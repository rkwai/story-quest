import { EngineError, type World } from './types';

export function buildContext(world: World, input: string, maxChars = 24000) {
  const words = input.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const player = world.entities.find(e => e.id === world.playerId)!;
  const entities = world.entities.filter(e => e.id === player.id || e.id === player.locationId || e.locationId === player.locationId || e.ownerId === player.id || words.some(w => e.name.toLowerCase().includes(w)));
  const ids = new Set(entities.map(e => e.id));
  // Include every event that a legal turn could cross. Overflow fails closed.
  const scheduled = world.scheduled.filter(e => !e.resolved && e.dueAt <= world.minute + 720);
  for (const event of scheduled) for (const id of event.subjects) ids.add(id);
  const linked = world.entities.filter(e => ids.has(e.id));
  const facts = world.facts.filter(f => f.subjects.some(id => ids.has(id)));
  const base = { title: world.title, premise: world.premise, minute: world.minute, playerId: world.playerId, entities: linked, rules: world.rules, facts, claims: world.claims.filter(c => ids.has(c.speakerId)).slice(-10), quests: world.quests.filter(q => q.status === 'active'), scheduled };
  let chars = JSON.stringify(base).length;
  if (chars > maxChars) throw new EngineError('CONTEXT_BUDGET_EXCEEDED');
  // Optional lexical matches and recent facts fill remaining budget without evicting scene facts.
  const optional = world.facts.filter(f => !facts.includes(f)).sort((a, b) => {
    const score = (f: typeof a) => words.filter(w => f.text.toLowerCase().includes(w)).length * 10000 + f.at;
    return score(b) - score(a);
  });
  for (const fact of optional.slice(0, 40)) {
    const size = JSON.stringify(fact).length + 1;
    if (chars + size > maxChars) continue;
    base.facts.push(fact); chars += size;
  }
  return { state: base, manifest: { entityIds: linked.map(e => e.id), factIds: base.facts.map(f => f.id), chars: JSON.stringify(base).length } };
}
