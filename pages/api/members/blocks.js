import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = assertSupabaseConfigured();
    const memberId = req.body?.memberId;
    if (!memberId || memberId === user.id) throw new Error('Membre invalide');
    if (req.method === 'POST') {
      const { error } = await supabase.from('member_blocks').upsert({ blocker_id: user.id, blocked_id: memberId }, { onConflict: 'blocker_id,blocked_id' });
      if (error) throw error;
      await supabase.from('member_contacts').delete().eq('owner_id', user.id).eq('member_id', memberId);
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { error } = await supabase.from('member_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', memberId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'POST, DELETE'); return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}
