# StoryQuest

A living story you can talk to. A mobile-first, entirely text-based adventure with an LLM dungeon master and a persistent world that remembers what actually happened.

## Product contract

- The LLM is the dungeon master: seed a world with lore, dynamics and rules, then let it evolve.
- Players describe intent freely. The engine validates and records consequences **before** narration.
- Established history never changes. World truth, character knowledge, and claims are separate.
- Details can be invented on encounter if consistent with existing facts. Unknown-to-player is not undetermined.
- Characters, possessions, NPCs, locations, rules, quests and events persist as data.
- Worlds advance with in-story time, not background cron jobs. No AI calls while a player is away.
- Storytelling comes first. Images, sound, tactical combat and multiplayer are deferred.

## Active implementation

Next.js / TypeScript frontend and server routes on **Vercel**; **Supabase** Auth and PostgreSQL for persistent campaigns, atomic commits and operational traces. The original Express/React prototype is preserved in `legacy/` and is not deployed.

The first slice provides a phone-friendly Story, Character, Journal and World interface; a local scripted sample; a typed world reducer; scoped context; Supabase persistence; and a two-stage live DM integration. The sample is explicitly scripted, not an AI demonstration. Live play needs the configuration below. See [implementation status](docs/implementation.md) for verified completion and remaining work; do not infer production readiness from this README.

## Run

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Without credentials, the sample runs locally in the browser. For live campaigns, set Supabase URL, publishable/anon key, server-only service role key, `OPENAI_API_KEY`, and an explicitly chosen `STORY_MODEL` supporting Chat Completions structured outputs. Apply `supabase/migrations` first. Enable email sign-in and register the site URL in Supabase Auth. No API key belongs in a `NEXT_PUBLIC_` variable.

```sh
npm run check
npm test
npm run build
```

## Documentation

- [Product and mobile experience](docs/product.md)
- [Architecture, truth and turn lifecycle](docs/architecture.md)
- [Implementation plan and current status](docs/implementation.md)
- [Maintenance, diagnostics and evaluation](docs/maintenance.md)
- [Deployment and rollback](docs/deployment.md)
- [Decision record and references](docs/decisions.md)
- [Agent working instructions](AGENTS.md)

## Delivery policy

Rick has authorized ongoing changes in this repository to be pushed to production. Verify changes, update the status docs, push `master`, and deploy to the connected Vercel project. Do not stop at a draft branch or ask for routine release approval. Never claim a live deployment succeeded without checking it. Missing provider access is a blocker to deployment, not to implementation.
