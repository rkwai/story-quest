import { Adventure } from '@/components/adventure';
import { configurationPresence } from '@/server/config';
export default function Home() {
  const live = configurationPresence().status === 'configured';
  return <Adventure liveAvailable={live} />;
}
export const dynamic = 'force-dynamic';
