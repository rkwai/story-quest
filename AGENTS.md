# Working on StoryQuest

Read README.md and docs/implementation.md, then the relevant architecture/maintenance sections before editing. This repository is Rick's text-based, mobile-first living-story project. Vercel frontend; Supabase backend. Do not switch hosting providers.

## Durable user decisions

The LLM is the DM and evolves a seeded, data-driven world. Record consequences before narration. Established history is immutable; unknown-to-player differs from undetermined. Knowledge is per character; claims can be false. New details must fit existing history. Character sheet, quests, world rules, NPCs and events are first-class. No visuals/sound yet. No per-world cron jobs: bounded lazy development with in-story time.

## Work and release

- Implement small complete slices. Update docs/implementation.md with actual outcomes and next steps.
- Rick explicitly says **always push to production for this repo**. After verification, commit and push master, deploy Vercel, check the live result, and continue authorized work. Routine release approval is already given.
- Never force-push, delete user data, expose secrets, or substitute a different provider to bypass missing access.
- Rick wants the QA account retained for iteration. Reset campaigns by archiving a run and starting from its stored seed; preserve old history/traces. Paid playtests are explicitly opt-in, claimed once by a durable run UUID, and never part of normal builds.
- Keep legacy/ for reference only. Active code is src/ and supabase/.
- Run npm run check, npm test, and npm run build. Check phone-sized UI when changing the experience.
- Check provider access early. If deployment is blocked, finish code and push first, then identify the exact connection/configuration needed.

## Engine rules

- Only validated typed proposals can change state; no arbitrary executable rules or SQL from models.
- Atomic versioned commit + unique turn ID. Retrying a turn must not run the world twice.
- Store the accepted proposal so replay never calls a model.
- Player responses and narration context must use an explicit knowledge projection. Never return the authoritative snapshot or private trace to the browser.
- Keep committed state on narration failure; use a safe fallback and retry presentation only.
- Model confidence is not correctness. TypeSafe is optional and must prove value on domain examples before becoming a dependency.
- Hard referential/chronological rules are enforced in code. Semantic contradictions and prose fidelity need evaluations; do not claim they are solved by JSON validation.
- Bound prompt size and calls. Record versions, stage timings, token usage, rejection codes and context selection. Do not log secrets, chain-of-thought, or raw prompts to console.
- Add regression fixtures for actual continuity failures. No silent retcons or model-generated repairs of committed history.
