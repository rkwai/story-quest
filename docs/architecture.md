# Architecture

## Responsibilities

Next.js serves the mobile web app and open shared-playtest orchestration routes on Vercel. Supabase stores authoritative snapshots, accepted turns and traces. No player identity or authentication is required in this mode. A pure TypeScript reducer is portable and provider-independent. The LLM makes creative judgments and proposes structured changes; code validates and applies them. Database commits, not model output or chat history, define truth.

```mermaid
flowchart TD
  UI[Mobile story interface] --> API[Shared playtest turn route]
  API --> Context[Bounded context builder]
  Context --> DM[OpenRouter DM proposal]
  DM --> Engine[Validate and reduce]
  Engine --> DB[(Supabase atomic commit)]
  DM -. Candidate review .-> Jev[TypeSafe Jev]
  Jev -. Advisory only .-> Trace
  DB --> View[Character knowledge projection]
  View --> Narrator[OpenRouter narration]
  Narrator --> UI
  API --> Trace[(Private turn traces)]
```

## Open shared access

The lobby lists all active and archived adventures. Anyone may create a run, resume an active one, reset it or delete a selected run after confirmation. Raw Supabase tables and internal RPCs remain inaccessible to browser roles: RLS stays enabled and anon/authenticated grants stay revoked. Application routes use the server key and return explicit player knowledge projections, never authoritative snapshots or private traces.

The historical `owner_id` UUID is an internal quota/serialization scope, decoupled from `auth.users`; it is not a player identity or access boundary in open mode. New campaigns use a shared scope. For an existing campaign, the server resolves its stored scope before invoking database functions, so earlier runs remain usable. Clients cannot supply their own scope to evade limits. The shared lobby permits five active campaigns and 100 turn attempts per day. Turn/narration leases and revision checks still apply. Concurrent visitors act on the same state; a stale proposal must fail instead of overwriting another turn.

Reset archives the original run and creates a new one from its stored seed with an idempotent reset ID. Delete removes the selected run and cascades to accepted turns and traces; an existing reset successor is a separate run. Neither operation requires a model call. UI confirmation is required for deletion, and deletion must not race an active turn or narration lease.

## State and history

The first version uses a JSONB campaign snapshot for a coherent transaction boundary, plus an append-only accepted-turn table. Entities, facts, rules, claims, quests and scheduled events have stable IDs. Facts have a canonical key, subjects, content, occurrence time, and explicit known-by character IDs. Facts cannot be overwritten. An existing fact's knowledge can grow. Claims have a speaker and their own audience and do not establish their content as truth.

Entity fields describe current state; updates are accepted operations in the event history. Items have one owner and optional mechanical state: quantity, consumable and usable. Engine 1.1.0 validates an ordered `itemActions` plan before other consequences. Ownership and location changes must use those actions; creating an item directly owned by the player or moving an item with a generic update is rejected. New world or NPC-owned items can still be generated with valid placement. Referential integrity, unique IDs/keys, valid owners, nondecreasing time, and event deadlines remain checked by the original reducer. Generated prose is never executed. Narrative rules are data supplied to the DM; schema/reducer validation cannot prove arbitrary prose consistency.

Inventory is a complete list, unlike undeveloped lore: an absent carried item is unavailable. The context includes the full possession list plus a selected item's stable ID when supplied by the UI. Generic facts, NPC claims and previous narration cannot establish possession. The inventory reducer validates declared dependencies; recognizing every dependency in unrestricted text remains a semantic DM task. See [inventory operations, compatibility and limits](inventory.md).

Stored seeds and accepted history remain unchanged. `replayVersioned` applies the original reducer to 1.0.0 turns and the inventory reducer to 1.1.0 turns; unknown engine versions fail explicitly. Legacy items without mechanical state default to quantity one, reusable and usable. Their private descriptions and freeform condition strings are not parsed into mechanical restrictions. Once 1.1.0 turns exist, releases used for rollback must understand quantity and usability; deploying a pre-1.1 app would ignore those restrictions.

Engine 1.2.0 wraps the inventory reducer with a typed `storyPlan`: optional quest hierarchy, objectives, stakes, public leads and progress evidence. Additive JSONB metadata supports existing saves without a database migration. Quests may be world, arc, local or immediate scope; parent scopes must be broader. Fresh evidence is required for reported progress and quest resolution. Quiet-turn counts request better direction, never force a world event. Versioned replay retains both earlier reducers and dispatches 1.2.0 turns to the story-aware wrapper. See [story direction](story-direction.md) for the full contract and semantic limitations.

The director selects at most six quests, preserving the focus's ancestor chain and grounded evidence. Relevant optional branches fit only after mandatory scene truth, inventory, rules and crossable deadlines. Selection is deterministic retrieval, not player intent classification. The DM develops the selected goals in its existing proposal call; the existing Jev advisory request additionally reviews unsupported progress and topic drift. A lead is a possible action, never a committed outcome, and narration receives only its public projection.

Future scaling: move growing facts/events into indexed tables and retrieve candidates by entity, place, time and full-text query. Keep a compact current-state snapshot. Never make an embedding summary authoritative.

