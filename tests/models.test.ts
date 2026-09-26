import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { propose, narrate } from '../src/server/dm';
import { ModelCallError } from '../src/server/openrouter';
import { seedWorld } from '../src/engine/seed';
import { playerView } from '../src/engine/view';
import { applyProposal } from '../src/engine/reducer';
import { buildContext } from '../src/engine/context';
import { proposalSchema, narrativeWireProposalSchema } from '../src/engine/types';
import duplicateDialogue from './fixtures/dialogue-duplicate-proposal.json';

const proposal = { kind: 'action', interpretation: 'You wait.', clarification: null, elapsedMinutes: 1, operations: [], itemActions: [], storyPlan: { focusQuestId: null, questUpdates: [], progress: [] } };
function config(t: TestContext) {
  const values = { OPENROUTER_API_KEY: 'test-private-key', STORY_MODEL: 'story/model', PROPOSAL_MODEL: 'planner/model', PROPOSAL_REASONING_EFFORT: 'low', STORY_REASONING_EFFORT: 'none' };
  const previous = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}
function envelope(content: string, finish = 'stop') {
  return { id: 'gen-fixture', model: 'resolved/model-version', provider: 'Example',
    choices: [{ finish_reason: finish, message: { content, reasoning: 'PRIVATE_REASONING' } }],
    usage: { prompt_tokens: 150, completion_tokens: 30, total_tokens: 180, cost: 0.001,
      completion_tokens_details: { reasoning_tokens: 10 }, raw_prompt: 'PRIVATE_PROMPT', secret: 'test-private-key' } };
}

test('proposal routes through OpenRouter with strict schema and sanitized billable metadata', async t => {
  config(t);
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer test-private-key');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body as string);
    assert.equal(body.model, 'planner/model');
    assert.equal(body.max_tokens, 5000);
    assert.equal(body.max_completion_tokens, undefined);
    assert.deepEqual(body.provider, { require_parameters: true });
    assert.deepEqual(body.reasoning, { effort: 'low', exclude: true });
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema, z.toJSONSchema(narrativeWireProposalSchema, { target: 'draft-7' }));
    assert.match(body.messages[1].content, /hidden-cause/);
    return Response.json(envelope(JSON.stringify(proposal)));
  });
  const result = await propose({ secret: 'hidden-cause' }, 'Wait briefly');
  assert.deepEqual(result.data, proposal);
  assert.equal(result.metrics.requestedModel, 'planner/model');
  assert.equal(result.metrics.model, 'resolved/model-version');
  assert.equal(result.metrics.providerGenerationId, 'gen-fixture');
  assert.equal(result.metrics.usage && (result.metrics.usage as Record<string, unknown>).costUsd, 0.001);
  assert.doesNotMatch(JSON.stringify(result.metrics), /PRIVATE_|test-private-key|hidden-cause/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('the live narrative schema has strict guidance and progress without suggested-action output', () => {
  const schema = z.toJSONSchema(narrativeWireProposalSchema, { target: 'draft-7' });
  const checked: string[][] = [];
  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const record = node as Record<string, unknown>;
    if (record.type === 'object') {
      const properties = Object.keys(record.properties as object ?? {}).sort();
      checked.push(properties);
      assert.equal(record.additionalProperties, false);
      assert.deepEqual([...(record.required as string[] ?? [])].sort(), properties);
    }
    Object.values(record).forEach(visit);
  }
  visit(schema);
  assert.ok(checked.some(properties => properties.includes('storyPlan')));
  assert.ok(checked.some(properties => properties.includes('questUpdates')));
  assert.ok(checked.every(properties => !properties.includes('leads')));
  assert.ok(checked.every(properties => !properties.includes('evidenceFactIds')));
  const updates = checked.find(properties => properties.includes('questId') && properties.includes('objective'));
  assert.deepEqual(updates, ['entityIds', 'objective', 'parentId', 'questId', 'scope', 'stakes']);
  assert.ok(checked.some(properties => properties.includes('claimIds')));
});

test('narration has a separate model, accepts prose and receives only player-visible knowledge', async t => {
  config(t);
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    assert.equal(body.model, 'story/model');
    assert.equal(body.response_format, undefined);
    assert.deepEqual(body.reasoning, { effort: 'none', exclude: true });
    assert.doesNotMatch(body.messages[1].content, /Hollow Choir|buried bell/);
    return Response.json(envelope('Rain threads the tower arch. The woman waits for your question.'));
  });
  const result = await narrate(playerView(seedWorld()), { id: 't1', input: 'Look around.', interpretation: 'Your attempt: Look around.', changes: [], narration: null, revision: 1 });
  assert.match(result.data.narration, /^Rain threads/);
});

test('truncation and invalid output retain usage without returning provider details or retrying', async t => {
  config(t);
  const responses = [envelope('', 'length'), envelope('{invalid'), envelope(JSON.stringify({ ...proposal, elapsedMinutes: -1 })), { error: { message: 'PRIVATE_ERROR' } }];
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(responses.shift()));
  for (const code of ['MODEL_INCOMPLETE', 'MODEL_INVALID_OUTPUT', 'MODEL_INVALID_OUTPUT', 'MODEL_UNAVAILABLE']) {
    await assert.rejects(propose({}, 'Look'), error => {
      assert.ok(error instanceof ModelCallError);
      assert.equal(error.code, code);
      assert.ok(error.metrics.generationId);
      assert.doesNotMatch(JSON.stringify(error), /PRIVATE_|test-private-key/);
      if (code !== 'MODEL_UNAVAILABLE') assert.equal((error.metrics.usage as Record<string, unknown>).costUsd, 0.001);
      return true;
    });
  }
  assert.equal(fetch.mock.callCount(), 4);
});

