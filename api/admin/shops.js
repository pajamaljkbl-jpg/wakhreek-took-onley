import { assertSupabaseConfigured } from '../../../lib/supabase';

function isAdmin(req) {
  return Boolean(process.env.ADMIN_SECRET) && req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Non autorisé' });

  let supabaseAdmin;
  try {
    supabaseAdmin = assertSupabaseConfigured();
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }

  const fields = 'id, name, city, quartier, wave_number, subscription_active, subscription_expires_at, created_at';

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('shops')
      .select(fields)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { shopId, action } = req.body || {};
    if (!shopId || !['activate_free', 'deactivate'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide' });
    }

    const updates = action === 'activate_free'
      ? {
        subscription_active: true,
        // Activation exceptionnelle décidée par l'administrateur : aucune expiration.
        subscription_expires_at: null,
      }
      : { subscription_active: false, subscription_expires_at: null };

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update(updates)
      .eq('id', shopId)
      .select(fields)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ shop: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Méthode non autorisée' });
}
