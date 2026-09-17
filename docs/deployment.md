# Vercel + Supabase deployment

## Standing authorization

Rick explicitly authorizes production pushes for this repo. After meaningful verification, commit and push master, publish to Vercel and inspect the result. Do not request routine approval. Never force-push or destructively reset a production database.

## First connection

1. Vercel and Supabase were connected successfully during implementation. Discover their tools and select/create the StoryQuest projects; do not ask to reconnect or guess an unrelated project.
2. Import rkwai/story-quest in Vercel, repository root `.`, Next.js preset, Node 22, production branch master. The active app is at the root, not legacy/frontend.
3. Create/link Supabase, apply the versioned migration, enable email sign-in and configure the exact production site URL and local redirect URL.
4. Add `.env.example` values to Vercel. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only. Choose `STORY_MODEL` explicitly for the connected API account. Leave TypeSafe off until evaluated.
5. Redeploy, test sign-in, create a campaign, perform a turn, reload, inspect private traces, and confirm hidden facts never appear in network responses.

## Git-triggered releases

GitHub Actions runs typecheck, tests and build. Vercel can build automatically from master. The agent must run checks before pushing because an automatic Vercel deployment can start before CI finishes. When credentials are available, Supabase migrations precede a release requiring new schema. Apply additive migrations first; never run the old Sequelize seed against Supabase.

## Rollback

Promote a known-good Vercel deployment or revert the bad application commit. Keep committed campaign history. Database changes should be additive and backward-compatible; fixes use a forward migration, not a destructive rollback. Engine versions must remain available to replay existing turns. Confirm a rollback against a copy of a real save before touching live data.

## Verification record

2026-09-17: deployed the verified application at master commit `30cc66d` through the connected Vercel app. Production deployment `dpl_CsgKf82cmH4DRgZKWrRZRaPZNjCS` is READY, and https://story-quest-seven.vercel.app returned HTTP 200 with the expected StoryQuest sample page. Project: `prj_oP2UoN5PwdpjElQxYNJ1KGIU3G6B`; team: `team_BVSaShvGktutB8H0ITMsdaq1`. This is the scripted sample; authenticated live DM play remains disabled pending backend and model configuration. Local browser smoke passed before deployment; the hosted check verified rendered HTML only.

The connected app deployed tracked active source files directly (legacy and environment files excluded). Automatic GitHub deployment linkage has not been configured. Continue explicit production releases until linkage is verified. CLI login polling was blocked by workspace network policy; use the operational connected app rather than assuming CLI authentication succeeded.

Supabase discovery found organization `datasaa` (`pevdfgjydqafmcscwqpt`) and no StoryQuest project. Do not repurpose unrelated projects. The project creation tool requires organization selection and cost acknowledgment before provisioning. Next: obtain that selection, quote provider cost, create a dedicated project, apply the migration, configure auth and server secrets/model, then test a real turn. No hosted Supabase migration or paid model evaluation has run.
