# Implementation plan and status

Updated: 2026-09-26. This file is the handoff across sessions. Checkboxes mean implemented and verified, not merely designed.

## Latest-first Story layout — September 26, 2026

Rick requested action input, preset prompts, latest interaction, then scrollable past interactions. The composer and its pending/error messages now lead the Story screen, followed by quest suggestions and the latest complete interaction. A separate keyboard-focusable region contains older turns in descending revision order, with the opening scene last. Before any turn, the opening remains the current scene. Saved turn arrays, API ordering and replay are unchanged.

The layout no longer scrolls to the history bottom when a turn or narration updates. Entering Story positions the composer at the top. Narration recovery remains attached to each original turn ID, including older turns. The latest passage has no inner height limit; only past history scrolls independently. Archives remain read-only and the scripted preview keeps its explicit preset flow.

Verification: TypeScript, all **127 existing regression tests**, the production build and all **15 existing phone browser tests** pass. The updated phone layout was visually inspected. No model calls, world-state changes or new database migration are required for this presentation update.

## Story direction — September 26, 2026

Rick reported aimless wandering and proposed world, major, local and immediate quests. Research on storylets/salience, Dungeon World fronts, Blades progress clocks and LLM narrative systems supports adding explicit adaptable goals and concrete opportunities while preserving player agency. [The research and design record](story-direction.md) includes primary sources and separates established patterns from preliminary AI evidence.

Engine `1.2.0` and prompt `dm-1.4.0` add mandatory typed `storyPlan` proposals with optional hierarchical quest guidance, objectives, stakes, grounded leads and fresh progress evidence. Only active known quests can be the player's focus. Parents must be broader in scope; completing a child does not complete its parent. Quest completion/failure requires new supporting evidence, and a newly created quest cannot also resolve in the same turn. Quiet-turn counters request direction after three turns without supported progress; they do not force deadlines, threats or player actions. Public progress cannot use hidden evidence. Rephrasing lead metadata does not count as progress. Freshness/reference checks do not prove the model's interpretation is meaningful.

The proposal context selects at most six quests with focus ancestry and required evidence protected, including authoritative facts attached to referenced quest entities. Optional branches fit atomically into the existing 24,000-character budget. Explicit questions about resolved quests can retrieve them as historical context without making them active. The narrator receives the focus, visible ancestors and quests explicitly changed by the turn instead of the entire journal; public fact growth still needs a later retrieval slice. Existing model choices, generation limits and deadlines remain unchanged. Jev shadow prompt `jev-shadow-2.1.0` adds progress-quality and topic-drift judgments in its existing request. Semantic context reranking remains deferred until evaluated on StoryQuest examples.

The Story view offers persistent editable lead suggestions and a current objective. The Journal displays scope, parent links, objectives, stakes and known leads; selecting a suggestion never submits it. The opening chapter label no longer remains stuck on Arrival after play advances. Old adventures immediately receive generic leads based on their current known scene, then acquire richer guidance through accepted turns. No saved history is rewritten, no database migration is required, and no reset is needed. Versioned replay preserves 1.0.0 and 1.1.0 behavior; use a story-aware release for rollback after 1.2.0 turns exist.

Verification: TypeScript, all **127 regression tests**, the production build and all **15 phone browser tests** pass. Tests cover hierarchy, hidden references and progress, stale evidence, atomic failures, same-turn resolution bypass, legacy saves, mixed replay, bounded retrieval, resolved-quest questions, narrator quest filtering, API call counts, persisted guidance and editable mobile actions. Story and Journal screenshots were inspected for wrapping/overflow; an independent review found the resolution/retrieval edge cases above, both fixed and tested. Provider responses are mocked; this is not a new paid story-quality playtest. Release via GitHub master and verify the exact production SHA, health and existing adventure projection before reporting deployment success. Next live evaluation should check that a declined lead and an exact NPC question preserve intent while meaningful opportunities continue to develop.

Private traces now capture selected quests/reasons, focus, before/after quiet counts, cited progress, updated quest IDs, surfaced lead IDs and rejected story codes. No additional trace-write stage is introduced. These records support tuning repetition, false progress, topic fidelity and context cost against actual play.

## Current delivery — open shared playtest (2026-09-18)

