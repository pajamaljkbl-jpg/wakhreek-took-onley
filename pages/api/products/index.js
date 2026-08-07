import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { shopId, q, category } = req.query;
    let query = supabaseAdmin.from('products').select('*, shops(id,name,city,quartier,wave_number,qr_code_url)').eq('active', true).order('created_at', { ascending: false });
    if (shopId) query = query.eq('shop_id', shopId);
    if (category) query = query.eq('category', category);
    if (q) query = query.ilike('name', `%${String(q).slice(0, 80)}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { shopId, name, description, imageUrl, category, price, stock } = req.body || {};
    if (!shopId || !name || Number(price) < 0) return res.status(400).json({ error: 'Boutique, nom et prix valides obligatoires' });
    const { data, error } = await supabaseAdmin.from('products').insert({ shop_id: shopId, name: String(name).trim(), description, image_url: imageUrl, category, price: Number(price) || 0, stock: Math.max(0, Number(stock) || 0) }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }
  res.setHeader('Allow', 'GET, POST'); return res.status(405).end();
}
