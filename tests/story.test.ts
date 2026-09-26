import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { seedWorld } from '../src/engine/seed';
import { applyProposal } from '../src/engine/reducer';
import { applyInventoryProposal, replayVersioned } from '../src/engine/inventory';
import { applyStoryProposal, effectiveStoryFocus, parseStoryProposal, publicStoryDirection } from '../src/engine/story';
import { playerView, publicChanges } from '../src/engine/view';
import { storyWireProposalSchema, worldSchema, type Operation, type Quest, type StoryPlan, type StoryProposal, type World } from '../src/engine/types';

function plan(changes: Partial<StoryPlan> = {}): StoryPlan {
  return { focusQuestId: 'mystery', questUpdates: [], progress: [], ...changes };
}
function proposal(operations: Operation[] = [], storyPlan = plan()): StoryProposal {
  return { kind: 'action', interpretation: 'You investigate the ruins.', clarification: null, elapsedMinutes: 1, itemActions: [], operations, storyPlan };
}
function update(world = seedWorld(), changes: Partial<StoryPlan['questUpdates'][number]> = {}): StoryPlan['questUpdates'][number] {
  const { lastProgressRevision: omitted, ...guidance } = world.quests[0].guidance!;
  return { questId: 'mystery', ...structuredClone(guidance), ...changes };
}
function clue(id = 'clue'): Operation {
  return { op: 'establish_fact', fact: { id, key: `ashford.${id}`, text: 'A fresh trail leads from the ruins toward the tower.', subjects: ['ashford', 'tower'], at: 481, knownBy: ['player'] } };
}
function quest(id: string, scope: 'world' | 'arc' | 'local' | 'immediate', parentId: string | null, knownBy = ['player']): Quest {
  return { id, title: id, description: 'A story thread.', status: 'active', knownBy, guidance: { scope, parentId, objective: 'Follow this thread.', stakes: 'Someone needs help.', entityIds: ['ashford'], leads: [], lastProgressRevision: 0 } };
}

// These tests validate mechanics and boundaries, not semantic story quality.
test('story wire requires every property, forbids unknown properties, and preserves inventory null normalization', () => {
  const schema = z.toJSONSchema(storyWireProposalSchema, { target: 'draft-7' });
  let objects = 0;
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    if (node.type === 'object') {
      objects++;
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...(node.required as string[] ?? [])].sort(), Object.keys(node.properties as object ?? {}).sort());
    }
    Object.values(node).forEach(visit);
  }
  visit(schema); assert.ok(objects > 20);
  assert.throws(() => parseStoryProposal({ ...proposal(), storyPlan: undefined }));
  const npc = { ...seedWorld().entities.find(entity => entity.id === 'mara')!, id: 'visitor', itemState: null };
  const parsed = parseStoryProposal({ ...proposal(), operations: [{ op: 'create_entity', entity: npc }] });
  assert.equal(parsed.operations[0].op, 'create_entity');
  if (parsed.operations[0].op === 'create_entity') assert.ok(!Object.hasOwn(parsed.operations[0].entity, 'itemState'));
});

test('the new seed offers safe concrete leads without changing the established mystery', () => {
  const world = seedWorld();
  assert.equal(world.quests.length, 1);
  assert.equal(world.quests[0].guidance?.scope, 'arc');
  assert.equal(world.quests[0].guidance?.parentId, null);
  assert.equal(playerView(world).story?.leads.length, 2);
  assert.doesNotMatch(JSON.stringify(playerView(world)), /Hollow Choir|buried bell|evidenceFactIds|lastProgressRevision/);
  assert.deepEqual(worldSchema.parse(world), world);
});

