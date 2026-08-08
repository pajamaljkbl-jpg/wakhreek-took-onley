export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  return res.status(200).json({
    adminWaveNumber: process.env.ADMIN_WAVE_NUMBER || '',
    adminWaveQrUrl: process.env.ADMIN_WAVE_QR_URL || '',
  });
}
