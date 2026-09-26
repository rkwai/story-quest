# Working on StoryQuest

Read README.md and docs/implementation.md, then the relevant architecture/maintenance sections before editing. This repository is Rick's text-based, mobile-first living-story project. Vercel frontend; Supabase backend. Do not switch hosting providers.

## Durable user decisions

The LLM is the DM and evolves a seeded, data-driven world. Record consequences before narration. Established history is immutable; unknown-to-player differs from undetermined. Knowledge is per character; claims can be false. New details must fit existing history. Character sheet, quests, world rules, NPCs and events are first-class. No visuals/sound yet. No per-world cron jobs: bounded lazy development with in-story time.

Current playtest mode is **open and shared**: no account or sign-in is required. Anyone can start, resume, reset or delete any adventure through the shared lobby. This is an explicit product decision, not an unfinished auth setup. Keep raw world state, secrets and operational traces server-only. Do not reintroduce login as a prerequisite without a new product decision.

## Work and release

- Implement small complete slices. Update docs/implementation.md with actual outcomes and next steps.
- Rick explicitly says **always push to production for this repo**. After verification, commit and push master, watch the native Git-triggered Vercel deployment, check the live result, and continue authorized work. Verify that the production alias serves the pushed commit; avoid duplicate manual deployments. Routine release approval is already given.
- Never force-push, expose secrets, or substitute a different provider to bypass missing access. Rick authorizes a confirmed Delete adventure capability for the shared lobby; do not delete existing user runs yourself during implementation or verification.
- Reset archives a run and starts from its stored seed, preserving old history/traces. Confirmed Delete permanently removes the selected run, accepted turns and traces. Keep these actions distinct. Retain any existing QA account; open playtesting no longer requires one.
- Paid playtests are explicitly opt-in, claimed once by a durable run UUID, and never part of normal builds. The existing auth-based verify:live script is legacy; do not use it as acceptance for the open lobby or attach it to a deployment build hook.
- Keep legacy/ for reference only. Active code is src/ and supabase/.
- Run npm run check, npm test, and npm run build. Check phone-sized UI when changing the experience.
- Check provider access early. If deployment is blocked, finish code and push first, then identify the exact connection/configuration needed.

## Engine rules

- Only validated typed proposals can change state; no arbitrary executable rules or SQL from models.
- Atomic versioned commit + unique turn ID. Retrying a turn must not run the world twice.
- Open access goes through application routes and player knowledge projections. RLS and revoked anon/authenticated grants still protect raw tables and RPCs. Resolve a campaign’s internal request-limit scope server-side; never trust a client-supplied owner or scope. Keep quotas and leases active.
- Store the accepted proposal so replay never calls a model.
- Player responses and narration context must use an explicit knowledge projection. Never return the authoritative snapshot or private trace to the browser.
- Keep committed state on narration failure; use a safe fallback and retry presentation only.
- Model confidence is not correctness. TypeSafe is optional and must prove value on domain examples before becoming a dependency.
- Hard referential/chronological rules are enforced in code. Semantic contradictions and prose fidelity need evaluations; do not claim they are solved by JSON validation.
- Bound prompt size and calls. Record versions, stage timings, token usage, rejection codes and context selection. Do not log secrets, chain-of-thought, or raw prompts to console.
- Add regression fixtures for actual continuity failures. No silent retcons or model-generated repairs of committed history.
- Live turns use engine 1.2.0 with mandatory `itemActions` and `storyPlan`; validate item ownership, reach, quantity and availability before other consequences. Do not bypass inventory with generic owner/location updates, direct player-owned item creation, facts or narration. See docs/inventory.md before changing this path.
- Preserve the 1.0.0 reducer for historical proposals and use versioned replay for mixed histories. Old items default to one reusable, usable object; do not infer mechanical state from private prose or rewrite stored seeds to grant missing equipment. Once 1.1.0 turns exist, use an inventory-aware release for rollback; a pre-1.1 app ignores quantity and usability.
- Free-text requirement extraction remains a model responsibility. Keep its limitations explicit; do not claim the typed inventory gate proves all prose consistent or reintroduce a keyword classifier for player intent.
- Read docs/story-direction.md before changing quests, context or pacing. Lore/history is truth; goals and leads are adaptable possibilities. Answer the player's exact input first. No forced player action, countdown or quest completion to satisfy a quiet-turn metric.
- Preserve 1.0.0 and 1.1.0 replay behavior; 1.2.0 adds quest direction after inventory/world reduction. New progress and terminal quest states require fresh evidence. Evidence existence/overlap is not proof of semantic relevance. Public leads must reference known entities/evidence; arbitrary generated text still needs semantic evaluation.
- Quest context is capped at six with focus ancestry and mandatory world constraints protected. Keep selection reasons and progress/rejection diagnostics private. Jev's two story judgments share the existing advisory request; a pre-context reranker remains deferred until evaluated. Do not add per-quest model calls or background world simulation.
