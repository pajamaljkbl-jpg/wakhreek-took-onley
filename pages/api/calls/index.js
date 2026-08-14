import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';

const CALL_TABLE = 'member_call_sessions';

async function authorizedConversation(conversationId, userId) {
  const { data, error } = await supabaseAdmin
    .from('member_conversations')
    .select('id, member_one_id, member_two_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data || ![data.member_one_id, data.member_two_id].includes(userId)) return null;
  return data;
}

export default async function handler(req, res) {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
    const user = await requireUser(req);

    if (req.method === 'GET') {
      const { conversationId, incoming } = req.query;

      if (incoming === '1') {
        const { data: conversations, error: convError } = await supabaseAdmin
          .from('member_conversations')
          .select('id, member_one_id, member_two_id')
          .or(`member_one_id.eq.${user.id},member_two_id.eq.${user.id}`);
        if (convError) throw convError;
        const ids = (conversations || []).map((row) => row.id);
        if (!ids.length) return res.status(200).json(null);

        const { data: ringing, error: ringingError } = await supabaseAdmin
          .from(CALL_TABLE)
          .select('*')
          .in('conversation_id', ids)
          .eq('status', 'ringing')
          .neq('caller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ringingError) throw ringingError;
        if (!ringing) return res.status(200).json(null);

        const conv = (conversations || []).find((row) => row.id === ringing.conversation_id);
        const callerId = ringing.caller_id || (conv?.member_one_id === user.id ? conv?.member_two_id : conv?.member_one_id);
        let caller = null;
        if (callerId) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, phone, avatar_url')
            .eq('id', callerId)
            .maybeSingle();
          caller = profile || null;
        }
        return res.status(200).json({ ...ringing, caller });
      }

      if (!conversationId) return res.status(400).json({ error: 'conversationId requis' });
      if (!(await authorizedConversation(conversationId, user.id))) return res.status(403).json({ error: 'Conversation non autorisée' });
      const { data, error } = await supabaseAdmin
        .from(CALL_TABLE)
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
      await supabaseAdmin.from(CALL_TABLE)
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .in('status', ['ringing', 'connected']);
      const { data, error } = await supabaseAdmin
        .from(CALL_TABLE)
        .insert({ conversation_id: conversationId, caller_id: user.id, call_type: callType, offer: signal, status: 'ringing' })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (!callId) return res.status(400).json({ error: 'callId requis' });
    const { data: call, error: callError } = await supabaseAdmin.from(CALL_TABLE).select('*').eq('id', callId).eq('conversation_id', conversationId).maybeSingle();
    if (callError) throw callError;
    if (!call) return res.status(404).json({ error: 'Appel introuvable' });

    if (action === 'answer') {
      if (!signal) return res.status(400).json({ error: 'Réponse invalide' });
      if (call.caller_id === user.id) return res.status(400).json({ error: 'Le correspondant doit répondre à cet appel' });
      const { data, error } = await supabaseAdmin.from(CALL_TABLE)
        .update({ answer: signal, status: 'connected', answered_at: new Date().toISOString() })
        .eq('id', call.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (action === 'candidate') {
      if (!signal || !['caller', 'callee'].includes(side)) return res.status(400).json({ error: 'Candidat invalide' });
      const field = side === 'caller' ? 'caller_candidates' : 'callee_candidates';
      const candidates = Array.isArray(call[field]) ? call[field] : [];
      const { error } = await supabaseAdmin.from(CALL_TABLE).update({ [field]: [...candidates, signal] }).eq('id', call.id);
      if (error) throw error;
      return res.status(204).end();
    }

    if (action === 'end') {
      const { error } = await supabaseAdmin.from(CALL_TABLE).update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (error) {
    return jsonError(res, error);
  }
}
