import { z } from 'zod';
import { database, campaignAccess, requireSameOrigin, checkDb, failure, readBody, trace } from '@/server/db';
import { narrate } from '@/server/dm';
import { ModelCallError } from '@/server/openrouter';
import { EngineError } from '@/engine/types';
export const maxDuration = 60;
export async function POST(request: Request) {
  let active: { campaign: string; turn: string } | undefined;
  const started = performance.now();
  try {
    requireSameOrigin(request);
    const { campaignId, turnId } = z.object({ campaignId: z.uuid(), turnId: z.uuid() }).parse(await readBody(request));
    const { db, owner } = await campaignAccess(campaignId);
    const { data, error } = await db.rpc('reserve_narration', { p_campaign: campaignId, p_owner: owner, p_turn: turnId }); checkDb(error);
    if (data.narration) return Response.json({ narration: data.narration });
    active = { campaign: campaignId, turn: turnId };
    const answer = await narrate(data.view, data.turn);
    const { error: saveError } = await db.from('turns').update({ narration: answer.data.narration, narration_lease_until: null }).eq('campaign_id', campaignId).eq('id', turnId).is('narration',null);
    checkDb(saveError);
    await trace(campaignId, turnId, 'narration', answer.metrics.durationMs, answer.metrics);
    return Response.json(answer.data);
  } catch (e) {
    if (active) {
      await trace(active.campaign, active.turn, 'narration_failed', performance.now()-started, { code: e instanceof EngineError ? e.code : 'INVALID_RESPONSE', ...(e instanceof ModelCallError ? { modelCall: e.metrics } : {}) });
      await Promise.resolve(database().from('turns').update({ narration_lease_until: null }).eq('campaign_id', active.campaign).eq('id', active.turn)).catch(() => undefined);
    }
    return failure(e);
  }
}
