import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { propose, narrate } from '../src/server/dm';
import { ModelCallError } from '../src/server/openrouter';
import { failure } from '../src/server/db';
import { POST as turnPost } from '../src/app/api/turns/route';
import { seedWorld } from '../src/engine/seed';
import { playerView } from '../src/engine/view';

const proposal = { kind: 'action', interpretation: 'You wait.', clarification: null, elapsedMinutes: 1, operations: [] };
const envelope = { id: 'gen-delayed', model: 'planner/model', provider: 'Fixture',
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(proposal) } }] };
function setup(t: TestContext) {
  const values = { OPENROUTER_API_KEY: 'fixture-private-key', STORY_MODEL: 'story/model', PROPOSAL_MODEL: 'planner/model',
    PROPOSAL_REASONING_EFFORT: 'low', STORY_REASONING_EFFORT: 'none', TYPESAFE_MODE: 'off',
    NEXT_PUBLIC_SUPABASE_URL: 'https://timeout-fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture-server-key' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  t.mock.timers.enable({ apis: ['setTimeout'] });
}
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
// HTTP headers can arrive immediately while the provider is still generating.
// Emulate fetch body cancellation as well as delayed successful delivery.
function delayedBody(signal: AbortSignal, delay: number, started: () => void): Response {
  return {
    ok: true, status: 200,
    json: () => {
      started();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve(envelope);
        }, delay);
        const abort = () => { clearTimeout(timeout); reject(signal.reason); };
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      });
    },
  } as Response;
}

test('a proposal arriving after the former cutoff succeeds once and cleans up its deadline', async t => {
  setup(t);
  const body = latch();
  let signal!: AbortSignal;
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    signal = options.signal!;
    return delayedBody(signal, 90_000, body.resolve);
  });
  const pending = propose({}, 'Wait briefly');
  await body.promise;
  t.mock.timers.tick(45_001);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(44_999);
  const result = await pending;
  assert.deepEqual(result.data, proposal);
  assert.equal(result.metrics.timeoutMs, 120_000);
  assert.equal(result.metrics.httpStatus, 200);
  assert.equal(typeof result.metrics.headersMs, 'number');
  t.mock.timers.tick(120_000);
  assert.equal(signal.aborted, false, 'a finished call must cancel its deadline timer');
  assert.equal(fetch.mock.callCount(), 1);
});

test('a stalled HTTP 200 body times out explicitly without another generation', async t => {
  setup(t);
  const body = latch();
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) =>
    delayedBody(options.signal!, 200_000, body.resolve));
  const pending = propose({}, 'Look');
  await body.promise;
  const rejected = assert.rejects(pending, error => {
    assert.ok(error instanceof ModelCallError);
    assert.equal(error.code, 'MODEL_TIMEOUT');
    assert.equal(error.metrics.failureKind, 'timeout');
    assert.equal(error.metrics.responsePhase, 'body');
    assert.equal(error.metrics.httpStatus, 200);
    assert.equal(error.metrics.timeoutMs, 120_000);
    assert.equal(failure(error).status, 504);
    assert.doesNotMatch(JSON.stringify(error), /fixture-private-key|fixture-server-key/);
    return true;
  });
  t.mock.timers.tick(120_000);
  await rejected;
  assert.equal(fetch.mock.callCount(), 1);
});

test('a timeout before HTTP headers is distinguishable from a stalled response body', async t => {
  setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true })));
  const rejected = assert.rejects(propose({}, 'Look'), error => {
    assert.ok(error instanceof ModelCallError);
    assert.equal(error.code, 'MODEL_TIMEOUT');
    assert.equal(error.metrics.responsePhase, 'headers');
    assert.equal(error.metrics.httpStatus, undefined);
    return true;
  });
  t.mock.timers.tick(120_000);
  await rejected;
  assert.equal(fetch.mock.callCount(), 1);
});

test('narration retains its separate 45 second budget', async t => {
  setup(t);
  const body = latch();
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) =>
    delayedBody(options.signal!, 200_000, body.resolve));
  const pending = narrate(playerView(seedWorld()), { id: 'narration', input: 'Look', interpretation: 'Look', changes: [], narration: null, revision: 1 });
  await body.promise;
  const rejected = assert.rejects(pending, error => {
    assert.ok(error instanceof ModelCallError);
    assert.equal(error.code, 'MODEL_TIMEOUT');
    assert.equal(error.metrics.timeoutMs, 45_000);
    return true;
  });
  t.mock.timers.tick(45_000);
  await rejected;
  assert.equal(fetch.mock.callCount(), 1);
});

test('a world-planning timeout persists diagnostics, releases the lease and never commits', async t => {
  setup(t);
  const body = latch();
  const campaign = '11111111-1111-4111-8111-111111111111';
  const turn = '22222222-2222-4222-8222-222222222222';
  const owner = '33333333-3333-4333-8333-333333333333';
  const paths: string[] = [], traces: { stage: string; details: Record<string, unknown> }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    if (url.hostname === 'openrouter.ai') return delayedBody(options!.signal!, 200_000, body.resolve);
    if (url.pathname === '/rest/v1/campaigns') return Response.json({ owner_id: owner });
    if (url.pathname === '/rest/v1/rpc/reserve_turn') return Response.json({ replayed: false, state: seedWorld() });
    if (url.pathname === '/rest/v1/turn_traces') { traces.push(JSON.parse(String(options?.body))); return new Response(null, { status: 201 }); }
    if (url.pathname === '/rest/v1/rpc/release_turn') return new Response(null, { status: 204 });
    throw new Error('Unexpected request: ' + url.pathname);
  });
  const request = new Request('https://story.example/api/turns', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://story.example' },
    body: JSON.stringify({ campaignId: campaign, turnId: turn, revision: 0, input: 'Look' }) });
  const pending = turnPost(request);
  await body.promise;
  t.mock.timers.tick(120_000);
  const response = await pending;
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'MODEL_TIMEOUT' });
  assert.equal(paths.filter(path => path === '/api/v1/chat/completions').length, 1);
  assert.equal(paths.filter(path => path === '/rest/v1/rpc/release_turn').length, 1);
  assert.equal(paths.includes('/rest/v1/rpc/commit_turn'), false);
  assert.equal(paths.includes('/rest/v1/turns'), false, 'revision zero needs no conversation query');
  assert.deepEqual(traces.map(trace => trace.stage), ['context', 'failed']);
  assert.equal(traces[1].details.code, 'MODEL_TIMEOUT');
  assert.equal((traces[1].details.modelCall as Record<string, unknown>).responsePhase, 'body');
});
