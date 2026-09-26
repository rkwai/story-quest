import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { POST as turnPost } from '../src/app/api/turns/route';
import { seedWorld } from '../src/engine/seed';
import type { PublicTurn, NarrativeProposal, World } from '../src/engine/types';

const campaignId = '11111111-1111-4111-8111-111111111111';
const turnId = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
const proposal: NarrativeProposal = {
  kind: 'action', interpretation: 'You ask what to investigate next.', clarification: null,
  elapsedMinutes: 1, operations: [], itemActions: [],
  storyPlan: { focusQuestId: 'mystery', questUpdates: [], progress: [] },
};
type Trace = { stage: string; details: Record<string, unknown> };
type Commit = { p_state: World; p_proposal: NarrativeProposal; p_result: PublicTurn; p_engine: string };

function request(input: string, revision = 0) {
  return new Request('https://story.example/api/turns', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://story.example' },
    body: JSON.stringify({ campaignId, turnId, revision, input }),
  });
}
function legacyWorld() {
  const world = seedWorld();
  delete world.story;
  for (const quest of world.quests) delete quest.guidance;
  return world;
}
function setup(t: TestContext, candidate: unknown, state = legacyWorld()) {
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
    if (url.pathname === '/rest/v1/rpc/reserve_turn') return Response.json({ replayed: false, state });
    if (url.pathname === '/rest/v1/turns') return Response.json([]);
    if (url.pathname === '/rest/v1/turn_traces') {
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
  return { paths, traces, commits, modelRequests };
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
