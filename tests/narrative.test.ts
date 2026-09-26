import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { seedWorld } from '../src/engine/seed';
import { applyNarrativeProposal, applyStoryProposal, parseNarrativeProposal } from '../src/engine/story';
import { applyInventoryProposal, replayVersioned } from '../src/engine/inventory';
import { applyProposal } from '../src/engine/reducer';
import { playerView, publicChanges } from '../src/engine/view';
import { narrativeWireProposalSchema, type NarrativePlan, type NarrativeProposal, type Operation, type QuestLead, type World } from '../src/engine/types';

const legacyLead: QuestLead = { id: 'legacy_command', text: 'Legacy suggested input.', action: 'LEGACY_PRESET_COMMAND_MUST_NOT_APPEAR', entityIds: ['mara'], evidenceFactIds: ['arrival'], evidenceClaimIds: [] };
function narrativePlan(changes: Partial<NarrativePlan> = {}): NarrativePlan { return { focusQuestId: 'mystery', questUpdates: [], progress: [], ...changes }; }
function proposal(operations: Operation[] = [], storyPlan = narrativePlan()): NarrativeProposal {
  return { kind: 'action', interpretation: 'You investigate.', clarification: null, elapsedMinutes: 1, itemActions: [], operations, storyPlan };
}
function update(world = seedWorld()): NarrativePlan['questUpdates'][number] {
  const { lastProgressRevision: omitted, leads: legacy, ...guidance } = world.quests[0].guidance!;
  return { questId: 'mystery', ...guidance };
}
function clue(): Operation {
  return { op: 'add_claim', claim: { id: 'witness', speakerId: 'mara', text: 'I saw a light move behind the tower window.', knownBy: ['player'] } };
}

test('current provider schema contains no preset lead field and retains strict structured-output requirements', () => {
  const schema = z.toJSONSchema(narrativeWireProposalSchema, { target: 'draft-7' });
  let objects = 0;
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    if (node.type === 'object') {
      objects++;
      assert.equal(node.additionalProperties, false);
      const properties = node.properties as Record<string, unknown> ?? {};
      assert.deepEqual([...(node.required as string[] ?? [])].sort(), Object.keys(properties).sort());
      assert.ok(!Object.hasOwn(properties, 'leads'));
      assert.ok(!Object.hasOwn(properties, 'suggestedActions'));
    }
    Object.values(node).forEach(visit);
  }
  visit(schema); assert.ok(objects > 15);
});

test('current parsing accepts objective updates without generating synthetic accepted lead fields', () => {
  const npc = { ...seedWorld().entities.find(entity => entity.id === 'mara')!, id: 'visitor', itemState: null };
  const raw = { ...proposal([], narrativePlan({ questUpdates: [update()] })), operations: [{ op: 'create_entity', entity: npc }] };
  const parsed = parseNarrativeProposal(raw);
  assert.ok(!Object.hasOwn(parsed.storyPlan.questUpdates[0], 'leads'));
  if (parsed.operations[0].op === 'create_entity') assert.ok(!Object.hasOwn(parsed.operations[0].entity, 'itemState'));
  assert.equal(applyNarrativeProposal(seedWorld(), parsed).revision, 1);
});

test('current parser and reducer reject legacy generated presets rather than silently accepting them', () => {
  const before = seedWorld(), saved = structuredClone(before);
  const withLeads = { ...proposal(), storyPlan: { ...narrativePlan(), questUpdates: [{ ...update(), leads: [legacyLead] }] } };
  assert.throws(() => parseNarrativeProposal(withLeads));
  assert.throws(() => applyNarrativeProposal(before, withLeads));
  assert.throws(() => parseNarrativeProposal({ ...proposal(), storyPlan: { ...narrativePlan(), suggestedActions: ['Look around'] } }));
  assert.throws(() => parseNarrativeProposal({ ...proposal(), leads: [legacyLead] }));
  assert.deepEqual(before, saved);
});

test('current guidance updates keep goals and evidence while old accepted lead records stay untouched', () => {
  const before = seedWorld(); before.quests[0].guidance!.leads = [structuredClone(legacyLead)];
  const saved = structuredClone(before);
  const after = applyNarrativeProposal(before, proposal([clue()], narrativePlan({
    questUpdates: [{ ...update(before), objective: 'Learn who was inside the tower.' }],
    progress: [{ questId: 'mystery', factIds: [], claimIds: ['witness'] }],
  })));
  assert.equal(after.story?.quietTurns, 0);
  assert.equal(after.quests[0].guidance?.objective, 'Learn who was inside the tower.');
  assert.deepEqual(after.quests[0].guidance?.leads, []);
  assert.equal(after.quests[0].guidance?.lastProgressRevision, 1);
  assert.deepEqual(before, saved);
  assert.equal(before.quests[0].guidance?.leads[0].action, legacyLead.action);
});