test('legacy saves receive grounded current-scene direction without mutations or historical upgrades', () => {
  const world = seedWorld(); delete world.story; delete world.quests[0].guidance;
  const saved = structuredClone(world);
  const direction = publicStoryDirection(world);
  assert.equal(direction.focusQuestId, 'mystery');
  assert.ok(direction.leads.some(lead => lead.entityIds.includes('mara')));
  assert.ok(direction.leads.some(lead => lead.entityIds.includes('tower')));
  assert.deepEqual(world, saved);
  world.entities.find(entity => entity.id === 'player')!.locationId = 'tower';
  const moved = publicStoryDirection(world);
  assert.ok(moved.leads.every(lead => !lead.entityIds.includes('mara')));
  assert.ok(moved.leads.some(lead => lead.entityIds.includes('tower')));
  assert.doesNotMatch(JSON.stringify(moved), /Hollow Choir|buried bell/);
});

test('metadata edits and ordinary dialogue accumulate quiet turns without pretending to be progress', () => {
  let world = seedWorld();
  const changed = update(world, { objective: 'Look more closely at the mystery.' });
  world = applyStoryProposal(world, proposal([], plan({ questUpdates: [changed] })));
  world = applyStoryProposal(world, proposal([{ op: 'add_claim', claim: { id: 'weather', speakerId: 'mara', text: 'The rain is cold.', knownBy: ['player'] } }]));
  world = applyStoryProposal(world, proposal());
  assert.equal(world.story?.quietTurns, 3);
  assert.equal(world.story?.lastProgressRevision, 0);
  assert.equal(world.quests[0].guidance?.lastProgressRevision, 0);
  assert.equal(world.quests[0].status, 'active');
});

test('fresh linked evidence advances a thread and resets quiet turns atomically', () => {
  const before = applyStoryProposal(seedWorld(), proposal());
  const next = applyStoryProposal(before, proposal([clue()], plan({ progress: [{ questId: 'mystery', factIds: ['clue'], claimIds: [] }] })));
  assert.equal(next.story?.quietTurns, 0);
  assert.equal(next.story?.lastProgressRevision, 2);
  assert.equal(next.quests[0].guidance?.lastProgressRevision, 2);
  assert.equal(before.facts.some(fact => fact.id === 'clue'), false);
  assert.equal(next.quests[0].status, 'active');
});

test('newly learned old facts count as discovery while already known facts cannot fabricate progress', () => {
  const before = seedWorld();
  const after = applyStoryProposal(before, proposal([{ op: 'learn_fact', id: 'cause', characterId: 'player' }], plan({ progress: [{ questId: 'mystery', factIds: ['cause'], claimIds: [] }] })));
  assert.equal(after.story?.quietTurns, 0);
  assert.throws(() => applyStoryProposal(after, proposal([], plan({ progress: [{ questId: 'mystery', factIds: ['cause'], claimIds: [] }] }))), /STORY_STALE_PROGRESS/);
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ progress: [{ questId: 'mystery', factIds: ['ruin'], claimIds: [] }] }))), /STORY_STALE_PROGRESS/);
});

test('fresh testimony supports a lead while remaining a claim, not established truth', () => {
  const before = seedWorld();
  const after = applyStoryProposal(before, proposal([{ op: 'add_claim', claim: { id: 'witness', speakerId: 'mara', text: 'I saw someone enter the tower.', knownBy: ['player'] } }], plan({
    questUpdates: [update(before, { leads: [{ id: 'ask_witness', text: 'Ask about the person at the tower.', action: 'Ask the woman who she saw entering the tower.', entityIds: ['mara', 'tower'], evidenceFactIds: [], evidenceClaimIds: ['witness'] }] })],
    progress: [{ questId: 'mystery', factIds: [], claimIds: ['witness'] }],
  })));
  assert.equal(after.story?.quietTurns, 0);
  assert.equal(after.facts.length, before.facts.length);
  assert.equal(playerView(after).story?.leads[0].id, 'ask_witness');
  assert.ok(publicChanges(before, after).some(change => change === 'Lead available: Ask about the person at the tower.'));
});

