import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { seedWorld } from '../src/engine/seed';
import { applyProposal } from '../src/engine/reducer';
import { applyInventoryProposal, inventoryActionChanges, itemState, parseInventoryProposal, replayVersioned } from '../src/engine/inventory';
import { playerView, publicChanges } from '../src/engine/view';
import { inventoryProposalSchema, inventoryWireProposalSchema, worldSchema, type Entity, type InventoryProposal, type ItemAction, type Operation, type Proposal, type World } from '../src/engine/types';

const action = (action: ItemAction['action'], itemId: string | null, quantity = 1, recipientId: string | null = null): ItemAction => ({ action, itemId, quantity, recipientId });
const proposal = (itemActions: ItemAction[] = [], operations: Operation[] = []): InventoryProposal => ({ kind: 'action', interpretation: 'You attempt an action.', clarification: null, elapsedMinutes: 1, operations, itemActions });
function addItem(world: World, changes: Partial<Entity> = {}): Entity {
  const item: Entity = { id: 'staff', kind: 'item', name: 'Oak staff', description: 'PRIVATE: the hidden maker was the Hollow Choir.', locationId: null, ownerId: 'player', condition: 'PRIVATE: a secret curse', knownBy: ['player'], ...changes };
  world.entities.push(item);
  return item;
}
const getItem = (world: World, id = 'staff') => world.entities.find(entity => entity.id === id)!;

test('the provider schema requires every object property and rejects additional properties throughout', () => {
  const schema = z.toJSONSchema(inventoryWireProposalSchema, { target: 'draft-7' });
  let checked = 0;
  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const record = node as Record<string, unknown>;
    if (record.type === 'object') {
      checked++;
      assert.equal(record.additionalProperties, false);
      assert.deepEqual([...(record.required as string[] ?? [])].sort(), Object.keys(record.properties as object ?? {}).sort());
    }
    Object.values(record).forEach(visit);
  }
  visit(schema);
  assert.ok(checked >= 15, 'all operation, entity and item-state objects were checked');
});

test('nullable wire item metadata is required and normalized without rewriting legacy entity shape', () => {
  const before = seedWorld();
  const entity = addItem(seedWorld(), { ownerId: null, locationId: 'ashford' });
  const missing = proposal([], [{ op: 'create_entity', entity }]);
  assert.throws(() => parseInventoryProposal(missing));
  const raw = { ...missing, operations: [{ op: 'create_entity', entity: { ...entity, itemState: null } }] };
  const normalized = parseInventoryProposal(raw);
  const after = applyInventoryProposal(before, normalized);
  assert.deepEqual(getItem(after), entity);
  assert.ok(!Object.hasOwn(getItem(after), 'itemState'));
  const metadata = { quantity: 3, consumable: true, usable: true };
  const typed = parseInventoryProposal({ ...raw, operations: [{ op: 'create_entity', entity: { ...entity, itemState: metadata } }] });
  assert.deepEqual(itemState(getItem(applyInventoryProposal(before, typed))), metadata);
  const npc = { ...before.entities.find(candidate => candidate.id === 'mara')!, id: 'visitor', itemState: null };
  assert.equal(applyInventoryProposal(before, parseInventoryProposal({ ...raw, operations: [{ op: 'create_entity', entity: npc }] })).entities.at(-1)?.id, 'visitor');
});

test('the reported bell-and-staff failure stays blocked despite an earlier misleading claim and narration', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/missing-staff.json', import.meta.url), 'utf8'));
  const before = worldSchema.parse(fixture.before), saved = structuredClone(before);
  assert.match(before.claims[0].text, /your staff/);
  assert.match(fixture.recentTurns[0].narration, /grip your staff/);
  assert.deepEqual(playerView(before).inventory?.map(item => item.id), fixture.expected.carriedItemIds);
  assert.throws(() => applyInventoryProposal(before, fixture.legacyProposal));
  const declared = { ...fixture.legacyProposal, itemActions: [action('use', null)] };
  assert.throws(() => applyInventoryProposal(before, declared), /ITEM_REQUIRED/);
  assert.deepEqual(before, saved);
  assert.equal(before.revision, fixture.expected.revision);
  assert.equal(before.minute, fixture.expected.minute);
  assert.equal(getItem(before, 'bell').condition, fixture.expected.bellCondition);
  assert.ok(!before.facts.some(fact => fact.id === fixture.expected.mustNotEstablishFactId));
  assert.ok(!before.entities.some(entity => entity.id === fixture.expected.mustNotCreateItem));
});

