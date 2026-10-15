import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { POST as turnPost } from '../src/app/api/turns/route';
import { seedWorld } from '../src/engine/seed';
import { replayVersioned } from '../src/engine/inventory';
import { proposalRequestFingerprint } from '../src/server/proposal-retry';
import type { PublicTurn, NarrativeProposal, World } from '../src/engine/types';

const campaignId = '11111111-1111-4111-8111-111111111111';
const turnId = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
const proposal: NarrativeProposal = {
  kind: 'action', interpretation: 'You ask what to investigate next.', clarification: null,
  elapsedMinutes: 1, operations: [], itemActions: [],
  storyPlan: { focusQuestId: 'mystery', questUpdates: [], progress: [] },
};
type Trace = { campaign_id: string; turn_id: string; stage: string; details: Record<string, unknown> };
type Commit = { p_state: World; p_proposal: NarrativeProposal; p_result: PublicTurn; p_engine: string };

function request(input: string, revision = 0, options: { retry?: boolean; itemId?: string; campaignId?: string; turnId?: string } = {}) {
  return new Request('https://story.example/api/turns', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://story.example' },
    body: JSON.stringify({ campaignId, turnId, revision, input, ...options }),
  });
}
function legacyWorld() {
  const world = seedWorld();
  delete world.story;
  for (const quest of world.quests) delete quest.guidance;
  return world;
}
function setup(t: TestContext, candidate: unknown, state = legacyWorld(), options: { traceReadFailure?: 'response' | 'throw' } = {}) {
  const { traceReadFailure } = options;
  const values = {
    OPENROUTER_API_KEY: 'fixture-story-private-key', STORY_MODEL: 'story/model', PROPOSAL_MODEL: 'planner/model',
    PROPOSAL_REASONING_EFFORT: 'low', STORY_REASONING_EFFORT: 'none', TYPESAFE_MODE: 'shadow',
    NEXT_PUBLIC_SUPABASE_URL: 'https://story-fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture-server-key',
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const paths: string[] = [], traces: Trace[] = [], commits: Commit[] = [];
  const modelRequests: Record<string, unknown>[] = [], unexpected: string[] = [];
  const traceReads: URL[] = [];
  t.after(() => assert.deepEqual(unexpected, [], 'all network requests must be explicitly mocked'));
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    if (url.hostname === 'openrouter.ai' && url.pathname === '/api/v1/chat/completions') {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.model, 'planner/model', 'the state route must not call the narrator');
      modelRequests.push(body);
      return Response.json({ id: 'gen-story-fixture', model: 'planner/model', provider: 'Fixture',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(candidate) } }],
        usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130, cost: 0.001 },
      });
    }
    if (url.hostname === 'openrouter.ai' && url.pathname === '/api/alpha/decisions') {
      return Response.json({ id: 'jev-story-fixture', model: '~typesafe/jev-latest', usage: { input_tokens: 100, output_tokens: 10, cost: 0 },
        answers: { inputMode: { type: 'choice', choice: 'action' }, immutableHistoryConcern: { type: 'noul', noul: 0 },
          worldRuleConcern: { type: 'noul', noul: 0 }, unjustifiedKnowledgeConcern: { type: 'noul', noul: 0 } },
      });
    }
    if (url.pathname === '/rest/v1/campaigns') return Response.json({ owner_id: owner });
    if (url.pathname === '/rest/v1/rpc/reserve_turn') return Response.json(commits.length
      ? { replayed: true, turn: commits[0].p_result }
      : { replayed: false, state });
    if (url.pathname === '/rest/v1/turns') return Response.json([]);
    if (url.pathname === '/rest/v1/turn_traces') {
      if (options === undefined) throw new Error('Fixture request options were missing');
      if (!options.body) {
        traceReads.push(url);
        assert.equal(url.searchParams.get('select'), 'details');
        assert.equal(url.searchParams.get('stage'), 'eq.failed');
        assert.equal(url.searchParams.get('order'), 'id.desc');
        assert.equal(url.searchParams.get('limit'), '1');
        if (traceReadFailure === 'throw') throw new Error('Fixture diagnostics unavailable');
        if (traceReadFailure === 'response') return Response.json({ message: 'Fixture diagnostics unavailable' }, { status: 503 });
        return Response.json(traces.filter(trace => trace.stage === 'failed'
          && `eq.${trace.campaign_id}` === url.searchParams.get('campaign_id')
          && `eq.${trace.turn_id}` === url.searchParams.get('turn_id')).slice(-1).map(trace => ({ details: trace.details })));
      }
      traces.push(JSON.parse(String(options?.body)));
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/rpc/release_turn') return new Response(null, { status: 204 });
    if (url.pathname === '/rest/v1/rpc/commit_turn') {
      const body = JSON.parse(String(options?.body)) as Commit;
      commits.push(body);
      return Response.json(body.p_result);
    }
    unexpected.push(`${url.hostname}${url.pathname}`);
    throw new Error('Unexpected fixture request');
  });
  return { paths, traces, commits, modelRequests, traceReads, setCandidate(next: unknown) { candidate = next; } };
}
function assertUncommitted(fixture: ReturnType<typeof setup>) {
  assert.equal(fixture.modelRequests.length, 1);
  assert.equal(fixture.commits.length, 0);
  assert.equal(fixture.paths.filter(path => path === '/rest/v1/rpc/release_turn').length, 1);
  assert.equal(fixture.paths.includes('/api/alpha/decisions'), false, 'invalid story plans fail before advisory review');
  assert.equal(fixture.traces.some(trace => trace.stage === 'typesafe_review' || trace.stage === 'committed'), false);
}
function direction(): NarrativeProposal['storyPlan']['questUpdates'][number] {
  return {
    questId: 'mystery', scope: 'local', parentId: null,
    objective: 'Investigate the surviving tower.', stakes: 'Someone in Ashford may still need help.',
    entityIds: ['ashford', 'tower', 'mara'],
  };
}

