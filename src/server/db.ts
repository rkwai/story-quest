import { createClient } from '@supabase/supabase-js';
import { EngineError } from '@/engine/types';
import { serverSupabaseConfig } from '@/server/config';

export function database() {
  const { url, key } = serverSupabaseConfig();
  if (!url || !key) throw new EngineError('NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
// Playtest adventures are deliberately shared. Owner IDs remain internal RPC
// scopes for existing saves, not identities supplied or authenticated by clients.
export async function campaignAccess(campaignId: string, db = database()) {
  const { data, error } = await db.from('campaigns').select('owner_id').eq('id', campaignId).maybeSingle();
  checkDb(error);
  if (!data) throw new EngineError('NOT_FOUND');
  return { db, owner: data.owner_id as string };
}
export async function playtestScope(db = database()) {
  const { data, error } = await db.from('playtest_scope').select('id').eq('singleton', true).single();
  checkDb(error);
  if (!data) throw new EngineError('NOT_CONFIGURED');
  return { db, owner: data.id as string };
}
export function requireSameOrigin(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Next's development URL may use 0.0.0.0 while the browser uses localhost.
  // Host is the browser-addressed authority; browsers cannot override it.
  const expectedOrigin = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (site === 'cross-site' || site === 'same-site' || (origin !== null && origin !== expectedOrigin)) {
    throw new EngineError('CROSS_ORIGIN_REQUEST');
  }
  // JSON also prevents cross-site HTML forms from causing a mutation when
  // Fetch Metadata is absent. Non-browser clients can still use this open API.
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new EngineError('INVALID_CONTENT_TYPE');
  }
}
export function checkDb(error: { message: string } | null) {
  if (!error) return;
  const code = ['NOT_FOUND','TURN_ID_REUSED','RESET_ID_REUSED','CAMPAIGN_ARCHIVED','TURN_BUSY','STALE_REVISION','RATE_LIMIT','DAILY_LIMIT','LEASE_EXPIRED','NARRATION_BUSY','NARRATION_LIMIT','CAMPAIGN_LIMIT'].find(c => error.message.includes(c));
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
  const status = code === 'CROSS_ORIGIN_REQUEST' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'NOT_CONFIGURED' ? 503 : ['RATE_LIMIT','DAILY_LIMIT'].includes(code) ? 429 : ['TURN_BUSY','STALE_REVISION','NARRATION_BUSY','CAMPAIGN_ARCHIVED','RESET_ID_REUSED','CAMPAIGN_LIMIT'].includes(code) ? 409 : 400;
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function readBody(request: Request) {
  const body = await request.text();
  if (body.length > 8000) throw new EngineError('INPUT_TOO_LARGE');
  return JSON.parse(body);
}
