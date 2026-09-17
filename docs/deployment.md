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

A production release is complete only with a successful provider deployment and an HTTP/browser check of its URL. Both plugins are connected, but their operational tools were not exposed in the implementation session. No live project or model credentials have yet been configured. Refresh discovery on the next turn and complete the provider steps. The offline scripted sample works without keys but is not a live DM.


The first implementation was published to master (`b76f10a`) and GitHub CI passed. Vercel CLI fallback was attempted and returned `login_required`; it has no saved login or token in this workspace. A successful plugin connection is distinct from CLI write authorization. No production URL has been claimed or verified.