test('a declared missing staff blocks every consequence and leaves time and the save unchanged', () => {
  const before = seedWorld(), saved = structuredClone(before);
  assert.throws(() => applyInventoryProposal(before, proposal([action('use', null)], [
    { op: 'update_entity', id: 'player', field: 'condition', value: 'Victorious' },
  ])), /ITEM_REQUIRED/);
  assert.deepEqual(before, saved);
});

test('live proposals must declare inventory actions, including the empty list for ordinary dialogue', () => {
  const { itemActions: ignored, ...legacy } = proposal();
  assert.ok(!inventoryProposalSchema.safeParse(legacy).success);
  assert.throws(() => applyInventoryProposal(seedWorld(), legacy));
  assert.equal(applyInventoryProposal(seedWorld(), proposal()).revision, 1);
});

test('an unknown or undiscovered implement is unavailable even if a model guesses its ID', () => {
  const world = seedWorld(); addItem(world, { knownBy: [] });
  for (const id of ['missing_staff', 'staff']) {
    assert.throws(() => applyInventoryProposal(world, proposal([action('use', id)])), /ITEM_UNAVAILABLE/);
  }
});

test('known NPC gear and distant ground gear cannot be used or taken as carried gear', () => {
  const world = seedWorld(); addItem(world, { ownerId: null, locationId: 'tower' });
  assert.throws(() => applyInventoryProposal(world, proposal([action('use', 'lantern')])), /ITEM_NOT_CARRIED/);
  assert.throws(() => applyInventoryProposal(world, proposal([action('take', 'lantern')])), /ITEM_NOT_REACHABLE/);
  assert.throws(() => applyInventoryProposal(world, proposal([action('take', 'staff')])), /ITEM_NOT_REACHABLE/);
});

test('an existing visible ground item can be taken and then used in one atomic turn', () => {
  const before = seedWorld(); addItem(before, { ownerId: null, locationId: 'ashford' });
  const after = applyInventoryProposal(before, proposal([action('take', 'staff'), action('use', 'staff')]));
  assert.equal(getItem(after).ownerId, 'player'); assert.equal(getItem(after).locationId, null);
  assert.equal(getItem(before).ownerId, null); assert.equal(after.revision, 1);
  assert.deepEqual(inventoryActionChanges(before, [action('use', 'staff')]), ['Used: Oak staff.']);
});

test('drop and give remove possession; later use fails atomically', () => {
  const before = seedWorld(); addItem(before);
  const saved = structuredClone(before);
  for (const transfer of [action('drop', 'staff'), action('give', 'staff', 1, 'mara')]) {
    assert.throws(() => applyInventoryProposal(before, proposal([transfer, action('use', 'staff')])), /ITEM_NOT_CARRIED/);
    assert.deepEqual(before, saved);
  }
  const dropped = applyInventoryProposal(before, proposal([action('drop', 'staff')]));
  assert.equal(getItem(dropped).ownerId, null); assert.equal(getItem(dropped).locationId, 'ashford');
  assert.ok(!playerView(dropped).inventory?.some(item => item.id === 'staff'));
  const given = applyInventoryProposal(before, proposal([action('give', 'staff', 1, 'mara')]));
  assert.equal(getItem(given).ownerId, 'mara'); assert.ok(getItem(given).knownBy.includes('mara'));
});

test('a known nearby NPC can give their existing item, but distant or hidden NPCs cannot', () => {
  const before = seedWorld();
  const received = applyInventoryProposal(before, proposal([action('receive', 'lantern'), action('use', 'lantern')]));
  assert.equal(getItem(received, 'lantern').ownerId, 'player');
  for (const mode of ['distant', 'hidden']) {
    const invalid = seedWorld();
    const npc = getItem(invalid, 'mara');
    if (mode === 'distant') npc.locationId = 'tower'; else npc.knownBy = ['mara'];
    assert.throws(() => applyInventoryProposal(invalid, proposal([action('receive', 'lantern')])), /ITEM_PERSON_UNAVAILABLE/);
    assert.throws(() => applyInventoryProposal(invalid, proposal([action('give', 'journal', 1, 'mara')])), /ITEM_PERSON_UNAVAILABLE/);
  }
});

