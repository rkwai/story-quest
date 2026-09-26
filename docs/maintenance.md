# Maintenance and evolution

## Durable gameplay records vs operational traces

Accepted turns are the campaign history: input, interpretation, operations, revision, elapsed story time, public outcome and engine version. Keep them for the life of the campaign so the reducer can replay from the seed. A player-confirmed permanent deletion ends that lifetime and removes the selected run’s turns and traces; reset does not. Never rewrite an old proposal when changing engine behavior; version reducers and migrate explicitly.

Private traces include a generation ID allocated before each OpenRouter call, requested and served model/provider, reported USD cost when returned, reasoning-token counts (never reasoning text), and Jev shadow judgments/version. Only explicit metadata fields are retained. Private traces explain each attempt: trace ID, campaign/turn ID, stage, model, prompt/engine version, duration, actual token usage, context entity/fact IDs, context size, validation failure code, and commit/narration status. Failed attempts after reservation also produce traces. A structurally valid but rejected candidate is stored privately with its failure code; malformed raw provider output is not retained. Do not store hidden reasoning, secrets, request headers or raw prompts in console logs. Provider errors should be sanitized. Input and accepted operations already live in private gameplay records; no need to duplicate them in every trace.

No public operator endpoint in the first slice. Inspect traces with privileged Supabase SQL. They must never appear in player APIs or client bundles.

## Debugging a turn

1. Confirm the play mode. The scripted preview has preset buttons and no model calls or hosted traces. For an AI adventure, find the campaign and turn ID from the UI error/report; query accepted turns and trace stages.
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

## Inventory diagnostics

Engine 1.1.0 proposals include ordered `itemActions`; prompt `dm-1.3.0` treats the inventory context as the complete possession list. Inspect the pre-turn snapshot, context `inventoryIds` and `selectedItemId`, then the proposal's item actions and accepted public changes. The Character view exposes only the player's known carried items and mechanical state, never raw item descriptions or private diagnostics.

The existing `committed` trace records `details.inventory.status = validated` and its `itemActions`. The existing `failed` trace records `details.inventory.status = blocked`, the safe error code and the rejected proposal when available. These fields use the existing trace writes; there is no additional logging request, inventory classifier or generation. A blocked item check runs before Jev, commit and narration. It releases the lease without changing campaign state, revision or story time. It may still follow one paid proposal request; an invalid explicitly selected ID is rejected before generation. A blocked attempt retains the existing request quota behavior.

For an item report, distinguish ownership, reach, quantity, usability and interpretation. `ITEM_REQUIRED` indicates the model explicitly identified a missing requirement. `ITEM_NOT_CARRIED`, `ITEM_NOT_REACHABLE`, `ITEM_DEPLETED`, `ITEM_INSUFFICIENT_QUANTITY` and `ITEM_UNUSABLE` indicate mechanical failures. `ITEM_DIRECT_MUTATION` catches an attempt to bypass typed inventory operations, while `INVENTORY_ACTION_REQUIRED` catches an action proposal ignoring the UI's selected item. Unknown/private item errors must not disclose hidden item names. A missing semantic dependency with an empty `itemActions` list is a model omission, not evidence that inventory checks ran and approved the equipment.

Regression coverage should include the missing-staff fixture with misleading old prose, another NPC's item, distant objects, same-name distinct IDs, partial consumption, zero quantity, damage/repair, transfers and atomic rollback when a later operation fails. Check that using an existing item still allows creative intent, talking about an item does not require owning it, and blocked drafts remain editable without submitting narration. Phone checks should cover Inventory → prepared action → explicit Send and archived/sample read-only inventory. Report mocked checks separately from authorized paid model playtests.

Use `replayVersioned` for histories mixing engine 1.0.0 and 1.1.0; preserve the old reducer and original stored seed. Do not add equipment to repair an earlier unsupported narration or rewrite accepted outcomes. After 1.1.0 turns exist, use an inventory-aware release for rollback or roll forward with a fix: the pre-1.1 app ignores quantity and usability and could revive depleted gear in its UI and adjudication. See [inventory compatibility and limits](inventory.md).

## Story direction diagnostics

Engine 1.3.0 records selected quest IDs, focus, ranking reasons and omitted quest count in the existing `context` trace. The `committed` trace includes before/after quiet-turn counts, updated quest IDs, progress evidence and `directionMode: 'narrative'`; it no longer records `surfacedLeadIds`. A rejected story plan has `story.status=blocked` plus a stable `STORY_*` code in `failed`. These details remain server-only. No extra trace-write round trip or model call is added.

