import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { buildContext, type RecentPublicTurn } from '../src/engine/context';
import { seedWorld } from '../src/engine/seed';
import { recentConversation, sanitizeConversation } from '../src/server/conversation';

function row(revision: number, input = `Question ${revision}`, narration: string | null = `Answer ${revision}`) {
  return { public_result: { id: `turn-${revision}`, revision, input, changes: [`Outcome ${revision}`] }, narration };
}

test('conversation fetch selects only earlier committed public data and sanitizes persisted extras', async t => {
  const campaign = 'e6ebc03f-66b6-400f-b8c7-64eb4f285f54';
  const db = createClient('https://conversation-fixture.supabase.co', 'fixture-server-key');
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.pathname, '/rest/v1/turns');
    assert.equal(url.searchParams.get('select'), 'public_result,narration');
    assert.equal(url.searchParams.get('campaign_id'), `eq.${campaign}`);
    assert.equal(url.searchParams.get('status'), 'eq.committed');
    assert.equal(url.searchParams.get('revision'), 'lte.3');
    assert.equal(url.searchParams.get('order'), 'revision.desc');
    assert.equal(url.searchParams.get('limit'), '4');
    return Response.json([
      row(4, 'FUTURE_INPUT'),
      { ...row(3, 'What do you mean by that?'), proposal: 'PRIVATE_PROPOSAL', state: 'PRIVATE_STATE',
        public_result: { ...row(3, 'What do you mean by that?').public_result, interpretation: 'PRIVATE_INTERPRETATION', narration: 'UNTRUSTED_NESTED_NARRATION' } },
      row(2, 'Why are you here?', null),
      { ...row(1), narration: { secret: 'INVALID_NARRATION' } },
    ]);
  });
  const recent = await recentConversation(db, campaign, 3);
  assert.deepEqual(recent.map(turn => turn.revision), [2, 3]);
  assert.equal(recent[1].input, 'What do you mean by that?');
  assert.equal(recent[1].narration, 'Answer 3');
  assert.equal(recent[0].narration, null);
  assert.deepEqual(Object.keys(recent[1]).sort(), ['changes', 'id', 'input', 'narration', 'revision']);
  assert.doesNotMatch(JSON.stringify(recent), /PRIVATE_|FUTURE_|UNTRUSTED_|INVALID_/);
});

test('conversation bounds preserve newest whole turns and exact input without private field passthrough', () => {
  const rows = Array.from({ length: 6 }, (_, index) => row(index + 1));
  assert.deepEqual(sanitizeConversation(rows, 6).map(turn => turn.id), ['turn-3', 'turn-4', 'turn-5', 'turn-6']);
  const longRows = Array.from({ length: 4 }, (_, index) => row(index + 1, 'q'.repeat(1000), 'a'.repeat(1000)));
  const bounded = sanitizeConversation(longRows, 4);
  assert.deepEqual(bounded.map(turn => turn.id), ['turn-3', 'turn-4']);
  assert.equal(bounded[1].input, 'q'.repeat(1000));
  assert.ok(JSON.stringify(bounded).length <= 6000);
  const oversized = row(5);
  oversized.public_result.changes = Array.from({ length: 10 }, () => 'c'.repeat(1200));
  assert.deepEqual(sanitizeConversation([oversized], 5), []);
});

test('mandatory state outranks conversation and total context never exceeds its budget', () => {
  const world = seedWorld(); world.revision = 4;
  const original = structuredClone(world);
  const turns = sanitizeConversation([row(3, 'Why are you here?'), row(4, 'What do you mean by that?')], 4);
  const context = buildContext(world, 'Tell me more.', 24000, turns);
  assert.deepEqual(context.state.recentTurns.map(turn => turn.input), ['Why are you here?', 'What do you mean by that?']);
  assert.deepEqual(context.manifest.turnIds, ['turn-3', 'turn-4']);
  assert.equal(context.manifest.conversationChars, JSON.stringify(context.state.recentTurns).length);
  assert.equal(context.manifest.chars, JSON.stringify(context.state).length);
  assert.ok(context.manifest.chars <= 24000);
  const core = buildContext(world, 'Tell me more.');
  const tight = buildContext(world, 'Tell me more.', core.manifest.chars + 1, turns);
  assert.deepEqual(tight.state.recentTurns, []);
  assert.deepEqual(tight.manifest.factIds, core.manifest.factIds);
  assert.equal(tight.manifest.conversationChars, 0);
  assert.ok(tight.manifest.chars <= core.manifest.chars + 1);
  const future = { ...turns[1], revision: 5, id: 'future-turn', secret: 'PRIVATE_EXTRA' };
  const filtered = buildContext(world, 'Tell me more.', 24000, [turns[0], future] as RecentPublicTurn[]);
  assert.deepEqual(filtered.manifest.turnIds, ['turn-3']);
  assert.doesNotMatch(JSON.stringify(filtered.state.recentTurns), /PRIVATE_EXTRA/);
  assert.deepEqual(world, original);
});

test('context includes local NPC possessions and resolves fact subjects with owner and location references', () => {
  const world = seedWorld();
  world.entities.push(
    { id: 'remote', kind: 'location', name: 'Distant market', description: 'A distant market.', locationId: null, ownerId: null, condition: 'Open', knownBy: [] },
    { id: 'merchant', kind: 'npc', name: 'Merchant', description: 'Keeps a key.', locationId: 'remote', ownerId: null, condition: 'Steady', knownBy: [] },
    { id: 'key', kind: 'item', name: 'Brass key', description: 'A distant key.', locationId: null, ownerId: 'merchant', condition: 'Worn', knownBy: [] },
  );
  world.facts.push({ id: 'key-fact', key: 'key.origin', text: 'The distant key is old.', at: 0, subjects: ['key'], knownBy: [] });
  const context = buildContext(world, 'Look around.');
  const included = new Set(context.manifest.entityIds);
  assert.ok(included.has('lantern'), 'Mara’s held lantern must accompany the local NPC');
  assert.ok(context.manifest.factIds.includes('key-fact'));
  assert.ok(included.has('key')); assert.ok(included.has('merchant')); assert.ok(included.has('remote'));
  for (const fact of context.state.facts) for (const subject of fact.subjects) assert.ok(included.has(subject));
  for (const entity of context.state.entities) {
    if (entity.ownerId) assert.ok(included.has(entity.ownerId));
    if (entity.locationId) assert.ok(included.has(entity.locationId));
  }
  // A fact cannot sneak in without accounting for the entities needed to interpret it.
  const coreSize = buildContext(seedWorld(), 'Look around.').manifest.chars;
  const tight = buildContext(world, 'Look around.', coreSize + 100);
  assert.ok(!tight.manifest.factIds.includes('key-fact'));
  assert.ok(!tight.manifest.entityIds.includes('key'));
  assert.ok(tight.manifest.chars <= coreSize + 100);
});
