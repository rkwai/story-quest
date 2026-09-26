import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationContext } from '../src/server/dm';
import { POST as narrationPost } from '../src/app/api/narration/route';
import { playerView } from '../src/engine/view';
import { seedWorld } from '../src/engine/seed';
import type { PublicTurn } from '../src/engine/types';

const turn: PublicTurn = { id: 'turn', input: 'I ask her about the tower.', interpretation: 'Your attempt: I ask her about the tower.', changes: [], narration: null, revision: 1 };

test('narration keeps focused ancestry and committed quest outcomes without the whole public journal', () => {
  const view = playerView(seedWorld());
  view.quests[0].parentId = 'world_goal';
  view.quests.push({ id: 'world_goal', title: 'Understand the road', description: 'A wider question.', status: 'active' });
  view.quests.push({ id: 'witness', title: 'Find a witness', description: 'Someone has spoken.', status: 'completed', parentId: 'mystery' });
  for (let n = 0; n < 100; n++) view.quests.push({ id: `other_${n}`, title: `Other quest ${n}`, description: 'Old public quest information.'.repeat(30), status: 'active' });
  const before = structuredClone(view);
  const context = narrationContext(view, { ...turn, changes: ['Quest completed: Find a witness.'] });
  assert.deepEqual(context.quests.map(quest => quest.id), ['mystery', 'world_goal', 'witness']);
  assert.ok(JSON.stringify(context).length < 24000);
  assert.ok(JSON.stringify(view).length > 24000);
  assert.deepEqual(view, before, 'Retrieval must not mutate the public journal');
  assert.deepEqual(context.facts, view.facts, 'Known facts retain the existing mandatory budget');
});

test('narration ignores legacy command metadata and lead-only receipts without mutating persisted views', () => {
  const view = playerView(seedWorld());
  const oldPrompt = { id: 'talk', questId: 'other', text: 'LEGACY_SUGGESTION_TEXT', action: 'LEGACY_ACTION_TEMPLATE', entityIds: ['mara'] };
  // Persisted narration snapshots from engine 1.2 can have a wider shape than
  // today's PlayerView. They must be projected again when narration is retried.
  Object.assign(view.quests[0], { leads: [oldPrompt], action: 'LEGACY_QUEST_COMMAND' });
  Object.assign(view.story!, { leads: [oldPrompt], action: 'LEGACY_STORY_COMMAND' });
  view.quests.push({ id: 'other', title: 'Another thread', description: 'A possibility.', status: 'active' });
  Object.assign(view.quests[1], { leads: [oldPrompt] });
  const before = structuredClone(view);
  const context = narrationContext(view, { ...turn, changes: ['Lead available: LEGACY_SUGGESTION_TEXT'] });
  assert.deepEqual(context.quests.map(quest => quest.id), ['mystery']);
  assert.doesNotMatch(JSON.stringify(context), /LEGACY_|"leads"|"action"/);
  assert.deepEqual(view, before, 'Old stored snapshots remain unchanged');
  delete view.story;
  assert.deepEqual(narrationContext(view, turn).quests.map(quest => quest.id), ['mystery']);
});

test('retrying old narration sends committed story instead of stored suggested commands and never reruns the world', async t => {
  const values = { OPENROUTER_API_KEY: 'fixture-private-key', STORY_MODEL: 'story/model', STORY_REASONING_EFFORT: 'none',
    NEXT_PUBLIC_SUPABASE_URL: 'https://narration-fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture-server-key' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const campaignId = '11111111-1111-4111-8111-111111111111';
  const turnId = '22222222-2222-4222-8222-222222222222';
  const view = playerView(seedWorld());
  const legacy = { id: 'talk', questId: 'mystery', text: 'LEGACY_SUGGESTION_TEXT', action: 'LEGACY_ACTION_TEMPLATE', entityIds: ['mara'] };
  Object.assign(view.quests[0], { leads: [legacy] });
  Object.assign(view.story!, { leads: [legacy] });
  const testimony = 'The woman at the arch claims: “I keep watch in case someone comes home.”';
  const saved = { view, turn: { ...turn, id: turnId, changes: [testimony, 'Lead available: LEGACY_SUGGESTION_TEXT'] } };
  const before = structuredClone(saved), paths: string[] = [], unexpected: string[] = [];
  t.after(() => assert.deepEqual(unexpected, [], 'all traffic must stay inside the fixture'));
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    if (url.hostname === 'openrouter.ai' && url.pathname === '/api/v1/chat/completions') {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.model, 'story/model');
      assert.equal(body.response_format, undefined);
      const supplied = JSON.parse(body.messages[1].content);
      assert.deepEqual(supplied.committedChanges, [testimony]);
      assert.equal(supplied.input, saved.turn.input);
      assert.doesNotMatch(body.messages[1].content, /LEGACY_|"leads"|"action"|Hollow Choir|buried bell/);
      assert.match(body.messages[0].content, /dialogue|clue|consequence/i);
      assert.match(body.messages[0].content, /no[^.]*menus|do not[^.]*menus|never[^.]*menus/i);
      return Response.json({ id: 'gen-narration-fixture', model: 'story/model',
        choices: [{ finish_reason: 'stop', message: { content: '“I keep watch in case someone comes home,” she says, her hand tightening around the lantern.' } }] });
    }
    if (url.pathname === '/rest/v1/campaigns') return Response.json({ owner_id: '33333333-3333-4333-8333-333333333333' });
    if (url.pathname === '/rest/v1/rpc/reserve_narration') return Response.json(saved);
    if (url.pathname === '/rest/v1/turns' && options?.method === 'PATCH') {
      assert.deepEqual(Object.keys(JSON.parse(String(options.body))).sort(), ['narration', 'narration_lease_until']);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/rest/v1/turn_traces') return new Response(null, { status: 201 });
    unexpected.push(`${url.hostname}${url.pathname}`);
    throw new Error('Unexpected fixture request');
  });
  const response = await narrationPost(new Request('https://story.example/api/narration', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://story.example' }, body: JSON.stringify({ campaignId, turnId }) }));
  assert.equal(response.status, 200);
  assert.match((await response.json()).narration, /keep watch/);
  assert.equal(paths.filter(path => path === '/api/v1/chat/completions').length, 1);
  assert.equal(paths.includes('/rest/v1/rpc/reserve_turn'), false);
  assert.equal(paths.includes('/rest/v1/rpc/commit_turn'), false);
  assert.deepEqual(saved, before, 'A narration retry cannot rewrite its saved world or receipts');
});