For aimlessness, compare the selected objective with the exact input, cited new evidence and the opportunity conveyed in the narration. Look for repeated hints, stale evidence, superficial facts counted as progress or a main quest displacing the user's actual question. `needsDirection` uses three quiet turns or missing goal metadata, not missing lead buttons. The existing Jev batch adds `storyProgressConcern` and `storyIntentConcern` as optional advisory probabilities; missing answers are not zero concern and no score changes world state. Use player feedback and recorded cases to evaluate these signals before adding a context reranker.

Old saves remain readable, but current contexts and public projections omit their legacy lead prompts. Existing objectives and stakes remain useful while accepted turns can update goal metadata. No database migration or reset is required. Replay dispatches by stored engine version, preserving 1.0.0, 1.1.0 and 1.2.0 behavior alongside 1.3.0. Roll forward or use a release that understands every recorded version. Paid playtests still require explicit opt-in; mocked tests establish contracts, not storytelling quality. See [story direction](story-direction.md).

Verify that live schemas omit generated lead commands, projections do not expose old prompts, and the Journal retains objectives/stakes without a “Known leads” list. Exact historical `Lead available:` receipts are filtered during rendering, not removed from accepted history. Phone checks should show input, newest scene and independently scrollable older scenes without visible “Latest interaction” or “Past story” labels. Fixed inventory controls and the explicitly labeled no-AI preview buttons remain intentional.

## World-planning deadlines

Keep these budgets coordinated: proposal 120 seconds, `/api/turns` 150 seconds, turn reservation 180 seconds. The route export and first exact-match rule in `vercel.json` both set 150. The 30-second margins leave room for context reads, validation, the bounded Jev review and saving, and prevent a second visitor taking over a still-running request. Other routes retain their 60-second configuration; narration calls remain 45 seconds and Jev four seconds. A platform-killed request can leave a busy lease until expiry; handled proposal failures release it.

Apply `longer_proposal_lease` before deploying the application change. It only replaces the reservation function and preserves its guards, shared quota and private grants. Existing active leases are left alone. The longer lease tolerates application rollback, subject to the inventory-version compatibility limits above; keep the forward migration and saved history. Fresh migrations and tests must run in timestamp order.

For failures inspect `details.modelCall` on the private `failed` trace: `timeoutMs`, `failureKind`, `responsePhase`, `headersMs`, `httpStatus` and `durationMs`. An HTTP 200 plus `failureKind=timeout` and `responsePhase=body` means headers arrived but the complete JSON response exceeded the deadline. `MODEL_TIMEOUT` is HTTP 504, while provider-unavailable errors are 503. Missing provider usage/cost remains unknown, not zero. Hard platform termination can still prevent final trace persistence.

There is one proposal generation per attempt and no automatic paid retry, speculative generation or premium routing. The same model, reasoning effort, token cap and context apply. The first turn skips an empty history query; this saves a database round trip, not the model's generation time. A longer wait may still consume provisioned memory and provider tokens; compare completed-attempt cost and retry frequency rather than promising zero cost or faster model execution. [Vercel duration and billing behavior](https://vercel.com/docs/functions/configuring-functions/duration).

## Maintenance cadence (human-triggered; no gameplay cron)

Weekly during active development: review rejected turns, failed narration, context overflow, p95 latency and usage. After every continuity report: add a labeled regression. Before a model change: run the fixed scenario set and a multi-turn campaign. Before a schema change: test migration on disposable PostgreSQL, replay representative saves, and plan rollback.

Operational trace retention target is 30 days; implement/schedule centralized cleanup only when real usage warrants it. Initial traces persist until the associated run is deleted through its confirmed Delete action or an authorized retention operation removes them. Accepted history is separate and must not be included in trace cleanup. Verify Supabase backup/PITR availability for the actual plan; do not assume it. Confirmed campaign deletion includes its traces and accepted turns. Account deletion is not part of the open-mode UI. Never silently retcon a campaign to fix an engine bug.

## Reliability gates

Engine invariants, idempotent retries, concurrent revision handling, server-resolved request scopes, shared-access behavior, secret filtering and narration-failure recovery are required tests. Phone UI checks cover the default lobby, one-click creation, shared resume, confirmed deletion, reset/archive behavior, typing, pending submission, tab navigation and long text. Live model tests require configured server credentials and must report their sample size; players do not sign in or supply keys. Mock success is not proof of AI quality.

