# Implementation plan and status

Updated: 2026-09-17. This file is the handoff across sessions. Checkboxes mean implemented and verified, not merely designed.

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

Vercel and Supabase operational tools are now available. Production sample: https://story-quest-seven.vercel.app (application commit `30cc66d`, deployment READY; expected page returned HTTP 200). Deployment used the connected app with source files. Git-triggered releases are not linked yet. See docs/deployment.md for provider IDs and exact verification limits.

Supabase project `cpybqwezigwkhxldxwiv` is ACTIVE_HEALTHY under DataSaa at the provider-quoted $0/month. Migration `20260917084314_story_engine.sql` is applied; table RLS and browser access denial verified. Security advisor returned only intentional informational no-policy notices. Auth settings, production environment values and explicit model selection remain outstanding; exact dashboard links and configuration are in docs/deployment.md.

## Next session

Read completed items and latest verification below. Continue the earliest incomplete phase, release verified work to production automatically, and report actual blockers precisely.


## Verification — first foundation slice

- TypeScript check and Next.js production build pass.
- 11 engine/PostgreSQL tests pass. The migration is executed against PGlite PostgreSQL with Supabase-like roles, including service_role execution, owner checks, secret isolation, immutable accepted turns, version checks, retry idempotency and narration leases.
- Phone browser smoke passes: action -> discovery -> claim labeling -> reload persistence -> World/Character navigation; no horizontal overflow. Initial phone and desktop screens visually inspected.
- Production dependency audit: no known vulnerabilities reported during this pass.
- TypeSafe shadow probe compiles and fails cleanly without a key, making no requests. Eight labeled cases are included. No live TypeSafe or DM evaluation has been run.
- Hosted migration and database access controls are verified. Email sign-in and actual model responses still require verification. The Vercel production sample is verified separately above.

Next action: configure Supabase Auth URL/email settings and the five Vercel environment values, redeploy, then run a real authenticated turn and inspect its traces. Set an OpenAI API key and explicit structured-output-compatible STORY_MODEL; use the user's TypeSafe key only for the opt-in probe until accuracy is measured.
