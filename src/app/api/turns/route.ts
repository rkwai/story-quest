import { z } from 'zod';
import { authenticate, checkDb, failure, readBody, trace } from '@/server/db';
import { propose, PROMPT_VERSION } from '@/server/dm';
import { ModelCallError } from '@/server/openrouter';
import { reviewProposal } from '@/server/typesafe';
import { buildContext } from '@/engine/context';
import { applyProposal } from '@/engine/reducer';
import { playerView, publicChanges } from '@/engine/view';
import { ENGINE_VERSION, EngineError, type World, type PublicTurn, type Proposal } from '@/engine/types';
export const maxDuration = 60;
const inputSchema = z.object({ campaignId: z.uuid(), turnId: z.uuid(), revision: z.number().int().min(0), input: z.string().trim().min(1).max(2000) });
export async function POST(request: Request) {
  let acquired: { campaign: string; owner: string; turn: string } | undefined;
  let candidate: Proposal | undefined;
  const start = performance.now();
  try {
    const { db, owner } = await authenticate(request);
    const body = inputSchema.parse(await readBody(request));
    const { data, error } = await db.rpc('reserve_turn', { p_campaign: body.campaignId, p_owner: owner, p_turn: body.turnId, p_input: body.input, p_revision: body.revision });
    checkDb(error);
    if (data.replayed) return Response.json({ turn: data.turn, replayed: true });
    acquired = { campaign: body.campaignId, owner, turn: body.turnId };
    const before = data.state as World;
    const context = buildContext(before, body.input);
    await trace(body.campaignId, body.turnId, 'context', performance.now()-start, { ...context.manifest, revision: before.revision, engineVersion: ENGINE_VERSION, promptVersion: PROMPT_VERSION });
    const answer = await propose(context.state, body.input);
    await trace(body.campaignId, body.turnId, 'proposal', answer.metrics.durationMs, answer.metrics);
    candidate = answer.data;
    const after = applyProposal(before, answer.data);
    const review = await reviewProposal(context.state, body.input, answer.data);
    await trace(body.campaignId, body.turnId, 'typesafe_review', review.durationMs, review);
    if (answer.data.kind === 'clarification') {
      const { error: releaseError } = await db.rpc('release_turn', { p_campaign: body.campaignId, p_owner: owner, p_turn: body.turnId }); checkDb(releaseError);
      await trace(body.campaignId, body.turnId, 'clarification', performance.now()-start, { proposal: answer.data });
      acquired = undefined;
      // The DM saw private facts. Its freeform question belongs in private traces only.
      return Response.json({ clarification: 'Could you be more specific about what you want to do or ask, and who or what it involves?' });
    }
    const turn: PublicTurn = { id: body.turnId, input: body.input, interpretation: `Your attempt: ${body.input}`, changes: publicChanges(before, after), narration: null, revision: after.revision };
    const { data: committed, error: commitError } = await db.rpc('commit_turn', { p_campaign: body.campaignId, p_owner: owner, p_turn: body.turnId, p_revision: before.revision, p_state: after, p_proposal: answer.data, p_result: turn, p_view: playerView(after), p_engine: ENGINE_VERSION });
    checkDb(commitError);
    acquired = undefined;
    await trace(body.campaignId, body.turnId, 'committed', performance.now()-start, { revision: after.revision, operationCount: answer.data.operations.length });
    return Response.json({ turn: committed, view: playerView(after) });
  } catch (e) {
    if (acquired) {
      await trace(acquired.campaign, acquired.turn, 'failed', performance.now()-start, { code: e instanceof EngineError ? e.code : 'INVALID_PROPOSAL', rejectedProposal: candidate ?? null, ...(e instanceof ModelCallError ? { modelCall: e.metrics } : {}) });
      await authenticate(request).then(({ db }) => db.rpc('release_turn', { p_campaign: acquired!.campaign, p_owner: acquired!.owner, p_turn: acquired!.turn })).catch(() => undefined);
    }
    return failure(e);
  }
}
