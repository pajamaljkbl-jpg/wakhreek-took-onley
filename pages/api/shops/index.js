import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { city } = req.query;
    let query = supabaseAdmin.from('shops').select('*, products(*)').order('created_at', { ascending: false });
    if (city && city !== 'Toutes Villes') query = query.eq('city', city);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { name, city, quartier, category, wave_number, om_number, qr_code_url, description, products } = req.body;

    if (!name || !city || !wave_number) {
      return res.status(400).json({ error: 'Nom, ville et numéro Wave sont obligatoires' });
    }

    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .insert({ name, city, quartier, category, wave_number, om_number, qr_code_url, description })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (Array.isArray(products) && products.length) {
      await supabaseAdmin.from('products').insert(
        products.map((p) => ({ shop_id: shop.id, name: p.name, price: p.price || 0 }))
      );
    }

    // Note: la boutique est créée mais "subscription_active" reste false —
    // il faut envoyer une preuve de paiement via POST /api/payments
    // (type: 'subscription'), puis attendre la validation manuelle admin
    // via /api/payments/[id]/review.
    return res.status(201).json(shop);
  }

  return res.status(405).end();
}
