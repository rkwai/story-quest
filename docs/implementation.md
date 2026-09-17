# Implementation plan and status

Updated: 2026-09-17. This file is the handoff across sessions. Checkboxes mean implemented and verified, not merely designed.

## Phase 0 — Product contract and repository reset

- [x] Capture agreed experience, authority/knowledge boundaries and lazy world evolution.
- [x] Rewrite README and add agent instructions, architecture, maintenance and deployment plans.
- [ ] Preserve old app under legacy/ and establish the new build.

## Phase 1 — Playable foundation (current)

- [ ] Mobile Story, Character, Journal and World views.
- [ ] Explicit scripted sample with browser persistence and recovery.
- [ ] Typed engine operations; immutable facts; knowledge/claims; deadline resolution; replay.
- [ ] Bounded context retrieval and explicit semantic limitations.
- [ ] Supabase auth, owner checks, private state, turn leases and atomic versioned commits.
- [ ] Live DM proposal -> commit -> narration, with retry/fallback behavior.
- [ ] Private diagnostic traces and versioned prompts.
- [ ] Meaningful engine/database/phone-flow verification and production build.
- [ ] Push master and verify production deployment.

## Phase 2 — Prove continuity

Build a fixed scenario set: destroyed-town attribution, false accusations, secret discoveries, item ownership, long rest with deadlines, ambiguous multi-actions, return after 30 turns and API interruption. Label acceptable interpretations and established facts. Compare models and TypeSafe on the same cases; record latency, token usage, clarification rate and continuity errors. Add semantic contradiction checks before committing novel facts. Evaluate narration for unsupported consequential assertions. Do not optimize cost by weakening truth/knowledge guarantees.

## Phase 3 — Longer worlds and richer authoring

Normalize entity/fact/event indexes, add full-text retrieval and explicit dependency links, measure context recall against long campaigns. Add proper character creation, authored and generated seeds, campaign picker, quest conditions, rules versioning, relationships and NPC goals as richer records. Add bounded multi-step travel catch-up. Preserve old rules and events on upgrades.

## Phase 4 — Operations and polish

Stream narration, replay UI for operators, player correction reports tied to turns, downloadable player journal, account/campaign deletion, trace retention tooling, spending dashboard and configurable campaign quotas. Validate restore/rollback in the actual connected deployment. Offline sample is separate from live saves; do not automatically promote its hidden client state to server authority.

## Deployment access

Initial inspection: repository accessible; no Vercel/Supabase project configuration or credentials in this workspace. Both plugins were suggested. Live deployment and provider calls must remain marked unverified until accounts are connected and configuration is set. A push to master is not evidence of a successful Vercel deployment.

## Next session

Read completed items and latest verification below. Continue the earliest incomplete phase, release verified work to production automatically, and report actual blockers precisely.
