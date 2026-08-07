import { supabaseAdmin } from '../../../lib/supabase';

// Crée (ou récupère si elle existe déjà) la conversation entre un acheteur
// et une boutique. entry_fee_paid démarre à false — il faudra payer les 10F
// via /api/checkout/create puis le webhook Wave pour pouvoir écrire.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { buyerId, shopId } = req.body;
  if (!buyerId || !shopId) {
    return res.status(400).json({ error: 'buyerId et shopId requis' });
  }

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('shop_id', shopId)
    .maybeSingle();

  if (existing) return res.status(200).json(existing);

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({ buyer_id: buyerId, shop_id: shopId })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
}
