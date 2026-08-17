import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

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
      const normalizedPhone = normalizePhone(phone);
      if (phone && normalizedPhone.length < 8) throw new Error('Numéro de téléphone invalide');

      if (phone) {
        const { data: profiles, error: phoneError } = await supabase.from('profiles').select('id, phone').neq('id', user.id).not('phone', 'is', null);
        if (phoneError) throw phoneError;
        const duplicate = (profiles || []).some((profile) => normalizePhone(profile.phone) === normalizedPhone);
        if (duplicate) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un compte Wakh Reek.' });
      }

      const payload = {};
      if (typeof fullName === 'string') payload.full_name = fullName.trim();
      if (typeof phone === 'string') payload.phone = phone.trim();
      if (typeof avatarUrl === 'string') payload.avatar_url = avatarUrl.trim();
      if (acceptedTerms === true) { payload.terms_accepted_at = new Date().toISOString(); payload.terms_version = termsVersion; }
      const { data, error } = await supabase.from('profiles').upsert({ id: user.id, ...payload }, { onConflict: 'id' }).select().single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un compte Wakh Reek.' });
        throw error;
      }
      return res.status(200).json(data);
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}
