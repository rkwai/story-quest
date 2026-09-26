import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationContext } from '../src/server/dm';
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

test('narration retains a newly offered alternate quest lead and handles legacy views', () => {
  const view = playerView(seedWorld());
  view.quests.push({ id: 'other', title: 'Another thread', description: 'A possibility.', status: 'active', leads: [{ id: 'talk', questId: 'other', text: 'Ask about the road.', action: 'I ask about the road.', entityIds: ['mara'] }] });
  assert.ok(narrationContext(view, { ...turn, changes: ['Lead available: Ask about the road.'] }).quests.some(quest => quest.id === 'other'));
  delete view.story;
  assert.deepEqual(narrationContext(view, turn).quests.map(quest => quest.id), ['mystery']);
});
