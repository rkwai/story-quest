import { createClient } from '@supabase/supabase-js';
import { EngineError } from '@/engine/types';

export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new EngineError('NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function authenticate(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new EngineError('UNAUTHORIZED');
  const db = database();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new EngineError('UNAUTHORIZED');
  return { db, owner: data.user.id };
}
export function checkDb(error: { message: string } | null) {
  if (!error) return;
  const code = ['NOT_FOUND','TURN_ID_REUSED','TURN_BUSY','STALE_REVISION','RATE_LIMIT','DAILY_LIMIT','LEASE_EXPIRED','NARRATION_BUSY','NARRATION_LIMIT','CAMPAIGN_LIMIT'].find(c => error.message.includes(c));
  throw new EngineError(code ?? 'PERSISTENCE_FAILED');
}
export async function trace(campaign: string, turn: string, stage: string, duration: number, details: Record<string, unknown>) {
  try {
    const { error } = await database().from('turn_traces').insert({ campaign_id: campaign, turn_id: turn, stage, duration_ms: Math.round(duration), details });
    if (error) console.error('trace_write_failed', { stage });
  } catch { console.error('trace_write_failed', { stage }); }
}
export function failure(error: unknown) {
  const code = error instanceof EngineError ? error.code : 'INVALID_REQUEST';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : code === 'NOT_CONFIGURED' ? 503 : ['RATE_LIMIT','DAILY_LIMIT'].includes(code) ? 429 : ['TURN_BUSY','STALE_REVISION','NARRATION_BUSY'].includes(code) ? 409 : 400;
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function readBody(request: Request) {
  const body = await request.text();
  if (body.length > 8000) throw new EngineError('INPUT_TOO_LARGE');
  return JSON.parse(body);
}