test('transfers require the entire stack and preserve its quantity', () => {
  const before = seedWorld(); addItem(before, { itemState: { quantity: 3, consumable: true, usable: true } });
  assert.throws(() => applyInventoryProposal(before, proposal([action('give', 'staff', 1, 'mara')])), /ITEM_PARTIAL_TRANSFER/);
  const after = applyInventoryProposal(before, proposal([action('give', 'staff', 3, 'mara')]));
  assert.equal(itemState(getItem(after)).quantity, 3);
  assert.equal(getItem(after).ownerId, 'mara');
});

test('consumption spends a typed quantity, keeps the exhausted entity for history and prevents reuse', () => {
  const before = seedWorld(); addItem(before, { id: 'rations', name: 'Trail rations', itemState: { quantity: 3, consumable: true, usable: true } });
  const after = applyInventoryProposal(before, proposal([action('consume', 'rations', 2)]));
  assert.equal(itemState(getItem(after, 'rations')).quantity, 1);
  assert.equal(playerView(after).inventory?.find(item => item.id === 'rations')?.quantity, 1);
  const exhausted = applyInventoryProposal(after, proposal([action('consume', 'rations')]));
  assert.equal(itemState(getItem(exhausted, 'rations')).quantity, 0);
  assert.ok(!playerView(exhausted).inventory?.some(item => item.id === 'rations'));
  assert.ok(!playerView(exhausted).character.possessions.includes('Trail rations'));
  assert.throws(() => applyInventoryProposal(exhausted, proposal([action('consume', 'rations')])), /ITEM_DEPLETED/);
  assert.throws(() => applyInventoryProposal(exhausted, proposal([action('use', 'rations')])), /ITEM_DEPLETED/);
});

test('double consumption and insufficient quantities roll back the entire proposed action', () => {
  const before = seedWorld(); addItem(before, { itemState: { quantity: 1, consumable: true, usable: true } });
  const saved = structuredClone(before);
  assert.throws(() => applyInventoryProposal(before, proposal([action('consume', 'staff'), action('consume', 'staff')])), /ITEM_DEPLETED/);
  assert.throws(() => applyInventoryProposal(before, proposal([action('consume', 'staff', 2)])), /ITEM_INSUFFICIENT_QUANTITY/);
  assert.deepEqual(before, saved);
  assert.throws(() => applyInventoryProposal(seedWorld(), proposal([action('consume', 'journal')])), /ITEM_NOT_CONSUMABLE/);
});

test('damaged gear is unusable until explicitly repaired and state changes preserve stack counts', () => {
  const before = seedWorld(); addItem(before, { itemState: { quantity: 2, consumable: false, usable: true } });
  const damaged = applyInventoryProposal(before, proposal([action('damage', 'staff', 2)]));
  assert.equal(itemState(getItem(damaged)).usable, false);
  assert.throws(() => applyInventoryProposal(damaged, proposal([action('use', 'staff')])), /ITEM_UNUSABLE/);
  assert.throws(() => applyInventoryProposal(before, proposal([action('damage', 'staff', 2), action('use', 'staff')])), /ITEM_UNUSABLE/);
  const repaired = applyInventoryProposal(damaged, proposal([action('repair', 'staff', 2), action('use', 'staff')]));
  assert.deepEqual(itemState(getItem(repaired)), { quantity: 2, consumable: false, usable: true });
  assert.match(publicChanges(before, damaged).join(' '), /Oak staff is unusable/);
  assert.match(publicChanges(damaged, repaired).join(' '), /Oak staff is usable/);
});

test('ground gear can be repaired locally but distant and NPC-held gear cannot be changed', () => {
  const before = seedWorld(); addItem(before, { ownerId: null, locationId: 'ashford', itemState: { quantity: 1, consumable: false, usable: false } });
  const after = applyInventoryProposal(before, proposal([action('repair', 'staff'), action('take', 'staff'), action('use', 'staff')]));
  assert.equal(getItem(after).ownerId, 'player'); assert.equal(itemState(getItem(after)).usable, true);
  getItem(before).locationId = 'tower';
  assert.throws(() => applyInventoryProposal(before, proposal([action('repair', 'staff')])), /ITEM_NOT_REACHABLE/);
  assert.throws(() => applyInventoryProposal(before, proposal([action('damage', 'lantern')])), /ITEM_NOT_REACHABLE/);
});

