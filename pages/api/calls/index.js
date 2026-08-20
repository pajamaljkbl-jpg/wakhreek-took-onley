import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';
import { sendPushToUser, userIdFromEmail } from '../../../lib/push-server';

const MEMBER_CALL_TABLE = 'member_call_sessions';
const SHOP_CALL_TABLE = 'call_sessions';
const CALL_TIMEOUT_MS = 45_000;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wakhreek.com').replace(/\/$/, '');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function disableCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

function rejectWithLog(res, status, error, context = {}) {
  console.error('[CALLS_REJECT]', { status, error, ...context });
  return res.status(status).json({ error });
}

async function expireUnansweredCalls() {
  const cutoff = new Date(Date.now() - CALL_TIMEOUT_MS).toISOString();
  const endedAt = new Date().toISOString();

  // Termine les appels expirés ET récupère leurs données (une seule fois chacun,
  // grâce à la condition status='ringing' qui verrouille la ligne).
  const [{ data: memberCalls }, { data: shopCalls }] = await Promise.all([
    supabaseAdmin.from(MEMBER_CALL_TABLE).update({ status: 'ended', ended_at: endedAt }).eq('status', 'ringing').lt('created_at', cutoff).select(),
    supabaseAdmin.from(SHOP_CALL_TABLE).update({ status: 'ended', ended_at: endedAt }).eq('status', 'ringing').lt('created_at', cutoff).select(),
  ]);

  // Prévient l'appelé : "📞 Appel manqué de X".
  await Promise.allSettled([
    ...(memberCalls || []).map((call) => notifyMissedMemberCall(call)),
    ...(shopCalls || []).map((call) => notifyMissedShopCall(call)),
  ]);
}

async function callerName(callerId) {
  if (!callerId) return 'Un membre Wakh Reek';
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('full_name, phone')
    .eq('id', callerId)
    .maybeSingle();
  return data?.full_name || data?.phone || 'Un membre Wakh Reek';
}

async function notifyMissedMemberCall(call) {
  try {
    const { data: conv } = await supabaseAdmin
      .from('member_conversations')
      .select('member_one_id, member_two_id')
      .eq('id', call.conversation_id)
      .maybeSingle();
    if (!conv) return;
    const recipientId = conv.member_one_id === call.caller_id ? conv.member_two_id : conv.member_one_id;
    if (!recipientId) return;
    const name = await callerName(call.caller_id);
    await sendPushToUser(recipientId, {
      kind: 'missed_call',
      title: '📞 Appel manqué',
      body: `${name} a tenté de vous joindre`,
      caller: name,
      callType: call.call_type || 'audio',
      callId: call.id,
      tag: `wakhreek-missed-${call.id}`,
      url: `${SITE_URL}/membres`,
    });
  } catch (error) {
    console.error('[CALLS_MISSED_MEMBER]', error?.message || error);
  }
}

async function notifyMissedShopCall(call) {
  try {
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('buyer_id, shop_id')
      .eq('id', call.conversation_id)
      .maybeSingle();
    if (!conv) return;
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('owner_id')
      .eq('id', conv.shop_id)
      .maybeSingle();
    let recipientId = null;
    if (shop?.owner_id && shop.owner_id !== call.caller_id) {
      recipientId = shop.owner_id; // l'appelant est l'acheteur → prévient le vendeur
    } else if (shop?.owner_id && shop.owner_id === call.caller_id) {
      const { data: buyer } = await supabaseAdmin
        .from('buyers')
        .select('email')
        .eq('id', conv.buyer_id)
        .maybeSingle();
      recipientId = await userIdFromEmail(buyer?.email); // l'appelant est le vendeur → prévient l'acheteur
    }
    if (!recipientId) return;
    const name = await callerName(call.caller_id);
    await sendPushToUser(recipientId, {
      kind: 'missed_call',
      title: '📞 Appel manqué',
      body: `${name} a tenté de vous joindre`,
      caller: name,
      callType: call.call_type || 'audio',
      callId: call.id,
      tag: `wakhreek-missed-${call.id}`,
      url: `${SITE_URL}/vendeur`,
    });
  } catch (error) {
    console.error('[CALLS_MISSED_SHOP]', error?.message || error);
  }
}