## Turn protocol

1. Resolve the campaign and its internal scope server-side. No JWT or sign-in is required. Enforce input size and a database-backed turn lease/rate limit; archived runs reject new actions.
2. Check `(campaign_id, turn_id)` before a model call; return the previous result on retry. A reused ID with a different input is rejected.
3. Build bounded DM context: world seed and all applicable rules, player and scene entities, linked facts/claims, selected quests and their ancestors, due events and a short recent outcome window. Include direction/pacing guidance; log selected IDs, reasons and size. Fail closed when mandatory context cannot fit.
4. The DM returns clarification or an attempted-action interpretation, elapsed time, mandatory `itemActions` and typed operations. At most one proposal call; invalid proposals return a failure without mutation. Missing equipment is represented explicitly rather than invented. A selected item is checked against the reserved snapshot before generation, and an action proposal must reference that same ID. Never silently repair history.
5. Reduce on a clone: check each item action against existing inventory and the current scene before other consequences. Any inventory failure blocks the whole attempt with no time or revision advance, releases the lease and returns a safe error while the UI keeps the draft. It does not call Jev or narration. Then reject invalid references, overwritten facts, invalid state transitions, unsupported operations and unresolved deadlines crossed by elapsed time. When configured, one OpenRouter Decisions request to Jev reviews a valid candidate and bounded context for intent/continuity. Its private results are advisory; a 4-second timeout or failure never changes the engine outcome.
6. Atomically lock/check snapshot revision and insert the accepted turn plus next snapshot. Concurrent stale proposals fail. Store the proposal, engine version and public outcome for replay. No external API call is inside the database transaction.
7. Return committed public changes first. Narration is a separate application request operating only on the committed public projection and outcome. It cannot change world state. The UI always has a deterministic fallback. Narration is persisted with bounded retries and its own lease.

Determinism means replay of accepted proposals from the original seed produces identical state. It does **not** mean AI interpretation is deterministic. First-slice adjudication has no dice; if introduced, persist rolls/seeds with the proposal.

## Living world without cron

Nothing happens computationally while the player is away. In-story actions advance time. The DM may develop relevant NPC goals and local dynamics within the turn's operation budget. Scheduled commitments have explicit due times and must resolve when crossed. On long travel/rest, include deadlines first; bound the allowed time jump to the configured maximum and use additional player turns if needed. Never silently skip commitments to meet a token budget.

Distant possibilities remain unmaterialized until relevant. They are constrained by established goals and history when materialized. This is selective story development, not a full offscreen simulation. No background job per NPC or campaign.

## Knowledge boundary

Authoritative state is not client-readable, even though the lobby and adventures are shared, because it contains spoilers. Tables have RLS and no client grants/policies for snapshots or traces. The server returns a deliberately constructed player view. The secret-informed DM interpretation and clarification text stay in private records; ambiguous turns return a fixed public-safe question. Public turn notes echo the player’s own attempt and list projected changes. Hidden facts, undiscovered entities, private rules and unresolved DM intentions never enter narration context. Known entities expose only identity/kind; descriptions, conditions and relationships are presented through known facts to avoid leaking changed offscreen attributes. An explicit inventory projection exposes only known items currently carried by the player, with stable ID, name, quantity, consumable and usable. Zero-quantity records remain in state and history but are omitted from carried inventory.

The narration prompt may add sensory connective prose but must not invent consequential facts. This prompt is a constraint, not a formal proof. Story fidelity evaluations and an eventual independent narrative checker are required before claiming strong semantic guarantees.

## Cost and latency

Default bounds: 2,000 input characters, 24,000 context characters, 20 world operations plus 12 item actions, 720 in-story minutes, 1 proposal + 1 narration call on the normal path, with at most one explicit narration retry per accepted turn. No calls on inactivity. Provider token counts, model/version, prompt version, stage duration and selected context IDs are logged. OpenRouter-reported cost, served model/provider and generation IDs are recorded through a metadata allowlist; missing costs stay null. Raw provider errors and reasoning are excluded. TypeSafe adds at most one 4-second shadow call per proposal, with no retries. Its resolved model, finite probabilities and usage are logged privately; it cannot commit or veto state.

The world-change proposal has a 120-second request deadline, inside a 150-second Vercel turn route and a 180-second reservation lease. Narration retains its separate 45-second deadline. This prevents the old 45-second cutoff from discarding slow responses while keeping one proposal per attempt; the model and context budgets are unchanged. A new adventure skips its empty history query.

Two sequential model stages are intentional: narration cannot precede commitment. A visible committed outcome prevents a narration delay from making the game appear lost. Later optimize with streaming narration and measured caching, not speculative world mutation.

## First-slice limits

Snapshot loading is O(campaign size) even though model context is bounded. Lexical/entity context retrieval can miss distant relevant facts. Immutable keys block direct replacement but not a cleverly paraphrased contradiction. World-rule semantics remain model adjudication. Document and measure these gaps; the roadmap includes indexed retrieval, contradiction evaluation, and long campaign benchmarks.