test('committed inventory receipts preserve NPC transfers, sequential owners and ground item repairs', () => {
  const before = seedWorld(); addItem(before, { ownerId: null, locationId: 'ashford' });
  const actions = [action('take', 'staff'), action('give', 'staff', 1, 'mara'), action('receive', 'staff'), action('drop', 'staff'), action('damage', 'staff'), action('repair', 'staff')];
  applyInventoryProposal(before, proposal(actions));
  assert.deepEqual(inventoryActionChanges(before, actions), [
    'Picked up: Oak staff.',
    'Gave: Oak staff to The woman at the arch.',
    'Received: Oak staff from The woman at the arch.',
    'Dropped: Oak staff.',
    'Damaged: Oak staff.',
    'Repaired: Oak staff.',
  ]);
  assert.doesNotMatch(JSON.stringify(inventoryActionChanges(before, actions)), /PRIVATE|hidden maker|Hollow Choir/);
});

test('generic owner and location updates cannot bypass inventory checks, including on a newly created item', () => {
  const before = seedWorld();
  for (const field of ['ownerId', 'locationId'] as const) {
    assert.throws(() => applyInventoryProposal(before, proposal([], [{ op: 'update_entity', id: 'lantern', field, value: field === 'ownerId' ? 'player' : 'ashford' }])), /ITEM_DIRECT_MUTATION/);
  }
  const discovered = addItem(seedWorld(), { ownerId: null, locationId: 'ashford' });
  assert.throws(() => applyInventoryProposal(before, proposal([], [{ op: 'create_entity', entity: discovered }, { op: 'update_entity', id: 'staff', field: 'ownerId', value: 'player' }])), /ITEM_DIRECT_MUTATION/);
});

test('new items are discoveries, never directly owned gear or fabricated implements for the current attempt', () => {
  const before = seedWorld();
  const owned = addItem(seedWorld());
  assert.throws(() => applyInventoryProposal(before, proposal([], [{ op: 'create_entity', entity: owned }])), /ITEM_INVALID_DISCOVERY/);
  const ground = { ...owned, ownerId: null, locationId: 'ashford' };
  assert.throws(() => applyInventoryProposal(before, proposal([action('take', 'staff'), action('use', 'staff')], [{ op: 'create_entity', entity: ground }])), /ITEM_UNAVAILABLE/);
  const discovered = applyInventoryProposal(before, proposal([], [{ op: 'create_entity', entity: ground }]));
  assert.equal(getItem(discovered).ownerId, null);
  assert.equal(applyInventoryProposal(discovered, proposal([action('take', 'staff'), action('use', 'staff')])).revision, 2);
});

test('living-world items may exist offscreen or belong to NPCs without becoming player possessions or knowledge', () => {
  const before = seedWorld();
  const hiddenNpc: Entity = { id: 'courier', kind: 'npc', name: 'Hidden courier', description: 'Private offscreen traveler.', locationId: 'tower', ownerId: null, condition: 'Waiting', knownBy: ['mara'] };
  const held = addItem(seedWorld(), { id: 'secret_staff', name: 'Hidden courier staff', ownerId: 'courier', locationId: null, knownBy: ['courier'] });
  const ground = addItem(seedWorld(), { id: 'secret_ring', name: 'Hidden tower ring', ownerId: null, locationId: 'tower', knownBy: [] });
  const after = applyInventoryProposal(before, proposal([], [
    { op: 'create_entity', entity: hiddenNpc }, { op: 'create_entity', entity: held }, { op: 'create_entity', entity: ground },
  ]));
  assert.equal(getItem(after, 'secret_staff').ownerId, 'courier');
  assert.equal(getItem(after, 'secret_ring').locationId, 'tower');
  assert.deepEqual(playerView(after).inventory, playerView(before).inventory);
  assert.doesNotMatch(JSON.stringify({ view: playerView(after), changes: publicChanges(before, after) }), /Hidden courier|Hidden tower ring|secret_staff|secret_ring/);
  assert.throws(() => applyInventoryProposal(after, proposal([action('take', 'secret_ring')])), /ITEM_UNAVAILABLE/);
});