Rick explicitly removed login and requested that anyone be able to start, resume and delete any adventure. The default entry becomes a shared lobby with one-click default creation and optional customization; the scripted preview is secondary. No email, account creation or anonymous Supabase Auth identity is required.

The implementation preserves the engine and knowledge boundary: routes resolve an existing campaign’s internal quota scope server-side, new runs use a shared scope, and raw tables/RPCs remain private. The historical owner UUID is decoupled from `auth.users` and retained as an internal request-limit/serialization key. Reset continues to archive; confirmed Delete removes one run and its accepted turns/traces. Existing user runs are not removed as part of this release.

Verification: TypeScript, all 40 regression tests and the production build pass. Tests cover no-login create/list/resume/delete routes, preservation of existing saves, private state filtering, shared quotas, active-lease deletion guards, deletion cascade, reset descendants and verification-ledger retention. Migration `20260918220546_open_playtest_lobby` is applied in Supabase; its filename matches the hosted version. A hosted query confirms one shared scope and no browser-role access to raw state, traces or delete RPCs. Security advisor has only six intentional informational RLS-without-policy notices on private tables. Hosted browser verification now confirms no-login default creation, reload and Continue. The phone browser scenarios were updated but not executed in this pass. The auth-based verify:live script is legacy and is not the acceptance gate for open mode. Normal builds must never invoke a paid playtest.

Git production verification (September 19): commit `7eb41b9720fcda090c11b0a970a8f03a604f4894` triggered `dpl_G1WuHghNxRNukRR9xvjyph43PTua`, reached READY and serves https://story-quest-seven.vercel.app; GitHub CI passed. Native Git releases are now operational.

First real AI dialogue attempt: DeepSeek V4.1 Flash, served by Wafer, proposed three `create_entity` operations with the same `mara_answer` ID. The engine rejected `DUPLICATE_ID` before commitment; revision remained 0. The proposal took 6.857 seconds and reported $0.000727 cost. No Jev review or narration ran. Private verification run `f7c1f6cf-a34d-4b62-a736-4c0a4a8b9b8e` remains recorded as failed. This verifies safe rejection, not a successful storytelling turn.

Rick authorized up to five focused playtest rounds with fixes and production releases between rounds. Prompt `dm-1.2.0` now documents operation semantics and records NPC answers as testimony, with a regression fixture for the exact rejected duplicate proposal. The DM receives up to four recent public turns within a 6,000-character conversation budget and the overall 24,000-character state budget; narration is explicitly not authoritative truth. Scene context now includes local NPC possessions and referenced entities. Rejected proposals show a useful error while preserving the player's input. Archived runs have accurate read-only copy. TypeScript, the production build, 42 existing/provider tests and four new conversation tests pass. The model behavior still needs a hosted retest after this release.

Hosted lifecycle checks also confirm reset creates a fresh seed-based run, archives the prior run without losing its failed-attempt trace, and opens archived history without an action composer. A fresh browser tab sees the same shared adventures. Delete confirmation and cancellation work; permanent hosted deletion has not been exercised. Existing player data was not removed.

Playtest rounds 2–4 on production commit `48500a2` (`dpl_Ba3u21pHbt8ypSiRJRvrnX19ndTx`, READY; CI passed): the original question produced a relevant answer recorded as testimony; after reload, “Whose eyes?” correctly continued that dialogue; inspecting the lantern without taking or lighting it preserved its owner and unlit condition while establishing observable details. Revisions advanced exactly once to 1, 2 and 3. DeepSeek proposal/narration and Jev advisory calls all completed. Provider-reported costs were $0.000771996, $0.001169802 and $0.003082698 respectively; commit-plus-narration timings were approximately 11.3, 15.3 and 22.4 seconds. These are three successful state transitions, not proof of general story consistency.

Round 4 narration added an unsupported decorative explanation that a thumb wore down a mark. That explanation was not committed as truth. Prompt `dm-1.2.1` explicitly prohibits inventing the causes of observed details or hidden motives, and the singular elapsed-time wording is corrected. Existing recorded prose is preserved.

