import { applyInventoryProposal, parseInventoryProposal } from './inventory';
import {
  EngineError, storyProposalSchema, storyWireProposalSchema, narrativeProposalSchema, narrativeWireProposalSchema,
  type PublicStoryDirection, type Quest, type QuestGuidance, type NarrativeProposal,
  type QuestLead, type StoryProposal, type World,
} from './types';

export class StoryError extends EngineError {}
function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new StoryError(code);
}
const scopeRank = { world: 0, arc: 1, local: 2, immediate: 3 } as const;
const knows = (record: { knownBy: string[] }, characterId: string) => record.knownBy.includes(characterId);
const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;

export function parseStoryProposal(raw: unknown): StoryProposal {
  const wire = storyWireProposalSchema.parse(raw);
  return storyProposalSchema.parse({ ...parseInventoryProposal(wire), storyPlan: wire.storyPlan });
}

/** Missing metadata stays missing in old saves; this helper never invents history. */
export function questGuidance(quest: Quest): QuestGuidance | undefined { return quest.guidance; }

function visibleLead(world: World, lead: QuestLead, characterId: string): boolean {
  return lead.entityIds.every(id => world.entities.some(entity => entity.id === id && knows(entity, characterId)))
    && lead.evidenceFactIds.every(id => world.facts.some(fact => fact.id === id && knows(fact, characterId)))
    && lead.evidenceClaimIds.every(id => world.claims.some(claim => claim.id === id && knows(claim, characterId)));
}

/** Prefer the committed focus; otherwise use current, known scene data only. */
export function effectiveStoryFocus(world: World): string | null {
  const active = world.quests.filter(quest => quest.status === 'active' && knows(quest, world.playerId));
  const saved = active.find(quest => quest.id === world.story?.focusQuestId);
  if (saved) return saved.id;
  const player = world.entities.find(entity => entity.id === world.playerId);
  const localIds = new Set(world.entities.filter(entity => knows(entity, world.playerId)
    && (entity.id === player?.locationId || (player?.locationId != null && entity.locationId === player.locationId))).map(entity => entity.id));
  const score = (quest: Quest) => (quest.guidance?.entityIds.some(id => localIds.has(id)) ? 100 : 0)
    + scopeRank[quest.guidance?.scope ?? 'local'];
  return [...active].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0]?.id ?? null;
}

/** Current projections expose direction, never a generated player command. */
export function publicStoryDirection(world: World): PublicStoryDirection {
  return { focusQuestId: effectiveStoryFocus(world), quietTurns: world.story?.quietTurns ?? 0 };
}

function validateGuidance(world: World, quest: Quest) {
  const guidance = quest.guidance;
  if (!guidance) return;
  ensure(unique(guidance.entityIds) && unique(guidance.leads.map(lead => lead.id)), 'STORY_DUPLICATE_REFERENCE');
  for (const id of guidance.entityIds) ensure(world.entities.some(entity => entity.id === id), 'STORY_UNKNOWN_ENTITY');
  if (guidance.parentId !== null) {
    const parent = world.quests.find(candidate => candidate.id === guidance.parentId);
    ensure(parent && parent.id !== quest.id, 'STORY_INVALID_PARENT');
    ensure(scopeRank[parent.guidance?.scope ?? 'local'] < scopeRank[guidance.scope], 'STORY_INVALID_PARENT_SCOPE');
  }
  for (const lead of guidance.leads) {
    ensure(unique(lead.entityIds) && unique(lead.evidenceFactIds) && unique(lead.evidenceClaimIds), 'STORY_DUPLICATE_REFERENCE');
    ensure(lead.entityIds.length + lead.evidenceFactIds.length + lead.evidenceClaimIds.length > 0, 'STORY_UNGROUNDED_LEAD');
    for (const id of lead.entityIds) ensure(world.entities.some(entity => entity.id === id), 'STORY_UNKNOWN_ENTITY');
    for (const id of lead.evidenceFactIds) ensure(world.facts.some(fact => fact.id === id), 'STORY_UNKNOWN_FACT');
    for (const id of lead.evidenceClaimIds) ensure(world.claims.some(claim => claim.id === id), 'STORY_UNKNOWN_CLAIM');
    // A known quest's leads are readable by that character. Other quest metadata
    // is planning data; projection excludes its private entity/evidence links.
    for (const characterId of quest.knownBy) ensure(visibleLead(world, lead, characterId), 'STORY_HIDDEN_LEAD_REFERENCE');
  }
}

function validateHierarchy(world: World) {
  for (const quest of world.quests) {
    validateGuidance(world, quest);
    const visited = new Set<string>([quest.id]);
    let parentId = quest.guidance?.parentId;
    while (parentId) {
      ensure(!visited.has(parentId), 'STORY_QUEST_CYCLE');
      visited.add(parentId);
      parentId = world.quests.find(candidate => candidate.id === parentId)?.guidance?.parentId;
    }
  }
}