test('progress rejects unknown, hidden, unrelated or empty evidence without applying any world changes', () => {
  for (const [facts, claims, error] of [
    [['missing'], [], 'STORY_UNKNOWN_FACT'],
    [['cause'], [], 'STORY_HIDDEN_PROGRESS'],
    [[], ['missing'], 'STORY_UNKNOWN_CLAIM'],
    [[], [], 'STORY_PROGRESS_WITHOUT_EVIDENCE'],
  ] as [string[], string[], string][]) {
    const before = seedWorld(), saved = structuredClone(before);
    assert.throws(() => applyStoryProposal(before, proposal([{ op: 'update_entity', id: 'player', field: 'condition', value: 'Tired' }], plan({ progress: [{ questId: 'mystery', factIds: facts, claimIds: claims }] }))), new RegExp(error));
    assert.deepEqual(before, saved);
  }
  assert.throws(() => applyStoryProposal(seedWorld(), proposal([{ op: 'establish_fact', fact: { id: 'book', key: 'book.mark', text: 'You add a mark to the notebook.', subjects: ['journal'], at: 481, knownBy: ['player'] } }], plan({ progress: [{ questId: 'mystery', factIds: ['book'], claimIds: [] }] }))), /STORY_UNRELATED_PROGRESS/);
});

test('the hierarchy accepts broader parents and does not automatically complete an ancestor', () => {
  const before = seedWorld();
  before.quests.push(quest('world_story', 'world', null), quest('local_help', 'local', 'mystery'), quest('immediate_help', 'immediate', 'local_help'));
  before.quests[0].guidance!.parentId = 'world_story';
  const after = applyStoryProposal(before, proposal([clue(), { op: 'update_quest', id: 'immediate_help', status: 'completed' }], plan({
    progress: [{ questId: 'immediate_help', factIds: ['clue'], claimIds: [] }], focusQuestId: 'local_help',
  })));
  assert.equal(after.quests.find(quest => quest.id === 'immediate_help')?.status, 'completed');
  assert.equal(after.quests.find(quest => quest.id === 'local_help')?.status, 'active');
  assert.equal(after.quests.find(quest => quest.id === 'mystery')?.status, 'active');
});

test('invalid parents, same-scope parents and cycles cannot enter the quest graph', () => {
  assert.throws(() => applyStoryProposal(seedWorld(), proposal([], plan({ questUpdates: [update(seedWorld(), { parentId: 'missing' })] }))), /STORY_INVALID_PARENT/);
  assert.throws(() => applyStoryProposal(seedWorld(), proposal([], plan({ questUpdates: [update(seedWorld(), { parentId: 'mystery' })] }))), /STORY_INVALID_PARENT/);
  const before = seedWorld(); before.quests.push(quest('other_arc', 'arc', null));
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ questUpdates: [update(before, { parentId: 'other_arc' })] }))), /STORY_INVALID_PARENT_SCOPE/);
  const cyclic = seedWorld(); cyclic.quests.push(quest('child', 'local', 'mystery')); cyclic.quests[0].guidance!.parentId = 'child';
  assert.throws(() => applyStoryProposal(cyclic, proposal()), /STORY_INVALID_PARENT_SCOPE|STORY_QUEST_CYCLE/);
});

test('public guidance rejects hidden entity, fact and claim references and ungrounded leads', () => {
  const before = seedWorld(); before.claims.push({ id: 'secret', speakerId: 'mara', text: 'Private testimony.', knownBy: ['mara'] });
  for (const lead of [
    { id: 'secret_entity', text: 'A secret lead.', action: 'Investigate.', entityIds: ['order'], evidenceFactIds: [], evidenceClaimIds: [] },
    { id: 'secret_fact', text: 'A secret lead.', action: 'Investigate.', entityIds: [], evidenceFactIds: ['cause'], evidenceClaimIds: [] },
    { id: 'secret_claim', text: 'A secret lead.', action: 'Investigate.', entityIds: [], evidenceFactIds: [], evidenceClaimIds: ['secret'] },
  ]) assert.throws(() => applyStoryProposal(before, proposal([], plan({ questUpdates: [update(before, { leads: [lead] })] }))), /STORY_HIDDEN_LEAD_REFERENCE/);
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ questUpdates: [update(before, { leads: [{ id: 'empty', text: 'Nothing concrete.', action: 'Go somewhere.', entityIds: [], evidenceFactIds: [], evidenceClaimIds: [] }] })] }))), /STORY_UNGROUNDED_LEAD/);
});

