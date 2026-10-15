import { createHash } from 'node:crypto';
import type { database } from '@/server/db';

const corrections = {
  STORY_UNKNOWN_FACT: 'A progress fact reference did not exist. Record a justified discovery with establish_fact, or reveal an existing hidden fact with learn_fact, before referencing it. Never invent evidence merely to satisfy progress.',
  STORY_UNKNOWN_CLAIM: 'A progress claim reference did not exist. Record the actual NPC testimony with add_claim before referencing it. Testimony is not proof that its content is true.',
  STORY_STALE_PROGRESS: 'Previously known evidence was counted as new progress. Only evidence established or newly revealed by this turn can count. Do not repackage old evidence with a new ID.',
  STORY_HIDDEN_PROGRESS: 'Public quest progress referred to evidence the player had not learned. Respect what was actually observed; do not reveal a secret merely to make progress valid.',
  DUPLICATE_ID: 'A proposed new record reused an existing ID. Refer to established records without recreating or renaming them. Only genuinely new records get new IDs.',
} as const;

export type ProposalRetryGuidance = {
  version: 'proposal-retry-1';
  code: keyof typeof corrections;
  correction: string;
};

// Scope diagnostic feedback to this exact attempt, without copying player text
// into traces. The database separately binds turn ID to input and campaign.
export function proposalRequestFingerprint(input: string, revision: number, itemId?: string): string {
  return createHash('sha256').update(JSON.stringify({ input, revision, itemId: itemId ?? null })).digest('hex');
}

export function proposalRetryGuidance(details: unknown, fingerprint: string): ProposalRetryGuidance | undefined {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return;
  const record = details as Record<string, unknown>;
  if (record.requestFingerprint !== fingerprint || typeof record.code !== 'string' || !Object.hasOwn(corrections, record.code)) return;
  const code = record.code as keyof typeof corrections;
  // Only fixed, bounded instructions cross into the next prompt. In particular,
  // rejected proposal prose and unknown diagnostic fields are never authority.
  return { version: 'proposal-retry-1', code, correction: corrections[code] };
}

export async function previousProposalGuidance(db: ReturnType<typeof database>, campaignId: string, turnId: string, fingerprint: string): Promise<ProposalRetryGuidance | undefined> {
  try {
    const { data, error } = await db.from('turn_traces').select('details')
      .eq('campaign_id', campaignId).eq('turn_id', turnId).eq('stage', 'failed')
      .order('id', { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(1500));
    if (error) return;
    return proposalRetryGuidance(data?.[0]?.details, fingerprint);
  } catch {
    // Observability cannot become a prerequisite for continuing the story.
    return;
  }
}
