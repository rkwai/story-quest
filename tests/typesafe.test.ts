import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { Proposal } from '../src/engine/types';
import {
  inputModeAnswerSchema, reviewProposal, safeTypeSafeUsage,
  TYPESAFE_PROMPT_VERSION, TYPESAFE_STATE_LIMIT, TYPESAFE_TIMEOUT_MS
} from '../src/server/typesafe';

const proposal: Proposal = { kind: 'action', interpretation: 'Investigate the ruins.', clarification: null, elapsedMinutes: 5, operations: [] };
const privateContext = { facts: ['PRIVATE-WORLD-TRUTH'], rules: [] };

function configure(t: TestContext, overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    OPENROUTER_API_KEY: 'test-openrouter-key', TYPESAFE_API_KEY: 'unused-native-key', TYPESAFE_MODEL: undefined, TYPESAFE_MODE: undefined,
    TYPESAFE_BASE_URL: 'https://unexpected-provider.invalid', TYPESAFE_DEFAULT_MODEL: 'unexpected-model', TYPESAFE_LOG_LEVEL: 'debug',
    ...overrides
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

function envelope() {
  return {
    model: 'typesafe/jev-1.13', id: 'gen-jev-123', provider: 'TypeSafe',
    answers: {
      inputMode: { type: 'choice', choice: 'action', confidence: 0.9, probabilities: { action: 0.9, dialogue: 0.05, question: 0.03, meta: 0.01, unclear: 0.01 } },
      immutableHistoryConcern: { type: 'noul', noul: 0.02 },
      worldRuleConcern: { type: 'noul', noul: 0.04 },
      unjustifiedKnowledgeConcern: { type: 'noul', noul: 0.8 }
    },
    usage: { input_tokens: 345, output_tokens: 0, cost: 0.00001449 }
  };
}

test('Jev shadow is skipped with no key or explicitly off and never makes a call', async t => {
  configure(t, { OPENROUTER_API_KEY: undefined });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected network call'); });
  assert.equal((await reviewProposal(privateContext, 'Look', proposal)).status, 'skipped');
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  process.env.TYPESAFE_MODE = 'off';
  assert.equal((await reviewProposal(privateContext, 'Look', proposal)).status, 'skipped');
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Jev uses one explicit OpenRouter Decisions batch and strips private provider metadata', async t => {
  configure(t);
  const logs = ['debug', 'info', 'warn', 'error'].map(method => t.mock.method(console, method as 'debug', () => undefined));
  const payload = { ...envelope(), reasoning: 'PRIVATE-REASONING', prompt: 'PRIVATE-PROMPT', usage: { ...envelope().usage, reasoning: 'PRIVATE-USAGE-REASONING' } };
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
    assert.ok(init?.signal instanceof AbortSignal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, '~typesafe/jev-latest');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-openrouter-key');
    assert.deepEqual(Object.keys(body.questions), ['inputMode', 'immutableHistoryConcern', 'worldRuleConcern', 'unjustifiedKnowledgeConcern']);
    assert.deepEqual(JSON.parse(body.state), { context: privateContext, input: 'Look', proposal });
    assert.equal(body.questions.inputMode.type, 'choice');
    assert.equal(body.questions.immutableHistoryConcern.type, 'noul');
    return Response.json(payload);
  });
  const original = structuredClone({ privateContext, proposal });
  const result = await reviewProposal(privateContext, 'Look', proposal);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(result.status, 'ok');
  assert.equal(result.requestedModel, '~typesafe/jev-latest');
  assert.equal(result.model, 'typesafe/jev-1.13');
  assert.equal(result.servedBy, 'TypeSafe');
  assert.equal(result.providerGenerationId, 'gen-jev-123');
  assert.match(result.generationId, /^[a-f0-9-]{36}$/);
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.promptVersion, TYPESAFE_PROMPT_VERSION);
  assert.equal(result.answers?.inputMode.choice, 'action');
  assert.deepEqual(result.answers?.unjustifiedKnowledgeConcern, { probability: 0.8 });
  assert.deepEqual(result.usage, { input_tokens: 345, output_tokens: 0, costUsd: 0.00001449 });
  assert.ok(Number.isFinite(result.durationMs));
  assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
  assert.deepEqual({ privateContext, proposal }, original);
  assert.ok(logs.every(log => log.mock.callCount() === 0));
});

test('configured Jev model is explicit and unsafe configuration or oversized context makes no call', async t => {
  configure(t, { TYPESAFE_MODEL: 'typesafe/jev-1.13' });
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(JSON.parse(String(init?.body)).model, 'typesafe/jev-1.13');
    return Response.json(envelope());
  });
  assert.equal((await reviewProposal(privateContext, 'Look', proposal)).requestedModel, 'typesafe/jev-1.13');
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal((await reviewProposal('x'.repeat(TYPESAFE_STATE_LIMIT), 'Look', proposal)).status, 'invalid');
  const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
  assert.equal((await reviewProposal(cyclic, 'Look', proposal)).status, 'invalid');
  process.env.TYPESAFE_MODEL = 'PRIVATE-SECRET\ninvalid';
  const invalid = await reviewProposal(privateContext, 'Look', proposal);
  assert.equal(invalid.status, 'invalid');
  assert.ok(!JSON.stringify(invalid).includes('PRIVATE-'));
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('story progression and player intent are reviewed in the existing single advisory batch', async t => {
  configure(t);
  const planned = { ...proposal, itemActions: [], storyPlan: { focusQuestId: null, questUpdates: [], progress: [] } };
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(Object.keys(body.questions).length, 6);
    assert.equal(body.questions.storyProgressConcern.type, 'noul');
    assert.equal(body.questions.storyIntentConcern.type, 'noul');
    return Response.json({ ...envelope(), answers: { ...envelope().answers,
      storyProgressConcern: { type: 'noul', noul: 0.7 }, storyIntentConcern: { type: 'noul', noul: 0.9 }
    } });
  });
  const before = structuredClone(planned);
  const result = await reviewProposal(privateContext, 'Why is she here?', planned);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.answers?.storyProgressConcern, { probability: 0.7 });
  assert.deepEqual(result.answers?.storyIntentConcern, { probability: 0.9 });
  assert.deepEqual(planned, before, 'Advisory judgments never alter a plan');
});