test('current projections and receipts suppress legacy presets without altering saved data', () => {
  const before = seedWorld(); before.quests[0].guidance!.leads = [structuredClone(legacyLead)];
  const after = applyNarrativeProposal(before, proposal());
  assert.deepEqual(after.quests[0].guidance?.leads, [legacyLead]);
  for (const world of [before, after]) {
    const view = playerView(world);
    assert.ok(!Object.hasOwn(view.story!, 'leads'));
    assert.ok(!Object.hasOwn(view.quests[0], 'leads'));
    assert.doesNotMatch(JSON.stringify(view), /LEGACY_PRESET_COMMAND|legacy_command|Legacy suggested input/);
  }
  assert.ok(publicChanges(before, after).every(change => !change.startsWith('Lead available:')));
});

test('current narrative plans retain evidence, hierarchy and quest-resolution gates', () => {
  const before = seedWorld(), saved = structuredClone(before);
  assert.throws(() => applyNarrativeProposal(before, proposal([], narrativePlan({ progress: [{ questId: 'mystery', factIds: ['ruin'], claimIds: [] }] }))), /STORY_STALE_PROGRESS/);
  assert.throws(() => applyNarrativeProposal(before, proposal([], narrativePlan({ questUpdates: [{ ...update(), parentId: 'mystery' }] }))), /STORY_INVALID_PARENT/);
  assert.throws(() => applyNarrativeProposal(before, proposal([{ op: 'update_quest', id: 'mystery', status: 'completed' }], narrativePlan({ focusQuestId: null }))), /STORY_RESOLUTION_WITHOUT_EVIDENCE/);
  assert.deepEqual(before, saved);
  const after = applyNarrativeProposal(before, proposal([clue(), { op: 'update_quest', id: 'mystery', status: 'completed' }], narrativePlan({ focusQuestId: null, progress: [{ questId: 'mystery', factIds: [], claimIds: ['witness'] }] })));
  assert.equal(after.quests[0].status, 'completed');
  assert.equal(after.story?.quietTurns, 0);
});

test('current narrative plans keep blocked inventory and clarifications atomic', () => {
  const before = seedWorld(), saved = structuredClone(before);
  assert.throws(() => applyNarrativeProposal(before, { ...proposal(), itemActions: [{ action: 'use', itemId: null, quantity: 1, recipientId: null }] }), /ITEM_REQUIRED/);
  assert.deepEqual(before, saved);
  assert.deepEqual(applyNarrativeProposal(before, { ...proposal([], narrativePlan({ focusQuestId: null })), kind: 'clarification', clarification: 'Which?', elapsedMinutes: 0 }), before);
});

test('mixed 1.0 through 1.3 replay preserves historical presets and accepts command-free new direction', () => {
  const seed = seedWorld(); delete seed.story; delete seed.quests[0].guidance;
  const legacy = { kind: 'action' as const, interpretation: 'You receive the lantern.', clarification: null, elapsedMinutes: 1, operations: [{ op: 'update_entity' as const, id: 'lantern', field: 'ownerId' as const, value: 'player' }] };
  const inventory = { ...legacy, operations: [], itemActions: [{ action: 'use' as const, itemId: 'lantern', quantity: 1, recipientId: null }] };
  const oldStory = { ...proposal(), storyPlan: { ...narrativePlan(), questUpdates: [{ ...update(), leads: [legacyLead] }] } };
  const current = proposal([clue()], narrativePlan({ progress: [{ questId: 'mystery', factIds: [], claimIds: ['witness'] }] }));
  const history = [{ engine_version: '1.0.0', proposal: legacy }, { engine_version: '1.1.0', proposal: inventory }, { engine_version: '1.2.0', proposal: oldStory }];
  const oldExpected = applyStoryProposal(applyInventoryProposal(applyProposal(seed, legacy), inventory), oldStory);
  assert.deepEqual(replayVersioned(seed, history), oldExpected);
  assert.deepEqual(oldExpected.quests[0].guidance?.leads, [legacyLead]);
  const all = [...history, { engine_version: '1.3.0', proposal: current }];
  assert.deepEqual(replayVersioned(seed, all), applyNarrativeProposal(oldExpected, current));
  assert.deepEqual(replayVersioned(seed, all).quests[0].guidance?.leads, [legacyLead]);
  assert.doesNotMatch(JSON.stringify(playerView(replayVersioned(seed, all))), /LEGACY_PRESET_COMMAND/);
  assert.equal(seed.story, undefined);
});