test('guidance and evidence-backed progress are committed atomically and projected without private world data', async t => {
  const world = legacyWorld(), original = structuredClone(world);
  const update = direction();
  const candidate: NarrativeProposal = { ...proposal,
    operations: [{ op: 'add_claim', claim: { id: 'tower_testimony', speakerId: 'mara',
      text: 'The tower was still standing when I arrived. You could look inside.', knownBy: ['player', 'mara'] } }],
    storyPlan: { focusQuestId: 'mystery', questUpdates: [update], progress: [{ questId: 'mystery', factIds: [], claimIds: ['tower_testimony'] }] },
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('What could I investigate next?'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(fixture.modelRequests.length, 1, 'direction uses the existing proposal call');
  assert.equal(fixture.paths.filter(path => path === '/api/alpha/decisions').length, 1);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.commits[0].p_engine, '1.3.0');
  assert.deepEqual(fixture.commits[0].p_proposal.storyPlan, candidate.storyPlan);
  assert.equal(fixture.commits[0].p_state.quests.find(quest => quest.id === 'mystery')!.guidance!.lastProgressRevision, 1);
  assert.equal(fixture.commits[0].p_state.story!.quietTurns, 0);
  assert.equal(result.view.story.focusQuestId, 'mystery');
  assert.equal(Object.hasOwn(result.view.story, 'leads'), false);
  assert.ok(result.view.quests.every((quest: object) => !Object.hasOwn(quest, 'leads')));
  assert.equal(result.view.quests.find((quest: { id: string }) => quest.id === 'mystery').objective, update.objective);
  assert.equal(result.turn.narration, null, 'direction is visible before the separate narration call');
  assert.doesNotMatch(JSON.stringify(result), /Hollow Choir|buried bell|fixture-server-key|fixture-story-private-key|evidenceFactIds|evidenceClaimIds/);
  assert.deepEqual(world, original);
});

test('omitting the required story plan fails closed without repeating generation or committing', async t => {
  const { storyPlan: _omitted, ...legacyProposal } = proposal;
  const fixture = setup(t, legacyProposal);
  const response = await turnPost(request('I look around.'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'MODEL_INVALID_OUTPUT' });
  assertUncommitted(fixture);
  assert.ok(fixture.traces.find(trace => trace.stage === 'failed')!.details.modelCall);
});

test('public progress referring to undiscovered evidence rejects the entire attempt before review or commitment', async t => {
  const world = legacyWorld(), original = structuredClone(world);
  const candidate: NarrativeProposal = { ...proposal,
    itemActions: [{ action: 'drop', itemId: 'journal', quantity: 1, recipientId: null }],
    storyPlan: { focusQuestId: 'mystery', questUpdates: [direction()], progress: [{ questId: 'mystery', factIds: ['cause'], claimIds: [] }] },
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I put down my notebook and look for a clue.'));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'STORY_HIDDEN_PROGRESS' });
  assertUncommitted(fixture);
  const failure = fixture.traces.find(trace => trace.stage === 'failed')!;
  assert.deepEqual(failure.details.story, { status: 'blocked', code: 'STORY_HIDDEN_PROGRESS' });
  assert.deepEqual((failure.details.rejectedProposal as NarrativeProposal).storyPlan, candidate.storyPlan);
  assert.deepEqual(world, original, 'tentative inventory, time and guidance changes must all roll back');
});

test('a live proposal cannot reintroduce former suggested-action fields', async t => {
  const candidate = { ...proposal, storyPlan: { ...proposal.storyPlan, questUpdates: [{ ...direction(),
    leads: [{ id: 'old_prompt', text: 'Ask about the tower', action: 'I ask the woman what she knows about the tower.',
      entityIds: ['mara', 'tower'], evidenceFactIds: ['ruin'], evidenceClaimIds: [] }],
  }] } };
  const fixture = setup(t, candidate);
  const response = await turnPost(request('What does she say?'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'MODEL_INVALID_OUTPUT' });
  assertUncommitted(fixture);
});

test('clarification releases the turn without changing pacing, guidance, story time or revision', async t => {
  const world = legacyWorld();
  world.revision = 4;
  world.story = { focusQuestId: 'mystery', quietTurns: 3, lastProgressRevision: 1 };
  const original = structuredClone(world);
  const candidate: NarrativeProposal = { ...proposal, kind: 'clarification', elapsedMinutes: 0,
    clarification: 'PRIVATE PROVIDER TEXT naming the Hollow Choir',
    storyPlan: { focusQuestId: null, questUpdates: [], progress: [] },
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I ask them about that.', 4));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { clarification: 'Could you be more specific about what you want to do or ask, and who or what it involves?' });
  assert.equal(fixture.modelRequests.length, 1);
  assert.equal(fixture.commits.length, 0);
  assert.equal(fixture.paths.filter(path => path === '/rest/v1/rpc/release_turn').length, 1);
  assert.ok(fixture.traces.some(trace => trace.stage === 'clarification'));
  assert.equal(fixture.traces.some(trace => trace.stage === 'committed'), false);
  assert.deepEqual(world, original);
});

test('a clarification cannot smuggle in a guidance update', async t => {
  const candidate: NarrativeProposal = { ...proposal, kind: 'clarification', elapsedMinutes: 0,
    clarification: 'What do you mean?',
    storyPlan: { focusQuestId: null, questUpdates: [direction()], progress: [] },
  };
  const fixture = setup(t, candidate);
  const response = await turnPost(request('I ask them about that.'));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'INVALID_CLARIFICATION' });
  assertUncommitted(fixture);
});

test('stalled pacing reaches the existing proposal call and metadata changes cannot pretend to make progress', async t => {
  const world = legacyWorld();
  world.revision = 4;
  world.story = { focusQuestId: 'mystery', quietTurns: 3, lastProgressRevision: 1 };
  const candidate: NarrativeProposal = { ...proposal,
    storyPlan: { focusQuestId: 'mystery', questUpdates: [direction()], progress: [] },
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I walk around the same ruins.', 4));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(fixture.modelRequests.length, 1);
  assert.equal(fixture.paths.filter(path => path === '/api/alpha/decisions').length, 1);
  const messages = fixture.modelRequests[0].messages as { content: string }[];
  const state = JSON.parse(messages[1].content).state;
  assert.equal(state.revision, 4, 'new record IDs can use the reserved campaign revision');
  assert.equal(state.storyDirector.focusQuestId, 'mystery');
  assert.equal(state.storyDirector.quietTurns, 3);
  assert.equal(state.storyDirector.needsDirection, true);
  assert.ok(state.storyDirector.selectedQuestIds.includes('mystery'));
  assert.equal(fixture.commits[0].p_state.story!.quietTurns, 4);
  assert.equal(result.view.story.quietTurns, 4);
  const trace = fixture.traces.find(record => record.stage === 'committed')!;
  const story = trace.details.story as Record<string, unknown>;
  assert.equal(story.status, 'validated');
  assert.equal(story.quietTurnsBefore, 3);
  assert.equal(story.quietTurns, 4);
  assert.deepEqual(story.progress, []);
  assert.deepEqual(story.updatedQuestIds, ['mystery']);
  assert.equal(Object.hasOwn(story, 'surfacedLeadIds'), false);
});

test('reusing an already known fact as quest progress returns a safe error and preserves pacing', async t => {
  const world = legacyWorld(), original = structuredClone(world);
  const candidate: NarrativeProposal = { ...proposal,
    storyPlan: { focusQuestId: 'mystery', questUpdates: [direction()], progress: [{ questId: 'mystery', factIds: ['ruin'], claimIds: [] }] },
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I look at the town again.'));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'STORY_STALE_PROGRESS' });
  assertUncommitted(fixture);
  assert.deepEqual(fixture.traces.find(trace => trace.stage === 'failed')!.details.story, { status: 'blocked', code: 'STORY_STALE_PROGRESS' });
  assert.deepEqual(world, original);
});

function worldWithToken() {
  const world = seedWorld();
  world.quests[0].knownBy = ['player', 'mara'];
  world.entities.push({ id: 'brass_token', kind: 'item', name: 'Brass token',
    description: 'A brass token resting beside the arch.', locationId: 'ashford', ownerId: null,
    condition: 'Tarnished', knownBy: ['player', 'mara'] });
  return world;
}
function repeatedQuest(world: World): Extract<NarrativeProposal['operations'][number], { op: 'add_quest' }> {
  const { id, title, description, status, knownBy } = world.quests[0];
  return { op: 'add_quest', quest: { id, title, description, status, knownBy: [...knownBy].reverse() } };
}
function takeToken(world: World): NarrativeProposal {
  return { ...proposal, interpretation: 'You pick up the brass token.',
    itemActions: [{ action: 'take', itemId: 'brass_token', quantity: 1, recipientId: null }],
    operations: [repeatedQuest(world)] };
}

test('an unchanged quest and rule repeated beside a valid item action are normalized, committed once and replayable', async t => {
  const world = worldWithToken(), original = structuredClone(world);
  const candidate = takeToken(world);
  candidate.operations.push({ op: 'add_rule', rule: structuredClone(world.rules[0]) },
    { op: 'establish_fact', fact: { id: 'token_inscription', key: 'brass_token.inscription',
      text: 'The token bears the outline of a bell tower.', subjects: ['brass_token', 'tower'],
      at: world.minute + 1, knownBy: ['player'] } });
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I pick up the brass token.'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(fixture.commits.length, 1);
  const committed = fixture.commits[0];
  assert.equal(committed.p_engine, '1.3.0', 'the existing reducer remains authoritative for replay');
  assert.deepEqual(committed.p_proposal, { ...candidate, operations: candidate.operations.slice(2) });
  assert.equal(committed.p_state.entities.find(entity => entity.id === 'brass_token')!.ownerId, 'player');
  assert.equal(committed.p_state.quests.length, original.quests.length);
  assert.deepEqual(committed.p_state.quests[0], original.quests[0], 'normalization must retain stored quest guidance and audience');
  assert.deepEqual(committed.p_state.rules, original.rules);
  assert.deepEqual(replayVersioned(original, [{ engine_version: committed.p_engine, proposal: committed.p_proposal }]), committed.p_state);
  assert.equal(result.turn.changes.filter((change: string) => change.startsWith('Picked up:')).length, 1);
  assert.equal(result.turn.changes.some((change: string) => change.startsWith('Quest ') || change.startsWith('World rule learned:')), false);
  assert.doesNotMatch(JSON.stringify(result), /proposal-normalization-1|normalization|omittedOperations|already_established/);
  assert.deepEqual(fixture.traces.find(trace => trace.stage === 'proposal')!.details.normalization, {
    version: 'proposal-normalization-1', omittedOperations: [
      { index: 0, op: 'add_quest', id: 'mystery', reason: 'already_established' },
      { index: 1, op: 'add_rule', id: 'memory', reason: 'already_established' },
    ],
  });
  const retry = await turnPost(request('I pick up the brass token.'));
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { turn: result.turn, replayed: true });
  assert.equal(fixture.modelRequests.length, 1, 'normalization and replay must not request another generation');
  assert.equal(fixture.paths.filter(path => path === '/api/alpha/decisions').length, 1);
  assert.equal(fixture.commits.length, 1);
  assert.deepEqual(world, original);
});

for (const [field, value] of [
  ['description', 'Replace the established goal with an unrelated task.'],
  ['knownBy', ['player']],
  ['status', 'completed'],
] as const) {
  test(`a repeated quest with changed ${field} still rejects atomically and preserves the raw candidate`, async t => {
    const world = worldWithToken(), original = structuredClone(world);
    const candidate = takeToken(world);
    const operation = repeatedQuest(world);
    Object.assign(operation.quest, { [field]: value });
    candidate.operations = [operation];
    const fixture = setup(t, candidate, world);
    const response = await turnPost(request('I pick up the brass token.'));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'DUPLICATE_ID' });
    assertUncommitted(fixture);
    assert.deepEqual(fixture.traces.find(trace => trace.stage === 'failed')!.details.rejectedProposal, candidate);
    assert.deepEqual(world, original, 'a rejected quest cannot transfer the item or advance the world');
  });
}

