import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = assertSupabaseConfigured();

    if (req.method === 'GET') {
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return res.status(200).json({ ...profile, email: user.email });
    }

    if (req.method === 'PATCH') {
      const { fullName, phone, avatarUrl, acceptedTerms, termsVersion = '2026-08-09' } = req.body || {};
      if (phone && phone.replace(/\D/g, '').length < 8) throw new Error('Numéro de téléphone invalide');
      const payload = {};
      if (typeof fullName === 'string') payload.full_name = fullName.trim();
      if (typeof phone === 'string') payload.phone = phone.trim();
      if (typeof avatarUrl === 'string') payload.avatar_url = avatarUrl.trim();
      if (acceptedTerms === true) { payload.terms_accepted_at = new Date().toISOString(); payload.terms_version = termsVersion; }
      const { data, error } = await supabase.from('profiles').upsert({ id: user.id, ...payload }, { onConflict: 'id' }).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}
