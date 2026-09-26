# Story direction

StoryQuest needs the DM to give the player a reason to act, a concrete next lead and visible consequences over time. A persistent world can be internally consistent yet still feel directionless. This slice adds a small narrative director to the existing proposal/commit/narration pipeline. It does not prescribe an ending or require the player to follow a main quest.

This is a prototype informed by established interactive-narrative techniques, not a claim that one architecture is universally best. See [implementation status](implementation.md) for verification and deployment results; this document describes the contract and its limits.

## Research and design choice

| Primary source | Relevant lesson | Application here |
| --- | --- | --- |
| Emily Short, [Beyond Branching: Quality-Based, Salience-Based, and Waypoint Narrative Structures](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/) | Modular content can be selected by prerequisites and current relevance. Relevance alone does not guarantee a satisfying dramatic arc. | Select a bounded set of quest context and retain direction across turns. Do not treat lexical relevance as a complete story planner. |
| Sage LaTorra and Adam Koebel, [Dungeon World: Fronts](https://github.com/Sagelt/Dungeon-World/blob/master/text/Fronts.xml) | Campaign and adventure threats connect scales of conflict. Motives, possible developments and unresolved stakes provide direction without fixing the outcome. | Connect immediate and local objectives to larger stakes when useful. Future plans remain adaptable; past events do not. |
| John Harper, [Blades in the Dark: Progress Clocks](https://bladesinthedark.com/progress-clocks) | Progress tracks changes in the fiction. Describe the obstacle so players can choose different methods of overcoming it. | Require evidence for reported quest progress. Do not advance a threat simply because another turn was submitted. Full clocks are deferred. |
| Sun et al., [Drama Llama](https://arxiv.org/html/2501.09099v1), 2025 | Combining storylets with LLM generation can add structure to otherwise directionless narratives. Its preliminary six-author study also found unreliable trigger timing and clichéd content. | Use explicit direction with improvised realization. This supports the design hypothesis, not a promise of consistently compelling play. |
| Wang et al., [Design Techniques for LLM-Powered Interactive Storytelling: A Case Study of the Dramamancer System](https://arxiv.org/html/2601.18785v1), 2026 | Scenes and condition/outcome events guide generated interactions. Responsiveness to the player's latest input remains a separate requirement from event progression. | Preserve the player's topic before introducing a next lead. Evaluate both progress and agency. This paper is a design case study, not a large controlled effectiveness trial. |
| TypeSafe, [Introduction](https://docs.typesafe.ai/introduction) and [Confidence](https://docs.typesafe.ai/confidence) | Jev supports narrow typed judgments composed in code; its confidence summarizes the answer distribution. | Keep Jev advisory. Evaluate relevance judgments on StoryQuest cases before using them to select optional context. Confidence is not world truth. |

The resulting design combines optional hierarchical objectives, bounded context selection and explicit progress evidence. It borrows storylet principles without implementing a full library of authored scenes, a planning search algorithm, condition-gated beats or autonomous NPC simulations.

## Four scales, one connected story

| Scope | Purpose | Illustrative objective |
| --- | --- | --- |
| `world` | A persistent conflict, question or opportunity affecting the wider setting | Understand why settlements along an old trade road are disappearing. |
| `arc` | A substantial line of investigation or change | Discover what happened to one settlement. |
| `local` | A problem involving the current place or cast | Find a witness who can explain an observed event. |
| `immediate` | A concrete objective the player can attempt now | Ask the known witness where they last saw the missing travelers. |

These examples are fictional design illustrations, not new facts about any saved adventure. A parent link expresses a relationship between objectives and must point to an existing quest at a strictly broader scope; self-links and cycles are invalid. The engine does not require all four scopes, populate missing levels automatically, or make every local interaction serve the same world quest. Independent stories remain possible.

World lore and historical facts constrain the DM. A quest objective states a desired or investigated outcome; it does not establish that the outcome happened. A lead suggests something to try; it does not guarantee success. An NPC's testimony remains a claim even when it helps an investigation.

## State contract

Existing quests retain their ID, title, description, status and knowledge list. Optional `guidance` adds:

- `scope` and nullable `parentId` for organization.
- `objective` and `stakes` for what the quest is trying to achieve and why it matters.
- `entityIds` linking the quest to relevant characters, places or items.
- Up to three `leads`, each with a stable ID, short display text, editable action text, linked entities, and supporting fact/claim IDs.
- `lastProgressRevision`, maintained by the engine.

Optional world `story` state records `focusQuestId`, `quietTurns` and `lastProgressRevision`. This is direction metadata, not a second source of world truth.

Engine 1.2.0 live proposals include a required `storyPlan` alongside `itemActions` and ordinary operations:

```ts
{
  focusQuestId: string | null,
  questUpdates: [ // at most three
    { questId, scope, parentId, objective, stakes, entityIds, leads }
  ],
  progress: [ // at most three
    { questId, factIds, claimIds }
  ]
}
```

The existing operations still create quests and mark them completed or failed. `storyPlan` supplies direction and evidence around those changes; it is not an unrestricted state patch. The engine checks references, quest hierarchy and visibility before accepting the complete turn. Invalid direction metadata rejects the candidate atomically, preserving the previous world. A live action must choose a known active focus when such quests exist; otherwise it uses `null`. A clarification carries a null focus and empty updates/progress and changes no world state.

Progress must point to supported evidence rather than simply assert that the story advanced. For a player-known quest, every cited fact or claim must be known to the player after the turn and must either be newly created or newly learned by that player. Reusing already known testimony does not count. Where guidance has evidence/entity links, at least one cited record must overlap those links through its ID, subjects or speaker. Completing or failing a quest also requires progress evidence for that quest in the same proposal; completing a child never automatically completes its parent. A quest cannot be added and resolved in the same turn, even if evidence is supplied; this prevents manufacturing instant completed goals.

Hidden quests may use new private evidence or evidence newly learned by their observers, but hidden progress does not reset the player's quiet-turn counter. Each lead must cite at least one entity, fact or claim, and all its references must be known to every character that knows that quest.

These checks establish freshness, visibility and structural overlap, not semantic progress. A model could still cite a shallow fact about the right entity or testimony that does not answer the objective. That requires evaluation and, later, stronger quest-specific conditions.

The proposal reducer remains responsible for inventory, chronology, immutable facts and legal operations. The director cannot grant a missing staff, invent an established cause, resolve an unearned quest or authorize narration to change the world.

## Turn behavior and context

The director runs within the existing DM proposal. There is no separate planning-model call, one-call-per-quest loop or background work while the player is away. Richer metadata can change token usage, so preserving call count is not a claim of identical cost.

Context selection uses state and bounded deterministic ranking, with at most six quests. Explicit quest/lead references and relevant entity mentions outrank broad title matches, current-scene links and saved focus. Immediate scope helps break ties. The selected known active focus and its ancestor chain are mandatory, including terminal ancestors that explain the current objective. Their supporting facts, claims and entity owner/location references are included as well.

Other relevant quests enter as optional complete bundles with their ancestry and evidence; a bundle that exceeds the quest count or character budget is omitted. There is no unbounded summary of every quest. Hidden relevant quests may be optional DM context, but cannot become the public focus. The full inventory, applicable rules and deadline obligations keep their existing priority. The context manifest records selected quest IDs, selection reasons, excluded quest count and selected claim IDs. Mandatory context overflow still fails closed rather than silently removing required state.

The DM should first respond to what the player actually attempted. Asking a woman why she is waiting at an arch deserves her answer or a deliberate refusal. It must not be reinterpreted as asking about the town merely because that is the larger quest. A connection to a larger thread can follow when the world and conversation support it.

Direction means the player can identify an available next step. It can come from a new clue, a witness's request, an obstacle made clearer, a changed relationship or a consequence of an earlier choice. The player may reject the lead, pursue another goal or continue exploring.

`quietTurns` is a pacing signal derived from recorded progress. It is not a verdict that a conversation is boring and is not a timer that forces disaster. The director sets `needsDirection` after three quiet turns or when there is no player-known grounded lead. This gives the DM stronger guidance to offer a concrete next step. Rest, deliberate character interaction and exploration remain valid. No clock, deadline, quest completion or historical fact advances solely because the quiet-turn counter increases.

Completed or failed quests explicitly named by title or ID remain eligible as optional historical context, never as an active focus.

Commit still precedes narration. The narrator receives only the public outcome, known quest direction and other projected knowledge. It may present committed leads naturally but cannot invent a new quest or clue to satisfy a pacing instruction. Narration receives only the focused quest, its visible ancestors and quests explicitly changed by the committed turn, rather than the full public journal. Mandatory public facts still have the existing 24,000-character narration limit; long-history fact retrieval remains future work.

## Player experience and knowledge boundary

The Story view surfaces a current lead close to the action composer. Selecting a suggested action prepares editable text; it does not submit a turn or force the character's choice. The Journal provides broader quest context: scope, objective, stakes and available leads. Existing freeform input remains the primary interaction.

Only known quests and permissible referenced entities/evidence belong in player projections. Hidden parent relationships must not reveal an undiscovered arc. Old quests without direction metadata remain readable. When no authored/committed leads are available for the active focus, the projection can offer generic attempts based only on the current known scene, such as asking a present NPC for information or examining a known landmark. These are possible investigations, not assertions that the NPC knows an answer or the landmark holds a clue.

Reference checks cannot prove that arbitrary `objective`, `stakes`, lead or narration text contains no spoiler. The DM must express public guidance using knowledge already available to the player, and semantic leakage remains an evaluation target. An unknown-to-player fact stays established truth on the server; it must not become a public lead merely because it would help advance the plot.

## TypeSafe / Jev

Jev is a plausible fit for questions such as whether a candidate lead addresses the player's current interest or whether a proposal repeats a previous lead. These should be narrow questions over bounded candidates, with deterministic logic combining the answers.

For this slice, the existing optional shadow review includes two additional narrow judgments: whether cited progress materially advances its objective, and whether quest pressure displaces the player’s exact topic. It remains a single bounded advisory request, cannot choose world truth and cannot block progress when unavailable. No new serial pre-context selector is required.

A Jev reranker for optional quest context is deferred until recorded examples show that it improves recall or story direction over deterministic selection. It would not be allowed to remove applicable rules, inventory, mandatory deadlines or the active objective's required context. Evaluate false exclusions, latency and cost as well as ranking quality. A concentrated probability distribution does not establish that a judgment is correct for a particular adventure.

## Compatibility and maintenance

Direction metadata is additive; existing snapshots and quests remain valid. Existing adventures can acquire guidance through accepted new turns. Do not rewrite their historical proposals, inject outcomes into old narration or require a reset to use the feature.

Versioned replay must preserve the original 1.0.0 and inventory 1.1.0 reducers and apply the story-aware reducer to 1.2.0 turns. Replay does not call a model. After story-aware turns exist, roll forward or use a release that understands them; an older application can discard or ignore new direction metadata.

Inspect selected quest IDs, focus, progress evidence, quiet-turn counts and rejected plans alongside ordinary turn traces. Keep these diagnostics private. Compare the proposed direction, committed state, projected lead and actual narration when investigating a report; they represent different stages and can fail separately.

## Evaluation and next steps

Automated tests should cover invalid/cyclic hierarchy, hidden references, missing progress evidence, atomic rejection, legacy saves, mixed-version replay and mobile editable-lead behavior. Mocked tests establish contract behavior, not creative quality.

Use explicitly authorized multi-turn playtests to measure:

- **Direction:** how often the player has a concrete, currently possible next step; consecutive turns without meaningful change.
- **Repetition:** repeated lead IDs/text and re-delivery of already learned information.
- **Agency:** whether the DM preserves the exact topic, accepts a declined lead and supports a different reasonable approach.
- **Consequences:** whether cited progress changes knowledge, access, relationships, obstacles or quest status in a meaningful way.
- **Continuity and secrecy:** unsupported causes, premature reveals and facts contradicted across turns.
- **Efficiency:** selected-context size, input/output tokens, reported cost and proposal/narration latency.

Do not optimize the quiet-turn metric by generating trivial facts or forcing constant escalation. A useful comparison includes the player's own assessment of whether they understood their choices and wanted to continue.

Later slices can add typed completion conditions, condition-gated beats, explicit NPC/front goals, and progress or danger clocks whose increments correspond to recorded events. Add these only where playtests expose a need. Long-campaign retrieval, richer branching outcomes, and a measured Jev reranker follow the same evidence-first approach. The current director provides the data and traces needed to make those decisions without building an unobserved simulation in advance.
