import { z } from 'zod';
import { authenticate, checkDb, failure, readBody } from '@/server/db';
import { OPENING } from '@/engine/seed';
import { playerView } from '@/engine/view';
import { EngineError, type World } from '@/engine/types';

export const dynamic = 'force-dynamic';
const resetSchema = z.object({ campaignId: z.uuid(), resetId: z.uuid() });

export async function POST(request: Request) {
  try {
    const { db, owner } = await authenticate(request);
    const { campaignId, resetId } = resetSchema.parse(await readBody(request));
    const { data, error } = await db.rpc('reset_campaign', {
      p_campaign: campaignId, p_owner: owner, p_reset: resetId,
    });
    checkDb(error);
    const [{ data: campaign, error: campaignError }, { data: turns, error: turnError }] = await Promise.all([
      db.from('campaigns').select('state,archived_at').eq('id', data.id).eq('owner_id', owner).single(),
      db.from('turns').select('public_result,narration').eq('campaign_id', data.id).eq('status', 'committed').order('revision', { ascending: false }).limit(100),
    ]);
    if (campaignError || !campaign) throw new EngineError('NOT_FOUND');
    checkDb(turnError);
    // The stored seed may include secrets; return only the character's view.
    return Response.json({ id: data.id, replayed: data.replayed, view: playerView(campaign.state as World), opening: OPENING, archived: campaign.archived_at !== null, turns: turns?.reverse().map(t => ({ ...t.public_result, narration: t.narration })) ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