Round 5 on `6af0aa0` correctly advanced to minute 1080, moved the woman to the tower and resolved the dusk event; its public fact also revealed the private name Mara before an introduction. The run is recorded as failed acceptance despite the correct physical outcome. Prompt `dm-1.2.2` now distinguishes an entity's known name from private IDs/descriptions and scheduled text; the exact failure is captured in `tests/fixtures/npc-name-visibility.json`. This prompt refinement has not received another paid test. Semantic knowledge/prose enforcement remains a limitation, not a solved invariant. Jev was advisory and reported only 0.17 knowledge concern for this failure.

Five paid attempts cost a provider-reported $0.008250946 total. TypeScript, all 46 regression tests and the build pass for the final prompt update. Hosted reset of the four-turn run preserved all four turns and 20 traces and created a fresh run identical to its stored seed. The original failed run and its three traces also remain. See [the full playtest report](playtest-2026-09-19.md) for coverage, timings and remaining checks. Continue with the undiscovered-name acceptance case before expanding the campaign test set; do not claim five clean passes.

## Inventory enforcement — September 26, 2026

Rick's latest playthrough used a staff that had never existed in carried inventory. Earlier dialogue/prose had mentioned one; a later accepted fact described striking the bell without referencing a staff entity. `tests/fixtures/missing-staff.json` preserves a minimal reproduction. Existing accepted history remains unchanged, and no staff is granted to repair it.

Engine `1.1.0` and prompt `dm-1.3.0` add mandatory ordered item actions for use, taking, dropping, giving, receiving, consumption, damage and repair. The engine checks existence, player knowledge, ownership, reach, quantity and usable/consumable state before any world consequence. Direct player-item creation and generic item ownership/location updates cannot bypass these checks. A blocked attempt releases its lease, keeps the draft and changes neither world time nor revision; no Jev review or narration runs for it. Context carries the full possession list, and selected UI IDs are validated before a paid call. The same proposal/narration models, call limits, reasoning settings and timeout budgets apply.

The Character view now shows item counts and mechanical availability, with Use, Drop and Consume controls that prepare editable roleplay text. The composer links back to inventory and visibly identifies a selected item. Duplicate names use stable IDs; retries preserve the same UUID only for the same input and selection. Reload recovery distinguishes an already committed item action from an uncommitted draft. Archives and the scripted preview stay read-only for item actions.

Old saves need no database migration. Legacy items retain their existing ownership and default to a single reusable, usable item; old proposals replay through the original reducer. New world/NPC/offscreen items remain possible but cannot be used in the turn that creates them. Current-location reach, whole-stack transfers and two-turn discovery/acquisition are deliberate first-slice limits. Free-text dependency extraction still depends on the DM: structured enforcement does not prove that every implicit requirement was identified. See [inventory contract and remaining limits](inventory.md).

Verification: TypeScript, all **84** regression tests and the production build pass. These include the staff fixture, strict provider schema compatibility, atomic rollback, consumable depletion, other people's/distant gear, item damage/repair, private projection, duplicate-name changes, old/new versioned replay, and route-level no-commit/no-extra-call checks. All **10** phone browser tests pass, including the five new inventory scenarios; the inventory screen was visually checked for wrapping and overflow. The Chromium test configuration no longer forces single-process mode, which caused browser shutdown between tests. All model responses in automated tests are mocked; no additional paid playtest is claimed. Release through the connected GitHub master deployment, then verify the exact production commit, health and an existing adventure inventory without mutating it.

## World-planning timeout update — September 21, 2026

The latest reported playthrough had five failed attempts at roughly 45.3 seconds, all after OpenRouter HTTP 200 headers and before a complete body. Seven accepted turns and their narrations were saved; Jev reviews averaged about 0.2 seconds. This points to the application's former 45-second proposal cutoff, not a slow deterministic reducer.

Proposal requests now have a 120-second deadline across headers and body, with a 150-second turn route and 180-second database reservation. Narration remains 45 seconds, and Jev remains at most four seconds. New adventures skip the impossible prior-conversation query; established adventures retain their complete existing context-selection rules. No model, effort, token budget, routing preference or automatic retry was added or changed.

Private model metrics now distinguish timeout, HTTP, network, invalid JSON and provider failures, record the configured deadline and header-arrival time, and identify whether a failure was waiting for headers or body. Timeouts return a safe HTTP 504 with the input preserved; other provider-unavailable errors return 503. A failed proposal releases its lease and cannot commit state.

