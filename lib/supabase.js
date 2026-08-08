import { createClient } from '@supabase/supabase-js';

// Utilisé uniquement côté serveur (API routes) — la clé service_role
// a tous les droits, elle ne doit JAMAIS être envoyée au navigateur.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ne pas faire planter toute la fonction Vercel au moment de l'import si une
// variable manque. Chaque route peut ainsi renvoyer une erreur JSON lisible.
export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

export function assertSupabaseConfigured() {
  if (!supabaseAdmin) {
    throw new Error(
      'Configuration Supabase manquante sur Vercel : vérifie NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis redéploie.'
    );
  }
  return supabaseAdmin;
}
