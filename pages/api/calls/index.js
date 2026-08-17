import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';
import { sendPushToUser, userIdFromEmail } from '../../../lib/push-server';

const MEMBER_CALL_TABLE = 'member_call_sessions';
const SHOP_CALL_TABLE = 'call_sessions';
const CALL_TIMEOUT_MS = 30_000;

async function expireUnansweredCalls() {
  const cutoff = new Date(Date.now() - CALL_TIMEOUT_MS).toISOString();
  const endedAt = new Date().toISOString();
  await Promise.all([
    supabaseAdmin.from(MEMBER_CALL_TABLE).update({ status: 'ended', ended_at: endedAt }).eq('status', 'ringing').lt('created_at', cutoff),
    supabaseAdmin.from(SHOP_CALL_TABLE).update({ status: 'ended', ended_at: endedAt }).eq('status', 'ringing').lt('created_at', cutoff)
  ]);
}

async function resolveConversation(conversationId, user) {
  const { data: member, error: memberError } = await supabaseAdmin.from('member_conversations').select('id, member_one_id, member_two_id').eq('id', conversationId).maybeSingle();
  if (memberError) throw memberError;
  if (member && [member.member_one_id, member.member_two_id].includes(user.id)) return { kind: 'member', table: MEMBER_CALL_TABLE, conversation: member };

  const { data: shopConversation, error: shopError } = await supabaseAdmin.from('conversations').select('id, buyer_id, shop_id').eq('id', conversationId).maybeSingle();
  if (shopError) throw shopError;
  if (!shopConversation) return null;
  const { data: shop, error: ownerError } = await supabaseAdmin.from('shops').select('id, owner_id').eq('id', shopConversation.shop_id).maybeSingle();
  if (ownerError) throw ownerError;
  if (shop?.owner_id === user.id) return { kind: 'shop', table: SHOP_CALL_TABLE, conversation: shopConversation };
  const { data: buyer, error: buyerError } = await supabaseAdmin.from('buyers').select('id, email').eq('id', shopConversation.buyer_id).maybeSingle();
  if (buyerError) throw buyerError;
  if (buyer?.email && user.email && buyer.email.toLowerCase() === user.email.toLowerCase()) return { kind: 'shop', table: SHOP_CALL_TABLE, conversation: shopConversation };
  return null;
}

async function recipientFor(access, caller) {
  if (access.kind === 'member') {
    const c = access.conversation;
    return c.member_one_id === caller.id ? c.member_two_id : c.member_one_id;
  }
  const c = access.conversation;
  const { data: shop } = await supabaseAdmin.from('shops').select('owner_id').eq('id', c.shop_id).maybeSingle();
  if (shop?.owner_id === caller.id) {
    const { data: buyer } = await supabaseAdmin.from('buyers').select('email').eq('id', c.buyer_id).maybeSingle();
    return userIdFromEmail(buyer?.email);
  }
  return shop?.owner_id || null;
}

