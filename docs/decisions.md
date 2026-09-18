# Decisions and research

## Accepted with Rick

- Text only initially; mobile-first; character sheet, quest log and discovered world.
- Vercel frontend and Supabase backend.
- The LLM is the dungeon master and evolves seeded high-level lore/rules/dynamics.
- Commit state before presenting changes and narrating the result.
- History is fixed; knowledge and claims are separate. Invent only undetermined details consistent with history.
- World progression is driven by in-story time with bounded lazy development; no per-world cron jobs.
- Always push verified work to production for this repository.

## Implementation choices

One application plus a pure reducer, rather than microservices. JSONB snapshots plus accepted turn history to establish correctness before normalizing for scale. Separate proposal and narration requests make commitment observable and narration recoverable. No model access from the browser. Seeded demo is visibly scripted. Do not promise semantic consistency from schemas alone.

## TypeSafe (reviewed 2026-09-17)

Jev answers Choice, Score and Noul questions over supplied state. It does not generate arbitrary prose. Questions in a request are independent; compose dependent decisions in code. Confidence is derived from distributions and needs domain calibration. Good candidates: ambiguity/intent classification, relevance scoring and detecting contradictions. It is not the world authority. A configured OpenRouter `~typesafe/jev-latest` call now reviews intent, immutable-history conflicts, world-rule conflicts and unjustified knowledge in one bounded batch. Results go to private shadow logs and cannot change/veto state. Promote judgments into control flow only after measured calibration on a labeled StoryQuest set. No paid inference calls were made during research.

Primary references:

- [TypeSafe introduction](https://docs.typesafe.ai/introduction)
- [Primitives](https://docs.typesafe.ai/primitives)
- [Confidence](https://docs.typesafe.ai/confidence)
- [Official TypeScript SDK](https://github.com/typesafe-ai/typesafe-sdk-js)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [OpenRouter structured output contract](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Next.js documentation](https://nextjs.org/docs)

A first opt-in shadow probe is included: `npm run eval:typesafe` with `OPENROUTER_API_KEY`. It batches eight labeled input-mode questions in one call and prints predictions, confidence and elapsed time. It does not exercise live game state, prove calibration, or establish production reliability; expand the dataset before using this to choose a provider. It never mutates campaigns.

## OpenRouter model split (2026-09-17)

Rick chose OpenRouter for generative models and Jev for typed assessments. On September 17 Jev was listed but unavailable. On September 18 the live provider launched; the integration now uses OpenRouter's dedicated alpha Decisions API with the same key as text generation. PROPOSAL_MODEL writes JSON operations; STORY_MODEL renders committed public outcomes as prose. Both use OpenRouter; the deterministic reducer and database remain authoritative. Initial configured candidate: DeepSeek V4.1 Flash, with GLM 5.3 Flash and Cydonia as comparison candidates. See [model research](models.md) for primary sources, configuration and untested quality claims.
