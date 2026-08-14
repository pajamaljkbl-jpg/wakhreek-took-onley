import { createClient } from '@supabase/supabase-js';

// Client réservé au navigateur. Sa création est différée : cela évite de
// bloquer la compilation Vercel si une variable n'est pas encore disponible.
let client;

export function getSupabaseBrowser() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Configuration Supabase publique manquante sur Vercel.');
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  return client;
}
