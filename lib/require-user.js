import { assertSupabaseConfigured } from './supabase';

export async function requireUser(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) throw new Error('Connexion requise');
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error('Session invalide');
  return data.user;
}

export function jsonError(res, error) {
  const status = error.message === 'Connexion requise' || error.message === 'Session invalide' ? 401 : 400;
  return res.status(status).json({ error: error.message || 'Erreur serveur' });
}
