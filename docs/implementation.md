# Implementation plan and status

Updated: 2026-09-19. This file is the handoff across sessions. Checkboxes mean implemented and verified, not merely designed.

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
