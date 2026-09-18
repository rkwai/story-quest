import { z } from 'zod';
import { authenticate, checkDb, failure, readBody } from '@/server/db';
import { seedWorld, OPENING } from '@/engine/seed';
import { playerView } from '@/engine/view';
import { EngineError, type World } from '@/engine/types';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const { db, owner } = await authenticate(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      const { data, error } = await db.from('campaigns').select('id,title,revision,created_at,updated_at,archived_at').eq('owner_id', owner).order('created_at', { ascending: false });
      checkDb(error); return Response.json({ campaigns: data });
    }
    z.uuid().parse(id);
    const { data, error } = await db.from('campaigns').select('id,state,archived_at').eq('id', id).eq('owner_id', owner).single();
    if (error || !data) throw new EngineError('NOT_FOUND');
    const { data: turns, error: turnError } = await db.from('turns').select('public_result,narration').eq('campaign_id', id).eq('status','committed').order('revision', { ascending: false }).limit(100);
    checkDb(turnError);
    return Response.json({ id, view: playerView(data.state as World), opening: OPENING, archived: data.archived_at !== null, turns: turns?.reverse().map(t => ({ ...t.public_result, narration: t.narration })) ?? [] });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const { db, owner } = await authenticate(request);
    const { name, premise } = z.object({ name: z.string().trim().min(1).max(50), premise: z.string().trim().min(1).max(1600) }).parse(await readBody(request));
    const state = seedWorld(name, premise);
    // The public scripted sample's culprit must not predetermine a live mystery.
    state.facts = state.facts.filter(f => f.id !== 'cause');
    state.entities = state.entities.filter(e => e.id !== 'order');
    const { data, error } = await db.rpc('create_campaign', { p_owner: owner, p_title: state.title, p_state: state });
    checkDb(error);
    return Response.json({ id: data, view: playerView(state), opening: OPENING, archived: false, turns: [] });
  } catch (e) { return failure(e); }
}
