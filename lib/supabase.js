import { createClient } from '@supabase/supabase-js';

// Utilisé uniquement côté serveur (API routes) — la clé service_role
// a tous les droits, elle ne doit JAMAIS être envoyée au navigateur.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