async function resolveConversation(conversationId, user) {
  const { data: member, error: memberError } = await supabaseAdmin
    .from('member_conversations')
    .select('id, member_one_id, member_two_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (member && [member.member_one_id, member.member_two_id].includes(user.id)) {
    return { kind: 'member', table: MEMBER_CALL_TABLE, conversation: member };
  }

  const { data: shopConversation, error: shopError } = await supabaseAdmin
    .from('conversations')
    .select('id, buyer_id, shop_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shopConversation) return null;

  const { data: shop, error: ownerError } = await supabaseAdmin
    .from('shops')
    .select('id, owner_id')
    .eq('id', shopConversation.shop_id)
    .maybeSingle();
  if (ownerError) throw ownerError;
  if (shop?.owner_id === user.id) return { kind: 'shop', table: SHOP_CALL_TABLE, conversation: shopConversation };

  const { data: buyer, error: buyerError } = await supabaseAdmin
    .from('buyers')
    .select('id, email')
    .eq('id', shopConversation.buyer_id)
    .maybeSingle();
  if (buyerError) throw buyerError;
  if (buyer?.email && user.email && buyer.email.toLowerCase() === user.email.toLowerCase()) {
    return { kind: 'shop', table: SHOP_CALL_TABLE, conversation: shopConversation };
  }
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

async function enrichCaller(call) {
  if (!call?.caller_id) return call;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone, avatar_url')
    .eq('id', call.caller_id)
    .maybeSingle();
  return { ...call, caller: profile || null, server_now: new Date().toISOString() };
}

async function incomingForUser(user) {
  const { data: memberConversations, error: memberError } = await supabaseAdmin
    .from('member_conversations')
    .select('id, member_one_id, member_two_id')
    .or(`member_one_id.eq.${user.id},member_two_id.eq.${user.id}`);
  if (memberError) throw memberError;

  const memberIds = (memberConversations || []).map((row) => row.id);
  let memberCall = null;
  if (memberIds.length) {
    const { data, error } = await supabaseAdmin
      .from(MEMBER_CALL_TABLE)
      .select('*')
      .in('conversation_id', memberIds)
      .eq('status', 'ringing')
      .neq('caller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
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
    const { data, error } = await supabaseAdmin
      .from(SHOP_CALL_TABLE)
      .select('*')
      .in('conversation_id', shopConversationIds)
      .eq('status', 'ringing')
      .neq('caller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    shopCall = data || null;
  }

  const candidates = [
    memberCall && { ...memberCall, conversation_kind: 'member' },
    shopCall && { ...shopCall, conversation_kind: 'shop' }
  ].filter(Boolean);
  candidates.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return candidates[0] ? enrichCaller(candidates[0]) : null;
}

export default async function handler(req, res) {
  disableCache(res);
  console.error('[CALLS_REQUEST]', { method: req.method, query: req.query, hasAuth: Boolean(req.headers?.authorization) });
  try {
    if (!supabaseAdmin) return rejectWithLog(res, 503, 'Supabase non configuré.', { method: req.method, query: req.query });
    const user = await requireUser(req);
    console.error('[CALLS_USER]', { userId: user?.id, email: user?.email, method: req.method, query: req.query });
    await expireUnansweredCalls();

    if (req.method === 'GET') {
      const { conversationId, incoming } = req.query;
      if (String(incoming) === '1') {
        const incomingCall = await incomingForUser(user);
        console.error('[CALLS_INCOMING_OK]', { userId: user.id, found: Boolean(incomingCall), callId: incomingCall?.id || null });
        return res.status(200).json(incomingCall);
      }
      if (!conversationId) return rejectWithLog(res, 400, 'conversationId requis', { method: req.method, query: req.query, incoming });
      if (!isUuid(conversationId)) return rejectWithLog(res, 400, 'conversationId invalide', { conversationId });
      const access = await resolveConversation(conversationId, user);
      if (!access) return rejectWithLog(res, 403, 'Conversation non autorisée', { userId: user.id, conversationId });
      const { data, error } = await supabaseAdmin
        .from(access.table)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json(data ? { ...data, conversation_kind: access.kind, server_now: new Date().toISOString() } : null);
    }

    if (req.method !== 'POST') {
      console.error('[CALLS_REJECT]', { status: 405, error: 'Méthode non autorisée', method: req.method });
      return res.status(405).end();
    }

    const { action, conversationId, callId, callType, signal, side } = req.body || {};
    if (!conversationId || !action) return rejectWithLog(res, 400, 'action et conversationId requis', { action, conversationId });
    if (!isUuid(conversationId)) return rejectWithLog(res, 400, 'conversationId invalide', { action, conversationId });

    const access = await resolveConversation(conversationId, user);
    if (!access) return rejectWithLog(res, 403, 'Conversation non autorisée', { userId: user.id, conversationId, action });
    const table = access.table;

    if (action === 'start') {
      if (!signal || !['audio', 'video'].includes(callType)) return rejectWithLog(res, 400, 'Signal ou type d’appel invalide', { callType, hasSignal: Boolean(signal) });
      await supabaseAdmin
        .from(table)
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .in('status', ['ringing', 'connected']);

      const { data, error } = await supabaseAdmin
        .from(table)
        .insert({ conversation_id: conversationId, caller_id: user.id, call_type: callType, offer: signal, status: 'ringing' })
        .select()
        .single();
      if (error) throw error;

      const recipientId = await recipientFor(access, user);
      let push = { sent: 0, skipped: true };
      if (recipientId) {
        const label = user.email || 'Un membre Wakh Reek';
        push = await sendPushToUser(recipientId, {
          kind: 'call',
          title: callType === 'video' ? '🎥 Appel vidéo Wakh Reek' : '📞 Appel audio Wakh Reek',
          body: `${label} vous appelle`,
          caller: label,
          callType,
          callId: data.id,
          tag: `wakhreek-call-${data.id}`,
          timeoutMs: CALL_TIMEOUT_MS,
          url: `${SITE_URL}/appel?conversationId=${encodeURIComponent(conversationId)}`
        });
      }
      console.error('[CALLS_START_RESULT]', { callId: data.id, recipientId, push });
      return res.status(201).json({ ...data, conversation_kind: access.kind, push, server_now: new Date().toISOString() });
    }

    if (!callId) return rejectWithLog(res, 400, 'callId requis', { action, conversationId });
    if (!isUuid(callId)) return rejectWithLog(res, 400, 'callId invalide', { action, callId });
    const { data: call, error: callError } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', callId)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (callError) throw callError;
    if (!call) return rejectWithLog(res, 404, 'Appel introuvable', { callId, conversationId });
    if (call.status === 'ended' && action !== 'end') return rejectWithLog(res, 410, 'Cet appel est terminé.', { callId, action });

    if (action === 'answer') {
      if (!signal) return rejectWithLog(res, 400, 'Réponse invalide', { callId });
      if (call.caller_id === user.id) return rejectWithLog(res, 400, 'Le correspondant doit répondre à cet appel', { callId, userId: user.id });
      const { data, error } = await supabaseAdmin
        .from(table)
        .update({ answer: signal, status: 'connected', answered_at: new Date().toISOString() })
        .eq('id', call.id)
        .eq('status', 'ringing')
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ ...data, conversation_kind: access.kind, server_now: new Date().toISOString() });
    }

    if (action === 'candidate') {
      if (!signal || !['caller', 'callee'].includes(side)) return rejectWithLog(res, 400, 'Candidat invalide', { callId, side, hasSignal: Boolean(signal) });
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

    return rejectWithLog(res, 400, 'Action inconnue', { action, conversationId, callId });
  } catch (error) {
    console.error('[CALLS_EXCEPTION]', {
      method: req.method,
      query: req.query,
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    return jsonError(res, error);
  }
}