test('new physical items still reject orphaned placement, two locations and invalid owners', () => {
  const before = seedWorld();
  for (const item of [
    addItem(seedWorld(), { ownerId: null, locationId: null }),
    addItem(seedWorld(), { ownerId: 'mara', locationId: 'ashford' }),
  ]) assert.throws(() => applyInventoryProposal(before, proposal([], [{ op: 'create_entity', entity: item }])), /ITEM_INVALID_DISCOVERY/);
  const invalidOwner = addItem(seedWorld(), { ownerId: 'ashford', locationId: null });
  assert.throws(() => applyInventoryProposal(before, proposal([], [{ op: 'create_entity', entity: invalidOwner }])), /INVALID_OWNER/);
});

test('ordinary world validation still rolls back inventory actions when a later consequence fails', () => {
  const before = seedWorld(); addItem(before); const saved = structuredClone(before);
  assert.throws(() => applyInventoryProposal(before, proposal([action('drop', 'staff')], [{ op: 'establish_fact', fact: { ...before.facts[0], id: 'replacement' } }])), /ESTABLISHED_FACT/);
  assert.deepEqual(before, saved);
});

test('clarification cannot carry inventory mutations', () => {
  const before = seedWorld();
  assert.throws(() => applyInventoryProposal(before, { ...proposal([action('drop', 'journal')]), kind: 'clarification', clarification: 'Which?', elapsedMinutes: 0 }), /INVALID_CLARIFICATION/);
  assert.deepEqual(applyInventoryProposal(before, { ...proposal(), kind: 'clarification', clarification: 'Which?', elapsedMinutes: 0 }), before);
});

test('inventory projection exposes mechanical state and identity without private item details', () => {
  const before = seedWorld(); addItem(before, { itemState: { quantity: 2, consumable: false, usable: false } });
  const view = playerView(before);
  assert.deepEqual(view.inventory?.find(item => item.id === 'staff'), { id: 'staff', name: 'Oak staff', quantity: 2, consumable: false, usable: false });
  assert.doesNotMatch(JSON.stringify(view), /PRIVATE|secret curse|hidden maker|Hollow Choir/);
  assert.deepEqual(view.inventory?.find(item => item.id === 'journal'), { id: 'journal', name: 'Weathered notebook', quantity: 1, consumable: false, usable: true });
});

test('possession changes are identified by item ID, including equally named items and stack quantities', () => {
  const before = seedWorld(); addItem(before);
  addItem(before, { id: 'other_staff', ownerId: null, locationId: 'ashford' });
  const after = applyInventoryProposal(before, proposal([action('drop', 'staff'), action('take', 'other_staff')]));
  const changes = publicChanges(before, after);
  assert.ok(changes.includes('Acquired: Oak staff.')); assert.ok(changes.includes('No longer carried: Oak staff.'));
  const food = seedWorld(); addItem(food, { itemState: { quantity: 3, consumable: true, usable: true } });
  assert.match(publicChanges(food, applyInventoryProposal(food, proposal([action('consume', 'staff')]))).join(' '), /Carried: Oak staff ×2 \(3 before\)/);
});

test('versioned replay preserves legacy transfers and continues with the new inventory rules', () => {
  const seed = seedWorld();
  const legacy: Proposal = { kind: 'action', interpretation: 'You accept the lantern.', clarification: null, elapsedMinutes: 1, operations: [{ op: 'update_entity', id: 'lantern', field: 'ownerId', value: 'player' }] };
  const accepted = applyProposal(seed, legacy);
  const live = proposal([action('use', 'lantern'), action('drop', 'lantern')]);
  const expected = applyInventoryProposal(accepted, live);
  assert.deepEqual(replayVersioned(seed, [{ engine_version: '1.0.0', proposal: legacy }, { engine_version: '1.1.0', proposal: live }]), expected);
  assert.deepEqual(replayVersioned(seed, [{ engine_version: '1.0.0', proposal: legacy }]), accepted);
  assert.throws(() => replayVersioned(seed, [{ engine_version: '1.1.0', proposal: legacy }]));
  assert.throws(() => replayVersioned(seed, [{ engine_version: 'future', proposal: live }]), /UNSUPPORTED_ENGINE_VERSION/);
  assert.equal(seed.revision, 0);
});
