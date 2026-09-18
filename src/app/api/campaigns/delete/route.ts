import { z } from 'zod';
import { database, requireSameOrigin, checkDb, failure, readBody } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { campaignId } = z.object({ campaignId: z.uuid() }).parse(await readBody(request));
    const { error } = await database().rpc('delete_playtest_campaign', { p_campaign: campaignId });
    checkDb(error);
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
