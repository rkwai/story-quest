import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, QUEST_CONTEXT_LIMIT } from '../src/engine/context';
import { seedWorld } from '../src/engine/seed';
import { playerView } from '../src/engine/view';
import type { Quest, QuestScope, World } from '../src/engine/types';

function quest(id: string, scope: QuestScope = 'local', parentId: string | null = null): Quest {
  return {
    id, title: id.replaceAll('_', ' '), description: `Investigate ${id}.`, status: 'active', knownBy: ['player'],
    guidance: { scope, parentId, objective: `Resolve ${id}.`, stakes: `The fate of ${id}.`, entityIds: ['ashford'], leads: [], lastProgressRevision: 0 }
  };
}
function worldWithQuests(...quests: Quest[]): World {
  const world = seedWorld();
  world.quests = quests;
  return world;
}

test('quest context is bounded as active branches grow; exact interest beats saved focus and decoy prose', () => {
  const focus = quest('village_cistern'), saved = quest('old_watch');
  const filler = Array.from({ length: 250 }, (_, index) => {
    const next = quest(`errand_${index}`);
    next.description = 'village cistern '.repeat(60);
    return next;
  });
  const world = worldWithQuests(saved, ...filler, focus);
  world.story = { focusQuestId: saved.id, quietTurns: 2, lastProgressRevision: 0 };
  const original = structuredClone(world);
  const context = buildContext(world, 'I investigate the village cistern.');
  assert.equal(context.manifest.focusQuestId, focus.id);
  assert.equal(context.state.quests.length, QUEST_CONTEXT_LIMIT);
  assert.equal(context.manifest.excludedQuestCount, world.quests.length - QUEST_CONTEXT_LIMIT);
  assert.ok(context.manifest.questSelection.find(item => item.id === focus.id)?.reasons.includes('explicit_quest'));
  assert.ok(context.manifest.chars <= 24000);
  assert.deepEqual(context.state.storyDirector.selectedQuestIds, context.manifest.questIds);
  assert.equal(context.state.storyDirector.quietTurns, 2);
  assert.equal(context.state.storyDirector.needsDirection, false, 'an existing objective does not need generated action suggestions');
  assert.doesNotMatch(JSON.stringify(context.state), /errand_249/);
  assert.deepEqual(world, original);
  const reversed = structuredClone(world); reversed.quests.reverse();
  assert.deepEqual(buildContext(reversed, 'I investigate the village cistern.').manifest.questIds, context.manifest.questIds);
});

test('mandatory focus ancestry retains completed stakes without making them active again', () => {
  const root = quest('world_stakes', 'world'), arc = quest('large_mystery', 'arc', root.id);
  const local = quest('town_well', 'local', arc.id), immediate = quest('brass_latch', 'immediate', local.id);
  root.status = 'completed'; arc.status = 'failed';
  const world = worldWithQuests(root, arc, local, immediate, ...Array.from({ length: 30 }, (_, i) => quest(`optional_${i}`)));
  const context = buildContext(world, 'Examine the brass latch.');
  assert.equal(context.manifest.focusQuestId, immediate.id);
  assert.deepEqual(context.manifest.questIds.slice(0, 4), [immediate.id, local.id, arc.id, root.id]);
  assert.equal(context.state.quests.find(q => q.id === root.id)?.status, 'completed');
  assert.equal(context.state.quests.find(q => q.id === arc.id)?.status, 'failed');
  assert.ok(context.manifest.questSelection.find(q => q.id === root.id)?.reasons.includes(`ancestor:${immediate.id}`));
  assert.match(context.state.storyDirector.instruction, /exact player action or question first/);
});

test('explicit related entity selects its quest over unrelated saved focus', () => {
  const local = quest('archive_riddle'), saved = quest('camp_report');
  local.guidance!.entityIds = ['tower']; saved.guidance!.entityIds = ['ashford'];
  const world = worldWithQuests(saved, local);
  world.story = { focusQuestId: saved.id, quietTurns: 0, lastProgressRevision: 0 };
  const context = buildContext(world, 'I examine the bell tower.');
  assert.equal(context.manifest.focusQuestId, local.id);
  assert.ok(context.manifest.questSelection.find(q => q.id === local.id)?.reasons.includes('referenced_entity'));
});

