import { Adventure } from '@/components/adventure';
export default function Home() {
  const live = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OPENROUTER_API_KEY && process.env.STORY_MODEL);
  return <Adventure liveAvailable={live} />;
}
export const dynamic = 'force-dynamic';