test('player projection hides private parent IDs and evidence IDs and rechecks lead visibility', () => {
  const before = seedWorld(); before.quests.push(quest('secret_world_arc', 'world', null, [])); before.quests[0].guidance!.parentId = 'secret_world_arc';
  before.quests[0].guidance!.entityIds.push('order');
  const view = playerView(before);
  assert.equal(view.quests[0].parentId, null);
  assert.doesNotMatch(JSON.stringify(view), /secret_world_arc|evidenceFactIds|evidenceClaimIds|lastProgressRevision|Hollow Choir/);
  before.facts.find(fact => fact.id === 'arrival')!.knownBy = ['mara'];
  assert.ok(playerView(before).story?.leads.every(lead => lead.id !== 'ask_woman'));
  before.entities.find(entity => entity.id === 'tower')!.knownBy = ['mara'];
  assert.ok(playerView(before).quests[0].leads?.every(lead => lead.id !== 'inspect_tower'));
});

test('public story focus cannot point to a hidden or finished quest', () => {
  const before = seedWorld(); before.quests.push(quest('hidden', 'world', null, []));
  for (const focusQuestId of ['hidden', 'missing']) assert.throws(() => applyStoryProposal(before, proposal([], plan({ focusQuestId }))), /STORY_INVALID_FOCUS/);
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ focusQuestId: null }))), /STORY_FOCUS_REQUIRED/);
  before.story!.focusQuestId = 'hidden';
  assert.equal(effectiveStoryFocus(before), 'mystery');
  before.quests[0].status = 'completed';
  assert.equal(effectiveStoryFocus(before), null);
  assert.deepEqual(publicStoryDirection(before).leads, []);
});

test('quest resolution needs fresh evidence, and terminal quests cannot be reconfigured later', () => {
  const before = seedWorld(), saved = structuredClone(before);
  assert.throws(() => applyStoryProposal(before, proposal([{ op: 'update_quest', id: 'mystery', status: 'completed' }], plan({ focusQuestId: null }))), /STORY_RESOLUTION_WITHOUT_EVIDENCE/);
  assert.deepEqual(before, saved);
  const after = applyStoryProposal(before, proposal([clue(), { op: 'update_quest', id: 'mystery', status: 'completed' }], plan({ focusQuestId: null, progress: [{ questId: 'mystery', factIds: ['clue'], claimIds: [] }], questUpdates: [update(before, { leads: [] })] })));
  assert.deepEqual(playerView(after).story?.leads, []);
  assert.throws(() => applyStoryProposal(after, proposal([], plan({ focusQuestId: null, questUpdates: [update(before, { leads: [] })] }))), /STORY_RESOLVED_QUEST/);
});

test('a quest cannot be invented and immediately resolved, with or without supporting evidence', () => {
  for (const withEvidence of [false, true]) {
    const before = seedWorld(), saved = structuredClone(before);
    const operations: Operation[] = [
      { op: 'update_entity', id: 'player', field: 'condition', value: 'Tired' },
      { op: 'add_quest', quest: { id: 'instant', title: 'An invented accomplishment', description: 'A throwaway objective.', status: 'active', knownBy: ['player'] } },
      ...(withEvidence ? [clue()] : []),
      { op: 'update_quest', id: 'instant', status: 'completed' },
    ];
    const storyPlan = plan({ progress: withEvidence ? [{ questId: 'instant', factIds: ['clue'], claimIds: [] }] : [] });
    assert.throws(() => applyStoryProposal(before, proposal(operations, storyPlan)), /STORY_NEW_QUEST_ALREADY_RESOLVED/);
    assert.deepEqual(before, saved);
    assert.equal(before.quests.some(quest => quest.id === 'instant'), false);
  }
});

