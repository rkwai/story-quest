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

Jev answers Choice, Score and Noul questions over supplied state. It does not generate arbitrary prose. Questions in a request are independent; compose dependent decisions in code. Confidence is derived from distributions and needs domain calibration. Good candidates: ambiguity/intent classification, relevance scoring and detecting contradictions. It is not the world authority. Start with opt-in shadow evaluation against a labeled StoryQuest set; no dependency on it for gameplay until measured benefit is established. No API calls were made during research.

Primary references:

- [TypeSafe introduction](https://docs.typesafe.ai/introduction)
- [Primitives](https://docs.typesafe.ai/primitives)
- [Confidence](https://docs.typesafe.ai/confidence)
- [Official TypeScript SDK](https://github.com/typesafe-ai/typesafe-sdk-js)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [OpenAI structured output contract](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Next.js documentation](https://nextjs.org/docs)

A first opt-in shadow probe is included: `npm run eval:typesafe` with `TYPESAFE_API_KEY`. It batches eight labeled input-mode questions in one call and prints predictions, confidence and elapsed time. It does not exercise live game state, prove calibration, or establish production reliability; expand the dataset before using this to choose a provider. It never mutates campaigns.
