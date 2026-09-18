# Maintenance and evolution

## Durable gameplay records vs operational traces

Accepted turns are the campaign history: input, interpretation, operations, revision, elapsed story time, public outcome and engine version. Keep them for the life of the campaign so the reducer can replay from the seed. Never rewrite an old proposal when changing engine behavior; version reducers and migrate explicitly.

Private traces include a generation ID allocated before each OpenRouter call, requested and served model/provider, reported USD cost when returned, reasoning-token counts (never reasoning text), and Jev shadow judgments/version. Only explicit metadata fields are retained. Private traces explain each attempt: trace ID, campaign/turn ID, stage, model, prompt/engine version, duration, actual token usage, context entity/fact IDs, context size, validation failure code, and commit/narration status. Failed attempts after reservation also produce traces. A structurally valid but rejected candidate is stored privately with its failure code; malformed raw provider output is not retained. Do not store hidden reasoning, secrets, request headers or raw prompts in console logs. Provider errors should be sanitized. Input and accepted operations already live in private gameplay records; no need to duplicate them in every trace.

No public operator endpoint in the first slice. Inspect traces with privileged Supabase SQL. They must never appear in player APIs or client bundles.

## Debugging a turn

1. Find the campaign and turn ID from the UI error/report; query accepted turns and trace stages.
2. Check whether commit happened. If yes, do not resubmit a new action ID to recover narration.
3. Replay the seed plus accepted proposals through the matching engine version and compare the snapshot.
4. Inspect context IDs: was the relevant fact retrieved? Did interpretation, adjudication, validation or narration introduce the discrepancy?
5. Add a regression scenario before changing prompts, retrieval or rules.
6. Shadow-test against recorded inputs; compare state transitions, visibility, tokens and latency before releasing.

## Useful operational queries

```sql
select stage, count(*), percentile_cont(0.95) within group (order by duration_ms) as p95_ms
from public.turn_traces where created_at > now() - interval '7 days' group by stage;
select turn_id, stage, details from public.turn_traces
where campaign_id = '<campaign UUID>' order by created_at;
```

## Maintenance cadence (human-triggered; no gameplay cron)

Weekly during active development: review rejected turns, failed narration, context overflow, p95 latency and usage. After every continuity report: add a labeled regression. Before a model change: run the fixed scenario set and a multi-turn campaign. Before a schema change: test migration on disposable PostgreSQL, replay representative saves, and plan rollback.

Operational trace retention target is 30 days; implement/schedule centralized cleanup only when real usage warrants it. Initial traces persist until an operator deletes them with a privileged query. Accepted history is separate and must not be included in trace cleanup. Verify Supabase backup/PITR availability for the actual plan; do not assume it. Campaign/account deletion must include traces and accepted turns. Never silently retcon a campaign to fix an engine bug.

## Reliability gates

Engine invariants, idempotent retries, concurrent revision handling, owner isolation, secret filtering and narration-failure recovery are required tests. Phone UI checks cover typing, pending submission, tab navigation, persisted sample and long text. Live model tests require credentials and must report their sample size; mock success is not proof of AI quality.

## Resetting during iteration

Use **Reset current adventure** in a live campaign. Confirm to archive the current run and create a fresh campaign from its original stored seed. Your account stays signed in. The previous run, accepted turns and diagnostics remain available for investigation; archived adventures are read-only. Reset has no model cost. Repeating the same reset request returns the same new campaign instead of creating duplicates. The active-campaign quota excludes archived runs.

The browser-only sample has a separate **Start a fresh sample** action. It does not touch Supabase or live campaigns.

## Opt-in hosted verification

After a configured production deployment is READY, run `npm run verify:live -- --execute --run-id=<new UUID>` in a trusted environment with the same Supabase and OpenRouter variables. A durable unique row in server-only `verification_runs` must be inserted before any account or model actions. Reusing that UUID skips the test, even after a rebuild or crash; a new deliberate test needs a new UUID. Never delete ledger entries to retry a run.

The QA account (`storyquest-qa@example.com`, reserved for internal tests and marked with server-owned app metadata) and its campaigns/traces are retained at Rick's request. No email is sent to this address, no reusable password is published, and normal player accounts are untouched. The check signs into that QA identity using an administrator-generated one-time token. Credentials, sessions, magic links and story/context text never enter logs. Results and sanitized provider metrics are stored in the private ledger.

One run requests one proposal, one Jev review and one narration, without automatic paid retries. It checks Auth sign-in and magic-link redirection, hosted campaign/turn/narration APIs, committed state, reload, database-level same-turn replay, direct-table privacy, and live campaign reset including request replay and preserved old history. Replay and archived-turn rejection use database functions directly to avoid extra model calls if an HTTP guard regresses.

Normal builds remain `npm run build`. On September 18 Rick explicitly authorized one temporary verification build followed by immediate restoration of the normal build, superseding the earlier review block. That invocation must contain a fixed run UUID so future reuse cannot repeat paid actions. Never add a public paid-test or credential-export endpoint. The script checks the current hosted release, not the release still being built; deploy application changes normally first. It does not prove SMTP email delivery, visual browser behavior, long-campaign continuity or overall model quality.