test('selected quest evidence includes facts, claim speakers and transitive ownership/location references', () => {
  const selected = quest('missing_key');
  const world = worldWithQuests(selected);
  world.entities.push(
    { id: 'remote', kind: 'location', name: 'Distant market', description: 'A distant market.', locationId: null, ownerId: null, condition: 'Open', knownBy: ['player'] },
    { id: 'merchant', kind: 'npc', name: 'Merchant', description: 'Carries a key.', locationId: 'remote', ownerId: null, condition: 'Steady', knownBy: ['player'] },
    { id: 'key', kind: 'item', name: 'Brass key', description: 'A distant key.', locationId: null, ownerId: 'merchant', condition: 'Worn', knownBy: ['player'] }
  );
  world.facts.push({ id: 'key_origin', key: 'key.origin', text: 'The key was made in the market.', subjects: ['key'], at: 0, knownBy: ['player'] });
  world.claims.push({ id: 'key_claim', speakerId: 'merchant', text: 'This key opens a cellar.', knownBy: ['player'] });
  selected.guidance!.leads = [{ id: 'ask_merchant', text: 'Ask about the key.', action: 'Ask the merchant about the key.', entityIds: ['key'], evidenceFactIds: ['key_origin'], evidenceClaimIds: ['key_claim'] }];
  const context = buildContext(world, 'Continue the missing key investigation.');
  assert.ok(context.manifest.factIds.includes('key_origin'));
  assert.ok(context.manifest.claimIds.includes('key_claim'));
  assert.ok(['key', 'merchant', 'remote'].every(id => context.manifest.entityIds.includes(id)));
  assert.equal(context.state.storyDirector.needsDirection, false);
  world.story = { focusQuestId: selected.id, quietTurns: 3, lastProgressRevision: 0 };
  assert.equal(buildContext(world, 'Continue.').state.storyDirector.needsDirection, true);
});

test('a relevant secret branch and its evidence stay DM-only and cannot become the player focus', () => {
  const known = quest('visible_question'), hidden = quest('buried_pact'); hidden.knownBy = [];
  hidden.guidance!.entityIds = ['ashford', 'order'];
  hidden.guidance!.leads = [{ id: 'private_lead', text: 'PRIVATE_CULPRIT_DIRECTION', action: 'PRIVATE_CULPRIT_ACTION', entityIds: ['order'], evidenceFactIds: ['cause'], evidenceClaimIds: [] }];
  const world = worldWithQuests(known, hidden);
  const context = buildContext(world, 'Tell me about the buried pact.');
  assert.equal(context.manifest.focusQuestId, known.id);
  assert.ok(context.manifest.questIds.includes(hidden.id));
  assert.ok(context.manifest.factIds.includes('cause'));
  assert.doesNotMatch(JSON.stringify(context.state), /PRIVATE_CULPRIT_DIRECTION|PRIVATE_CULPRIT_ACTION/);
  assert.doesNotMatch(JSON.stringify(playerView(world)), /PRIVATE_CULPRIT|buried_pact|Hollow Choir|buried bell/);
});

test('optional oversized quests are dropped atomically without displacing focus, truth, inventory, rules or deadlines', () => {
  const main = quest('rain_shelter'), world = worldWithQuests(main);
  const core = buildContext(world, 'I investigate rain shelter.');
  const optional = quest('other_branch'); optional.description = 'x'.repeat(1200);
  world.quests.push(optional);
  const context = buildContext(world, 'I investigate rain shelter.', core.manifest.chars + 20);
  assert.deepEqual(context.manifest.questIds, [main.id]);
  assert.deepEqual(context.manifest.factIds, core.manifest.factIds);
  assert.deepEqual(context.state.rules, world.rules);
  assert.deepEqual(context.state.inventory, core.state.inventory);
  assert.deepEqual(context.state.scheduled, world.scheduled);
  assert.equal(context.manifest.excludedQuestCount, 1);
  assert.ok(context.manifest.chars <= core.manifest.chars + 20);
});

test('mandatory focus/evidence overflow fails closed rather than dropping established context', () => {
  const root = quest('old_promises', 'world'), focus = quest('current_thread', 'immediate', root.id);
  const world = worldWithQuests(root, focus);
  const context = buildContext(world, 'Follow the current thread.');
  assert.throws(() => buildContext(world, 'Follow the current thread.', context.manifest.chars - 1), /CONTEXT_BUDGET_EXCEEDED/);
  focus.guidance!.leads = [{ id: 'bad', text: 'Missing evidence.', action: 'Inspect the evidence.', entityIds: [], evidenceFactIds: ['does_not_exist'], evidenceClaimIds: [] }];
  assert.throws(() => buildContext(world, 'Follow the current thread.'), /UNKNOWN_FACT/);
});

test('unrelated hidden quests do not fill context and invalid ancestry fails closed', () => {
  const main = quest('rain_shelter'), hidden = quest('secret_trip');
  hidden.knownBy = []; hidden.guidance!.entityIds = ['order'];
  const world = worldWithQuests(main, hidden);
  assert.deepEqual(buildContext(world, 'Wait here.').manifest.questIds, [main.id]);
  main.guidance!.parentId = hidden.id;
  assert.throws(() => buildContext(world, 'Wait here.'), /STORY_INVALID_ANCESTRY/);
});

