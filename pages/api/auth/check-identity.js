import { assertSupabaseConfigured } from '../../../lib/supabase';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user) => normalizeEmail(user.email) === email);
    if (found) return found;
    if (users.length < 200) break;
  }
  return null;
}

async function phoneAlreadyUsed(supabase, normalizedPhone) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, phone')
    .not('phone', 'is', null);
  if (error) throw error;
  if ((profiles || []).some((profile) => normalizePhone(profile.phone) === normalizedPhone)) return true;

  // Older Wakhreek accounts may have the phone only in auth user_metadata.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (usersError) throw usersError;
    const users = data?.users || [];
    if (users.some((user) => normalizePhone(user.user_metadata?.phone) === normalizedPhone)) return true;
    if (users.length < 200) break;
  }
  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }

    const supabase = assertSupabaseConfigured();
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    if (phone.length < 8) return res.status(400).json({ error: 'Numéro de téléphone invalide.' });

    const [existingEmail, existingPhone] = await Promise.all([
      findAuthUserByEmail(supabase, email),
      phoneAlreadyUsed(supabase, phone),
    ]);

    if (existingEmail) return res.status(409).json({ field: 'email', error: 'Cette adresse e-mail est déjà utilisée par un compte Wakh Reek.' });
    if (existingPhone) return res.status(409).json({ field: 'phone', error: 'Ce numéro de téléphone est déjà utilisé par un compte Wakh Reek.' });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('check-identity:', error);
    return res.status(500).json({ error: error?.message || 'Impossible de vérifier le compte.' });
  }
}
