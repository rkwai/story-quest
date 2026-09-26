import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { POST as turnPost } from '../src/app/api/turns/route';
import { seedWorld } from '../src/engine/seed';
import type { NarrativeProposal, PublicTurn, World } from '../src/engine/types';

const campaignId = '11111111-1111-4111-8111-111111111111';
const turnId = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
const proposal: NarrativeProposal = {
  kind: 'action', interpretation: 'You use the item.', clarification: null,
  elapsedMinutes: 1, operations: [], itemActions: [], storyPlan: { focusQuestId: 'mystery', questUpdates: [], progress: [] },
};
type Trace = { stage: string; details: Record<string, unknown> };
type Commit = { p_state: World; p_proposal: NarrativeProposal; p_result: PublicTurn };

function request(input: string, itemId?: string) {
  return new Request('https://story.example/api/turns', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://story.example' },
    body: JSON.stringify({ campaignId, turnId, revision: 0, input, ...(itemId ? { itemId } : {}) }),
  });
}

// Model and persistence traffic are fixtures. A failure may not reach Jev,
// commit, or narration; the unexpected-request check catches extra paid calls.
function setup(t: TestContext, candidate: unknown, state = seedWorld()) {
  const values = {
    OPENROUTER_API_KEY: 'fixture-inventory-private-key', STORY_MODEL: 'story/model', PROPOSAL_MODEL: 'planner/model',
    PROPOSAL_REASONING_EFFORT: 'low', STORY_REASONING_EFFORT: 'none', TYPESAFE_MODE: 'shadow',
    NEXT_PUBLIC_SUPABASE_URL: 'https://inventory-fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture-server-key',
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
      assert.equal(body.model, 'planner/model', 'narration must run only after the committed route response');
      modelRequests.push(body);
      return Response.json({ id: 'gen-inventory-fixture', model: 'planner/model', provider: 'Fixture',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(candidate) } }],
        usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130, cost: 0.001 },
      });
    }
    if (url.hostname === 'openrouter.ai' && url.pathname === '/api/alpha/decisions') {
      return Response.json({ id: 'jev-inventory-fixture', model: '~typesafe/jev-latest', usage: { input_tokens: 100, output_tokens: 10, cost: 0 },
        answers: { inputMode: { type: 'choice', choice: 'action' }, immutableHistoryConcern: { type: 'noul', noul: 0 },
          worldRuleConcern: { type: 'noul', noul: 0 }, unjustifiedKnowledgeConcern: { type: 'noul', noul: 0 } },
      });
    }
    if (url.pathname === '/rest/v1/campaigns') return Response.json({ owner_id: owner });
    if (url.pathname === '/rest/v1/rpc/reserve_turn') return Response.json({ replayed: false, state });
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

function assertUncommitted(fixture: ReturnType<typeof setup>, expectedProposalCalls: number) {
  assert.equal(fixture.modelRequests.length, expectedProposalCalls);
  assert.equal(fixture.commits.length, 0);
  assert.equal(fixture.paths.filter(path => path === '/rest/v1/rpc/release_turn').length, 1);
  assert.equal(fixture.paths.includes('/api/alpha/decisions'), false, 'invalid inventory must fail before the advisory model');
  assert.equal(fixture.traces.some(trace => trace.stage === 'typesafe_review' || trace.stage === 'committed'), false);
}

