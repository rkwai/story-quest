# Maintenance and evolution

## Durable gameplay records vs operational traces

Accepted turns are the campaign history: input, interpretation, operations, revision, elapsed story time, public outcome and engine version. Keep them for the life of the campaign so the reducer can replay from the seed. Never rewrite an old proposal when changing engine behavior; version reducers and migrate explicitly.

Private traces explain each attempt: trace ID, campaign/turn ID, stage, model, prompt/engine version, duration, actual token usage, context entity/fact IDs, context size, validation failure code, and commit/narration status. Failed attempts must also produce traces. Do not store hidden reasoning, secrets, request headers or raw prompts in console logs. Provider errors should be sanitized. Input and accepted operations already live in private gameplay records; no need to duplicate them in every trace.

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
