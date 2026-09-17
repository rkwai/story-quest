# Vercel + Supabase deployment

## Standing authorization

Rick explicitly authorizes production pushes for this repo. After meaningful verification, commit and push master, publish to Vercel and inspect the result. Do not request routine approval. Never force-push or destructively reset a production database.

## First connection

1. Connect Vercel and Supabase accounts to the workspace. Select/create the StoryQuest projects once account access exists; do not guess an unrelated project.
2. Import rkwai/story-quest in Vercel, repository root `.`, Next.js preset, Node 22, production branch master. The active app is at the root, not legacy/frontend.
3. Create/link Supabase, apply the versioned migration, enable email sign-in and configure the exact production site URL and local redirect URL.
4. Add `.env.example` values to Vercel. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only. Choose `STORY_MODEL` explicitly for the connected API account. Leave TypeSafe off until evaluated.
5. Redeploy, test sign-in, create a campaign, perform a turn, reload, inspect private traces, and confirm hidden facts never appear in network responses.

## Git-triggered releases

GitHub Actions runs typecheck, tests and build. Vercel can build automatically from master. The agent must run checks before pushing because an automatic Vercel deployment can start before CI finishes. When credentials are available, Supabase migrations precede a release requiring new schema. Apply additive migrations first; never run the old Sequelize seed against Supabase.

## Rollback

Promote a known-good Vercel deployment or revert the bad application commit. Keep committed campaign history. Database changes should be additive and backward-compatible; fixes use a forward migration, not a destructive rollback. Engine versions must remain available to replay existing turns. Confirm a rollback against a copy of a real save before touching live data.

## Verification record

A production release is complete only with a successful provider deployment and an HTTP/browser check of its URL. No provider credentials were present at initial inspection; connection is required before this can be verified. The offline scripted sample works without keys but is not a live DM.