test('using an absent staff blocks every proposed consequence and releases the turn', async t => {
  const world = seedWorld(), original = structuredClone(world);
  const candidate: NarrativeProposal = {
    ...proposal, interpretation: 'You use your staff to clear the fallen stones.',
    itemActions: [{ action: 'use', itemId: null, quantity: 1, recipientId: null }],
    operations: [{ op: 'establish_fact', fact: { id: 'cleared_stones', key: 'stones.cleared',
      text: 'You cleared the fallen stones with your staff.', subjects: ['player', 'ashford'], at: 481, knownBy: ['player'] } }],
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I use my staff to clear the fallen stones.'));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'ITEM_REQUIRED' });
  assertUncommitted(fixture, 1);
  assert.deepEqual(world, original);
  const rejected = fixture.traces.find(trace => trace.stage === 'failed')!;
  assert.equal(rejected.details.code, 'ITEM_REQUIRED');
  assert.deepEqual((rejected.details.rejectedProposal as NarrativeProposal).itemActions, candidate.itemActions);
  assert.deepEqual(rejected.details.inventory, { status: 'blocked', code: 'ITEM_REQUIRED' });
});

test('a live model response without the inventory declaration fails closed before commitment', async t => {
  const { itemActions: _omitted, ...legacyProposal } = proposal;
  const fixture = setup(t, legacyProposal);
  const response = await turnPost(request('I look around.'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'MODEL_INVALID_OUTPUT' });
  assertUncommitted(fixture, 1);
  const failed = fixture.traces.find(trace => trace.stage === 'failed')!;
  assert.equal(failed.details.code, 'MODEL_INVALID_OUTPUT');
  assert.ok(failed.details.modelCall, 'the rejected call must retain its private usage diagnostics');
});

test('taking a known nearby staff and then using it commits once before narration', async t => {
  const world = seedWorld();
  world.entities.push({ id: 'fallen_staff', kind: 'item', name: 'Ash staff', description: 'A fallen wooden staff.',
    ownerId: null, locationId: 'ashford', condition: 'Sound', knownBy: ['player'],
    itemState: { quantity: 1, usable: true, consumable: false } });
  const original = structuredClone(world);
  const candidate: NarrativeProposal = { ...proposal,
    itemActions: [
      { action: 'take', itemId: 'fallen_staff', quantity: 1, recipientId: null },
      { action: 'use', itemId: 'fallen_staff', quantity: 1, recipientId: null },
    ],
  };
  const fixture = setup(t, candidate, world);
  const response = await turnPost(request('I pick up the fallen staff and use it to test the ground.'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(fixture.modelRequests.length, 1);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.paths.filter(path => path === '/api/alpha/decisions').length, 1);
  assert.equal(fixture.paths.includes('/rest/v1/rpc/release_turn'), false);
  assert.equal(fixture.commits[0].p_state.revision, 1);
  const staff = fixture.commits[0].p_state.entities.find(entity => entity.id === 'fallen_staff')!;
  assert.equal(staff.ownerId, 'player');
  assert.equal(staff.locationId, null);
  assert.deepEqual(fixture.commits[0].p_proposal.itemActions, candidate.itemActions);
  assert.equal(result.turn.narration, null);
  assert.equal(result.turn.revision, 1);
  assert.ok(result.view.inventory.some((item: { id: string }) => item.id === 'fallen_staff'));
  assert.doesNotMatch(JSON.stringify(result), /Hollow Choir|buried bell|fixture-server-key|fixture-inventory-private-key/);
  assert.deepEqual(world, original);
});

for (const itemId of ['nonexistent_staff', 'lantern']) {
  test(`selected item ${itemId} is rejected before a paid call when it is not carried`, async t => {
    const fixture = setup(t, proposal);
    const response = await turnPost(request('I use this item.', itemId));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'ITEM_NOT_CARRIED' });
    assertUncommitted(fixture, 0);
  });
}

test('a selected carried item must be included in the proposed inventory actions', async t => {
  const fixture = setup(t, proposal);
  const response = await turnPost(request('I write down what I have learned.', 'journal'));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'INVENTORY_ACTION_REQUIRED' });
  assertUncommitted(fixture, 1);
  const failed = fixture.traces.find(trace => trace.stage === 'failed')!;
  assert.equal(failed.details.code, 'INVENTORY_ACTION_REQUIRED');
});

test('a selected carried notebook can be used without consuming or recreating it', async t => {
  const candidate: NarrativeProposal = { ...proposal,
    itemActions: [{ action: 'use', itemId: 'journal', quantity: 1, recipientId: null }],
  };
  const fixture = setup(t, candidate);
  const response = await turnPost(request('I use my notebook to review my notes.', 'journal'));
  assert.equal(response.status, 200);
  assert.equal(fixture.modelRequests.length, 1);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.commits[0].p_state.entities.filter(entity => entity.id === 'journal').length, 1);
  assert.equal(fixture.commits[0].p_state.entities.find(entity => entity.id === 'journal')!.ownerId, 'player');
  const result = await response.json();
  assert.equal(result.view.inventory.find((item: { id: string }) => item.id === 'journal').quantity, 1);
  assert.ok(result.turn.changes.includes('Used: Weathered notebook.'));
});
