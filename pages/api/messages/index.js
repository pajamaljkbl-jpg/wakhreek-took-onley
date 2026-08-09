import { supabaseAdmin } from '../../../lib/supabase';

// Remplace le chat simulé (setTimeout + réponses automatiques) par une vraie
// messagerie stockée en base — les deux parties (acheteur/boutique) lisent
// et écrivent dans la même conversation.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ error: 'conversationId requis' });

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { conversationId, sender, content, type = 'text', mediaUrl, durationSeconds } = req.body;
    if (!conversationId || !sender || (!content && !mediaUrl)) {
      return res.status(400).json({ error: 'conversationId, sender et contenu requis' });
    }
    if (!['text', 'image', 'audio'].includes(type)) return res.status(400).json({ error: 'Type de message invalide' });

    // On vérifie que le "10F" d'entrée a bien été payé avant d'autoriser
    // l'envoi de messages — sinon on recrée la faille du bouton "j'ai payé".
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('entry_fee_paid')
      .eq('id', conversationId)
      .single();

    if (!conv?.entry_fee_paid) {
      return res.status(403).json({ error: 'Paiement des 10F requis avant de pouvoir écrire' });
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({ conversation_id: conversationId, sender, content: content || '', message_type: type, media_url: mediaUrl || null, duration_seconds: Number(durationSeconds) || null })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).end();
}
