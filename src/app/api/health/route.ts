import { configurationPresence } from '@/server/config';

export const dynamic = 'force-dynamic';

/** Reports configuration presence, not credential validity. Makes no provider calls. */
export function GET() {
  const health = configurationPresence();
  return Response.json(health, {
    status: health.status === 'configured' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' }
  });
}
