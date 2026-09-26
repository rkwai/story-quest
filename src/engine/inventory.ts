import { applyProposal } from './reducer';
import { applyStoryProposal } from './story';
import { EngineError, inventoryProposalSchema, inventoryWireProposalSchema, itemStateSchema, type Entity, type InventoryProposal, type ItemAction, type ItemState, type Proposal, type World } from './types';

// Error messages are codes only: a rejected model-provided item name may contain a secret.
export class InventoryError extends EngineError {}
function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new InventoryError(code);
}

// Old saves remain valid without rewriting their inventory or historical events.
export function itemState(entity: Entity): ItemState {
  return entity.itemState ? itemStateSchema.parse(entity.itemState) : { quantity: 1, consumable: false, usable: true };
}

export function parseInventoryProposal(raw: unknown): InventoryProposal {
  const wire = inventoryWireProposalSchema.parse(raw);
  return inventoryProposalSchema.parse({ ...wire, operations: wire.operations.map(operation => {
    if (operation.op !== 'create_entity' || operation.entity.itemState !== null) return operation;
    const { itemState: omitted, ...entity } = operation.entity;
    return { ...operation, entity };
  }) });
}

export function applyInventoryProposal(before: World, raw: unknown): World {
  const proposal = inventoryProposalSchema.parse(raw);
  if (proposal.kind === 'clarification') {
    ensure(proposal.itemActions.length === 0, 'INVALID_CLARIFICATION');
    return applyProposal(before, proposal);
  }
  const working = structuredClone(before);
  const player = working.entities.find(entity => entity.id === before.playerId);
  ensure(player?.kind === 'character', 'INVALID_PLAYER');
  const known = (entity: Entity) => entity.knownBy.includes(before.playerId);
  const localNpc = (id: string | null) => {
    const npc = working.entities.find(entity => entity.id === id);
    ensure(npc?.kind === 'npc' && known(npc) && player.locationId !== null && npc.locationId === player.locationId, 'ITEM_PERSON_UNAVAILABLE');
    return npc;
  };

  // Inventory actions precede other world consequences. Every referenced item
  // must already exist: discovering a new object cannot fabricate an implement
  // for the very attempt that motivated its creation.
  for (const action of proposal.itemActions) {
    ensure(action.itemId !== null, 'ITEM_REQUIRED');
    const item = working.entities.find(entity => entity.id === action.itemId);
    ensure(item?.kind === 'item' && known(item), 'ITEM_UNAVAILABLE');
    ensure(action.action === 'give' || action.recipientId === null, 'ITEM_INVALID_RECIPIENT');
    const state = itemState(item);
    ensure(state.quantity > 0, 'ITEM_DEPLETED');
    ensure(action.quantity <= state.quantity, 'ITEM_INSUFFICIENT_QUANTITY');
    if (['take', 'drop', 'give', 'receive', 'damage', 'repair'].includes(action.action)) {
      ensure(action.quantity === state.quantity, 'ITEM_PARTIAL_TRANSFER');
    }

    if (action.action === 'damage' || action.action === 'repair') {
      ensure((item.ownerId === player.id && item.locationId === null) || (item.ownerId === null && player.locationId !== null && item.locationId === player.locationId), 'ITEM_NOT_REACHABLE');
      item.itemState = { ...state, usable: action.action === 'repair' };
    } else if (action.action === 'take') {
      ensure(item.ownerId === null && player.locationId !== null && item.locationId === player.locationId, 'ITEM_NOT_REACHABLE');
      item.ownerId = player.id;
      item.locationId = null;
    } else if (action.action === 'receive') {
      localNpc(item.ownerId);
      ensure(item.locationId === null, 'ITEM_NOT_REACHABLE');
      item.ownerId = player.id;
    } else {
      ensure(item.ownerId === player.id && item.locationId === null, 'ITEM_NOT_CARRIED');
      switch (action.action) {
        case 'use':
          ensure(state.usable, 'ITEM_UNUSABLE');
          break;
        case 'consume':
          ensure(state.usable, 'ITEM_UNUSABLE');
          ensure(state.consumable, 'ITEM_NOT_CONSUMABLE');
          item.itemState = { ...state, quantity: state.quantity - action.quantity };
          break;
        case 'drop':
          ensure(player.locationId !== null, 'ITEM_NOT_REACHABLE');
          item.ownerId = null;
          item.locationId = player.locationId;
          break;
        case 'give':
          item.ownerId = localNpc(action.recipientId).id;
          if (!item.knownBy.includes(item.ownerId)) item.knownBy.push(item.ownerId);
          break;
      }
    }
  }

  for (const operation of proposal.operations) {
    if (operation.op === 'update_entity' && ['ownerId', 'locationId'].includes(operation.field)) {
      const existing = working.entities.find(entity => entity.id === operation.id);
      const created = proposal.operations.find(candidate => candidate.op === 'create_entity' && candidate.entity.id === operation.id);
      ensure(existing?.kind !== 'item' && !(created?.op === 'create_entity' && created.entity.kind === 'item'), 'ITEM_DIRECT_MUTATION');
    }
    if (operation.op === 'create_entity') {
      const entity = operation.entity;
      if (entity.kind === 'item') {
        // The DM may develop unseen places and NPC possessions. It may not
        // retroactively equip the player, leave physical items nowhere, or put
        // one item both in a place and in someone's possession. The legacy
        // reducer validates referenced location and owner kinds afterward.
        ensure(entity.ownerId !== player.id && ((entity.ownerId === null && entity.locationId !== null) || (entity.ownerId !== null && entity.locationId === null)), 'ITEM_INVALID_DISCOVERY');
        ensure(itemState(entity).quantity > 0, 'ITEM_DEPLETED');
      } else {
        ensure(entity.itemState === undefined, 'ITEM_INVALID_STATE');
      }
    }
  }
  // The original reducer still enforces reference, chronology and uniqueness
  // constraints. Its clone means a later failure never changes the caller's save.
  return applyProposal(working, proposal);
}