Verification: [GitHub Actions on `8ca161a6`](https://github.com/rkwai/story-quest/actions/runs/35561359754) passed TypeScript, all 52 regression tests and the production build. The isolated Vercel preview is READY. The new regression cases simulate a 90-second successful response, timeout before headers, a stalled HTTP 200 body, unchanged narration limits, timeout cleanup without commit, and concurrent/reset/delete protection 135 seconds into a reservation. All model responses are mocked; no paid playtest or claim of measured live latency improvement is part of this change. Hosted migration `20260921043358_longer_proposal_lease` is applied; a read-only query confirms the 180-second lease, security-invoker execution and server-only grants. Security advisors report only the same six intentional informational RLS-without-policy findings. The repository filename matches the provider-generated migration version. Release through the normal Git-triggered `master` deployment and verify its exact source commit and production alias.

## Phase 0 — Product contract and repository reset

- [x] Capture agreed experience, authority/knowledge boundaries and lazy world evolution.
- [x] Rewrite README and add agent instructions, architecture, maintenance and deployment plans.
- [x] Preserve old app under legacy/ and establish the new build.

## Phase 1 — Playable foundation (current)

- [x] Mobile Story, Character, Journal and World views.
- [x] Explicit scripted preview with preset choices; optional secondary entry from the shared lobby.
- [x] Typed engine operations; immutable facts; knowledge/claims; deadline resolution; replay.
- [x] Bounded context retrieval and explicit semantic limitations.
- [x] Supabase private state, turn leases and atomic versioned commits. Earlier account ownership checks are superseded by the open shared-playtest decision.
- [x] Live DM proposal -> commit -> narration, with retry/fallback behavior.
- [x] Private diagnostic traces and versioned prompts.
- [x] Meaningful engine/database/phone-flow verification and production build.
- [x] Push implementation to master; GitHub CI passed on b76f10a.
- [x] Verify hosted production sample deployment (READY and HTTP 200).
- [x] Create dedicated DataSaa Supabase project, apply schema and verify server-only access.
- [ ] Complete and verify the open lobby: no-login create/resume/reset/delete plus a real model turn.

## Phase 2 — Prove continuity

Build a fixed scenario set: destroyed-town attribution, false accusations, secret discoveries, item ownership, long rest with deadlines, ambiguous multi-actions, return after 30 turns and API interruption. Label acceptable interpretations and established facts. Compare models and TypeSafe on the same cases; record latency, token usage, clarification rate and continuity errors. Add semantic contradiction checks before committing novel facts. Evaluate narration for unsupported consequential assertions. Do not optimize cost by weakening truth/knowledge guarantees.

## Phase 3 — Longer worlds and richer authoring

Normalize entity/fact/event indexes, add full-text retrieval and explicit dependency links, measure context recall against long campaigns. Add proper character creation, authored and generated seeds, campaign picker, quest conditions, rules versioning, relationships and NPC goals as richer records. Add bounded multi-step travel catch-up. Preserve old rules and events on upgrades.

## Phase 4 — Operations and polish

Stream narration, replay UI for operators, player correction reports tied to turns, downloadable player journal, trace retention tooling, spending dashboard and configurable campaign quotas. Validate restore/rollback in the actual connected deployment. Offline sample is separate from live saves; do not automatically promote its hidden client state to server authority.

## Deployment access

Current access policy: the release target is an open lobby with shared adventures and no login. Account-scoped sign-in observations in the historical sections below do not prescribe current setup. Use docs/deployment.md for project IDs/configuration and record the latest hosted result in this section after release.

### Earlier deployment record — superseded access policy

Vercel and Supabase operational tools are now available. Production: https://story-quest-seven.vercel.app (application commit `e9da55d`, configured deployment READY; home and /api/health returned HTTP 200). Rick completed the Supabase/Vercel project connection; the redeployed app sees both public Supabase values, its server key and the OpenRouter key. Live sign-in is enabled. Deployment used the connected app with source files. Git-triggered releases are not linked yet. See docs/deployment.md for provider IDs and exact verification limits.

Supabase project `cpybqwezigwkhxldxwiv` is ACTIVE_HEALTHY under DataSaa at the provider-quoted $0/month. Migration `20260917084314_story_engine.sql` is applied; table RLS and browser access denial verified. Security advisor returned only intentional informational no-policy notices. Auth settings and production environment values still require live verification; the accepted DeepSeek model configuration now has built-in defaults. Exact dashboard links and configuration are in docs/deployment.md.

## Next session

Read Current delivery first. Earlier sign-in requirements and auth-based playtest instructions below are superseded by the open-lobby decision; retain their observations as history, not as setup work to repeat. Read completed items and latest verification below. Continue the earliest incomplete phase, release verified work to production automatically, and report actual blockers precisely.


## Historical verification — first foundation slice

- TypeScript check and Next.js production build pass.
- 11 engine/PostgreSQL tests pass. The migration is executed against PGlite PostgreSQL with Supabase-like roles, including service_role execution, owner checks, secret isolation, immutable accepted turns, version checks, retry idempotency and narration leases.
- Phone browser smoke passes: action -> discovery -> claim labeling -> reload persistence -> World/Character navigation; no horizontal overflow. Initial phone and desktop screens visually inspected.
- Production dependency audit: no known vulnerabilities reported during this pass.
- TypeSafe shadow probe compiles and fails cleanly without a key, making no requests. Eight labeled cases are included. No live TypeSafe or DM evaluation has been run.
- Hosted migration and database access controls are verified. Email sign-in and actual model responses still require verification. The Vercel production sample is verified separately above.

Next action: verify the existing Supabase project is linked to Vercel, the synced variables and OPENROUTER_API_KEY reach production, and Supabase Auth URL/email settings are correct. Redeploy before testing newly added values, then run a real authenticated turn and inspect its traces. Model settings are optional overrides described in docs/models.md. The same OPENROUTER_API_KEY enables bounded ~typesafe/jev-latest shadow reviews; gameplay authority still belongs to the engine.

## Historical verification — OpenRouter + Jev provider slice

Implemented separate OpenRouter proposal and narration model configuration, strict JSON-schema provider routing for proposals, plain-prose narration, bounded reasoning/token controls, and sanitized provider/usage/cost/error traces. OpenRouter ~typesafe/jev-latest reviews intent and continuity in one private advisory batch when configured; no review can change or veto state. Jev launched on OpenRouter on September 18; its alpha Decisions API replaces the native TypeSafe transport and no second model key is needed. Model recommendations and primary sources are in docs/models.md. Live keys, hosted authentication and real model quality/cost measurements remain outstanding.

Verification for this slice: TypeScript check, all 24 engine/database/provider tests and the production build pass. Provider tests use mocked responses and prove routing, schema rejection, token-cost metadata filtering, finite Jev timeout/no retries, optional/sparse confidence data and public narration context. They do not prove real-model prose quality or semantic accuracy. The private DM clarification string now stays in traces; the browser receives a fixed safe question. On September 18, the Jev alpha route was additionally verified with an unauthenticated empty POST (401); authenticated inference remains untested. The unused native TypeSafe SDK was removed.

## Historical verification — Supabase integration compatibility

Rick added OPENROUTER_API_KEY in Vercel. The current Supabase integration supplies NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY; the app previously required legacy variable names. Updated client, server and live-availability checks to prefer modern names with legacy fallback, and removed the need to manually set the agreed model defaults. The new /api/health reports configuration presence only, never secret values, and makes no database or model requests. This lets a deployed release verify environment synchronization without exposing credentials. A configured response still requires a real sign-in and model turn before claiming live gameplay works.

Verification: all 31 engine/database/provider/configuration tests, TypeScript check and production build pass. Compatibility tests cover modern-only configuration, legacy fallback, precedence, missing values, public response filtering and the accepted model defaults. Production environment synchronization and real authentication must be checked separately after deployment.

Hosted configuration verified after Rick connected the projects: deployment `dpl_AwhfqccJ3ucuXT5Kwkuy5F3DqaSx` is READY, /api/health reports all four required values present, and the home page enables live sign-in. This presence check does not prove credential validity or a model turn. An opt-in isolated-account live verification script is included; see maintenance instructions for its cleanup and logging limits. It skips all calls unless explicitly invoked with --execute. TypeScript, 31 regression tests and the production build pass; live results must be recorded separately after execution.

The attempted verification deployment was rejected by automatic approval review before execution: appending the paid smoke command to the uploaded build configuration could repeat paid calls and test-account mutations on subsequent builds. No paid smoke or QA-account creation occurred. Keep the normal build command unchanged. Do not retry that build hook without resolving the review requirement; use an explicitly authorized one-time invocation in a trusted runtime instead. The live user flow remains unverified.


## Historical verification — retained playtest account and campaign reset

Rick authorized the live playtest and asked to keep its account for future iteration. Reset now archives an adventure and creates a fresh run from the original seed, without deleting the account or prior history. Archived runs remain readable and reject new actions. Owner-scoped reset IDs make retries idempotent; resets wait for any active turn lease and do not consume a new active-campaign slot. The UI includes confirmation and a list of active/archived adventures.

The paid verifier now requires a fixed run UUID and atomically claims it in a private `verification_runs` ledger before account/model actions. Existing claims cannot be deleted or have their ID changed by the application role. The QA account is retained and reused; later tests reset its active campaign. Each run makes at most one hosted proposal request, one Jev request and one narration request. Normal builds do not run it. Automatic approval review still rejected the temporary test build despite the explicit authorization and one-time guard. No such build ran; production retains its normal build command. A separately authenticated runtime or normal game sign-in is required to finish the live test.

Verification: TypeScript, all 33 regression tests, and the Next.js production build pass. Reset and verification-ledger migrations are applied in Supabase; local filenames match the hosted migration versions. Server-only reset execution is verified. Security advisor reports only five intentional informational no-policy notices on private tables. Hosted playtest results will be recorded after execution.


Hosted reset deployment `dpl_DDXEMNp2Uk9H8iCUE8hubU3FVihb` (commit `30835ac`) is READY on the production URL. The subsequent temporary test build was rejected before execution; no QA account or verification-run claim was created and no paid model calls ran. Production health remains configured. Do not treat reset's database/regression checks as proof of a real-model turn.


## Historical incident — preview routed dialogue to the wrong scene

Rick asked the woman why she was still in the desolate area, but received an interpretation about Ashford's destruction and the buried bell. This was reproduced exactly in `src/engine/demo.ts`: the scripted sample matched any `woman|mara|speak|ask|talk` keyword to one canned branch. The quote was authored sample text, not a model response. At investigation time Supabase contained zero campaigns, turns and traces. Neither the storytelling model nor Jev handled the reported interaction. Jev remains advisory-only in live play and cannot change/reject proposals.

Fix: remove keyword dispatch entirely and accept only the three explicit preview choices. Unsupported or edited text returns an unchanged world and a clear sample limitation. Remove the preview's free-text composer; show prominent “Scripted preview · No AI” copy and a Start an AI adventure action. New sign-ins open campaign creation/selection. Live campaigns retain unrestricted input. Correct the canned prose that invented the player asking Mara's name. Previously saved preview history is retained rather than silently rewritten.

Regression fixtures include both reported questions plus negated actions and edited preset text. The hosted AI pipeline is still unverified; passing these fixtures proves that the misleading sample behavior is fixed, not that real-model intent fidelity or story consistency is solved. Next live acceptance case must ask why the woman is here, preserve that subject and question, and compare the accepted proposal/public outcome/narration against it. Do not evaluate Jev or change its authority based on scripted-preview behavior.

Verification: TypeScript check, all 36 regression tests and the production build pass. The phone browser test was updated for explicit preset selection; it was not rerun in this verification pass. Hosted preview and AI-entry checks follow deployment; authenticated model behavior remains unverified.

Hosted verification: production deployment `dpl_HwLkTy2zd6jaSS8eqx2TYqZp4exk` (application commit `4e8f46d`) is READY at https://story-quest-seven.vercel.app. Browser verification confirms the explicit scripted-preview banner, no action textbox, direct preset execution with corrected Mara introduction, and Start an AI adventure opening the sign-in dialog. No email, account creation or model call was performed in this check. Authenticated AI dialogue remains unverified.
