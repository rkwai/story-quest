# Vercel + Supabase deployment

## Standing authorization

Rick explicitly authorizes production pushes for this repo. After meaningful verification, commit and push master, publish to Vercel and inspect the result. Do not request routine approval. Never force-push or destructively reset a production database.

## First connection

1. Vercel and Supabase were connected successfully during implementation. Discover their tools and select/create the StoryQuest projects; do not ask to reconnect or guess an unrelated project.
2. Import rkwai/story-quest in Vercel, repository root `.`, Next.js preset, Node 22, production branch master. The active app is at the root, not legacy/frontend.
3. Create/link Supabase, apply the versioned migration, enable email sign-in and configure the exact production site URL and local redirect URL.
4. Add `.env.example` values to Vercel. `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` are server-only. Use the explicit model IDs in docs/models.md. TypeSafe runs only advisory shadow reviews until calibrated.
5. Redeploy, test sign-in, create a campaign, perform a turn, reload, inspect private traces, and confirm hidden facts never appear in network responses.

## Git-triggered releases

GitHub Actions runs typecheck, tests and build. Vercel can build automatically from master. The agent must run checks before pushing because an automatic Vercel deployment can start before CI finishes. When credentials are available, Supabase migrations precede a release requiring new schema. Apply additive migrations first; never run the old Sequelize seed against Supabase.

## Rollback

Promote a known-good Vercel deployment or revert the bad application commit. Keep committed campaign history. Database changes should be additive and backward-compatible; fixes use a forward migration, not a destructive rollback. Engine versions must remain available to replay existing turns. Confirm a rollback against a copy of a real save before touching live data.

## Verification record

2026-09-17: deployed the verified application at master commit `30cc66d` through the connected Vercel app. Production deployment `dpl_CsgKf82cmH4DRgZKWrRZRaPZNjCS` is READY, and https://story-quest-seven.vercel.app returned HTTP 200 with the expected StoryQuest sample page. Project: `prj_oP2UoN5PwdpjElQxYNJ1KGIU3G6B`; team: `team_BVSaShvGktutB8H0ITMsdaq1`. This is the scripted sample; authenticated live DM play remains disabled pending backend and model configuration. Local browser smoke passed before deployment; the hosted check verified rendered HTML only.

The connected app deployed tracked active source files directly (legacy and environment files excluded). Automatic GitHub deployment linkage has not been configured. Continue explicit production releases until linkage is verified. CLI login polling was blocked by workspace network policy; use the operational connected app rather than assuming CLI authentication succeeded.

## Hosted Supabase

Project `story-quest` (`cpybqwezigwkhxldxwiv`) is ACTIVE_HEALTHY under DataSaa (`pevdfgjydqafmcscwqpt`), us-east-1, close to the Vercel server region. Rick selected the organization; the provider quoted $0/month and its cost-confirmation step completed. [Project dashboard](https://supabase.com/dashboard/project/cpybqwezigwkhxldxwiv).

Migration `story_engine` was applied successfully as remote version `20260917084314`. The local filename now matches that version to avoid duplicate application by future CLI pushes. Four application tables have RLS enabled, anon/authenticated have no SELECT privileges, and service_role has CRUD access. The security advisor reported only four informational [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings. This is intentional: authoritative snapshots, hidden history and traces are server-only. Do not add browser read policies to silence them.

## Remaining live configuration

The connected tools expose public keys but no server key retrieval, Supabase Auth configuration setter, or Vercel environment setter. Configure the following in [Vercel environment settings](https://vercel.com/rick-wongs-projects-3b8edb49/story-quest/settings/environment-variables), target Production:

| Variable | Value/source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://cpybqwezigwkhxldxwiv.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Enabled publishable key from this project's API settings |
| SUPABASE_SERVICE_ROLE_KEY | This project's server-only service-role key; never put it in chat or git |
| OPENROUTER_API_KEY | Server-only OpenRouter key with credits |
| STORY_MODEL | deepseek/deepseek-v4.1-flash (starter storyteller) |
| PROPOSAL_MODEL | deepseek/deepseek-v4.1-flash (optional; defaults to STORY_MODEL; JSON Schema required) |
| PROPOSAL_REASONING_EFFORT | low for the starter model |
| STORY_REASONING_EFFORT | none for DeepSeek; low for GLM; omit for Cydonia |
| TYPESAFE_MODEL | ~typesafe/jev-latest (same OpenRouter key) |
| TYPESAFE_MODE | shadow (or off to disable reviews) |

In [Supabase Auth URL configuration](https://supabase.com/dashboard/project/cpybqwezigwkhxldxwiv/auth/url-configuration), set Site URL to https://story-quest-seven.vercel.app and register that exact redirect origin plus http://localhost:3000 for local testing. Confirm email provider is enabled. Default Supabase SMTP is limited to organization-team addresses; Rick can demo using his team email. Public signups need custom SMTP ([provider documentation](https://supabase.com/docs/guides/auth/auth-smtp)).

After configuration, redeploy so public keys are included in the client build. Test sign-in, create campaign, commit a turn, complete narration, reload, inspect traces and confirm hidden facts remain server-only. The application stays in scripted-sample mode until the three Supabase values plus OPENROUTER_API_KEY and STORY_MODEL are present. Hosted auth and a real paid model turn remain unverified; TypeSafe is optional for availability and cannot mutate or veto state; configured reviews are privately logged. Jev launched on OpenRouter on September 18; both model roles now use one OpenRouter key. The former TYPESAFE_API_KEY setting is no longer used.

Package engines now pins Node 22.x, matching CI, because the initial Vercel deployment selected Node 24 from the former >=22 range.
