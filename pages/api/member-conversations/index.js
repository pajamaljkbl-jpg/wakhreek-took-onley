import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

function pairKey(a, b) { return [a, b].sort().join(':'); }

async function assertAllowed(supabase, one, two) {
  const { data, error } = await supabase.from('member_blocks').select('blocker_id, blocked_id')
    .or(`and(blocker_id.eq.${one},blocked_id.eq.${two}),and(blocker_id.eq.${two},blocked_id.eq.${one})`).limit(1);
  if (error) throw error;
  if (data?.length) throw new Error('Cette communication n’est pas disponible.');
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = assertSupabaseConfigured();
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('member_conversations').select('*')
        .or(`member_one_id.eq.${user.id},member_two_id.eq.${user.id}`).order('updated_at', { ascending: false });
      if (error) throw error;
      const partnerIds = (data || []).map((row) => row.member_one_id === user.id ? row.member_two_id : row.member_one_id);
      const { data: profiles } = partnerIds.length ? await supabase.from('profiles').select('id, full_name, phone, avatar_url').in('id', partnerIds) : { data: [] };
      const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      return res.status(200).json((data || []).map((row) => ({ ...row, partner: byId[row.member_one_id === user.id ? row.member_two_id : row.member_one_id] || null })));
    }
    if (req.method === 'POST') {
      const memberId = req.body?.memberId;
      if (!memberId || memberId === user.id) throw new Error('Membre invalide');
      const { data: target, error: targetError } = await supabase.from('profiles').select('id, terms_accepted_at').eq('id', memberId).maybeSingle();
      if (targetError) throw targetError;
      if (!target?.id) throw new Error('Ce membre doit avoir un compte Wakh Reek.');
      await assertAllowed(supabase, user.id, memberId);
      const key = pairKey(user.id, memberId);
      const { data: existing } = await supabase.from('member_conversations').select('*').eq('pair_key', key).maybeSingle();
      if (existing) return res.status(200).json(existing);
      const { data, error } = await supabase.from('member_conversations').insert({ member_one_id: user.id, member_two_id: memberId, pair_key: key }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}
