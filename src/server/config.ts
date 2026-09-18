import { publicSupabaseConfig } from '@/lib/supabase-public';

/** Server-only configuration. Never import this module from a client component. */
export function serverSupabaseConfig() {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY_CONFIGURATION');
  return {
    url: publicSupabaseConfig().url,
    key: process.env.SUPABASE_SECRET_KEY?.trim()
      || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined
  };
}

/** Presence only: these booleans do not validate credentials or provider availability. */
export function configurationPresence() {
  const server = serverSupabaseConfig();
  const checks = {
    supabaseUrl: Boolean(server.url),
    supabasePublicKey: Boolean(publicSupabaseConfig().key),
    supabaseServerKey: Boolean(server.key),
    openrouterKey: Boolean(process.env.OPENROUTER_API_KEY?.trim())
  };
  const status = Object.values(checks).every(Boolean) ? 'configured' : 'not_configured';
  return { status, checks } as const;
}
