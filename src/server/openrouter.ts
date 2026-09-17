import { EngineError } from '@/engine/types';

export type ModelStage = 'proposal' | 'narration';
export class ModelCallError extends EngineError {
  constructor(code: string, public metrics: Record<string, unknown>) { super(code); }
}

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const label = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_.:/ -]{1,160}$/.test(value) ? value : null;

/** Only a fixed metadata allowlist is persisted, never provider messages or reasoning. */
function usageMetrics(value: unknown) {
  const usage = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const details = usage.completion_tokens_details as Record<string, unknown> | undefined;
  const prompt = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  return { inputTokens: finite(usage.prompt_tokens), outputTokens: finite(usage.completion_tokens),
    totalTokens: finite(usage.total_tokens), reasoningTokens: finite(details?.reasoning_tokens),
    cachedTokens: finite(prompt?.cached_tokens), costUsd: finite(usage.cost) };
}

export async function generate(stage: ModelStage, system: string, content: unknown, maxTokens: number, promptVersion: string, schema?: Record<string, unknown>): Promise<{ text: string; metrics: Record<string, unknown> & { durationMs: number } }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = stage === 'proposal' ? process.env.PROPOSAL_MODEL || process.env.STORY_MODEL : process.env.STORY_MODEL;
  if (!apiKey || !model) throw new EngineError('NOT_CONFIGURED');
  const effort = process.env[stage === 'proposal' ? 'PROPOSAL_REASONING_EFFORT' : 'STORY_REASONING_EFFORT'];
  if (effort && !['none','minimal','low','medium','high','xhigh'].includes(effort)) throw new EngineError('NOT_CONFIGURED');
  const started = performance.now();
  const metrics: Record<string, unknown> = { generationId: crypto.randomUUID(), provider: 'openrouter', stage, requestedModel: model, promptVersion, reasoningEffort: effort || 'provider_default' };
  const fail = (code: string): never => { throw new ModelCallError(code, { ...metrics, durationMs: Math.round(performance.now() - started) }); };
  let payload;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://story-quest-seven.vercel.app', 'X-OpenRouter-Title': 'StoryQuest' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(content) }],
        max_tokens: maxTokens, stream: false, provider: { require_parameters: true },
        ...(effort ? { reasoning: { effort, exclude: true } } : {}),
        ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'storyquest_proposal', strict: true, schema } } } : {}) })
    });
    metrics.httpStatus = response.status;
    if (!response.ok) return fail('MODEL_UNAVAILABLE');
    payload = await response.json();
  } catch (error) {
    if (error instanceof ModelCallError) throw error;
    return fail('MODEL_UNAVAILABLE');
  }
  metrics.model = label(payload?.model);
  metrics.servedBy = label(payload?.provider);
  metrics.providerGenerationId = label(payload?.id);
  metrics.usage = usageMetrics(payload?.usage);
  const answer = payload?.choices?.[0];
  if (payload?.error) return fail('MODEL_UNAVAILABLE');
  metrics.finishReason = label(answer?.finish_reason);
  if (answer?.finish_reason !== 'stop' || typeof answer.message?.content !== 'string' || !answer.message.content.trim()) return fail('MODEL_INCOMPLETE');
  return { text: answer.message.content.trim(), metrics: { ...metrics, durationMs: Math.round(performance.now() - started) } };
}
