# Implementation plan and status

Updated: 2026-09-18. This file is the handoff across sessions. Checkboxes mean implemented and verified, not merely designed.

## Phase 0 — Product contract and repository reset

- [x] Capture agreed experience, authority/knowledge boundaries and lazy world evolution.
- [x] Rewrite README and add agent instructions, architecture, maintenance and deployment plans.
- [x] Preserve old app under legacy/ and establish the new build.

## Phase 1 — Playable foundation (current)

- [x] Mobile Story, Character, Journal and World views.
- [x] Explicit scripted sample with browser persistence and recovery.
- [x] Typed engine operations; immutable facts; knowledge/claims; deadline resolution; replay.
- [x] Bounded context retrieval and explicit semantic limitations.
- [x] Supabase auth, owner checks, private state, turn leases and atomic versioned commits.
- [x] Live DM proposal -> commit -> narration, with retry/fallback behavior.
- [x] Private diagnostic traces and versioned prompts.
- [x] Meaningful engine/database/phone-flow verification and production build.
- [x] Push implementation to master; GitHub CI passed on b76f10a.
- [x] Verify hosted production sample deployment (READY and HTTP 200).
- [x] Create dedicated DataSaa Supabase project, apply schema and verify server-only access.
- [ ] Configure auth/environment values and verify a real authenticated model turn.

## Phase 2 — Prove continuity

Build a fixed scenario set: destroyed-town attribution, false accusations, secret discoveries, item ownership, long rest with deadlines, ambiguous multi-actions, return after 30 turns and API interruption. Label acceptable interpretations and established facts. Compare models and TypeSafe on the same cases; record latency, token usage, clarification rate and continuity errors. Add semantic contradiction checks before committing novel facts. Evaluate narration for unsupported consequential assertions. Do not optimize cost by weakening truth/knowledge guarantees.

## Phase 3 — Longer worlds and richer authoring

Normalize entity/fact/event indexes, add full-text retrieval and explicit dependency links, measure context recall against long campaigns. Add proper character creation, authored and generated seeds, campaign picker, quest conditions, rules versioning, relationships and NPC goals as richer records. Add bounded multi-step travel catch-up. Preserve old rules and events on upgrades.

## Phase 4 — Operations and polish

Stream narration, replay UI for operators, player correction reports tied to turns, downloadable player journal, account/campaign deletion, trace retention tooling, spending dashboard and configurable campaign quotas. Validate restore/rollback in the actual connected deployment. Offline sample is separate from live saves; do not automatically promote its hidden client state to server authority.

## Deployment access

Vercel and Supabase operational tools are now available. Production: https://story-quest-seven.vercel.app (application commit `e9da55d`, configured deployment READY; home and /api/health returned HTTP 200). Rick completed the Supabase/Vercel project connection; the redeployed app sees both public Supabase values, its server key and the OpenRouter key. Live sign-in is enabled. Deployment used the connected app with source files. Git-triggered releases are not linked yet. See docs/deployment.md for provider IDs and exact verification limits.

Supabase project `cpybqwezigwkhxldxwiv` is ACTIVE_HEALTHY under DataSaa at the provider-quoted $0/month. Migration `20260917084314_story_engine.sql` is applied; table RLS and browser access denial verified. Security advisor returned only intentional informational no-policy notices. Auth settings and production environment values still require live verification; the accepted DeepSeek model configuration now has built-in defaults. Exact dashboard links and configuration are in docs/deployment.md.

## Next session

Read completed items and latest verification below. Continue the earliest incomplete phase, release verified work to production automatically, and report actual blockers precisely.


## Verification — first foundation slice

- TypeScript check and Next.js production build pass.
- 11 engine/PostgreSQL tests pass. The migration is executed against PGlite PostgreSQL with Supabase-like roles, including service_role execution, owner checks, secret isolation, immutable accepted turns, version checks, retry idempotency and narration leases.
- Phone browser smoke passes: action -> discovery -> claim labeling -> reload persistence -> World/Character navigation; no horizontal overflow. Initial phone and desktop screens visually inspected.
- Production dependency audit: no known vulnerabilities reported during this pass.
- TypeSafe shadow probe compiles and fails cleanly without a key, making no requests. Eight labeled cases are included. No live TypeSafe or DM evaluation has been run.
- Hosted migration and database access controls are verified. Email sign-in and actual model responses still require verification. The Vercel production sample is verified separately above.

