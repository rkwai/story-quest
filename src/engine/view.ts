import type { World, PlayerView } from './types';

export function playerView(world: World): PlayerView {
  const p = world.playerId;
  const knows = (x: { knownBy: string[] }) => x.knownBy.includes(p);
  const visible = world.entities.filter(knows);
  const name = (id: string | null) => visible.find(x => x.id === id)?.name ?? 'Unfamiliar place';
  const player = world.entities.find(e => e.id === p)!;
  return {
    title: world.title, revision: world.revision, minute: world.minute, playerId: p,
    character: { name: player.name, condition: player.condition, location: name(player.locationId), possessions: visible.filter(e => e.kind === 'item' && e.ownerId === p).map(e => e.name) },
    entities: visible.map(({ id, name, kind }) => ({ id, name, kind })),
    facts: world.facts.filter(knows).map(({ id, text, at, subjects }) => ({ id, text, at, subjects: subjects.filter(s => visible.some(e => e.id === s)) })),
    claims: world.claims.filter(knows).map(({ id, text, speakerId }) => ({ id, text, speaker: visible.find(e => e.id === speakerId)?.name ?? 'An unidentified speaker' })),
    quests: world.quests.filter(knows).map(({ id, title, description, status }) => ({ id, title, description, status })),
    rules: world.rules.filter(knows).map(({ id, text }) => ({ id, text }))
  };
}
export function publicChanges(before: World, after: World): string[] {
  const a = playerView(before), b = playerView(after), changes: string[] = [];
  for (const f of b.facts) if (!a.facts.some(x => x.id === f.id)) changes.push(f.text);
  for (const c of b.claims) if (!a.claims.some(x => x.id === c.id)) changes.push(`${c.speaker} claims: “${c.text}”`);
  for (const q of b.quests) {
    const old = a.quests.find(x => x.id === q.id);
    if (!old || old.status !== q.status) changes.push(`Quest ${q.status}: ${q.title}.`);
  }
  for (const e of b.entities) if (!a.entities.some(x => x.id === e.id)) changes.push(`Discovered: ${e.name}.`);
  for (const r of b.rules) if (!a.rules.some(x => x.id === r.id)) changes.push(`World rule learned: ${r.text}`);
  if (a.character.condition !== b.character.condition) changes.push(`Your condition: ${b.character.condition}.`);
  if (a.character.location !== b.character.location) changes.push(`You arrive at ${b.character.location}.`);
  for (const item of b.character.possessions) if (!a.character.possessions.includes(item)) changes.push(`Acquired: ${item}.`);
  for (const item of a.character.possessions) if (!b.character.possessions.includes(item)) changes.push(`No longer carried: ${item}.`);
  if (before.minute !== after.minute) {
    const elapsed = after.minute - before.minute;
    changes.push(elapsed === 1 ? '1 minute passes.' : `${elapsed} minutes pass.`);
  }
  return changes;
}
