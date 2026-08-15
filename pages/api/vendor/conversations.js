import { supabaseAdmin } from '../../../lib/supabase';

async function getSeller(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
  const seller = await getSeller(req);
  if (!seller) return res.status(401).json({ error: 'Connecte-toi pour accéder à ton espace vendeur.' });

  const { data: shops, error: shopsError } = await supabaseAdmin.from('shops').select('id, name, city').eq('owner_id', seller.id);
  if (shopsError) return res.status(500).json({ error: shopsError.message });
  const shopIds = (shops || []).map((shop) => shop.id);
  if (!shopIds.length) return res.status(200).json({ shops: [], conversations: [], calls: [], orders: [] });

  const [{ data: conversations, error: conversationsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabaseAdmin.from('conversations').select('*').in('shop_id', shopIds).order('created_at', { ascending: false }),
    supabaseAdmin.from('orders').select('*, order_items(*)').in('shop_id', shopIds).order('created_at', { ascending: false }),
  ]);

  if (conversationsError) return res.status(500).json({ error: conversationsError.message });
  if (ordersError) return res.status(500).json({ error: ordersError.message });

  const ids = (conversations || []).map((item) => item.id);
  const buyerIds = [...new Set((conversations || []).map((item) => item.buyer_id).filter(Boolean))];
  const [{ data: buyers }, { data: messages }, { data: calls }] = await Promise.all([
    buyerIds.length ? supabaseAdmin.from('buyers').select('id, email, phone').in('id', buyerIds) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from('messages').select('*').in('conversation_id', ids).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from('call_sessions').select('*').in('conversation_id', ids).in('status', ['ringing', 'connected']).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const buyerById = Object.fromEntries((buyers || []).map((buyer) => [buyer.id, buyer]));
  const messagesByConversation = {};
  (messages || []).forEach((message) => { (messagesByConversation[message.conversation_id] ||= []).push(message); });

  return res.status(200).json({
    shops,
    calls: calls || [],
    orders: orders || [],
    conversations: (conversations || []).map((conversation) => ({
      ...conversation,
      buyer: buyerById[conversation.buyer_id] || null,
      messages: messagesByConversation[conversation.id] || [],
    })),
  });
}
