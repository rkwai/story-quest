# Models and evaluation

Verified against provider documentation and the public OpenRouter catalog on **2026-09-18**. The choices below are starting configurations, not measured storytelling winners. No paid model comparison or live TypeSafe accuracy evaluation has been completed.

## Responsibilities

- **OpenRouter DM:** interprets intent, develops the world and proposes typed operations using JSON Schema output.
- **Engine:** validates the proposal and atomically commits authoritative state. Accepted proposals replay without model calls.
- **OpenRouter narrator:** writes plain prose from the committed player-visible outcome. It cannot mutate state and does not receive hidden world facts.
- **TypeSafe Jev:** optionally evaluates batched intent and continuity questions. Results are private advisory traces; they do not veto, choose or commit an outcome until domain calibration demonstrates a useful policy.

Schema compliance and model confidence do not prove semantic consistency. The deterministic boundary remains the engine and its accepted history.

## Initial configuration

Add the OpenRouter key in Vercel, then redeploy. The other values below are built-in defaults and optional overrides:

```dotenv
OPENROUTER_API_KEY=<secret>
PROPOSAL_MODEL=deepseek/deepseek-v4.1-flash
PROPOSAL_REASONING_EFFORT=low
STORY_MODEL=deepseek/deepseek-v4.1-flash
STORY_REASONING_EFFORT=none

TYPESAFE_MODEL=~typesafe/jev-latest
TYPESAFE_MODE=shadow
```

`TYPESAFE_MODEL` is optional and defaults to `~typesafe/jev-latest`. The same `OPENROUTER_API_KEY` powers Jev and text generation. Shadow evaluation is the default; `TYPESAFE_MODE=off` disables it. Advisory failure never blocks a valid engine result. Keep all credentials out of browser variables and source control. Supabase configuration is still required for live saves; see [deployment](deployment.md).

Start with DeepSeek V4.1 Flash for both generative stages. It supports structured proposals and permits reasoning to be disabled for short narration. This is a cost/control rationale, not evidence that its fiction is better than GLM's.

The default DeepSeek model automatically uses `low` proposal reasoning and `none` narration reasoning. For a different model, omitted reasoning settings defer to that provider's defaults; configure supported controls explicitly when comparing alternatives.

## Models to compare

Prices are USD per million tokens, advertised starting input/output rates at verification time. Routing, provider discounts and time-based pricing can change the actual bill. Cached input has separate rates. Reasoning tokens are billable output.

| Candidate | Exact model ID | Input / output | Context | Trial role |
|---|---|---:|---:|---|
| DeepSeek V4.1 Flash | `deepseek/deepseek-v4.1-flash` | From $0.135 / $0.54 | 1,048,576 | Initial DM and narrator |
| GLM 5.3 Flash | `z-ai/glm-5.3-flash` | From $0.075 / $0.25 | Up to 1,310,720; many endpoints 1,048,576 | Compare DM decisions and narration |
| Cydonia 24B V4.1 | `thedrummer/cydonia-24b-v4.1` | $0.30 / $0.50 | 131,072 | Narration-only creative-writing experiment |
| TypeSafe Jev | OpenRouter `~typesafe/jev-latest` → `typesafe/jev-1.13` | $0.042 / free | 32,000 | Advisory typed judgments |

