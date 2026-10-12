import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProposal } from '../src/server/proposal-normalization';
import { seedWorld } from '../src/engine/seed';
import { applyNarrativeProposal } from '../src/engine/story';
import { replayVersioned } from '../src/engine/inventory';
import { questSchema, type NarrativeProposal, type Operation } from '../src/engine/types';

function proposal(operations: Operation[]): NarrativeProposal {
  return { kind: 'action', interpretation: 'You wait.', clarification: null, elapsedMinutes: 1,
    operations, itemActions: [], storyPlan: { focusQuestId: 'mystery', questUpdates: [], progress: [] } };
}

test('unchanged stored quests and rules are omitted without changing history or replay rules', () => {
  const before = seedWorld(), original = structuredClone(before);
  const candidate = proposal([
    { op: 'add_quest', quest: questSchema.parse(before.quests[0]) },
    { op: 'add_rule', rule: structuredClone(before.rules[0]) },
    { op: 'add_claim', claim: { id: 'reply_1', text: 'I will wait here.', speakerId: 'mara', knownBy: ['player', 'mara'] } },
  ]);
  const raw = structuredClone(candidate);
  assert.throws(() => applyNarrativeProposal(before, candidate), /DUPLICATE_ID/);
  const result = normalizeProposal(before, candidate);
  assert.deepEqual(result.normalization, { version: 'proposal-normalization-1', omittedOperations: [
    { index: 0, op: 'add_quest', id: 'mystery', reason: 'already_established' },
    { index: 1, op: 'add_rule', id: 'memory', reason: 'already_established' },
  ] });
  assert.deepEqual(result.proposal.operations, [candidate.operations[2]]);
  const after = applyNarrativeProposal(before, result.proposal);
  assert.deepEqual(after.quests, original.quests);
  assert.deepEqual(after.rules, original.rules);
  assert.equal(after.claims.length, 1);
  assert.deepEqual(replayVersioned(before, [{ engine_version: '1.3.0', proposal: result.proposal }]), after);
  assert.deepEqual(candidate, raw);
  assert.deepEqual(before, original);
});

test('audience order is immaterial but changes to knowledge or quest/rule content stay blocked', () => {
  const before = seedWorld();
  before.quests[0].knownBy = ['player', 'mara'];
  before.rules[0].knownBy = ['player', 'mara'];
  const quest = questSchema.parse(before.quests[0]), rule = structuredClone(before.rules[0]);
  const reordered = normalizeProposal(before, proposal([
    { op: 'add_quest', quest: { ...quest, knownBy: ['mara', 'player'] } },
    { op: 'add_rule', rule: { ...rule, knownBy: ['mara', 'player'] } },
  ]));
  assert.equal(reordered.proposal.operations.length, 0);
  const conflicts: Operation[] = [
    { op: 'add_quest', quest: { ...quest, title: 'A different quest' } },
    { op: 'add_quest', quest: { ...quest, description: 'Different history.' } },
    { op: 'add_quest', quest: { ...quest, status: 'completed' } },
    { op: 'add_quest', quest: { ...quest, knownBy: ['player'] } },
    { op: 'add_quest', quest: { ...quest, knownBy: ['player', 'player'] } },
    { op: 'add_rule', rule: { ...rule, text: 'Magic changes the past.' } },
    { op: 'add_rule', rule: { ...rule, knownBy: ['mara'] } },
  ];
  for (const operation of conflicts) {
    const candidate = proposal([operation]);
    const result = normalizeProposal(before, candidate);
    assert.deepEqual(result.proposal, candidate);
    assert.equal(result.normalization.omittedOperations.length, 0);
    assert.throws(() => applyNarrativeProposal(before, result.proposal), /DUPLICATE_ID/);
  }
});

test('normalization cannot reveal private quests or rules by merging observers', () => {
  const before = seedWorld();
  before.quests[0].knownBy = ['mara'];
  before.rules[0].knownBy = ['mara'];
  for (const operation of [
    { op: 'add_quest', quest: { ...questSchema.parse(before.quests[0]), knownBy: ['mara', 'player'] } },
    { op: 'add_rule', rule: { ...before.rules[0], knownBy: ['mara', 'player'] } },
  ] satisfies Operation[]) {
    const candidate = proposal([operation]);
    assert.deepEqual(normalizeProposal(before, candidate).proposal, candidate);
    assert.throws(() => applyNarrativeProposal(before, candidate), /DUPLICATE_ID/);
  }
});

test('new records are campaign scoped and repeated new IDs remain an error', () => {
  const first = seedWorld(), second = seedWorld();
  first.quests.push({ ...questSchema.parse(first.quests[0]), id: 'local_goal' });
  const addition: Operation = { op: 'add_quest', quest: questSchema.parse(first.quests[1]) };
  assert.equal(normalizeProposal(first, proposal([addition])).proposal.operations.length, 0);
  const candidate = normalizeProposal(second, proposal([addition])).proposal;
  assert.equal(candidate.operations.length, 1);
  assert.equal(applyNarrativeProposal(second, candidate).quests.length, 2);
  const repeated = normalizeProposal(second, proposal([addition, structuredClone(addition)]));
  assert.equal(repeated.normalization.omittedOperations.length, 0);
  assert.throws(() => applyNarrativeProposal(second, repeated.proposal), /DUPLICATE_ID/);
});

test('entities, inventory, facts, claims and events never enter the reassertion allowlist', () => {
  const before = seedWorld();
  before.claims.push({ id: 'account', speakerId: 'mara', text: 'I was here.', knownBy: ['mara'] });
  const duplicates: Operation[] = [
    { op: 'create_entity', entity: structuredClone(before.entities.find(entity => entity.id === 'journal')!) },
    { op: 'establish_fact', fact: structuredClone(before.facts[0]) },
    { op: 'add_claim', claim: structuredClone(before.claims[0]) },
    { op: 'schedule_event', event: structuredClone(before.scheduled[0]) },
  ];
  for (const operation of duplicates) {
    const candidate = proposal([operation]);
    const result = normalizeProposal(before, candidate);
    assert.deepEqual(result.proposal, candidate);
    assert.equal(result.normalization.omittedOperations.length, 0);
    assert.throws(() => applyNarrativeProposal(before, result.proposal));
  }
});

test('clarifications and quest status transitions cannot be repaired by dropping operations', () => {
  const before = seedWorld();
  const addition: Operation = { op: 'add_quest', quest: questSchema.parse(before.quests[0]) };
  const clarification: NarrativeProposal = { ...proposal([addition]), kind: 'clarification', elapsedMinutes: 0,
    clarification: 'What do you mean?', storyPlan: { focusQuestId: null, questUpdates: [], progress: [] } };
  assert.deepEqual(normalizeProposal(before, clarification).proposal, clarification);
  assert.throws(() => applyNarrativeProposal(before, clarification), /INVALID_CLARIFICATION/);
  const update: Operation = { op: 'update_quest', id: 'mystery', status: 'completed' };
  for (const operations of [[addition, update], [update, addition]]) {
    const candidate = proposal(operations);
    assert.deepEqual(normalizeProposal(before, candidate).proposal, candidate);
    assert.throws(() => applyNarrativeProposal(before, candidate), /DUPLICATE_ID/);
  }
  before.quests[0].status = 'completed';
  assert.throws(() => applyNarrativeProposal(before, normalizeProposal(before, proposal([addition])).proposal), /DUPLICATE_ID/);
});