test('provider failures are sanitized and configuration never falls back to an old provider', async t => {
  config(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('PRIVATE_ERROR test-private-key', { status: 429 }));
  await assert.rejects(propose({}, 'Look'), error => {
    assert.ok(error instanceof ModelCallError);
    assert.equal(error.code, 'MODEL_UNAVAILABLE');
    assert.equal(error.metrics.httpStatus, 429);
    assert.doesNotMatch(JSON.stringify(error), /PRIVATE_|test-private-key/);
    return true;
  });
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(propose({}, 'Look'), /NOT_CONFIGURED/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('a non-reasoning storyteller works without a reasoning parameter', async t => {
  config(t);
  delete process.env.STORY_REASONING_EFFORT;
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(JSON.parse(options.body as string).reasoning, undefined);
    return Response.json(envelope('Rain settles on the road.'));
  });
  const result = await narrate(playerView(seedWorld()), { id: 't2', input: 'Wait', interpretation: 'Wait', changes: [], narration: null, revision: 1 });
  assert.equal(result.metrics.reasoningEffort, 'provider_default');
});

test('an OpenRouter key alone uses the accepted DeepSeek defaults for both stages', async t => {
  config(t);
  for (const key of ['STORY_MODEL', 'PROPOSAL_MODEL', 'PROPOSAL_REASONING_EFFORT', 'STORY_REASONING_EFFORT']) delete process.env[key];
  const requests: Record<string, unknown>[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    requests.push(body);
    return Response.json(envelope(body.response_format ? JSON.stringify(proposal) : 'Rain settles on the road.'));
  });
  await propose({}, 'Wait');
  await narrate(playerView(seedWorld()), { id: 'defaults', input: 'Wait', interpretation: 'Wait', changes: [], narration: null, revision: 1 });
  assert.deepEqual(requests.map(body => body.model), ['deepseek/deepseek-v4.1-flash', 'deepseek/deepseek-v4.1-flash']);
  assert.deepEqual(requests.map(body => body.reasoning), [{ effort: 'low', exclude: true }, { effort: 'none', exclude: true }]);
});

test('the recorded live dialogue failure is rejected atomically without silently deduplicating model output', async t => {
  config(t);
  // Adapt only the transport envelope; preserve the recorded invalid operations.
  const wire = { ...duplicateDialogue, itemActions: [], storyPlan: { focusQuestId: null, questUpdates: [], progress: [] }, operations: duplicateDialogue.operations.map(operation => ({ ...operation, entity: { ...operation.entity, itemState: null } })) };
  t.mock.method(globalThis, 'fetch', async () => Response.json(envelope(JSON.stringify(wire))));
  const world = seedWorld();
  const original = structuredClone(world);
  const input = 'I ask the woman, "What are you doing in this desolate area?"';
  const answer = await propose(buildContext(world, input).state, input);
  // The defect is semantic: this response fits the transport schema, but must
  // never be accepted or repaired by deleting inconvenient operations.
  assert.deepEqual(proposalSchema.parse(answer.data), duplicateDialogue);
  assert.equal(answer.data.operations.length, 3);
  assert.throws(() => applyProposal(world, answer.data), /DUPLICATE_ID/);
  assert.deepEqual(world, original);
});

test('an NPC answer is recorded as testimony with the original player question and no invented answer entity', async t => {
  config(t);
  const input = 'I ask the woman, "What are you doing in this desolate area?"';
  const reply = 'I keep watch here in case someone returns looking for their family.';
  const world = seedWorld();
  const context = { ...buildContext(world, input).state, recentTurns: [{ input: 'I approach her.', narration: 'You stand beneath the arch.' }] };
  const dialogue = { kind: 'action', interpretation: 'You ask the woman why she remains here.', clarification: null, elapsedMinutes: 1, itemActions: [], storyPlan: { focusQuestId: null, questUpdates: [], progress: [] },
    operations: [{ op: 'add_claim', claim: { id: 'mara_reason_1', speakerId: 'mara', text: reply, knownBy: ['player', 'mara'] } }] };
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    const supplied = JSON.parse(body.messages[1].content);
    assert.equal(supplied.input, input);
    assert.deepEqual(supplied.state.recentTurns, context.recentTurns);
    assert.equal(body.response_format.json_schema.strict, true);
    const branches = body.response_format.json_schema.schema.properties.operations.items.oneOf;
    assert.ok(branches.some((branch: { properties: { op: { const: string } } }) => branch.properties.op.const === 'add_claim'));
    assert.match(body.messages[0].content, /An answer, utterance, memory, relationship, motive or event is NOT an entity or faction/);
    return Response.json(envelope(JSON.stringify(dialogue)));
  });
  const result = await propose(context, input);
  const after = applyProposal(world, result.data);
  assert.deepEqual(after.entities, world.entities);
  assert.deepEqual(after.facts, world.facts);
  assert.equal(after.claims.length, 1);
  assert.equal(playerView(after).claims[0].text, reply);
  assert.equal(playerView(after).claims[0].speaker, 'The woman at the arch');
  assert.equal(after.revision, world.revision + 1);
});
