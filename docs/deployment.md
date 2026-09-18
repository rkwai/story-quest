# Vercel + Supabase deployment

## Standing authorization

Rick explicitly authorizes production pushes for this repo. After meaningful verification, commit and push master, publish to Vercel and inspect the result. Do not request routine approval. Never force-push or destructively reset a production database.

## First connection

1. Vercel and Supabase were connected successfully during implementation. Discover their tools and select/create the StoryQuest projects; do not ask to reconnect or guess an unrelated project.
2. Import rkwai/story-quest in Vercel, repository root `.`, Next.js preset, Node 22, production branch master. The active app is at the root, not legacy/frontend.
3. Link the existing Supabase project and apply all versioned migrations, including the open-lobby migration. Player sign-in, email delivery and Auth redirect configuration are not required for the current shared mode.
4. Connect the existing Supabase project to this Vercel project so the integration syncs its environment values. Add `OPENROUTER_API_KEY` separately. `SUPABASE_SECRET_KEY` and `OPENROUTER_API_KEY` are server-only. Model overrides are optional; see docs/models.md. TypeSafe runs only advisory shadow reviews until calibrated.
5. Redeploy, open the shared lobby without signing in, create/resume an adventure, perform a turn, reload, inspect private traces and confirm hidden facts never appear in network responses. Verify reset preserves history and confirmed deletion removes only the selected disposable test run.

## Git-triggered releases

GitHub Actions runs typecheck, tests and build. Vercel can build automatically from master. The agent must run checks before pushing because an automatic Vercel deployment can start before CI finishes. When credentials are available, Supabase migrations precede a release requiring new schema. Apply additive migrations first; never run the old Sequelize seed against Supabase.

## Rollback

Promote a known-good Vercel deployment or revert the bad application commit. Keep committed campaign history. Database changes should be additive and backward-compatible; fixes use a forward migration, not a destructive rollback. Engine versions must remain available to replay existing turns. Confirm a rollback against a copy of a real save before touching live data.

## Historical verification record — account mode superseded

Retained for audit history. See implementation.md for the latest release and its actual verification status.

2026-09-17: deployed the verified application at master commit `30cc66d` through the connected Vercel app. Production deployment `dpl_CsgKf82cmH4DRgZKWrRZRaPZNjCS` is READY, and https://story-quest-seven.vercel.app returned HTTP 200 with the expected StoryQuest sample page. Project: `prj_oP2UoN5PwdpjElQxYNJ1KGIU3G6B`; team: `team_BVSaShvGktutB8H0ITMsdaq1`. This is the scripted sample; authenticated live DM play remains disabled pending backend and model configuration. Local browser smoke passed before deployment; the hosted check verified rendered HTML only.

The connected app deployed tracked active source files directly (legacy and environment files excluded). Automatic GitHub deployment linkage has not been configured. Continue explicit production releases until linkage is verified. CLI login polling was blocked by workspace network policy; use the operational connected app rather than assuming CLI authentication succeeded.

## Hosted Supabase setup record

The following connection observations predate the open-lobby change. References to sign-in and Auth checks are historical, not current deployment prerequisites.

2026-09-18 connection update: Rick linked the existing projects. Production deployment `dpl_AwhfqccJ3ucuXT5Kwkuy5F3DqaSx` (application `e9da55d`) is READY; `/api/health` returns 200 with all required configuration flags true. The production home page now enables live sign-in. Auth redirects, credential validity and the real model flow require the opt-in live verification described in maintenance.md.

Project `story-quest` (`cpybqwezigwkhxldxwiv`) is ACTIVE_HEALTHY under DataSaa (`pevdfgjydqafmcscwqpt`), us-east-1, close to the Vercel server region. Rick selected the organization; the provider quoted $0/month and its cost-confirmation step completed. [Project dashboard](https://supabase.com/dashboard/project/cpybqwezigwkhxldxwiv).

Migration `story_engine` was applied successfully as remote version `20260917084314`. The local filename now matches that version to avoid duplicate application by future CLI pushes. Four application tables have RLS enabled, anon/authenticated have no SELECT privileges, and service_role has CRUD access. The security advisor reported only four informational [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings. This is intentional: authoritative snapshots, hidden history and traces are server-only. Do not add browser read policies to silence them.

## Current live configuration

The existing Supabase/Vercel integration is connected and can sync database credentials without manually copying a server key. This is distinct from connecting Supabase and Vercel tools to the coding assistant. If the linkage needs repair, use **External Integration Connection / Connect Account** and link Supabase `cpybqwezigwkhxldxwiv` to Vercel `story-quest`; do not create another database. See the [official integration](https://vercel.com/marketplace/supabase) and [project linking guide](https://supabase.com/docs/guides/deployment/branching/integrations).

Check Production values in [Vercel environment settings](https://vercel.com/rick-wongs-projects-3b8edb49/story-quest/settings/environment-variables):

| Variable | Value/source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://cpybqwezigwkhxldxwiv.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Optional for open mode; may remain supplied by the integration (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) |
| SUPABASE_SECRET_KEY | Supplied by the integration; legacy SUPABASE_SERVICE_ROLE_KEY is also accepted; server-only |
| OPENROUTER_API_KEY | Server-only OpenRouter key with credits |
| STORY_MODEL | Optional; defaults to deepseek/deepseek-v4.1-flash |
| PROPOSAL_MODEL | deepseek/deepseek-v4.1-flash (optional; defaults to STORY_MODEL; JSON Schema required) |
| PROPOSAL_REASONING_EFFORT | Defaults to low for the starter model |
| STORY_REASONING_EFFORT | Defaults to none for the starter model; use low for GLM; omit for Cydonia |
| TYPESAFE_MODEL | ~typesafe/jev-latest (same OpenRouter key) |
| TYPESAFE_MODE | shadow (or off to disable reviews) |

No Supabase Auth or SMTP setup is required for the open shared lobby. Legacy publishable/anon values may remain synced by the integration; they do not authorize reads of raw campaign tables. Database and OpenRouter secrets stay server-only. Keep the existing integration values rather than asking a playtester to copy credentials.

After configuration changes, redeploy. `GET /api/health` reports configuration presence with no-store caching and no external calls; it does not prove credential validity or model credits. Real acceptance is: open lobby without sign-in, start a default adventure, submit the reported “what are you doing in this desolate area” question, check the accepted outcome and narration, resume after reload, and inspect private traces. Test reset and confirmed deletion using disposable runs; do not delete existing player adventures as deployment cleanup. Record observed results in implementation.md rather than inferring success from health flags or mocked tests.

The auth-based `verify:live` script is historical and is not acceptance for this mode. Do not attach it or any paid playtest to a build hook. See maintenance.md for the current verification checklist and earlier access constraints.

Package engines now pins Node 22.x, matching CI, because the initial Vercel deployment selected Node 24 from the former >=22 range.


## Historical reset release — September 18

Commit `30835ac` adds account-preserving campaign reset, archived history and the one-time verification ledger. Hosted migrations `20260918023239_verification_runs` and `20260918023311_campaign_reset` are applied; migration filenames match production. Deployment `dpl_DDXEMNp2Uk9H8iCUE8hubU3FVihb` is READY. TypeScript, 33 regression tests and production build pass. The opted-in live test through a temporary build hook was rejected again by automatic approval review; the normal `npm run build` configuration remains active and the real-model flow remains unverified.