export function applyStoryProposal(before: World, raw: unknown): World {
  const proposal = storyProposalSchema.parse(raw);
  const plan = proposal.storyPlan;
  if (proposal.kind === 'clarification') {
    ensure(plan.focusQuestId === null && plan.questUpdates.length === 0 && plan.progress.length === 0, 'INVALID_CLARIFICATION');
    return applyInventoryProposal(before, proposal);
  }
  // Inventory and canonical world changes remain atomic. Guidance may refer to
  // evidence established by this turn, but cannot create that evidence itself.
  const after = applyInventoryProposal(before, proposal);
  // A newly invented quest must survive at least one turn as an actionable
  // thread. Otherwise add_quest + update_quest can manufacture a completion.
  for (const operation of proposal.operations) {
    if (operation.op === 'update_quest') ensure(before.quests.some(quest => quest.id === operation.id), 'STORY_NEW_QUEST_ALREADY_RESOLVED');
  }
  ensure(unique(plan.questUpdates.map(update => update.questId)) && unique(plan.progress.map(progress => progress.questId)), 'STORY_DUPLICATE_QUEST');
  for (const update of plan.questUpdates) {
    const quest = after.quests.find(candidate => candidate.id === update.questId);
    ensure(quest, 'STORY_UNKNOWN_QUEST');
    const old = before.quests.find(candidate => candidate.id === update.questId);
    ensure(quest.status === 'active' || (old?.status === 'active' && update.leads.length === 0), 'STORY_RESOLVED_QUEST');
    const { questId: omitted, ...guidance } = update;
    quest.guidance = { ...structuredClone(guidance), lastProgressRevision: old?.guidance?.lastProgressRevision ?? before.revision };
  }
  validateHierarchy(after);

  let publicProgress = false;
  for (const progress of plan.progress) {
    const quest = after.quests.find(candidate => candidate.id === progress.questId);
    ensure(quest, 'STORY_UNKNOWN_QUEST');
    const oldQuest = before.quests.find(candidate => candidate.id === quest.id);
    ensure(quest.status === 'active' || oldQuest?.status === 'active', 'STORY_RESOLVED_QUEST');
    ensure(progress.factIds.length + progress.claimIds.length > 0, 'STORY_PROGRESS_WITHOUT_EVIDENCE');
    ensure(unique(progress.factIds) && unique(progress.claimIds), 'STORY_DUPLICATE_REFERENCE');
    const factRecords = progress.factIds.map(id => {
      const fact = after.facts.find(candidate => candidate.id === id);
      ensure(fact, 'STORY_UNKNOWN_FACT'); return fact;
    });
    const claimRecords = progress.claimIds.map(id => {
      const claim = after.claims.find(candidate => candidate.id === id);
      ensure(claim, 'STORY_UNKNOWN_CLAIM'); return claim;
    });
    const evidence = [...factRecords.map(record => ({ record, prior: before.facts.find(candidate => candidate.id === record.id) })),
      ...claimRecords.map(record => ({ record, prior: before.claims.find(candidate => candidate.id === record.id) }))];
    const publicQuest = knows(quest, after.playerId);
    for (const { record, prior } of evidence) {
      if (publicQuest) {
        ensure(knows(record, after.playerId), 'STORY_HIDDEN_PROGRESS');
        ensure(!prior || !knows(prior, after.playerId), 'STORY_STALE_PROGRESS');
      } else {
        // Hidden world arcs may develop without announcing that progress. New
        // private records or newly learned evidence can support their outcome.
        ensure(!prior || quest.knownBy.some(characterId => knows(record, characterId) && !knows(prior, characterId)), 'STORY_STALE_PROGRESS');
      }
    }
    const guidance = quest.guidance;
    if (guidance) {
      const entityIds = new Set([...guidance.entityIds, ...guidance.leads.flatMap(lead => lead.entityIds)]);
      const factIds = new Set(guidance.leads.flatMap(lead => lead.evidenceFactIds));
      const claimIds = new Set(guidance.leads.flatMap(lead => lead.evidenceClaimIds));
      if (entityIds.size || factIds.size || claimIds.size) {
        ensure(factRecords.some(fact => factIds.has(fact.id) || fact.subjects.some(id => entityIds.has(id)))
          || claimRecords.some(claim => claimIds.has(claim.id) || entityIds.has(claim.speakerId)), 'STORY_UNRELATED_PROGRESS');
      }
      guidance.lastProgressRevision = after.revision;
    }
    if (publicQuest) publicProgress = true;
  }
  for (const operation of proposal.operations) {
    if (operation.op === 'update_quest') ensure(plan.progress.some(progress => progress.questId === operation.id), 'STORY_RESOLUTION_WITHOUT_EVIDENCE');
  }
  if (plan.focusQuestId !== null) {
    ensure(after.quests.some(quest => quest.id === plan.focusQuestId && quest.status === 'active' && knows(quest, after.playerId)), 'STORY_INVALID_FOCUS');
  } else {
    ensure(!after.quests.some(quest => quest.status === 'active' && knows(quest, after.playerId)), 'STORY_FOCUS_REQUIRED');
  }
  after.story = {
    focusQuestId: plan.focusQuestId,
    quietTurns: publicProgress ? 0 : Math.min((before.story?.quietTurns ?? 0) + 1, Number.MAX_SAFE_INTEGER),
    lastProgressRevision: publicProgress ? after.revision : before.story?.lastProgressRevision ?? before.revision,
  };
  return after;
}

/** Engine 1.3 proposal contract deliberately excludes legacy lead commands. */
export function parseNarrativeProposal(raw: unknown): NarrativeProposal {
  const wire = narrativeWireProposalSchema.parse(raw);
  return narrativeProposalSchema.parse({ ...parseInventoryProposal(wire), storyPlan: wire.storyPlan });
}

export function applyNarrativeProposal(before: World, raw: unknown): World {
  const proposal = narrativeProposalSchema.parse(raw);
  // Reuse the established hierarchy, evidence, pacing and atomicity checks.
  // This is an internal compatibility shape only: accepted 1.3 proposals never
  // contain leads, and existing saved leads remain untouched unless that quest
  // is explicitly updated. Historical 1.2 replay still has its original schema.
  return applyStoryProposal(before, {
    ...proposal,
    storyPlan: {
      ...proposal.storyPlan,
      questUpdates: proposal.storyPlan.questUpdates.map(update => ({ ...update, leads: [] })),
    },
  });
}