test('normalization cannot turn a clarification with world operations into a valid clarification', async t => {
  const world = worldWithToken(), original = structuredClone(world);
  const candidate: NarrativeProposal = { ...proposal, kind: 'clarification', elapsedMinutes: 0,
    clarification: 'Which object do you mean?', operations: [repeatedQuest(world)],
    storyPlan: { focusQuestId: null, questUpdates: [], progress: [] } };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I take that.'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_CLARIFICATION' });
  assertUncommitted(fixture);
  assert.deepEqual(fixture.traces.find(trace => trace.stage === 'failed')!.details.rejectedProposal, candidate);
  assert.deepEqual(world, original);
});

for (const [factId, error] of [['ruin', 'STORY_STALE_PROGRESS'], ['missing_token_clue', 'STORY_UNKNOWN_FACT']] as const) {
  test(`an omitted repeated quest still rejects ${error} and preserves the original operation`, async t => {
    const world = worldWithToken(), original = structuredClone(world);
    const candidate = takeToken(world);
    candidate.storyPlan = { ...proposal.storyPlan,
      progress: [{ questId: 'mystery', factIds: [factId], claimIds: [] }] };
    const fixture = setup(t, candidate, world);
    const response = await turnPost(request('I pick up the brass token.'));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error });
    assertUncommitted(fixture);
    const failure = fixture.traces.find(trace => trace.stage === 'failed')!;
    assert.deepEqual(failure.details.rejectedProposal, candidate, 'diagnostics need the original model output, including omitted repeats');
    assert.deepEqual(failure.details.normalization, { version: 'proposal-normalization-1', omittedOperations: [
      { index: 0, op: 'add_quest', id: 'mystery', reason: 'already_established' },
    ] });
    assert.deepEqual(world, original, 'invalid progress must discard tentative inventory changes too');
  });
}

