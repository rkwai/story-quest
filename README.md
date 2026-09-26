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

Next.js / TypeScript frontend and server routes on **Vercel**; **Supabase** PostgreSQL for persistent campaigns, atomic commits and operational traces. Current playtesting is open and shared; no login is required. The original Express/React prototype is preserved in `legacy/` and is not deployed.

The home screen is a shared adventure lobby. Start a new adventure with one click, optionally customize its seed, or resume an existing run. Everyone can see and continue the same adventures. Reset archives the old run and starts from its original seed; confirmed Delete permanently removes the selected run, its turns and diagnostics.

Adventures provide phone-friendly Story, Character, Journal and World views, free-text roleplay, a typed world reducer, scoped context, persistent saves and a two-stage live DM integration. A separate scripted preview uses only three preset buttons and makes no model calls. Live play needs the configuration below. See [implementation status](docs/implementation.md) for verified completion and remaining work; do not infer production readiness from this README.

The Character view shows carried items, quantities and availability, with an Inventory shortcut beside the story composer. Selecting an item prepares an editable action; sending it remains explicit. Live proposals declare item use, acquisition, transfers, consumption, damage and repair, which the engine checks before any consequence commits. A missing item blocks the attempt without advancing the world. Existing saves and recorded history remain intact. See [inventory behavior and current limits](docs/inventory.md), including the remaining dependency on the DM recognizing equipment requirements in free text.

## Run

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Without server configuration, the clearly labeled scripted preview can run locally in the browser. For live campaigns, link the existing Supabase project through its Vercel integration and add `OPENROUTER_API_KEY`. The server reads the integration's `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` is supported). The integration may also supply a publishable/anon key, but open play does not require it. DeepSeek V4.1 Flash is the built-in DM and narrator default. Optional `STORY_MODEL` and `PROPOSAL_MODEL` override it; the proposal model must support JSON Schema. The same OpenRouter key powers `~typesafe/jev-latest` intent/continuity reviews in private shadow logs; no separate TypeSafe key is needed. Set `TYPESAFE_MODE=off` to disable the advisory review. See [model configuration and research](docs/models.md). Apply all `supabase/migrations` first, including the open-lobby migration. Email, SMTP, Supabase Auth configuration and player API keys are not prerequisites for this mode. Raw database tables remain private; public application routes return only player-visible data. Quotas and turn leases remain active. No secret API key belongs in a `NEXT_PUBLIC_` variable.

```sh
npm run check
npm test
npm run build
```

## Documentation

- [Product and mobile experience](docs/product.md)
- [Architecture, truth and turn lifecycle](docs/architecture.md)
- [Inventory and action requirements](docs/inventory.md)
- [Implementation plan and current status](docs/implementation.md)
- [Maintenance, diagnostics and evaluation](docs/maintenance.md)
- [OpenRouter, Jev and model choices](docs/models.md)
- [Deployment and rollback](docs/deployment.md)
- [Decision record and references](docs/decisions.md)
- [Agent working instructions](AGENTS.md)

## Delivery policy

Rick has authorized ongoing changes in this repository to be pushed to production. Verify changes, update the status docs, push `master`, and deploy to the connected Vercel project. Do not stop at a draft branch or ask for routine release approval. Never claim a live deployment succeeded without checking it. Missing provider access is a blocker to deployment, not to implementation.
