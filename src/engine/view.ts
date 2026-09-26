import type { World, PlayerView } from './types';
import { itemState } from './inventory';

export function playerView(world: World): PlayerView {
  const p = world.playerId;
  const knows = (x: { knownBy: string[] }) => x.knownBy.includes(p);
  const visible = world.entities.filter(knows);
  const name = (id: string | null) => visible.find(x => x.id === id)?.name ?? 'Unfamiliar place';
  const player = world.entities.find(e => e.id === p)!;
  const inventory = visible.filter(e => e.kind === 'item' && e.ownerId === p).map(e => ({ id: e.id, name: e.name, ...itemState(e) })).filter(e => e.quantity > 0);
  return {
    title: world.title, revision: world.revision, minute: world.minute, playerId: p,
    character: { name: player.name, condition: player.condition, location: name(player.locationId), possessions: inventory.map(e => e.name) },
    inventory,
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
  for (const item of b.inventory ?? []) {
    const old = a.inventory?.find(previous => previous.id === item.id);
    if (!old) changes.push(`Acquired: ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}.`);
    else {
      if (old.quantity !== item.quantity) changes.push(`Carried: ${item.name} ×${item.quantity} (${old.quantity} before).`);
      if (old.usable !== item.usable) changes.push(`${item.name} is ${item.usable ? 'usable' : 'unusable'}.`);
    }
  }
  for (const item of a.inventory ?? []) if (!b.inventory?.some(current => current.id === item.id)) changes.push(`No longer carried: ${item.name}.`);
  if (before.minute !== after.minute) {
    const elapsed = after.minute - before.minute;
    changes.push(elapsed === 1 ? '1 minute passes.' : `${elapsed} minutes pass.`);
  }
  return changes;
}