function missingEvidenceProposal(): NarrativeProposal {
  return { ...proposal, interpretation: 'PRIVATE_REJECTED_PROSE is not established history.', elapsedMinutes: 2,
    storyPlan: { ...proposal.storyPlan, progress: [{ questId: 'mystery', factIds: ['unrecorded_reply'], claimIds: [] }] } };
}
function supportedReply(world: World): NarrativeProposal {
  return { ...proposal, elapsedMinutes: 2,
    operations: [{ op: 'establish_fact', fact: { id: 'tower_knocks', key: 'tower.knocks_after_name',
      text: 'Three slow knocks sounded from the tower after you spoke the name.', subjects: ['player', 'tower'],
      at: world.minute + 2, knownBy: ['player'] } }],
    storyPlan: { ...proposal.storyPlan, progress: [{ questId: 'mystery', factIds: ['tower_knocks'], claimIds: [] }] } };
}
function plannerPayload(fixture: ReturnType<typeof setup>, index: number) {
  const messages = fixture.modelRequests[index].messages as { content: string }[];
  return JSON.parse(messages[1].content);
}

test('an explicit same-action retry learns from a missing fact rejection, commits once and replays without another lookup or model call', async t => {
  const world = seedWorld(), original = structuredClone(world), input = 'I speak the name and listen.';
  const fixture = setup(t, missingEvidenceProposal(), world);
  const rejected = await turnPost(request(input));
  assert.equal(rejected.status, 409);
  assert.deepEqual(await rejected.json(), { error: 'STORY_UNKNOWN_FACT' });
  assertUncommitted(fixture);
  assert.equal(fixture.traceReads.length, 0, 'the ordinary first attempt does not read diagnostic history');
  assert.equal(plannerPayload(fixture, 0).retryGuidance, undefined);
  const fingerprint = proposalRequestFingerprint(input, world.revision);
  assert.equal(fixture.traces.find(trace => trace.stage === 'failed')!.details.requestFingerprint, fingerprint);
  assert.deepEqual(world, original);

  fixture.setCandidate(supportedReply(world));
  const response = await turnPost(request(input, 0, { retry: true }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(fixture.traceReads.length, 1);
  assert.equal(fixture.traceReads[0].searchParams.get('campaign_id'), `eq.${campaignId}`);
  assert.equal(fixture.traceReads[0].searchParams.get('turn_id'), `eq.${turnId}`);
  assert.equal(fixture.modelRequests.length, 2, 'one proposal per explicit player submission');
  const payload = plannerPayload(fixture, 1);
  assert.equal(payload.input, input);
  assert.equal(payload.retryGuidance.code, 'STORY_UNKNOWN_FACT');
  assert.match(payload.retryGuidance.correction, /establish_fact/);
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_REJECTED_PROSE|unrecorded_reply/);
  assert.ok(JSON.stringify(payload.state).length + JSON.stringify(payload.retryGuidance).length <= 24000);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.commits[0].p_result.id, turnId);
  assert.equal(result.view.revision, original.revision + 1);
  assert.equal(result.view.minute, original.minute + 2, 'rejection cannot advance time');
  assert.deepEqual(replayVersioned(original, [{ engine_version: fixture.commits[0].p_engine,
    proposal: fixture.commits[0].p_proposal }]), fixture.commits[0].p_state);
  assert.doesNotMatch(JSON.stringify(result), /requestFingerprint|retryGuidance|proposal-retry-1|PRIVATE_REJECTED_PROSE/);
  const contextTrace = fixture.traces.filter(trace => trace.stage === 'context').at(-1)!;
  assert.deepEqual(contextTrace.details.retryGuidance, { version: 'proposal-retry-1', code: 'STORY_UNKNOWN_FACT',
    chars: JSON.stringify(payload.retryGuidance).length });

  const replay = await turnPost(request(input, 0, { retry: true }));
  assert.deepEqual(await replay.json(), { turn: result.turn, replayed: true });
  assert.equal(fixture.traceReads.length, 1, 'committed replay returns before diagnostic retrieval');
  assert.equal(fixture.modelRequests.length, 2);
  assert.equal(fixture.commits.length, 1);
  assert.deepEqual(world, original);
});

