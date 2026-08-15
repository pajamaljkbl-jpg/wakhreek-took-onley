import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const user = await requireUser(req);
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Abonnement push invalide' });
    }
    const row = {
      user_id: user.id,
      email: user.email || null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error) { return jsonError(res, error); }
}
