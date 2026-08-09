import { supabaseAdmin } from '../../../lib/supabase';

async function paidConversation(conversationId) {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id, entry_fee_paid')
    .eq('id', conversationId)
    .maybeSingle();
  return data?.entry_fee_paid ? data : null;
}

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

  if (req.method === 'GET') {
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ error: 'conversationId requis' });
    if (!(await paidConversation(conversationId))) return res.status(403).json({ error: 'Conversation non autorisée' });
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || null);
  }

  if (req.method !== 'POST') return res.status(405).end();
  const { action, conversationId, callId, callType, signal, side } = req.body || {};
  if (!conversationId || !action) return res.status(400).json({ error: 'action et conversationId requis' });
  if (!(await paidConversation(conversationId))) return res.status(403).json({ error: 'Paiement requis avant l’appel' });

  if (action === 'start') {
    if (!signal || !['audio', 'video'].includes(callType)) return res.status(400).json({ error: 'Signal ou type d’appel invalide' });
    await supabaseAdmin.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('conversation_id', conversationId).in('status', ['ringing', 'connected']);
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .insert({ conversation_id: conversationId, call_type: callType, offer: signal })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (!callId) return res.status(400).json({ error: 'callId requis' });
  const { data: call, error: callError } = await supabaseAdmin.from('call_sessions').select('*').eq('id', callId).eq('conversation_id', conversationId).maybeSingle();
  if (callError || !call) return res.status(404).json({ error: 'Appel introuvable' });

  if (action === 'answer') {
    const { data, error } = await supabaseAdmin.from('call_sessions')
      .update({ answer: signal, status: 'connected', answered_at: new Date().toISOString() })
      .eq('id', call.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (action === 'candidate') {
    if (!signal || !['caller', 'callee'].includes(side)) return res.status(400).json({ error: 'Candidat invalide' });
    const field = side === 'caller' ? 'caller_candidates' : 'callee_candidates';
    const candidates = Array.isArray(call[field]) ? call[field] : [];
    const { error } = await supabaseAdmin.from('call_sessions').update({ [field]: [...candidates, signal] }).eq('id', call.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  if (action === 'end') {
    const { error } = await supabaseAdmin.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(400).json({ error: 'Action inconnue' });
}