Sources: [DeepSeek](https://openrouter.ai/deepseek/deepseek-v4.1-flash), [GLM](https://openrouter.ai/z-ai/glm-5.3-flash), [Cydonia](https://openrouter.ai/thedrummer/cydonia-24b-v4.1), [Jev on OpenRouter](https://openrouter.ai/typesafe/jev-1.13).

GLM 5.3 Flash requires reasoning: use `low` for either stage when comparing it, not `none`. Its lower token price does not establish lower turn cost or latency. Cydonia is explicitly marketed for creative writing; keep DeepSeek for proposals, set `STORY_MODEL=thedrummer/cydonia-24b-v4.1`, and **omit** `STORY_REASONING_EFFORT` for narration. It has no reasoning control or tool calling. Neither specialist branding nor general benchmark scores prove continuity in this game.

Use concrete generative model IDs rather than a rolling latest/router alias when comparing runs. Jev's requested `~typesafe/jev-latest` alias can move; its response reports the resolved version. Record requested and returned models so changes can be investigated.

## Jev availability and boundary

Jev became available on OpenRouter on **September 18, 2026**. The [Jev 1.13 listing](https://openrouter.ai/typesafe/jev-1.13) now shows the TypeSafe provider and pricing. The September 17 research correctly observed a pending listing; that finding is superseded by the launch. Use `~typesafe/jev-latest` or pin `typesafe/jev-1.13`.

Jev uses OpenRouter's dedicated `POST https://openrouter.ai/api/alpha/decisions`, documented in its [official OpenAPI schema](https://openrouter.ai/openapi.json). This is an alpha API, separate from chat completions. The adapter uses its documented request/response contract with the same bearer key as text generation. It returns typed judgments, not free-form narration or arbitrary engine operations. Questions within a batch are evaluated independently; express dependencies in code. See [TypeSafe introduction](https://docs.typesafe.ai/introduction).

The first integration observes intent and candidate continuity in shadow mode. Privately log question/version identifiers, returned assessments, resolved model, usage, latency and sanitized errors. An unavailable or uncertain advisory call must not silently become an authoritative game rule. Thresholds need labeled StoryQuest cases before any gating role.

Because the Decisions endpoint is alpha, recheck the official schema when changing the adapter. Use the full URL above: the launch-day generated SDK incorrectly joined that path to its `/api/v1` base. An unauthenticated empty POST reached the root alpha route (401); the double-prefixed path returned 404. This verifies routing, not authenticated inference. Never route Jev through chat completions or silently fall back to a second provider account.

## Request and cost controls

OpenRouter proposals use `response_format.type=json_schema` and `provider.require_parameters=true`, then local schema validation and reducer checks. Support varies by provider; strict mode is not a universal guarantee. Narration uses plain text from the public projection. [Structured-output documentation](https://openrouter.ai/docs/guides/features/structured-outputs).

DeepSeek supports optional reasoning; `none` in this app disables it. GLM's current catalog marks reasoning mandatory and supports `low`, `high` and `max`. Cydonia has no reasoning parameters. Confirm capabilities before changing model IDs. [Public model catalog](https://openrouter.ai/api/v1/models).

Hiding reasoning with `exclude: true` does not stop generation or billing. Most providers count reasoning against the output-token limit; a response can exhaust its budget before producing usable content. Check finish reason, content and usage; reject truncated proposals without committing. Log billed usage/cost where supplied, never hidden reasoning or credentials. [Reasoning documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

Retain the bounded context, operation limit, turn leases and explicit narration retry. A million-token context window is not an instruction to send an entire campaign. No calls occur while players are away.

## Paid evaluation before changing defaults

Run the same labeled scenarios against each candidate and retain model, provider, prompt version, selected context IDs, input/output/reasoning tokens, reported cost and stage latency. Inspect both accepted operations and visible prose.

1. **History:** preserve the sample's established Ashford destruction cause. In a fresh live campaign, the cause starts undetermined; establish it once, then prevent later reinterpretation from changing it.
2. **Knowledge:** hidden causes stay hidden until discovery. A false accusation remains a claim. Narration must not disclose private NPC information or unseen events.
3. **State:** track the actual lantern, tower, owners and locations. Waiting until dusk resolves Mara's scheduled movement without skipping a deadline or changing history.
4. **Agency:** distinguish attempts from guaranteed success; clarify genuinely ambiguous multi-actions. Narration must not invent player decisions, possessions, injuries or quest completion.
5. **Persistence:** revisit after 30 turns, retry the same turn ID, and interrupt narration after commitment. State and discoveries must survive; presentation retries must not repeat the action.
6. **Experience and economics:** compare blinded prose preferences, repetition, scene consistency, clarification rate, continuity violations, p50/p95 latency and actual cost per completed turn, including failures and retries.

Separately label Jev intent and continuity questions, measure false positives/negatives and calibration, and test behavior when relevant context is absent. Promote an advisory judgment into a decision policy only after its error tradeoffs are understood. Add reported failures as regression fixtures; never repair the score by rewriting established campaign history.
