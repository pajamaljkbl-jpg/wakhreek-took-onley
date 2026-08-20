export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  return res.status(200).json({
    adminWaveNumber: process.env.ADMIN_WAVE_NUMBER || '',
    adminWaveQrUrl: process.env.ADMIN_WAVE_QR_URL || '',
    // Clés PUBLIQUES uniquement (elles sont déjà dans le bundle du site,
    // donc aucune fuite ici) — utilisées par l'application Windows pour
    // rafraîchir la session et détecter les appels entrants.
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wakhreek.com').replace(/\/$/, ''),
  });
}
