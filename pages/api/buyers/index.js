import { supabaseAdmin } from '../../../lib/supabase';

// Remplace l'inscription en localStorage — le compte acheteur est maintenant
// stocké en base, donc il n'est plus perdu si le cache du navigateur est vidé.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, phone } = req.body;
  if (!email || !phone) {
    return res.status(400).json({ error: 'Email et téléphone obligatoires' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ error: 'Numéro de téléphone invalide' });
  }

  // upsert : si l'email existe déjà, on récupère juste le buyer existant
  const { data, error } = await supabaseAdmin
    .from('buyers')
    .upsert({ email, phone }, { onConflict: 'email' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}
