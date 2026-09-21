import { z } from 'zod';
import { boundConversation, CONVERSATION_TURN_LIMIT, type RecentPublicTurn } from '@/engine/context';
import { checkDb, type database } from '@/server/db';

const conversationRow = z.object({
  public_result: z.object({
    id: z.string().min(1).max(80),
    revision: z.number().int().min(1),
    input: z.string().min(1).max(2000),
    changes: z.array(z.string().max(1600)).max(50),
  }),
  narration: z.string().min(1).max(3000).nullable(),
});

export function sanitizeConversation(rows: readonly unknown[], throughRevision: number): RecentPublicTurn[] {
  const turns: RecentPublicTurn[] = [];
  for (const row of rows) {
    const parsed = conversationRow.safeParse(row);
    if (!parsed.success || parsed.data.public_result.revision > throughRevision) continue;
    const { id, revision, input, changes } = parsed.data.public_result;
    turns.push({ id, revision, input, changes, narration: parsed.data.narration });
  }
  return boundConversation(turns);
}

export async function recentConversation(db: ReturnType<typeof database>, campaignId: string, throughRevision: number): Promise<RecentPublicTurn[]> {
  // Revision N is the reserved world's latest committed turn; this request will
  // become N+1. Do not include later turns, uncommitted attempts, or private data.
  if (throughRevision === 0) return [];
  const { data, error } = await db.from('turns').select('public_result,narration')
    .eq('campaign_id', campaignId).eq('status', 'committed').lte('revision', throughRevision)
    .order('revision', { ascending: false }).limit(CONVERSATION_TURN_LIMIT);
  checkDb(error);
  return sanitizeConversation(data ?? [], throughRevision);
}