test('an immediate quest can retain a legacy parent with the default local scope', () => {
  const legacy: Quest = { id: 'legacy', title: 'Old unfinished question', description: 'An existing adventure objective.', status: 'active', knownBy: ['player'] };
  const child = quest('fresh_lead', 'immediate', legacy.id);
  const world = worldWithQuests(legacy, child);
  assert.deepEqual(buildContext(world, 'Investigate the fresh lead.').manifest.questIds, [child.id, legacy.id]);
});

test('selected remote quest entities bring established secret facts as mandatory truth', () => {
  const main = quest('winter_observatory'); main.guidance!.entityIds = ['observatory'];
  const world = worldWithQuests(main);
  world.entities.push({ id: 'observatory', kind: 'location', name: 'Distant observatory', description: 'A remote ruined dome.', locationId: null, ownerId: null, condition: 'Ruined', knownBy: ['player'] });
  world.facts.push({ id: 'observatory_cause', key: 'observatory.cause', text: 'PRIVATE_ORIGIN: The dome fell before Ashford was destroyed.', subjects: ['observatory', 'order'], at: -5000, knownBy: [] });
  const context = buildContext(world, 'Consider the winter observatory.');
  assert.ok(context.manifest.factIds.includes('observatory_cause'));
  assert.ok(context.manifest.entityIds.includes('order'));
  assert.throws(() => buildContext(world, 'Consider the winter observatory.', context.manifest.chars - 1), /CONTEXT_BUDGET_EXCEEDED/);
  assert.doesNotMatch(JSON.stringify(playerView(world)), /PRIVATE_ORIGIN/);
});

test('a character without a location does not make every unplaced entity part of the scene', () => {
  const world = worldWithQuests();
  world.entities.find(entity => entity.id === world.playerId)!.locationId = null;
  for (let index = 0; index < 100; index++) world.entities.push({ id: `far_${index}`, kind: 'location', name: `Far place ${index}`, description: 'x'.repeat(1000), locationId: null, ownerId: null, condition: 'Unknown', knownBy: [] });
  const context = buildContext(world, 'Wait.');
  assert.ok(context.manifest.chars <= 24000);
  assert.ok(!context.manifest.entityIds.some(id => id.startsWith('far_')));
});

test('explicit questions retrieve completed and failed quest history without making it active focus', () => {
  for (const status of ['completed', 'failed'] as const) {
    const active = quest('current_patrol'), resolved = quest('old_beacon');
    resolved.status = status;
    resolved.description = 'The watch ended after the beacon keeper left.';
    resolved.guidance!.objective = 'Find the missing beacon keeper.';
    resolved.guidance!.entityIds = ['beacon'];
    const world = worldWithQuests(active, resolved);
    world.story = { focusQuestId: active.id, quietTurns: 0, lastProgressRevision: 0 };
    world.entities.push({ id: 'beacon', kind: 'location', name: 'Far beacon', description: 'A remote signal tower.', locationId: null, ownerId: null, condition: 'Unlit', knownBy: ['player'] });
    world.facts.push({ id: 'beacon_outcome', key: 'beacon.outcome', text: 'The keeper left the beacon at dawn.', subjects: ['beacon'], at: 400, knownBy: ['player'] });
    const context = buildContext(world, 'What happened during the old beacon quest?');
    assert.equal(context.manifest.focusQuestId, active.id);
    const included = context.state.quests.find(quest => quest.id === resolved.id);
    assert.equal(included?.status, status);
    assert.equal(included?.guidance?.objective, 'Find the missing beacon keeper.');
    assert.ok(context.manifest.factIds.includes('beacon_outcome'));
    assert.ok(context.manifest.questSelection.find(item => item.id === resolved.id)?.reasons.includes('resolved_reference'));
    assert.ok(!buildContext(world, 'Continue our patrol.').manifest.questIds.includes(resolved.id));
  }
});

test('referencing a resolved quest ID alone retrieves its history with no active focus', () => {
  const resolved = quest('ended_watch'); resolved.status = 'completed';
  resolved.title = 'A completely different title';
  const context = buildContext(worldWithQuests(resolved), 'Tell me about ended_watch.');
  assert.equal(context.manifest.focusQuestId, null);
  assert.deepEqual(context.manifest.questIds, [resolved.id]);
  assert.equal(context.state.quests[0].status, 'completed');
});