test('private world development may resolve a hidden thread without pretending the player progressed', () => {
  const before = applyStoryProposal(seedWorld(), proposal()); before.quests.push(quest('hidden_world', 'world', null, []));
  const after = applyStoryProposal(before, proposal([
    { op: 'establish_fact', fact: { id: 'private_outcome', key: 'private.outcome', text: 'A private world event occurred.', subjects: ['ashford'], at: 482, knownBy: [] } },
    { op: 'update_quest', id: 'hidden_world', status: 'completed' },
  ], plan({ progress: [{ questId: 'hidden_world', factIds: ['private_outcome'], claimIds: [] }] })));
  assert.equal(after.quests.find(quest => quest.id === 'hidden_world')?.status, 'completed');
  assert.equal(after.story?.quietTurns, 2);
  assert.equal(after.story?.lastProgressRevision, 0);
  assert.doesNotMatch(JSON.stringify(playerView(after)), /hidden_world|private_outcome|private world event/i);
});

test('clarifications and blocked inventory cannot advance story counters or mutate guidance', () => {
  const before = seedWorld(), saved = structuredClone(before);
  const clarification = { ...proposal([], plan({ focusQuestId: null })), kind: 'clarification', clarification: 'Which?', elapsedMinutes: 0 };
  assert.deepEqual(applyStoryProposal(before, clarification), before);
  assert.throws(() => applyStoryProposal(before, { ...clarification, storyPlan: plan() }), /INVALID_CLARIFICATION/);
  assert.throws(() => applyStoryProposal(before, { ...proposal([], plan({ questUpdates: [update(before, { objective: 'Ignore the missing staff.' })] })), itemActions: [{ action: 'use', itemId: null, quantity: 1, recipientId: null }] }), /ITEM_REQUIRED/);
  assert.deepEqual(before, saved);
});

test('duplicate quest updates and oversized plans are rejected instead of silently winning by order', () => {
  const before = seedWorld();
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ questUpdates: [update(before), update(before)] }))), /STORY_DUPLICATE_QUEST/);
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ questUpdates: Array.from({ length: 4 }, () => update(before)) }))));
  assert.throws(() => applyStoryProposal(before, proposal([], plan({ questUpdates: [update(before, { leads: Array.from({ length: 4 }, () => before.quests[0].guidance!.leads[0]) })] }))));
});

test('mixed version replay preserves historical reducers and continues with evidence-backed story plans', () => {
  const seed = seedWorld(); delete seed.story; delete seed.quests[0].guidance;
  const legacy = { kind: 'action' as const, interpretation: 'You receive the lantern.', clarification: null, elapsedMinutes: 1, operations: [{ op: 'update_entity' as const, id: 'lantern', field: 'ownerId' as const, value: 'player' }] };
  const inventory = { ...legacy, operations: [], itemActions: [{ action: 'use' as const, itemId: 'lantern', quantity: 1, recipientId: null }] };
  const story = proposal([clue()], plan({ questUpdates: [update()], progress: [{ questId: 'mystery', factIds: ['clue'], claimIds: [] }] }));
  const expected = applyStoryProposal(applyInventoryProposal(applyProposal(seed, legacy), inventory), story);
  const turns = [{ engine_version: '1.0.0', proposal: legacy }, { engine_version: '1.1.0', proposal: inventory }, { engine_version: '1.2.0', proposal: story }];
  assert.deepEqual(replayVersioned(seed, turns), expected);
  assert.deepEqual(replayVersioned(seed, turns), replayVersioned(seed, turns));
  assert.equal(seed.story, undefined); assert.equal(seed.quests[0].guidance, undefined);
  assert.equal(replayVersioned(seed, turns.slice(0, 2)).story, undefined);
  assert.throws(() => applyStoryProposal(seed, inventory));
});