## Resetting during iteration

Use **Reset current adventure** in a live campaign. Confirm to archive the current run and create a fresh campaign from its original stored seed. The previous run, accepted turns and diagnostics remain available for investigation; archived adventures are read-only. Reset has no model cost. Repeating the same reset request returns the same new campaign instead of creating duplicates. The active-campaign quota excludes archived runs. All visitors share the lobby and can continue the new run.

The browser-only sample has a separate **Start a fresh sample** action. It does not touch Supabase or live campaigns.

## Deleting during iteration

Choose Delete on the selected adventure and confirm that its story history and diagnostics will be removed. The deletion applies to that run only; another run created by reset remains separate. Do not use Delete if the failure still needs trace investigation; use Reset to start fresh while preserving evidence. Missing/deleted saves must return a clear result and the UI must return to the lobby. Active turn/narration leases must finish or expire before deletion.

Rick explicitly requested this capability. That does not authorize an agent to clear existing user runs during implementation or release checks. Verify deletion against a disposable test run only. Keep the verification ledger intact; a run deletion may clear its campaign reference without erasing the record of a paid test.

## Current open-lobby verification

1. Open production without signing in. Confirm the shared lobby is the initial screen and Start a new adventure creates a playable run without a form prerequisite.
2. Resume that run from the shared list in another browser/session. Confirm the same public history and revision; raw authoritative state and traces must remain unavailable through browser database roles.
3. Submit the original reported question about why the woman is here. Check exact input preservation, committed consequences and subject fidelity in the narration. Record model, usage, stage timing and result; do not treat a scripted preview or a mock as this test.
4. Reload and resume. Retry an accepted turn ID without new model calls or duplicated state. Test stale concurrent actions and narration recovery separately when changing those paths.
5. Reset a disposable run and verify an archive plus a new seed-based run. Confirm delete on a disposable run removes its history/traces without deleting another adventure. Do not clear existing player runs to make room.
6. Report the number of real model turns run and any outstanding checks. A single successful turn is not proof of long-term story consistency.

Normal builds remain `npm run build`; do not put paid verification into a deployment build command or add a public paid-test/credential-export endpoint. The ordinary shared game UI is the intended playtest path. The shared limits are five active campaigns and 100 turn attempts per day; leases remain active even though login has been removed.

## Historical auth-based verifier — superseded for open mode

The existing `scripts/verify-live.ts` was written for account-scoped campaigns and tests identity/ownership assumptions that no longer define product access. Retain it as history; do not use it as current acceptance or run it unchanged against the shared lobby. The invocation and safeguards below describe its former contract, not a remaining login requirement.

### Former invocation and safeguards

The former command was `npm run verify:live -- --execute --run-id=<new UUID>` in a trusted environment with the same Supabase and OpenRouter variables. A durable unique row in server-only `verification_runs` must be inserted before any account or model actions. Reusing that UUID skips the test, even after a rebuild or crash; a new deliberate test needs a new UUID. Never delete ledger entries to retry a run.

The QA account (`storyquest-qa@example.com`, reserved for internal tests and marked with server-owned app metadata) and its campaigns/traces are retained at Rick's request. No email is sent to this address, no reusable password is published, and normal player accounts are untouched. The check signs into that QA identity using an administrator-generated one-time token. Credentials, sessions, magic links and story/context text never enter logs. Results and sanitized provider metrics are stored in the private ledger.

One run requests one proposal, one Jev review and one narration, without automatic paid retries. It checks Auth sign-in and magic-link redirection, hosted campaign/turn/narration APIs, committed state, reload, database-level same-turn replay, direct-table privacy, and live campaign reset including request replay and preserved old history. Replay and archived-turn rejection use database functions directly to avoid extra model calls if an HTTP guard regresses.

Normal builds remain `npm run build`. On September 18 Rick explicitly authorized the playtest and retaining its account. Automatic approval review nevertheless rejected the temporary build-hook invocation again before execution, citing persistent deployment side effects. Do not retry a build hook. That verifier required a separately authenticated trusted runtime; current playtesting instead uses the open game UI without sign-in. A fixed run UUID still protects script invocations from accidental repetition. Never add a public paid-test or credential-export endpoint. The script checks the current hosted release, not the release still being built; deploy application changes normally first. It does not prove SMTP email delivery, visual browser behavior, long-campaign continuity or overall model quality.