for (const changed of ['input', 'revision', 'item', 'campaign', 'turn'] as const) {
  test(`rejected-action guidance is not inherited after changing ${changed}`, async t => {
    const world = seedWorld(), input = 'I speak the name and listen.';
    const fixture = setup(t, missingEvidenceProposal(), world);
    assert.equal((await turnPost(request(input))).status, 409);
    if (changed === 'revision') world.revision = 1;
    const candidate = supportedReply(world);
    if (changed === 'item') candidate.itemActions = [{ action: 'use', itemId: 'journal', quantity: 1, recipientId: null }];
    fixture.setCandidate(candidate);
    const response = await turnPost(request(changed === 'input' ? 'I listen beside the tower.' : input, world.revision, {
      retry: true,
      ...(changed === 'item' ? { itemId: 'journal' } : {}),
      ...(changed === 'campaign' ? { campaignId: '44444444-4444-4444-8444-444444444444' } : {}),
      ...(changed === 'turn' ? { turnId: '55555555-5555-4555-8555-555555555555' } : {}),
    }));
    assert.equal(response.status, 200);
    assert.equal(fixture.traceReads.length, 1);
    assert.equal(plannerPayload(fixture, 1).retryGuidance, undefined);
    assert.equal(fixture.traces.filter(trace => trace.stage === 'context').at(-1)!.details.retryGuidance, undefined);
  });
}

for (const traceReadFailure of ['response', 'throw'] as const) {
  test(`diagnostic ${traceReadFailure} failure does not prevent an explicit retry from continuing`, async t => {
    const world = seedWorld(), input = 'I speak the name and listen.';
    const fixture = setup(t, supportedReply(world), world, { traceReadFailure });
    const response = await turnPost(request(input, 0, { retry: true }));
    assert.equal(response.status, 200);
    assert.ok(fixture.traceReads.length >= 1, 'Supabase may retry a failed read within its bounded deadline');
    assert.equal(fixture.modelRequests.length, 1);
    assert.equal(fixture.commits.length, 1);
    assert.equal(plannerPayload(fixture, 0).retryGuidance, undefined);
  });
}

test('a repeated submission without the explicit retry flag does not fetch previous diagnostic guidance', async t => {
  const world = seedWorld(), input = 'I speak the name and listen.';
  const fixture = setup(t, missingEvidenceProposal(), world);
  assert.equal((await turnPost(request(input))).status, 409);
  fixture.setCandidate(supportedReply(world));
  assert.equal((await turnPost(request(input))).status, 200);
  assert.equal(fixture.traceReads.length, 0);
  assert.equal(plannerPayload(fixture, 1).retryGuidance, undefined);
});
