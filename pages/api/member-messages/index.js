import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

async function conversationForUser(supabase, id, userId) {
  const { data, error } = await supabase.from('member_conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || (data.member_one_id !== userId && data.member_two_id !== userId)) throw new Error('Conversation introuvable');
  return data;
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = assertSupabaseConfigured();
    if (req.method === 'GET') {
      const conversation = await conversationForUser(supabase, req.query.conversationId, user.id);
      const { data, error } = await supabase.from('member_messages').select('*').eq('conversation_id', conversation.id).order('created_at');
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { conversationId, content, messageType = 'text', mediaUrl, durationSeconds } = req.body || {};
      const conversation = await conversationForUser(supabase, conversationId, user.id);
      const partnerId = conversation.member_one_id === user.id ? conversation.member_two_id : conversation.member_one_id;
      const { data: blocks, error: blocksError } = await supabase.from('member_blocks').select('blocker_id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${user.id})`).limit(1);
      if (blocksError) throw blocksError;
      if (blocks?.length) throw new Error('Cette communication n’est pas disponible.');
      if (!['text', 'image', 'audio', 'video'].includes(messageType)) throw new Error('Type de message invalide');
      if (!String(content || '').trim() && !mediaUrl) throw new Error('Message vide');
      const { data, error } = await supabase.from('member_messages').insert({ conversation_id: conversation.id, sender_id: user.id, content: String(content || '').trim() || null, message_type: messageType, media_url: mediaUrl || null, duration_seconds: durationSeconds || null }).select().single();
      if (error) throw error;
      await supabase.from('member_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id);
      return res.status(201).json(data);
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}
