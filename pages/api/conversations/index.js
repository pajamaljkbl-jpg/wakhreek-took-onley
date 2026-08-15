import { supabaseAdmin } from '../../../lib/supabase';

// Crée (ou récupère) une conversation entre un acheteur et une boutique.
// L'accès à la discussion est désormais gratuit : aucun paiement de 10F n'est requis.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { buyerId, shopId } = req.body;
  if (!buyerId || !shopId) {
    return res.status(400).json({ error: 'buyerId et shopId requis' });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('shop_id', shopId)
    .maybeSingle();

  if (existingError) return res.status(500).json({ error: existingError.message });

  if (existing) {
    if (!existing.entry_fee_paid) {
      const { data: opened, error: openError } = await supabaseAdmin
        .from('conversations')
        .update({ entry_fee_paid: true })
        .eq('id', existing.id)
        .select()
        .single();
      if (openError) return res.status(500).json({ error: openError.message });
      return res.status(200).json(opened);
    }
    return res.status(200).json(existing);
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({ buyer_id: buyerId, shop_id: shopId, entry_fee_paid: true })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
}