async function incomingForUser(user) {
  const { data: memberConversations, error: memberError } = await supabaseAdmin.from('member_conversations').select('id, member_one_id, member_two_id').or(`member_one_id.eq.${user.id},member_two_id.eq.${user.id}`);
  if (memberError) throw memberError;
  const memberIds = (memberConversations || []).map((row) => row.id);
  let memberCall = null;
  if (memberIds.length) {
    const { data, error } = await supabaseAdmin.from(MEMBER_CALL_TABLE).select('*').in('conversation_id', memberIds).eq('status', 'ringing').neq('caller_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    memberCall = data || null;
  }
  const { data: ownedShops, error: ownedError } = await supabaseAdmin.from('shops').select('id').eq('owner_id', user.id);
  if (ownedError) throw ownedError;
  const ownedIds = (ownedShops || []).map((row) => row.id);
  let shopConversationIds = [];
  if (ownedIds.length) {
    const { data, error } = await supabaseAdmin.from('conversations').select('id').in('shop_id', ownedIds);
    if (error) throw error;
    shopConversationIds.push(...(data || []).map((row) => row.id));
  }
  if (user.email) {
    const { data: buyers, error: buyerError } = await supabaseAdmin.from('buyers').select('id').ilike('email', user.email);
    if (buyerError) throw buyerError;
    const buyerIds = (buyers || []).map((row) => row.id);
    if (buyerIds.length) {
      const { data, error } = await supabaseAdmin.from('conversations').select('id').in('buyer_id', buyerIds);
      if (error) throw error;
      shopConversationIds.push(...(data || []).map((row) => row.id));
    }
  }
  shopConversationIds = [...new Set(shopConversationIds)];
  let shopCall = null;
  if (shopConversationIds.length) {
    const { data, error } = await supabaseAdmin.from(SHOP_CALL_TABLE).select('*').in('conversation_id', shopConversationIds).eq('status', 'ringing').neq('caller_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    shopCall = data || null;
  }
  const candidates = [memberCall && { ...memberCall, conversation_kind: 'member' }, shopCall && { ...shopCall, conversation_kind: 'shop' }].filter(Boolean);
  candidates.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return candidates[0] || null;
}

export default async function handler(req, res) {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
    const user = await requireUser(req);
    await expireUnansweredCalls();

    if (req.method === 'GET') {
      const { conversationId, incoming } = req.query;
      if (incoming === '1') return res.status(200).json(await incomingForUser(user));
      if (!conversationId) return res.status(400).json({ error: 'conversationId requis' });
      const access = await resolveConversation(conversationId, user);
      if (!access) return res.status(403).json({ error: 'Conversation non autorisée' });
      const { data, error } = await supabaseAdmin.from(access.table).select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return res.status(200).json(data ? { ...data, conversation_kind: access.kind } : null);
    }
    if (req.method !== 'POST') return res.status(405).end();
    const { action, conversationId, callId, callType, signal, side } = req.body || {};
    if (!conversationId || !action) return res.status(400).json({ error: 'action et conversationId requis' });
    const access = await resolveConversation(conversationId, user);
    if (!access) return res.status(403).json({ error: 'Conversation non autorisée' });
    const table = access.table;
    if (action === 'start') {
      if (!signal || !['audio', 'video'].includes(callType)) return res.status(400).json({ error: 'Signal ou type d’appel invalide' });
      await supabaseAdmin.from(table).update({ status: 'ended', ended_at: new Date().toISOString() }).eq('conversation_id', conversationId).in('status', ['ringing', 'connected']);
      const { data, error } = await supabaseAdmin.from(table).insert({ conversation_id: conversationId, caller_id: user.id, call_type: callType, offer: signal, status: 'ringing' }).select().single();
      if (error) throw error;
      const recipientId = await recipientFor(access, user);
      if (recipientId) {
        const label = user.email || 'Un membre Wakh Reek';
        sendPushToUser(recipientId, {
          kind: 'call',
          title: callType === 'video' ? '🎥 Appel vidéo Wakh Reek' : '📞 Appel audio Wakh Reek',
          body: `${label} vous appelle`,
          caller: label,
          callType,
          callId: data.id,
          tag: `wakhreek-call-${data.id}`,
          timeoutMs: CALL_TIMEOUT_MS,
          url: `https://www.wakhreek.com/appel?conversationId=${encodeURIComponent(conversationId)}`
        }).catch((e) => console.error('Push appel:', e));
      }
      return res.status(201).json({ ...data, conversation_kind: access.kind });
    }
    if (!callId) return res.status(400).json({ error: 'callId requis' });
    const { data: call, error: callError } = await supabaseAdmin.from(table).select('*').eq('id', callId).eq('conversation_id', conversationId).maybeSingle();
    if (callError) throw callError;
    if (!call) return res.status(404).json({ error: 'Appel introuvable' });
    if (call.status === 'ended' && action !== 'end') return res.status(410).json({ error: 'Cet appel est terminé.' });
    if (action === 'answer') {
      if (!signal) return res.status(400).json({ error: 'Réponse invalide' });
      if (call.caller_id === user.id) return res.status(400).json({ error: 'Le correspondant doit répondre à cet appel' });
      const { data, error } = await supabaseAdmin.from(table).update({ answer: signal, status: 'connected', answered_at: new Date().toISOString() }).eq('id', call.id).eq('status', 'ringing').select().single();
      if (error) throw error;
      return res.status(200).json({ ...data, conversation_kind: access.kind });
    }
    if (action === 'candidate') {
      if (!signal || !['caller', 'callee'].includes(side)) return res.status(400).json({ error: 'Candidat invalide' });
      const field = side === 'caller' ? 'caller_candidates' : 'callee_candidates';
      const candidates = Array.isArray(call[field]) ? call[field] : [];
      const { error } = await supabaseAdmin.from(table).update({ [field]: [...candidates, signal] }).eq('id', call.id);
      if (error) throw error;
      return res.status(204).end();
    }
    if (action === 'end') {
      const { error } = await supabaseAdmin.from(table).update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
      if (error) throw error;
      return res.status(204).end();
    }
    return res.status(400).json({ error: 'Action inconnue' });
  } catch (error) { return jsonError(res, error); }
}
