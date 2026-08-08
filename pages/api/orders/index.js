import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { shopId } = req.query;
    if (!shopId) return res.status(400).json({ error: 'shopId requis' });
    const { data, error } = await supabaseAdmin.from('orders').select('*, order_items(*)').eq('shop_id', shopId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { buyerId, customerName, customerPhone, deliveryAddress, items } = req.body || {};
    if (!customerName || !customerPhone || !deliveryAddress || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Informations client et panier obligatoires' });
    const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    const { data: products, error: productError } = await supabaseAdmin.from('products').select('id,shop_id,name,price,stock,active').in('id', ids);
    if (productError || !products?.length) return res.status(400).json({ error: 'Produits introuvables' });
    const shopIds = [...new Set(products.map((p) => p.shop_id))];
    if (shopIds.length !== 1) return res.status(400).json({ error: 'Une commande doit appartenir à une seule boutique' });
    let total = 0; const lines = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (!product?.active || product.stock < quantity) return res.status(409).json({ error: `Stock insuffisant pour ${product?.name || 'un produit'}` });
      total += product.price * quantity; lines.push({ product_id: product.id, product_name: product.name, unit_price: product.price, quantity });
    }
    const { data: order, error } = await supabaseAdmin.from('orders').insert({ buyer_id: buyerId || null, shop_id: shopIds[0], customer_name: customerName, customer_phone: customerPhone, delivery_address: deliveryAddress, total }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    const { error: lineError } = await supabaseAdmin.from('order_items').insert(lines.map((line) => ({ ...line, order_id: order.id })));
    if (lineError) return res.status(500).json({ error: lineError.message });
    for (const line of lines) await supabaseAdmin.from('products').update({ stock: products.find((p) => p.id === line.product_id).stock - line.quantity }).eq('id', line.product_id);
    return res.status(201).json({ ...order, items: lines });
  }
  res.setHeader('Allow', 'GET, POST'); return res.status(405).end();
}
