import { supabaseAdmin } from '../../../lib/supabase';

// Messagerie gratuite entre acheteur et boutique : texte, image, audio et vidéo.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ error: 'conversationId requis' });
    const { data, error } = await supabaseAdmin.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { conversationId, sender, content, type = 'text', mediaUrl, durationSeconds } = req.body;
    if (!conversationId || !sender || (!content && !mediaUrl)) return res.status(400).json({ error: 'conversationId, sender et contenu requis' });
    if (!['text', 'image', 'audio', 'video'].includes(type)) return res.status(400).json({ error: 'Type de message invalide' });

    const { data: conv, error: convError } = await supabaseAdmin.from('conversations').select('id, shop_id').eq('id', conversationId).maybeSingle();
    if (convError) return res.status(500).json({ error: convError.message });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    if (sender === 'shop') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const { data: authData, error: authError } = token ? await supabaseAdmin.auth.getUser(token) : { data: null, error: true };
      if (authError || !authData?.user) return res.status(401).json({ error: 'Connexion vendeur requise' });
      const { data: shop } = await supabaseAdmin.from('shops').select('id').eq('id', conv.shop_id).eq('owner_id', authData.user.id).maybeSingle();
      if (!shop) return res.status(403).json({ error: 'Cette boutique ne t’appartient pas' });
    }

    const { data, error } = await supabaseAdmin.from('messages').insert({ conversation_id: conversationId, sender, content: content || '', message_type: type, media_url: mediaUrl || null, duration_seconds: Number(durationSeconds) || null }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }
  return res.status(405).end();
}
