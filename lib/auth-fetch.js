// Wakh Reek — aide d'authentification pour les appels et l'API.
//
// Problème corrigé : le jeton d'accès Supabase expire (1 h par défaut) et les
// pages envoyaient l'ancien jeton en boucle → 401 sur /api/calls → l'appel ne
// part jamais. Ce module renvoie TOUJOURS un jeton valide (rafraîchi si besoin)
// et rejoue UNE fois la requête en cas de 401.
import { getSupabaseBrowser } from './supabase-browser';

export class AuthRequiredError extends Error {
  constructor() {
    super('Connexion requise');
    this.name = 'AuthRequiredError';
  }
}

// Lit la date d'expiration du JWT sans dépendance externe.
function parseExpiry(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(part));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

const EXPIRY_MARGIN_MS = 30 * 1000;

async function refresh(client, session) {
  if (!session?.refresh_token) {
    const { data, error } = await client.auth.refreshSession();
    return error ? null : data.session;
  }
  const { data, error } = await client.auth.refreshSession({ refresh_token: session.refresh_token });
  return error ? null : data.session;
}

export async function getFreshSession() {
  const client = getSupabaseBrowser();
  const { data } = await client.auth.getSession();
  let session = data.session;
  if (!session) return null;

  const exp = parseExpiry(session.access_token);
  if (exp && Date.now() >= exp - EXPIRY_MARGIN_MS) {
    const refreshed = await refresh(client, session);
    if (!refreshed) return null;
    session = refreshed;
  }
  return session;
}

export async function authFetch(path, options = {}) {
  let session = await getFreshSession();
  if (!session) throw new AuthRequiredError();

  const headersFor = (s) => ({ ...(options.headers || {}), Authorization: `Bearer ${s.access_token}` });

  let res = await fetch(path, { ...options, headers: headersFor(session) });

  if (res.status === 401) {
    const client = getSupabaseBrowser();
    const refreshed = await refresh(client, session);
    if (!refreshed) throw new AuthRequiredError();
    session = refreshed;
    res = await fetch(path, { ...options, headers: headersFor(session) });
  }
  return res;
}

export function isAuthError(error) {
  return Boolean(error && error.name === 'AuthRequiredError');
}
