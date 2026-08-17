import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
    const user = await requireUser(req);
    const token = String(req.body?.token || '').trim();
    if (!token || token.length < 40) return res.status(400).json({ error: 'Token appareil invalide' });

    const { error } = await supabaseAdmin.from('native_push_tokens').upsert({
      user_id: user.id,
      token,
      platform: 'android',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'token' });
    if (error) throw error;
    return res.status(204).end();
  } catch (error) {
    return jsonError(res, error);
  }
}