test('gateway choice confidence may be absent and only reported finite costs are retained', async t => {
  configure(t);
  let cost: unknown = undefined;
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    ...envelope(), usage: { input_tokens: 100, output_tokens: 0, cost },
    answers: { ...envelope().answers, inputMode: { type: 'choice', choice: 'action' } }
  }));
  for (const value of [undefined, -1, 'PRIVATE-COST-DETAIL', Infinity]) {
    cost = value;
    const result = await reviewProposal(privateContext, 'Look', proposal);
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.answers?.inputMode, { choice: 'action' });
    assert.equal(result.usage?.costUsd, null);
    assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
  }
  cost = 0;
  assert.equal((await reviewProposal(privateContext, 'Look', proposal)).usage?.costUsd, 0);
});

test('gateway sparse probability maps preserve reported keys without inventing zeroes', async t => {
  configure(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    ...envelope(), answers: {
      ...envelope().answers,
      inputMode: { type: 'choice', choice: 'action', probabilities: { action: 0.8, dialogue: 0.2 } }
    }
  }));
  const result = await reviewProposal(privateContext, 'Look', proposal);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.answers?.inputMode, { choice: 'action', probabilities: { action: 0.8, dialogue: 0.2 } });
  assert.equal(result.answers?.inputMode.probabilities?.question, undefined);
  assert.equal(result.answers?.inputMode.confidence, undefined);
});

test('invalid answers, probability keys, confidence and token counts are never treated as valid metadata', async t => {
  configure(t);
  let payload: unknown = envelope();
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const malformed = [
    { ...envelope().answers, inputMode: { ...envelope().answers.inputMode, choice: 'PRIVATE-UNEXPECTED-CHOICE' } },
    { ...envelope().answers, inputMode: { ...envelope().answers.inputMode, confidence: 1.1 } },
    { ...envelope().answers, inputMode: { ...envelope().answers.inputMode, confidence: Number.NaN } },
    { ...envelope().answers, inputMode: { ...envelope().answers.inputMode, probabilities: { action: -0.1 } } },
    { ...envelope().answers, inputMode: { ...envelope().answers.inputMode, probabilities: { ...envelope().answers.inputMode.probabilities, secret: 0 } } },
    { ...envelope().answers, immutableHistoryConcern: { type: 'noul', noul: -0.1 } },
    { ...envelope().answers, unjustifiedKnowledgeConcern: { type: 'noul', noul: Infinity } },
    { ...envelope().answers, injectedReasoning: 'PRIVATE-REASONING' }
  ];
  for (const answers of malformed) {
    payload = { ...envelope(), answers };
    const result = await reviewProposal(privateContext, 'Look', proposal);
    assert.equal(result.status, 'invalid');
    assert.equal(result.answers, undefined);
    assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
  }
  assert.equal(inputModeAnswerSchema.safeParse({ ...envelope().answers.inputMode, confidence: NaN }).success, false);
  assert.equal(safeTypeSafeUsage({ input_tokens: -1, output_tokens: 1 }), null);
  assert.equal(safeTypeSafeUsage({ input_tokens: 1, output_tokens: Infinity }), null);
  assert.equal(safeTypeSafeUsage({ input_tokens: 1.2, output_tokens: 1 }), null);
  payload = { ...envelope(), model: { reasoning: 'PRIVATE-REASONING' }, usage: { input_tokens: -1, output_tokens: 1, secret: 'PRIVATE-KEY' } };
  const result = await reviewProposal(privateContext, 'Look', proposal);
  assert.equal(result.status, 'ok');
  assert.equal(result.model, undefined);
  assert.equal(result.usage, null);
  assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
});

test('Jev provider failures are sanitized and retryable errors are never retried', async t => {
  configure(t);
  const logs = ['debug', 'info', 'warn', 'error'].map(method => t.mock.method(console, method as 'debug', () => undefined));
  let scenario: 'http' | 'transport' = 'http';
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    if (scenario === 'transport') throw new Error('PRIVATE-TRANSPORT-SECRET');
    return Response.json({ error: { message: 'PRIVATE-PROVIDER-SECRET', prompt: 'PRIVATE-PROMPT' } }, { status: 503 });
  });
  for (const value of ['http', 'transport'] as const) {
    scenario = value;
    const result = await reviewProposal(privateContext, 'Look', proposal);
    assert.equal(result.status, 'unavailable');
    assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
  }
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.ok(logs.every(log => log.mock.callCount() === 0));
});

test('Jev cancels a stalled gateway request at four seconds without retrying', async t => {
  configure(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let aborted = false;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('PRIVATE-TIMEOUT-DETAIL')); }, { once: true });
  }));
  const pending = reviewProposal(privateContext, 'Look', proposal);
  t.mock.timers.tick(TYPESAFE_TIMEOUT_MS - 1);
  assert.equal(aborted, false);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(aborted, true);
  assert.equal(result.status, 'unavailable');
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
});