test('legacy action suggestions are omitted from every selected quest while preserving goal and evidence context', () => {
  const parent = quest('broad_question', 'arc'), focused = quest('current_problem', 'local', parent.id), optional = quest('nearby_question');
  const world = worldWithQuests(parent, focused, optional);
  world.story = { focusQuestId: focused.id, quietTurns: 0, lastProgressRevision: 0 };
  world.claims.push({ id: 'remembered_testimony', speakerId: 'mara', text: 'I waited here through the night.', knownBy: ['player'] });
  for (const quest of world.quests) quest.guidance!.leads = [{ id: `lead_${quest.id}`, text: `LEGACY_TEXT_${quest.id}`, action: `LEGACY_ACTION_${quest.id}`, entityIds: ['mara'], evidenceFactIds: ['arrival'], evidenceClaimIds: ['remembered_testimony'] }];
  const original = structuredClone(world);
  const context = buildContext(world, 'Consider the current problem.');
  assert.equal(context.manifest.focusQuestId, focused.id);
  assert.equal(context.state.quests.length, 3);
  assert.doesNotMatch(JSON.stringify(context.state), /LEGACY_TEXT_|LEGACY_ACTION_|"leads"|"action"/);
  for (const quest of context.state.quests) {
    assert.ok(quest.guidance?.objective);
    assert.ok(quest.guidance?.stakes);
    assert.ok(!Object.hasOwn(quest.guidance!, 'leads'));
  }
  assert.ok(context.manifest.factIds.includes('arrival'));
  assert.ok(context.manifest.claimIds.includes('remembered_testimony'));
  assert.match(context.state.storyDirector.instruction, /clues, NPC dialogue and consequences committed by world operations/);
  assert.match(context.state.storyDirector.instruction, /Do not generate menus or preset player inputs/);
  assert.deepEqual(world, original, 'legacy saved metadata remains unchanged');
});

test('legacy action text no longer ranks or selects a quest', () => {
  const focused = quest('scene_question'), old = quest('unrelated_errand');
  old.guidance!.entityIds = [];
  old.guidance!.leads = [{ id: 'retired', text: 'Old suggestion.', action: 'Turn around exactly three times.', entityIds: ['mara'], evidenceFactIds: [], evidenceClaimIds: [] }];
  const world = worldWithQuests(focused, old);
  world.story = { focusQuestId: focused.id, quietTurns: 0, lastProgressRevision: 0 };
  const context = buildContext(world, 'Turn around exactly three times.');
  assert.equal(context.manifest.focusQuestId, focused.id);
  assert.deepEqual(context.manifest.questIds, [focused.id]);
  assert.ok(context.manifest.questSelection.every(quest => !quest.reasons.includes('explicit_lead')));
});

test('pacing requests in-world direction for quiet turns or a missing objective, not absent preset actions', () => {
  const focused = quest('current_goal'), world = worldWithQuests(focused);
  focused.guidance!.leads = [];
  assert.equal(buildContext(world, 'Wait.').state.storyDirector.needsDirection, false);
  world.story = { focusQuestId: focused.id, quietTurns: 3, lastProgressRevision: 0 };
  assert.equal(buildContext(world, 'Wait.').state.storyDirector.needsDirection, true);
  world.story.quietTurns = 0;
  focused.guidance!.objective = '   ';
  assert.equal(buildContext(world, 'Wait.').state.storyDirector.needsDirection, true);
  delete focused.guidance;
  assert.equal(buildContext(world, 'Wait.').state.storyDirector.needsDirection, true);
});

test('legacy lead receipts are filtered from live conversation without rewriting recorded turns or narration', () => {
  const world = worldWithQuests(quest('current_question')); world.revision = 1;
  // This is the exact legacy receipt format covered by the 1.2 story fixture.
  const recorded = [{
    id: 'legacy-turn', revision: 1, input: 'I ask about the person at the tower.',
    changes: ['Lead available: Ask about the person at the tower.', 'The woman claims: “Someone waited at the tower.”', '1 minute passes.'],
    narration: 'She tells you that someone waited at the tower. You could ask what she remembers.'
  }];
  const original = structuredClone(recorded);
  const context = buildContext(world, 'What did they look like?', 24000, recorded);
  assert.deepEqual(context.state.recentTurns[0].changes, ['The woman claims: “Someone waited at the tower.”', '1 minute passes.']);
  assert.equal(context.state.recentTurns[0].input, recorded[0].input);
  assert.equal(context.state.recentTurns[0].narration, recorded[0].narration);
  assert.doesNotMatch(JSON.stringify(context.state.recentTurns), /Lead available:/);
  assert.deepEqual(recorded, original);
  assert.equal(context.manifest.conversationChars, JSON.stringify(context.state.recentTurns).length);
});
