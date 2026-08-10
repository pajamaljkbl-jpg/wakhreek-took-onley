import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    const { targetUserId, targetType, targetId, reason, details } = req.body || {};
    if (!['member', 'message', 'story', 'shop', 'product'].includes(targetType) || !String(reason || '').trim()) throw new Error('Signalement incomplet');
    const supabase = assertSupabaseConfigured();
    const { data, error } = await supabase.from('member_reports').insert({ reporter_id: user.id, target_user_id: targetUserId || null, target_type: targetType, target_id: targetId || null, reason: String(reason).slice(0, 160), details: String(details || '').slice(0, 1000) }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) { return jsonError(res, error); }
}
