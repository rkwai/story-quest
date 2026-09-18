# Vercel + Supabase deployment

## Standing authorization

Rick explicitly authorizes production pushes for this repo. After meaningful verification, commit and push master, publish to Vercel and inspect the result. Do not request routine approval. Never force-push or destructively reset a production database.

## First connection

1. Vercel and Supabase were connected successfully during implementation. Discover their tools and select/create the StoryQuest projects; do not ask to reconnect or guess an unrelated project.
2. Import rkwai/story-quest in Vercel, repository root `.`, Next.js preset, Node 22, production branch master. The active app is at the root, not legacy/frontend.
3. Create/link Supabase, apply the versioned migration, enable email sign-in and configure the exact production site URL and local redirect URL.
4. Connect the existing Supabase project to this Vercel project so the integration syncs its environment values. Add `OPENROUTER_API_KEY` separately. `SUPABASE_SECRET_KEY` and `OPENROUTER_API_KEY` are server-only. Model overrides are optional; see docs/models.md. TypeSafe runs only advisory shadow reviews until calibrated.
5. Redeploy, test sign-in, create a campaign, perform a turn, reload, inspect private traces, and confirm hidden facts never appear in network responses.

## Git-triggered releases

GitHub Actions runs typecheck, tests and build. Vercel can build automatically from master. The agent must run checks before pushing because an automatic Vercel deployment can start before CI finishes. When credentials are available, Supabase migrations precede a release requiring new schema. Apply additive migrations first; never run the old Sequelize seed against Supabase.

## Rollback

Promote a known-good Vercel deployment or revert the bad application commit. Keep committed campaign history. Database changes should be additive and backward-compatible; fixes use a forward migration, not a destructive rollback. Engine versions must remain available to replay existing turns. Confirm a rollback against a copy of a real save before touching live data.

## Verification record

2026-09-17: deployed the verified application at master commit `30cc66d` through the connected Vercel app. Production deployment `dpl_CsgKf82cmH4DRgZKWrRZRaPZNjCS` is READY, and https://story-quest-seven.vercel.app returned HTTP 200 with the expected StoryQuest sample page. Project: `prj_oP2UoN5PwdpjElQxYNJ1KGIU3G6B`; team: `team_BVSaShvGktutB8H0ITMsdaq1`. This is the scripted sample; authenticated live DM play remains disabled pending backend and model configuration. Local browser smoke passed before deployment; the hosted check verified rendered HTML only.

The connected app deployed tracked active source files directly (legacy and environment files excluded). Automatic GitHub deployment linkage has not been configured. Continue explicit production releases until linkage is verified. CLI login polling was blocked by workspace network policy; use the operational connected app rather than assuming CLI authentication succeeded.

## Hosted Supabase

2026-09-18 connection update: Rick linked the existing projects. Production deployment `dpl_AwhfqccJ3ucuXT5Kwkuy5F3DqaSx` (application `e9da55d`) is READY; `/api/health` returns 200 with all required configuration flags true. The production home page now enables live sign-in. Auth redirects, credential validity and the real model flow require the opt-in live verification described in maintenance.md.

Project `story-quest` (`cpybqwezigwkhxldxwiv`) is ACTIVE_HEALTHY under DataSaa (`pevdfgjydqafmcscwqpt`), us-east-1, close to the Vercel server region. Rick selected the organization; the provider quoted $0/month and its cost-confirmation step completed. [Project dashboard](https://supabase.com/dashboard/project/cpybqwezigwkhxldxwiv).

Migration `story_engine` was applied successfully as remote version `20260917084314`. The local filename now matches that version to avoid duplicate application by future CLI pushes. Four application tables have RLS enabled, anon/authenticated have no SELECT privileges, and service_role has CRUD access. The security advisor reported only four informational [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings. This is intentional: authoritative snapshots, hidden history and traces are server-only. Do not add browser read policies to silence them.

## Remaining live configuration

The Supabase/Vercel integration can sync the database credentials without manually copying a server key. This is distinct from connecting Supabase and Vercel tools to the coding assistant. For the existing DataSaa project, use **External Integration Connection / Connect Account** and explicitly link Supabase `cpybqwezigwkhxldxwiv` to Vercel `story-quest`; do not create another database. See the [official integration](https://vercel.com/marketplace/supabase) and [project linking guide](https://supabase.com/docs/guides/deployment/branching/integrations).

Check Production values in [Vercel environment settings](https://vercel.com/rick-wongs-projects-3b8edb49/story-quest/settings/environment-variables):

| Variable | Value/source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://cpybqwezigwkhxldxwiv.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supplied by the integration; legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is also accepted |
| SUPABASE_SECRET_KEY | Supplied by the integration; legacy SUPABASE_SERVICE_ROLE_KEY is also accepted; server-only |
| OPENROUTER_API_KEY | Server-only OpenRouter key with credits |
| STORY_MODEL | Optional; defaults to deepseek/deepseek-v4.1-flash |
| PROPOSAL_MODEL | deepseek/deepseek-v4.1-flash (optional; defaults to STORY_MODEL; JSON Schema required) |
| PROPOSAL_REASONING_EFFORT | Defaults to low for the starter model |
| STORY_REASONING_EFFORT | Defaults to none for the starter model; use low for GLM; omit for Cydonia |
| TYPESAFE_MODEL | ~typesafe/jev-latest (same OpenRouter key) |
| TYPESAFE_MODE | shadow (or off to disable reviews) |

In [Supabase Auth URL configuration](https://supabase.com/dashboard/project/cpybqwezigwkhxldxwiv/auth/url-configuration), set Site URL to https://story-quest-seven.vercel.app and register that exact redirect origin plus http://localhost:3000 for local testing. The integration documents automatic redirects for preview branches; do not assume production Auth URLs are set by environment synchronization. Confirm email provider is enabled. Default Supabase SMTP is limited to organization-team addresses; Rick can demo using his team email. Public signups need custom SMTP ([provider documentation](https://supabase.com/docs/guides/auth/auth-smtp)).

After configuration, redeploy so public keys are included in the client build. `GET /api/health` reports only required-value presence as booleans (200 configured, 503 missing), with no-store caching and no external calls. It exposes no keys, URLs, provider responses or campaign data. It does **not** validate credentials, project linking, Auth redirects or model credits. Then test sign-in, create campaign, commit a turn, complete narration, reload, inspect traces and confirm hidden facts remain server-only. Live availability requires the three Supabase values and OPENROUTER_API_KEY; model settings have built-in defaults. Hosted auth and a real paid model turn remain unverified. Jev launched on OpenRouter on September 18; both model roles now use one OpenRouter key. The former TYPESAFE_API_KEY setting is no longer used.

Package engines now pins Node 22.x, matching CI, because the initial Vercel deployment selected Node 24 from the former >=22 range.
