import { assertSupabaseConfigured } from '../../../../lib/supabase';
import { jsonError, requireUser } from '../../../../lib/require-user';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    const q = String(req.query.q || '').trim();
    if (q.length < 3) return res.status(200).json([]);
    const supabase = assertSupabaseConfigured();
    const { data, error } = await supabase.from('profiles').select('id, full_name, phone, role, created_at')
      .or(`phone.ilike.%${q.replace(/[%_,()]/g, '')}%,full_name.ilike.%${q.replace(/[%_,()]/g, '')}%`).neq('id', user.id).limit(20);
    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error) { return jsonError(res, error); }
}
