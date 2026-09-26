import { EngineError, type Quest, type World } from './types';
import { itemState } from './inventory';

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

export const QUEST_CONTEXT_LIMIT = 6;
const SCOPE_DEPTH = { world: 0, arc: 1, local: 2, immediate: 3 };
const COMMON_WORDS = new Set('the and that this with from about what where when which who why how does have has had will would could should can for are was were you your they their them there here into onto ask asks tell look find seek follow help explore discover investigate quest story world large local immediate some now still doing'.split(' '));
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const meaningfulWords = (text: string) => [...new Set(normalize(text).split(' ').filter(word => word.length >= 3 && !COMMON_WORDS.has(word)))];
const hasPhrase = (input: string, text: string) => {
  const phrase = normalize(text);
  return phrase.length >= 3 && ` ${input} `.includes(` ${phrase} `);
};

type RankedQuest = { quest: Quest; score: number; reasons: string[]; relevant: boolean };

// This is retrieval, not intent classification: only the DM interprets what the
// player wants. Description length and repeated filler cannot buy more context.
function rankQuests(world: World, input: string, localIds: Set<string>, mentionedIds: Set<string>): RankedQuest[] {
  const normalized = normalize(input), words = new Set(meaningfulWords(input));
  // A resolved thread is history, but an explicit question still needs its
  // objective and outcome context. It never competes to become active focus.
  const candidates = world.quests.filter(quest => quest.status === 'active' || hasPhrase(normalized, quest.title) || hasPhrase(normalized, quest.id));
  const frequency = new Map<string, number>();
  for (const quest of candidates) for (const word of meaningfulWords(quest.title)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  return candidates.map(quest => {
    const guidance = quest.guidance;
    const references = [...(guidance?.entityIds ?? []), ...(guidance?.leads.flatMap(lead => lead.entityIds) ?? [])];
    const reasons: string[] = [];
    let score = 0;
    if (hasPhrase(normalized, quest.title) || hasPhrase(normalized, quest.id)) { score += 1000; reasons.push('explicit_quest'); }
    if (guidance?.leads.some(lead => hasPhrase(normalized, lead.action))) { score += 1100; reasons.push('explicit_lead'); }
    if (references.some(id => mentionedIds.has(id))) { score += 600; reasons.push('referenced_entity'); }
    const matches = meaningfulWords(quest.title).filter(word => words.has(word));
    if (matches.length) { score += 200 + matches.reduce((sum, word) => sum + 10 / frequency.get(word)!, 0); reasons.push('title_match'); }
    if (references.some(id => localIds.has(id))) { score += 100; reasons.push('current_scene'); }
    const relevant = reasons.length > 0;
    if (quest.status !== 'active') reasons.push('resolved_reference');
    if (world.story?.focusQuestId === quest.id) { score += 50; reasons.push('saved_focus'); }
    if (!reasons.length) reasons.push('active_fallback');
    // Preserve exact-match ranking; specificity and ID only resolve ties.
    return { quest, score, reasons, relevant };
  }).sort((a, b) => b.score - a.score
    || Number(b.quest.knownBy.includes(world.playerId)) - Number(a.quest.knownBy.includes(world.playerId))
    || (SCOPE_DEPTH[b.quest.guidance?.scope ?? 'world'] - SCOPE_DEPTH[a.quest.guidance?.scope ?? 'world'])
    || a.quest.id.localeCompare(b.quest.id));
}

export function buildContext(world: World, input: string, maxChars = 24000, recentTurns: readonly RecentPublicTurn[] = [], selectedItemId?: string) {
  const words = meaningfulWords(input), normalized = normalize(input);
  const player = world.entities.find(e => e.id === world.playerId);
  if (!player) throw new EngineError('UNKNOWN_ENTITY');
  const localIds = new Set(world.entities.filter(e => e.id === player.id || e.ownerId === player.id || (player.locationId !== null && (e.id === player.locationId || e.locationId === player.locationId))).map(e => e.id));
  const mentionedIds = new Set(world.entities.filter(e => hasPhrase(normalized, e.name) || hasPhrase(normalized, e.id)).map(e => e.id));
  const ids = new Set([...localIds, ...mentionedIds]);
  // An NPC's held item has no locationId. Include local actors' possessions so
  // phrases such as "her lantern" do not require the DM to recreate that item.
  const actors = new Set(world.entities.filter(e => ids.has(e.id) && (e.kind === 'character' || e.kind === 'npc')).map(e => e.id));
  for (const entity of world.entities) if (entity.ownerId && actors.has(entity.ownerId)) {
    ids.add(entity.id);
    if (localIds.has(entity.ownerId)) localIds.add(entity.id);
  }
  // Include every event that a legal turn could cross. Overflow fails closed.
  const scheduled = world.scheduled.filter(e => !e.resolved && e.dueAt <= world.minute + 720);
  for (const event of scheduled) for (const id of event.subjects) ids.add(id);
  const facts = world.facts.filter(f => f.subjects.some(id => ids.has(id)));
  const byId = new Map(world.entities.map(entity => [entity.id, entity]));
  const factById = new Map(world.facts.map(fact => [fact.id, fact]));
  const claimById = new Map(world.claims.map(claim => [claim.id, claim]));
  const questById = new Map(world.quests.map(quest => [quest.id, quest]));
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
  function ancestry(quest: Quest): Quest[] {
    const chain = [quest], visited = new Set([quest.id]);
    let child = quest;
    while (child.guidance?.parentId) {
      const parent = questById.get(child.guidance.parentId);
      if (!parent || visited.has(parent.id) || SCOPE_DEPTH[parent.guidance?.scope ?? 'local'] >= SCOPE_DEPTH[child.guidance.scope]) throw new EngineError('STORY_INVALID_ANCESTRY');
      chain.push(parent); visited.add(parent.id); child = parent;
      if (chain.length > 4) throw new EngineError('STORY_INVALID_ANCESTRY');
    }
    return chain;
  }
  const ranked = rankQuests(world, input, localIds, mentionedIds);
  const focus = ranked.find(candidate => candidate.quest.status === 'active' && candidate.quest.knownBy.includes(world.playerId));
  const focusQuestId = focus?.quest.id ?? null;
  const quietTurns = world.story?.quietTurns ?? 0;
  const hasActionableLead = focus?.quest.guidance?.leads.some(lead =>
    (lead.entityIds.length + lead.evidenceFactIds.length + lead.evidenceClaimIds.length > 0)
    && lead.entityIds.every(id => byId.get(id)?.knownBy.includes(world.playerId))
    && lead.evidenceFactIds.every(id => factById.get(id)?.knownBy.includes(world.playerId))
    && lead.evidenceClaimIds.every(id => claimById.get(id)?.knownBy.includes(world.playerId))
  ) ?? false;
  const linked = withReferences([...ids, ...facts.flatMap(fact => fact.subjects)]);
  // Ownership is a complete mechanical list, not a suggestion inferred from prose.
  // Keep it in mandatory context so optional memories cannot displace equipment.
  const inventory = world.entities.filter(e => e.kind === 'item' && e.ownerId === world.playerId)
    .map(e => ({ id: e.id, name: e.name, ...itemState(e) }));
  let base = {
    title: world.title, premise: world.premise, minute: world.minute, playerId: world.playerId,
    entities: linked, inventory: { complete: true, items: inventory, selectedItemId: selectedItemId ?? null },
    rules: world.rules, facts, claims: world.claims.filter(c => ids.has(c.speakerId)).slice(-10), quests: [] as Quest[], scheduled,
    storyDirector: {
      focusQuestId, selectedQuestIds: [] as string[], quietTurns, needsDirection: quietTurns >= 3 || !hasActionableLead,
      instruction: 'Honor the exact player action or question first. Offer grounded opportunities rather than forcing a quest or changing the subject. When direction is needed, advance or refresh a relevant lead using known evidence; a lead is a possibility, not a guaranteed outcome. Resolved ancestors supply stakes, not active tasks.'
    },
    recentTurns: [] as RecentPublicTurn[]
  };
  function addQuests(quests: Quest[]) {
    const allQuests = [...base.quests, ...quests.filter(quest => !base.quests.some(existing => existing.id === quest.id))];
    const factIds = new Set(base.facts.map(fact => fact.id)), claimIds = new Set(base.claims.map(claim => claim.id));
    const requiredEntities = new Set(base.entities.map(entity => entity.id));
    const questEntities = new Set<string>();
    for (const quest of quests) if (quest.guidance) {
      for (const id of quest.guidance.entityIds) questEntities.add(id);
      for (const lead of quest.guidance.leads) {
        for (const id of lead.entityIds) questEntities.add(id);
        for (const id of lead.evidenceFactIds) factIds.add(id);
        for (const id of lead.evidenceClaimIds) claimIds.add(id);
      }
    }
    // A selected remote objective brings its established truth, including secrets.
    // Close explicit quest/lead subjects once; do not recursively retrieve every
    // fact about owners, locations or the other subjects of those facts.
    for (const id of questEntities) requiredEntities.add(id);
    for (const fact of world.facts) if (fact.subjects.some(id => questEntities.has(id))) factIds.add(fact.id);
    const questFacts = [...factIds].map(id => {
      const fact = factById.get(id);
      if (!fact) throw new EngineError('UNKNOWN_FACT');
      for (const subject of fact.subjects) requiredEntities.add(subject);
      return fact;
    });
    const questClaims = [...claimIds].map(id => {
      const claim = claimById.get(id);
      if (!claim) throw new EngineError('UNKNOWN_CLAIM');
      requiredEntities.add(claim.speakerId);
      return claim;
    });
    return { ...base, entities: withReferences(requiredEntities), facts: questFacts, claims: questClaims, quests: allQuests, storyDirector: { ...base.storyDirector, selectedQuestIds: allQuests.map(quest => quest.id) } };
  }
  const questSelection: { id: string; reasons: string[] }[] = [];
  function recordSelection(candidate: RankedQuest, chain: Quest[]) {
    for (const quest of chain) if (!questSelection.some(selected => selected.id === quest.id)) questSelection.push({ id: quest.id, reasons: quest.id === candidate.quest.id ? [...candidate.reasons] : [`ancestor:${candidate.quest.id}`] });
  }
  if (focus) {
    const chain = ancestry(focus.quest);
    base = addQuests(chain);
    recordSelection(focus, chain);
  }
  if (JSON.stringify(base).length > maxChars) throw new EngineError('CONTEXT_BUDGET_EXCEEDED');
  // All focus ancestors and their evidence are mandatory. Other branches are
  // atomic optional bundles: an oversized branch cannot evict scene truth.
  for (const candidate of ranked) {
    if (base.quests.some(quest => quest.id === candidate.quest.id) || (!candidate.relevant && !candidate.reasons.includes('saved_focus'))) continue;
    const chain = ancestry(candidate.quest);
    const count = new Set([...base.quests, ...chain].map(quest => quest.id)).size;
    if (count > QUEST_CONTEXT_LIMIT) continue;
    const next = addQuests(chain);
    if (JSON.stringify(next).length > maxChars) continue;
    base = next; recordSelection(candidate, chain);
  }
  base.recentTurns = boundConversation(recentTurns.filter(turn => turn.revision <= world.revision));
  while (base.recentTurns.length && JSON.stringify(base).length > maxChars) base.recentTurns.shift();
  // Optional lexical matches and recent facts fill remaining budget without evicting scene facts.
  const optional = world.facts.filter(f => !base.facts.some(existing => existing.id === f.id)).sort((a, b) => {
    const score = (f: typeof a) => words.filter(w => f.text.toLowerCase().includes(w)).length * 10000 + f.at;
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
  for (const fact of optional.slice(0, 40)) {
    const candidate = { ...base, entities: withReferences([...base.entities.map(entity => entity.id), ...fact.subjects]), facts: [...base.facts, fact] };
    if (JSON.stringify(candidate).length > maxChars) continue;
    base.entities = candidate.entities; base.facts = candidate.facts;
  }
  return {
    state: base,
    manifest: {
      entityIds: base.entities.map(e => e.id), factIds: base.facts.map(f => f.id), claimIds: base.claims.map(claim => claim.id),
      inventoryIds: inventory.map(item => item.id), selectedItemId: selectedItemId ?? null,
      questIds: base.quests.map(quest => quest.id), focusQuestId, questSelection, excludedQuestCount: world.quests.length - base.quests.length,
      turnIds: base.recentTurns.map(turn => turn.id), conversationChars: base.recentTurns.length ? JSON.stringify(base.recentTurns).length : 0,
      chars: JSON.stringify(base).length
    }
  };
}
