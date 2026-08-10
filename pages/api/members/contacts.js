import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = assertSupabaseConfigured();
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('member_contacts').select('member_id, created_at').eq('owner_id', user.id);
      if (error) throw error;
      const ids = (data || []).map((row) => row.member_id);
      if (!ids.length) return res.status(200).json([]);
      const { data: people, error: peopleError } = await supabase.from('profiles').select('id, full_name, phone, role').in('id', ids);
      if (peopleError) throw peopleError;
      return res.status(200).json(people || []);
    }
    const memberId = req.body?.memberId;
    if (!memberId || memberId === user.id) throw new Error('Membre invalide');
    if (req.method === 'POST') {
      const { error } = await supabase.from('member_contacts').upsert({ owner_id: user.id, member_id: memberId }, { onConflict: 'owner_id,member_id' });
      if (error) throw error;
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { error } = await supabase.from('member_contacts').delete().eq('owner_id', user.id).eq('member_id', memberId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE'); return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}
