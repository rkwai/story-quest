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
- [ ] Push master and verify production deployment.

## Phase 2 — Prove continuity

Build a fixed scenario set: destroyed-town attribution, false accusations, secret discoveries, item ownership, long rest with deadlines, ambiguous multi-actions, return after 30 turns and API interruption. Label acceptable interpretations and established facts. Compare models and TypeSafe on the same cases; record latency, token usage, clarification rate and continuity errors. Add semantic contradiction checks before committing novel facts. Evaluate narration for unsupported consequential assertions. Do not optimize cost by weakening truth/knowledge guarantees.

## Phase 3 — Longer worlds and richer authoring

Normalize entity/fact/event indexes, add full-text retrieval and explicit dependency links, measure context recall against long campaigns. Add proper character creation, authored and generated seeds, campaign picker, quest conditions, rules versioning, relationships and NPC goals as richer records. Add bounded multi-step travel catch-up. Preserve old rules and events on upgrades.

## Phase 4 — Operations and polish

Stream narration, replay UI for operators, player correction reports tied to turns, downloadable player journal, account/campaign deletion, trace retention tooling, spending dashboard and configurable campaign quotas. Validate restore/rollback in the actual connected deployment. Offline sample is separate from live saves; do not automatically promote its hidden client state to server authority.

## Deployment access

Initial inspection: repository accessible; no Vercel/Supabase project configuration or credentials in this workspace. Both plugins were subsequently connected successfully by Rick, and installed status was verified. Their operational tools were not exposed in the active session (only GitHub and plugin-management tools were callable). Do not ask Rick to reconnect them. Refresh tool discovery in the next turn and use the connected providers. Live deployment and provider calls remain unverified until projects and model configuration are applied. A push to master is not evidence of a successful Vercel deployment.

## Next session

Read completed items and latest verification below. Continue the earliest incomplete phase, release verified work to production automatically, and report actual blockers precisely.


## Verification — first foundation slice

- TypeScript check and Next.js production build pass.
- 11 engine/PostgreSQL tests pass. The migration is executed against PGlite PostgreSQL with Supabase-like roles, including service_role execution, owner checks, secret isolation, immutable accepted turns, version checks, retry idempotency and narration leases.
- Phone browser smoke passes: action -> discovery -> claim labeling -> reload persistence -> World/Character navigation; no horizontal overflow. Initial phone and desktop screens visually inspected.
- Production dependency audit: no known vulnerabilities reported during this pass.
- TypeSafe shadow probe compiles and fails cleanly without a key, making no requests. Eight labeled cases are included. No live TypeSafe or DM evaluation has been run.
- Supabase hosted migration, email sign-in, actual model responses and Vercel live deployment still require verification in the connected accounts. Local database tests do not establish hosted access or deployment success.

Next action: discover the now-connected Vercel and Supabase tools, identify/create the StoryQuest projects, apply migration and environment settings, deploy master, then run a real authenticated turn and inspect its traces. Set an OpenAI API key and explicit structured-output-compatible STORY_MODEL; use the user's TypeSafe key only for the opt-in probe until accuracy is measured.
