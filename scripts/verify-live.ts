/** Explicitly opt-in production smoke test. Never log credentials, links, or story data. */
import { randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicSupabaseConfig } from '../src/lib/supabase-public';
import { serverSupabaseConfig } from '../src/server/config';

const SITE = 'https://story-quest-seven.vercel.app';
const PROJECT = 'https://cpybqwezigwkhxldxwiv.supabase.co';
const WORK_BUDGET_MS = 150000;
const DIAGNOSTIC_BUDGET_MS = 25000;
const QA_EMAIL = 'storyquest-qa@example.com';
const INPUT = 'I examine the ruined archway without moving or speaking.';
const errorCodes = new Set(['NOT_CONFIGURED', 'UNAUTHORIZED', 'NOT_FOUND', 'TURN_ID_REUSED', 'TURN_BUSY', 'STALE_REVISION', 'RATE_LIMIT', 'DAILY_LIMIT', 'LEASE_EXPIRED', 'NARRATION_BUSY', 'NARRATION_LIMIT', 'CAMPAIGN_LIMIT', 'CAMPAIGN_ARCHIVED', 'PERSISTENCE_FAILED', 'INVALID_REQUEST', 'INVALID_PROPOSAL', 'INVALID_RESPONSE', 'MODEL_UNAVAILABLE', 'MODEL_INCOMPLETE', 'MODEL_INVALID_OUTPUT', 'CONTEXT_BUDGET_EXCEEDED']);
for (const code of ['INVALID_CLARIFICATION', 'ACTION_HAS_CLARIFICATION', 'UNKNOWN_ENTITY', 'DUPLICATE_ID', 'INVALID_OBSERVER', 'INVALID_CONDITION', 'ESTABLISHED_FACT', 'FUTURE_FACT', 'UNKNOWN_FACT', 'INVALID_NEW_QUEST', 'UNKNOWN_QUEST', 'QUEST_ALREADY_RESOLVED', 'INVALID_DEADLINE', 'UNKNOWN_PENDING_EVENT', 'EVENT_WITHOUT_OUTCOME', 'INVALID_EVENT_OUTCOME', 'INVALID_LOCATION', 'INVALID_OWNER', 'ITEM_TWO_LOCATIONS', 'INVALID_SPEAKER', 'UNRESOLVED_DEADLINE', 'INVALID_PLAYER']) errorCodes.add(code);
const stages = new Set(['context', 'proposal', 'typesafe_review', 'clarification', 'committed', 'failed', 'narration', 'narration_failed']);
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
class SmokeFailure extends Error { constructor(public code: string) { super(code); } }
const check: (condition: unknown, code: string) => asserts condition = (condition, code) => { if (!condition) throw new SmokeFailure(code); };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const label = (value: unknown) => typeof value === 'string' && /^~?[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(value) ? value : null;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const reports: Record<string, unknown>[] = [];
const log = (phase: string, status: string, extra: Record<string, unknown> = {}) => {
  const entry = { verification: 'live', phase, status, ...extra };
  reports.push(entry);
  console.log(JSON.stringify(entry));
};

function safeTrace(row: Record<string, unknown>) {
  const details = record(row.details);
  const nested = record(details.modelCall);
  const metrics = Object.keys(nested).length ? nested : details;
  const usage = record(metrics.usage);
  const http = number(metrics.httpStatus);
  const advisory = ['skipped', 'ok', 'unavailable', 'invalid'].includes(String(metrics.status)) ? metrics.status : null;
  return {
    stage: stages.has(String(row.stage)) ? row.stage : 'unknown', durationMs: number(row.duration_ms),
    provider: metrics.provider === 'openrouter' ? 'openrouter' : null,
    requestedModel: label(metrics.requestedModel), model: label(metrics.model),
    providerGenerationId: label(metrics.providerGenerationId),
    httpStatus: http !== null && Number.isInteger(http) && http >= 100 && http <= 599 ? http : null,
    finishReason: metrics.finishReason === 'stop' ? 'stop' : null,
    code: errorCodes.has(String(details.code)) ? details.code : null,
    advisoryStatus: advisory,
    usage: {
      inputTokens: number(usage.inputTokens ?? usage.input_tokens),
      outputTokens: number(usage.outputTokens ?? usage.output_tokens),
      totalTokens: number(usage.totalTokens), reasoningTokens: number(usage.reasoningTokens),
      cachedTokens: number(usage.cachedTokens), costUsd: number(usage.costUsd)
    }
  };
}

async function main() {
  if (!process.argv.includes('--execute')) {
    log('opt_in', 'skipped', { reason: 'Pass --execute --run-id=<UUID> to run one paid production turn with the retained QA account.' });
    return;
  }
  const runId = process.argv.find(arg => arg.startsWith('--run-id='))?.slice('--run-id='.length);
  check(z.uuid().safeParse(runId).success, 'RUN_ID_REQUIRED');
  const publicConfig = publicSupabaseConfig(), serverConfig = serverSupabaseConfig();
  check(publicConfig.url === PROJECT && serverConfig.url === PROJECT, 'PROJECT_MISMATCH');
  check(publicConfig.key && serverConfig.key && process.env.OPENROUTER_API_KEY?.trim(), 'NOT_CONFIGURED');
  const work = new AbortController();
  const workTimer = setTimeout(() => work.abort(), WORK_BUDGET_MS);
  let phase = 'preflight';
  let failed = false;
  let authRedirect = false;
  let qaUserId: string | undefined;
  let campaignId: string | undefined;
  let bearer: string | undefined;
  const turnId = randomUUID();
  const email = QA_EMAIL;
  const password = randomBytes(32).toString('base64url');

  function projectFetch(signal: AbortSignal, requestTimeout = 15000) {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      check(target.origin === PROJECT, 'PROJECT_REQUEST_MISMATCH');
      return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(requestTimeout), ...(init?.signal ? [init.signal] : [])]) });
    }) as typeof fetch;
  }
  const admin = createClient(PROJECT, serverConfig.key, { auth: authOptions, global: { fetch: projectFetch(work.signal) } });
  const publicClient = createClient(PROJECT, publicConfig.key, { auth: authOptions, global: { fetch: projectFetch(work.signal) } });
  async function hosted(path: string, body?: unknown, timeout = 15000) {
    check(path.startsWith('/api/'), 'HOSTED_PATH_INVALID');
    const response = await fetch(`${SITE}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      signal: AbortSignal.any([work.signal, AbortSignal.timeout(timeout)]),
      headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const code = record(payload).error;
      throw new SmokeFailure(errorCodes.has(String(code)) ? String(code) : 'HOSTED_API_FAILED');
    }
    return payload;
  }
  const campaignSchema = z.object({ id: z.uuid(), view: z.looseObject({ revision: z.number().int().nonnegative() }), turns: z.array(z.object({ id: z.string(), revision: z.number().int(), narration: z.string().nullable() })) });
  let verifiedFlow = false;
  let claimed = false;
  let resetVerified = false;
  try {
    // A durable unique claim prevents this exact opt-in from spending again on any rebuild.
    const claim = await admin.from('verification_runs').insert({ id: runId, status: 'running' });
    if (claim.error?.code === '23505') { log('one_time_guard', 'skipped', { reason: 'This run ID has already been used.' }); return; }
    check(!claim.error, 'RUN_CLAIM_FAILED');
    claimed = true;
    log('one_time_guard', 'passed');
    const health = record(await hosted('/api/health'));
    check(health.status === 'configured', 'HOSTED_NOT_CONFIGURED');
    log(phase, 'passed');

    phase = 'qa_identity';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { storyquest_qa: true } });
    check(!created.error || created.error.code === 'email_exists', 'QA_CREATE_FAILED');
    const sessionLink = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: SITE } });
    const qa = sessionLink.data.user;
    check(!sessionLink.error && qa?.email === email && qa.app_metadata.storyquest_qa === true && z.uuid().safeParse(qa.id).success, 'QA_IDENTITY_MISMATCH');
    qaUserId = qa.id;
    // Verify the generated OTP directly for a reusable session; no email or password is logged/stored.
    const signedIn = await publicClient.auth.verifyOtp({ token_hash: sessionLink.data.properties.hashed_token, type: 'email' });
    check(!signedIn.error && signedIn.data.user?.id === qaUserId && signedIn.data.session?.access_token, 'QA_SIGNIN_FAILED');
    bearer = signedIn.data.session.access_token;
    const identified = await admin.from('verification_runs').update({ qa_user_id: qaUserId }).eq('id', runId);
    check(!identified.error, 'RUN_RECORD_FAILED');
    log(phase, 'passed', { retained: true, reused: !!created.error });

    phase = 'auth_redirect';
    try {
      const generated = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: SITE } });
      check(!generated.error && generated.data.user?.id === qaUserId, 'QA_LINK_FAILED');
      const requestedRedirect = new URL(generated.data.properties.redirect_to);
      check(requestedRedirect.origin === SITE && requestedRedirect.pathname === '/' && !requestedRedirect.search, 'AUTH_REDIRECT_MISMATCH');
      const action = new URL(generated.data.properties.action_link);
      check(action.origin === PROJECT && action.pathname === '/auth/v1/verify', 'AUTH_LINK_TARGET_MISMATCH');
      // This request deliberately carries no admin key or bearer credentials.
      const verification = await fetch(action, { redirect: 'manual', signal: AbortSignal.any([work.signal, AbortSignal.timeout(15000)]) });
      check([301, 302, 303, 307, 308].includes(verification.status), 'AUTH_REDIRECT_RESPONSE_INVALID');
      const location = verification.headers.get('location');
      check(location, 'AUTH_REDIRECT_MISSING');
      const returned = new URL(location);
      const fragment = new URLSearchParams(returned.hash.slice(1));
      check(returned.origin === SITE && returned.pathname === '/' && !returned.search && !fragment.has('error'), 'AUTH_REDIRECT_MISMATCH');
      const linkBearer = fragment.get('access_token'), refresh = fragment.get('refresh_token');
      check(linkBearer && refresh, 'AUTH_SESSION_MISSING');
      const identity = await publicClient.auth.getUser(linkBearer);
      check(!identity.error && identity.data.user?.id === qaUserId, 'AUTH_SESSION_INVALID');
      bearer = linkBearer;
      authRedirect = true;
      log(phase, 'passed');
    } catch (error) {
      failed = true;
      log(phase, 'failed', { code: error instanceof SmokeFailure ? error.code : 'AUTH_REDIRECT_CHECK_FAILED', authRedirect: false });
      // Continue the same QA run with the already verified QA session.
    }

    phase = 'campaign';
    const listed = z.object({ campaigns: z.array(z.object({ id: z.uuid(), archived_at: z.string().nullable() })) }).parse(await hosted('/api/campaigns'));
    const active = listed.campaigns.find(c => c.archived_at === null);
    const campaign = campaignSchema.parse(active
      ? await hosted('/api/campaigns/reset', { campaignId: active.id, resetId: randomUUID() })
      : await hosted('/api/campaigns', { name: 'QA Traveler', premise: 'A quiet fantasy world where established history remains true. A traveler arrives at the ruined town of Ashford.' }));
    campaignId = campaign.id;
    const attached = await admin.from('verification_runs').update({ campaign_id: campaignId }).eq('id', runId);
    check(!attached.error, 'RUN_RECORD_FAILED');
    check(campaign.view.revision === 0 && campaign.turns.length === 0, 'CAMPAIGN_INITIAL_STATE_INVALID');
    log(phase, 'passed');
    const body = { campaignId, turnId, revision: campaign.view.revision, input: INPUT };

    phase = 'turn';
    const outcome = record(await hosted('/api/turns', body, 60000));
    check(!outcome.clarification, 'UNEXPECTED_CLARIFICATION');
    const turn = z.object({ id: z.uuid(), revision: z.number().int(), narration: z.string().nullable() }).parse(outcome.turn);
    check(turn.id === turnId && turn.revision === 1 && turn.narration === null, 'TURN_COMMIT_INVALID');
    check(record(outcome.view).revision === turn.revision, 'TURN_VIEW_INVALID');
    log(phase, 'passed', { revision: turn.revision });

    phase = 'narration';
    const narration = z.object({ narration: z.string().trim().min(1).max(3000) }).parse(await hosted('/api/narration', { campaignId, turnId }, 60000));
    log(phase, 'passed', { characters: narration.narration.length });

    phase = 'reload_and_replay';
    const beforeReplay = campaignSchema.parse(await hosted(`/api/campaigns?id=${campaignId}`));
    check(beforeReplay.view.revision === 1 && beforeReplay.turns.length === 1 && beforeReplay.turns[0].id === turnId && beforeReplay.turns[0].narration === narration.narration, 'RELOAD_INVALID');
    // Exercise database replay without another paid-capable HTTP turn request.
    const replay = await admin.rpc('reserve_turn', { p_campaign: campaignId, p_owner: qaUserId, p_turn: turnId, p_input: INPUT, p_revision: 0 });
    check(!replay.error, 'REPLAY_INVALID');
    const replayed = record(replay.data);
    check(replayed.replayed === true && record(replayed.turn).id === turnId && record(replayed.turn).revision === 1, 'REPLAY_INVALID');
    const afterReplay = campaignSchema.parse(await hosted(`/api/campaigns?id=${campaignId}`));
    check(afterReplay.view.revision === 1 && afterReplay.turns.length === 1 && afterReplay.turns[0].narration === narration.narration, 'REPLAY_MUTATED_WORLD');
    log(phase, 'passed', { revision: afterReplay.view.revision, turns: afterReplay.turns.length });

    phase = 'private_data_isolation';
    const browser = createClient(PROJECT, publicConfig.key, { auth: authOptions, global: { fetch: projectFetch(work.signal), headers: { Authorization: `Bearer ${bearer}` } } });
    for (const table of ['campaigns', 'turn_traces'] as const) {
      const query = browser.from(table).select('id').eq(table === 'campaigns' ? 'id' : 'campaign_id', campaignId).limit(1);
      const result = await query;
      check((result.error?.code === '42501' && !result.data) || (!result.error && Array.isArray(result.data) && result.data.length === 0), 'PRIVATE_DATA_ACCESSIBLE');
    }
    log(phase, 'passed');
    verifiedFlow = true;

    phase = 'reset';
    const resetId = randomUUID();
    const resetBody = { campaignId, resetId };
    const fresh = campaignSchema.parse(await hosted('/api/campaigns/reset', resetBody));
    check(fresh.id !== campaignId && fresh.view.revision === 0 && fresh.turns.length === 0 && isDeepStrictEqual(fresh.view, campaign.view), 'RESET_STATE_INVALID');
    const resetReplay = record(await hosted('/api/campaigns/reset', resetBody));
    check(resetReplay.id === fresh.id && resetReplay.replayed === true, 'RESET_REPLAY_INVALID');
    const old = record(await hosted(`/api/campaigns?id=${campaignId}`));
    check(old.archived === true && record(old.view).revision === 1 && campaignSchema.parse(old).turns[0]?.narration === narration.narration, 'RESET_HISTORY_CHANGED');
    const archivedAttempt = await admin.rpc('reserve_turn', { p_campaign: campaignId, p_owner: qaUserId, p_turn: randomUUID(), p_input: INPUT, p_revision: 1 });
    check(archivedAttempt.error?.message.includes('CAMPAIGN_ARCHIVED'), 'ARCHIVED_CAMPAIGN_NOT_PROTECTED');
    const resetReload = campaignSchema.parse(await hosted(`/api/campaigns?id=${fresh.id}`));
    check(resetReload.view.revision === 0 && resetReload.turns.length === 0, 'RESET_RELOAD_INVALID');
    resetVerified = true;
    log(phase, 'passed', { freshRevision: 0, preservedRevision: 1, replayed: true });
  } catch (error) {
    failed = true;
    log(phase, 'failed', { code: error instanceof SmokeFailure ? error.code : work.signal.aborted ? 'WORK_BUDGET_EXCEEDED' : 'VERIFICATION_FAILED' });
  } finally {
    clearTimeout(workTimer);
    work.abort();
    const diagnostic = new AbortController();
    const diagnosticTimer = setTimeout(() => diagnostic.abort(), DIAGNOSTIC_BUDGET_MS);
    const diagnosticAdmin: SupabaseClient = createClient(PROJECT, serverConfig.key, { auth: authOptions, global: { fetch: projectFetch(diagnostic.signal, 8000) } });
    try {
      if (campaignId) {
        try {
          const traces = await diagnosticAdmin.from('turn_traces').select('stage,duration_ms,details').eq('campaign_id', campaignId).eq('turn_id', turnId).order('created_at').limit(20);
          check(!traces.error && Array.isArray(traces.data), 'TRACE_READ_FAILED');
          const metrics = traces.data.map(row => safeTrace(row));
          log('provider_traces', 'captured', { metrics });
          if (verifiedFlow) {
            for (const stage of ['proposal', 'narration']) {
              const calls = metrics.filter(row => row.stage === stage);
              check(calls.length === 1 && calls[0].provider === 'openrouter' && calls[0].model && calls[0].providerGenerationId && calls[0].httpStatus === 200 && calls[0].finishReason === 'stop' && calls[0].usage.inputTokens !== null, 'PROVIDER_EVIDENCE_MISSING');
            }
            const review = metrics.find(row => row.stage === 'typesafe_review');
            check(review && review.advisoryStatus, 'JEV_TRACE_MISSING');
            log('provider_validation', 'passed', { typesafeStatus: review.advisoryStatus });
          }
        } catch (error) {
          failed = true;
          log('provider_traces', 'failed', { code: error instanceof SmokeFailure ? error.code : 'TRACE_VERIFICATION_FAILED' });
        }
      }
      if (qaUserId) log('retention', 'passed', { accountRetained: true, historyRetained: true });
      if (claimed) {
        log('complete', failed ? 'failed' : 'passed', { authRedirect, verifiedFlow, resetVerified });
        const recorded = await diagnosticAdmin.from('verification_runs').update({
          status: failed ? 'failed' : 'passed', qa_user_id: qaUserId ?? null, campaign_id: campaignId ?? null,
          finished_at: new Date().toISOString(), result: { authRedirect, verifiedFlow, resetVerified, reports }
        }).eq('id', runId);
        if (recorded.error) { failed = true; log('run_record', 'failed', { code: 'RUN_RECORD_FAILED' }); }
      }
    } finally { clearTimeout(diagnosticTimer); diagnostic.abort(); }
  }
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  log('configuration', 'failed', { code: error instanceof SmokeFailure ? error.code : 'VERIFICATION_FAILED' });
  process.exitCode = 1;
});
