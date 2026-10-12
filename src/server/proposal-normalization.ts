import type { NarrativeProposal, World } from '@/engine/types';

export interface ProposalNormalization {
  version: 'proposal-normalization-1';
  omittedOperations: { index: number; op: 'add_quest' | 'add_rule'; id: string; reason: 'already_established' }[];
}

function sameAudience(a: readonly string[], b: readonly string[]): boolean {
  // Ordering does not change knowledge, but additions, removals and malformed
  // duplicate observers must not be repaired into an accepted operation.
  return a.length === b.length && new Set(a).size === a.length && new Set(b).size === b.length
    && a.every(id => b.includes(id));
}

/**
 * Remove only unchanged quest/rule declarations already in this campaign.
 * This is live model-output handling, not a change to historical reducers.
 * Persist the returned proposal so strict versioned replay needs no repair.
 */
export function normalizeProposal(before: World, candidate: NarrativeProposal): {
  proposal: NarrativeProposal; normalization: ProposalNormalization;
} {
  const normalization: ProposalNormalization = { version: 'proposal-normalization-1', omittedOperations: [] };
  if (candidate.kind !== 'action') return { proposal: candidate, normalization };

  const quests = new Map(before.quests.map(quest => [quest.id, quest]));
  const rules = new Map(before.rules.map(rule => [rule.id, rule]));
  const updatedQuests = new Set(candidate.operations.flatMap(operation => operation.op === 'update_quest' ? [operation.id] : []));
  const operations = candidate.operations.filter((operation, index) => {
    let redundant = false;
    let id: string;
    if (operation.op === 'add_quest') {
      const incoming = operation.quest, existing = quests.get(incoming.id);
      id = incoming.id;
      // Guidance is separate save metadata, never part of an add_quest. Leave
      // status transitions/recreations in one proposal to the strict reducer.
      redundant = !!existing && !updatedQuests.has(id)
        && existing.title === incoming.title && existing.description === incoming.description
        && existing.status === 'active' && incoming.status === 'active'
        && sameAudience(existing.knownBy, incoming.knownBy);
    } else if (operation.op === 'add_rule') {
      const incoming = operation.rule, existing = rules.get(incoming.id);
      id = incoming.id;
      redundant = !!existing && existing.text === incoming.text && sameAudience(existing.knownBy, incoming.knownBy);
    } else return true;

    if (redundant) normalization.omittedOperations.push({ index, op: operation.op, id, reason: 'already_established' });
    return !redundant;
  });
  return { proposal: { ...candidate, operations }, normalization };
}