export function inventoryActionChanges(before: World, actions: readonly ItemAction[]): string[] {
  const owners = new Map(before.entities.filter(entity => entity.kind === 'item').map(entity => [entity.id, entity.ownerId]));
  const person = (id: string | null) => before.entities.find(entity => entity.id === id && ['npc', 'character'].includes(entity.kind) && entity.knownBy.includes(before.playerId))?.name ?? 'someone nearby';
  return actions.flatMap(action => {
    const item = before.entities.find(entity => entity.id === action.itemId && entity.kind === 'item' && entity.knownBy.includes(before.playerId));
    if (!item) return [];
    const label = `${item.name}${action.quantity > 1 ? ` ×${action.quantity}` : ''}`;
    switch (action.action) {
      case 'use': return [`Used: ${label}.`];
      case 'consume': return [`Consumed: ${label}.`];
      case 'damage': return [`Damaged: ${label}.`];
      case 'repair': return [`Repaired: ${label}.`];
      case 'take': owners.set(item.id, before.playerId); return [`Picked up: ${label}.`];
      case 'drop': owners.set(item.id, null); return [`Dropped: ${label}.`];
      case 'give':
        owners.set(item.id, action.recipientId);
        return [`Gave: ${label} to ${person(action.recipientId)}.`];
      case 'receive': {
        const giver = person(owners.get(item.id) ?? null);
        owners.set(item.id, before.playerId);
        return [`Received: ${label} from ${giver}.`];
      }
    }
  });
}

export interface VersionedProposal { engine_version: string; proposal: unknown }
export function replayVersioned(seed: World, turns: readonly VersionedProposal[]): World {
  return turns.reduce((world, turn) => {
    if (turn.engine_version === '1.0.0') return applyProposal(world, turn.proposal as Proposal);
    if (turn.engine_version === '1.1.0') return applyInventoryProposal(world, turn.proposal);
    if (turn.engine_version === '1.2.0') return applyStoryProposal(world, turn.proposal);
    throw new EngineError('UNSUPPORTED_ENGINE_VERSION');
  }, structuredClone(seed));
}
