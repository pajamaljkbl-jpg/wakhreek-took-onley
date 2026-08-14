import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';

async function authorizedConversation(conversationId, userId) {
  const { data: memberConversation, error: memberError } = await supabaseAdmin
    .from('member_conversations')
    .select('id, member_one_id, member_two_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (memberConversation && [memberConversation.member_one_id, memberConversation.member_two_id].includes(userId)) {
    return { type: 'member', data: memberConversation };
  }

  const { data: legacyConversation, error: legacyError } = await supabaseAdmin
    .from('conversations')
    .select('id, entry_fee_paid')
    .eq('id', conversationId)
    .maybeSingle();
  if (legacyError) throw legacyError;
  if (legacyConversation?.entry_fee_paid) return { type: 'legacy', data: legacyConversation };
  return null;
}

export default async function handler(req, res) {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
    const user = await requireUser(req);

    if (req.method === 'GET') {
      const { conversationId } = req.query;
      if (!conversationId) return res.status(400).json({ error: 'conversationId requis' });
      if (!(await authorizedConversation(conversationId, user.id))) return res.status(403).json({ error: 'Conversation non autorisée' });
      const { data, error } = await supabaseAdmin
        .from('call_sessions')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json(data || null);
    }

    if (req.method !== 'POST') return res.status(405).end();
    const { action, conversationId, callId, callType, signal, side } = req.body || {};
    if (!conversationId || !action) return res.status(400).json({ error: 'action et conversationId requis' });
    if (!(await authorizedConversation(conversationId, user.id))) return res.status(403).json({ error: 'Conversation non autorisée' });

    if (action === 'start') {
      if (!signal || !['audio', 'video'].includes(callType)) return res.status(400).json({ error: 'Signal ou type d’appel invalide' });
      await supabaseAdmin.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('conversation_id', conversationId).in('status', ['ringing', 'connected']);
      const { data, error } = await supabaseAdmin
        .from('call_sessions')
        .insert({ conversation_id: conversationId, call_type: callType, offer: signal, status: 'ringing' })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (!callId) return res.status(400).json({ error: 'callId requis' });
    const { data: call, error: callError } = await supabaseAdmin.from('call_sessions').select('*').eq('id', callId).eq('conversation_id', conversationId).maybeSingle();
    if (callError) throw callError;
    if (!call) return res.status(404).json({ error: 'Appel introuvable' });

    if (action === 'answer') {
      const { data, error } = await supabaseAdmin.from('call_sessions')
        .update({ answer: signal, status: 'connected', answered_at: new Date().toISOString() })
        .eq('id', call.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (action === 'candidate') {
      if (!signal || !['caller', 'callee'].includes(side)) return res.status(400).json({ error: 'Candidat invalide' });
      const field = side === 'caller' ? 'caller_candidates' : 'callee_candidates';
      const candidates = Array.isArray(call[field]) ? call[field] : [];
      const { error } = await supabaseAdmin.from('call_sessions').update({ [field]: [...candidates, signal] }).eq('id', call.id);
      if (error) throw error;
      return res.status(204).end();
    }

    if (action === 'end') {
      const { error } = await supabaseAdmin.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (error) {
    return jsonError(res, error);
  }
}
