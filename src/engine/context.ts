import { EngineError, type World } from './types';

export interface RecentPublicTurn {
  id: string;
  revision: number;
  input: string;
  changes: string[];
  narration: string | null;
}
export const CONVERSATION_TURN_LIMIT = 4;
export const CONVERSATION_CHAR_LIMIT = 6000;

// Conversation supplies referents and exact player intent, never new world truth.
// Project fields explicitly so extra persisted properties cannot cross this boundary.
export function boundConversation(turns: readonly RecentPublicTurn[], maxChars = CONVERSATION_CHAR_LIMIT): RecentPublicTurn[] {
  const recent = [...turns].sort((a, b) => a.revision - b.revision).slice(-CONVERSATION_TURN_LIMIT)
    .map(turn => ({ id: turn.id, revision: turn.revision, input: turn.input, changes: [...turn.changes], narration: turn.narration }));
  while (recent.length && JSON.stringify(recent).length > Math.min(maxChars, CONVERSATION_CHAR_LIMIT)) recent.shift();
  return recent;
}

export function buildContext(world: World, input: string, maxChars = 24000, recentTurns: readonly RecentPublicTurn[] = []) {
  const words = input.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const player = world.entities.find(e => e.id === world.playerId)!;
  const entities = world.entities.filter(e => e.id === player.id || e.id === player.locationId || e.locationId === player.locationId || e.ownerId === player.id || words.some(w => e.name.toLowerCase().includes(w)));
  const ids = new Set(entities.map(e => e.id));
  // An NPC's held item has no locationId. Include local actors' possessions so
  // phrases such as "her lantern" do not require the DM to recreate that item.
  const actors = new Set(entities.filter(e => e.kind === 'character' || e.kind === 'npc').map(e => e.id));
  for (const entity of world.entities) if (entity.ownerId && actors.has(entity.ownerId)) ids.add(entity.id);
  // Include every event that a legal turn could cross. Overflow fails closed.
  const scheduled = world.scheduled.filter(e => !e.resolved && e.dueAt <= world.minute + 720);
  for (const event of scheduled) for (const id of event.subjects) ids.add(id);
  const facts = world.facts.filter(f => f.subjects.some(id => ids.has(id)));
  const byId = new Map(world.entities.map(entity => [entity.id, entity]));
  function withReferences(required: Iterable<string>) {
    const selected = new Set(required);
    // Each canonical entity is visited once, including cycles. This closes only
    // entity references, not all facts attached to newly encountered entities.
    for (const id of selected) {
      const entity = byId.get(id);
      if (!entity) throw new EngineError('UNKNOWN_ENTITY');
      if (entity.ownerId) selected.add(entity.ownerId);
      if (entity.locationId) selected.add(entity.locationId);
    }
    return [...selected].map(id => byId.get(id)!);
  }
  const linked = withReferences([...ids, ...facts.flatMap(fact => fact.subjects)]);
  const base = { title: world.title, premise: world.premise, minute: world.minute, playerId: world.playerId, entities: linked, rules: world.rules, facts, claims: world.claims.filter(c => ids.has(c.speakerId)).slice(-10), quests: world.quests.filter(q => q.status === 'active'), scheduled, recentTurns: [] as RecentPublicTurn[] };
  if (JSON.stringify(base).length > maxChars) throw new EngineError('CONTEXT_BUDGET_EXCEEDED');
  base.recentTurns = boundConversation(recentTurns.filter(turn => turn.revision <= world.revision));
  while (base.recentTurns.length && JSON.stringify(base).length > maxChars) base.recentTurns.shift();
  // Optional lexical matches and recent facts fill remaining budget without evicting scene facts.
  const optional = world.facts.filter(f => !facts.includes(f)).sort((a, b) => {
    const score = (f: typeof a) => words.filter(w => f.text.toLowerCase().includes(w)).length * 10000 + f.at;
    return score(b) - score(a);
  });
  for (const fact of optional.slice(0, 40)) {
    const candidate = { ...base, entities: withReferences([...base.entities.map(entity => entity.id), ...fact.subjects]), facts: [...base.facts, fact] };
    if (JSON.stringify(candidate).length > maxChars) continue;
    base.entities = candidate.entities; base.facts = candidate.facts;
  }
  return { state: base, manifest: { entityIds: base.entities.map(e => e.id), factIds: base.facts.map(f => f.id), turnIds: base.recentTurns.map(turn => turn.id), conversationChars: base.recentTurns.length ? JSON.stringify(base.recentTurns).length : 0, chars: JSON.stringify(base).length } };
}
