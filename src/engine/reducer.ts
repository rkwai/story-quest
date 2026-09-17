import { EngineError, proposalSchema, type Proposal, type World } from './types';

function ensure(condition: unknown, code: string): asserts condition { if (!condition) throw new EngineError(code); }
export function applyProposal(before: World, raw: Proposal): World {
  const p = proposalSchema.parse(raw);
  if (p.kind === 'clarification') {
    ensure(p.operations.length === 0 && p.elapsedMinutes === 0 && p.clarification, 'INVALID_CLARIFICATION');
    return structuredClone(before);
  }
  ensure(p.clarification === null, 'ACTION_HAS_CLARIFICATION');
  const world = structuredClone(before);
  const end = before.minute + p.elapsedMinutes;
  const entity = (id: string) => { const e = world.entities.find(x => x.id === id); ensure(e, 'UNKNOWN_ENTITY'); return e; };
  const unique = (items: { id: string }[], id: string) => ensure(!items.some(x => x.id === id), 'DUPLICATE_ID');
  const observers = (ids: string[]) => ids.forEach(id => ensure(['npc', 'character'].includes(entity(id).kind), 'INVALID_OBSERVER'));
  for (const op of p.operations) {
    switch (op.op) {
      case 'create_entity':
        unique(world.entities, op.entity.id); world.entities.push(structuredClone(op.entity)); break;
      case 'update_entity': {
        const e = entity(op.id);
        if (op.field === 'condition') { ensure(op.value !== null, 'INVALID_CONDITION'); e.condition = op.value; }
        else e[op.field] = op.value;
        break;
      }
      case 'discover_entity': {
        const e = entity(op.id); observers([op.characterId]);
        if (!e.knownBy.includes(op.characterId)) e.knownBy.push(op.characterId);
        break;
      }
      case 'establish_fact':
        unique(world.facts, op.fact.id);
        ensure(!world.facts.some(f => f.key === op.fact.key), 'ESTABLISHED_FACT');
        ensure(op.fact.at <= end, 'FUTURE_FACT');
        world.facts.push(structuredClone(op.fact)); break;
      case 'learn_fact': {
        const f = world.facts.find(f => f.id === op.id); ensure(f, 'UNKNOWN_FACT'); observers([op.characterId]);
        if (!f.knownBy.includes(op.characterId)) f.knownBy.push(op.characterId);
        break;
      }
      case 'add_claim': unique(world.claims, op.claim.id); world.claims.push(structuredClone(op.claim)); break;
      case 'add_quest': unique(world.quests, op.quest.id); ensure(op.quest.status === 'active', 'INVALID_NEW_QUEST'); world.quests.push(structuredClone(op.quest)); break;
      case 'update_quest': {
        const q = world.quests.find(q => q.id === op.id); ensure(q, 'UNKNOWN_QUEST');
        ensure(q.status === 'active', 'QUEST_ALREADY_RESOLVED'); q.status = op.status; break;
      }
      case 'add_rule': unique(world.rules, op.rule.id); world.rules.push(structuredClone(op.rule)); break;
      case 'schedule_event':
        unique(world.scheduled, op.event.id);
        ensure(op.event.dueAt > before.minute && !op.event.resolved, 'INVALID_DEADLINE');
        world.scheduled.push(structuredClone(op.event)); break;
      case 'resolve_event': {
        const event = world.scheduled.find(e => e.id === op.id); ensure(event && !event.resolved, 'UNKNOWN_PENDING_EVENT');
        const f = world.facts.find(f => f.id === op.factId); ensure(f, 'EVENT_WITHOUT_OUTCOME');
        ensure(f.at >= before.minute && f.subjects.some(s => event.subjects.includes(s)), 'INVALID_EVENT_OUTCOME');
        event.resolved = true; break;
      }
    }
  }
  for (const e of world.entities) {
    observers(e.knownBy);
    if (e.locationId) ensure(entity(e.locationId).kind === 'location', 'INVALID_LOCATION');
    if (e.ownerId) {
      ensure(e.kind === 'item' && ['character', 'npc'].includes(entity(e.ownerId).kind), 'INVALID_OWNER');
      ensure(e.locationId === null, 'ITEM_TWO_LOCATIONS');
    }
  }
  for (const f of world.facts) { f.subjects.forEach(entity); observers(f.knownBy); }
  for (const c of world.claims) { ensure(['npc', 'character'].includes(entity(c.speakerId).kind), 'INVALID_SPEAKER'); observers(c.knownBy); }
  for (const q of world.quests) observers(q.knownBy);
  for (const r of world.rules) observers(r.knownBy);
  for (const e of world.scheduled) { e.subjects.forEach(entity); ensure(e.resolved || e.dueAt > end, 'UNRESOLVED_DEADLINE'); }
  ensure(entity(world.playerId).kind === 'character', 'INVALID_PLAYER');
  world.minute = end; world.revision += 1;
  return world;
}

export function replay(seed: World, proposals: Proposal[]) { return proposals.reduce(applyProposal, structuredClone(seed)); }