Next action: verify the existing Supabase project is linked to Vercel, the synced variables and OPENROUTER_API_KEY reach production, and Supabase Auth URL/email settings are correct. Redeploy before testing newly added values, then run a real authenticated turn and inspect its traces. Model settings are optional overrides described in docs/models.md. The same OPENROUTER_API_KEY enables bounded ~typesafe/jev-latest shadow reviews; gameplay authority still belongs to the engine.

## OpenRouter + Jev provider slice

Implemented separate OpenRouter proposal and narration model configuration, strict JSON-schema provider routing for proposals, plain-prose narration, bounded reasoning/token controls, and sanitized provider/usage/cost/error traces. OpenRouter ~typesafe/jev-latest reviews intent and continuity in one private advisory batch when configured; no review can change or veto state. Jev launched on OpenRouter on September 18; its alpha Decisions API replaces the native TypeSafe transport and no second model key is needed. Model recommendations and primary sources are in docs/models.md. Live keys, hosted authentication and real model quality/cost measurements remain outstanding.

Verification for this slice: TypeScript check, all 24 engine/database/provider tests and the production build pass. Provider tests use mocked responses and prove routing, schema rejection, token-cost metadata filtering, finite Jev timeout/no retries, optional/sparse confidence data and public narration context. They do not prove real-model prose quality or semantic accuracy. The private DM clarification string now stays in traces; the browser receives a fixed safe question. On September 18, the Jev alpha route was additionally verified with an unauthenticated empty POST (401); authenticated inference remains untested. The unused native TypeSafe SDK was removed.

## Supabase integration compatibility

Rick added OPENROUTER_API_KEY in Vercel. The current Supabase integration supplies NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY; the app previously required legacy variable names. Updated client, server and live-availability checks to prefer modern names with legacy fallback, and removed the need to manually set the agreed model defaults. The new /api/health reports configuration presence only, never secret values, and makes no database or model requests. This lets a deployed release verify environment synchronization without exposing credentials. A configured response still requires a real sign-in and model turn before claiming live gameplay works.

Verification: all 31 engine/database/provider/configuration tests, TypeScript check and production build pass. Compatibility tests cover modern-only configuration, legacy fallback, precedence, missing values, public response filtering and the accepted model defaults. Production environment synchronization and real authentication must be checked separately after deployment.

Hosted configuration verified after Rick connected the projects: deployment `dpl_AwhfqccJ3ucuXT5Kwkuy5F3DqaSx` is READY, /api/health reports all four required values present, and the home page enables live sign-in. This presence check does not prove credential validity or a model turn. An opt-in isolated-account live verification script is included; see maintenance instructions for its cleanup and logging limits. It skips all calls unless explicitly invoked with --execute. TypeScript, 31 regression tests and the production build pass; live results must be recorded separately after execution.

The attempted verification deployment was rejected by automatic approval review before execution: appending the paid smoke command to the uploaded build configuration could repeat paid calls and test-account mutations on subsequent builds. No paid smoke or QA-account creation occurred. Keep the normal build command unchanged. Do not retry that build hook without resolving the review requirement; use an explicitly authorized one-time invocation in a trusted runtime instead. The live user flow remains unverified.


## Retained playtest account and campaign reset

Rick authorized the live playtest and asked to keep its account for future iteration. Reset now archives an adventure and creates a fresh run from the original seed, without deleting the account or prior history. Archived runs remain readable and reject new actions. Owner-scoped reset IDs make retries idempotent; resets wait for any active turn lease and do not consume a new active-campaign slot. The UI includes confirmation and a list of active/archived adventures.

The paid verifier now requires a fixed run UUID and atomically claims it in a private `verification_runs` ledger before account/model actions. Existing claims cannot be deleted or have their ID changed by the application role. The QA account is retained and reused; later tests reset its active campaign. Each run makes at most one hosted proposal request, one Jev request and one narration request. Normal builds do not run it. Automatic approval review still rejected the temporary test build despite the explicit authorization and one-time guard. No such build ran; production retains its normal build command. A separately authenticated runtime or normal game sign-in is required to finish the live test.

Verification: TypeScript, all 33 regression tests, and the Next.js production build pass. Reset and verification-ledger migrations are applied in Supabase; local filenames match the hosted migration versions. Server-only reset execution is verified. Security advisor reports only five intentional informational no-policy notices on private tables. Hosted playtest results will be recorded after execution.


Hosted reset deployment `dpl_DDXEMNp2Uk9H8iCUE8hubU3FVihb` (commit `30835ac`) is READY on the production URL. The subsequent temporary test build was rejected before execution; no QA account or verification-run claim was created and no paid model calls ran. Production health remains configured. Do not treat reset's database/regression checks as proof of a real-model turn.
