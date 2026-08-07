import { supabaseAdmin } from '../../../lib/supabase';

// Reçoit une image en base64 depuis le front-end et l'envoie dans le bucket
// Supabase "public" (créé une fois manuellement dans le dashboard Supabase).
// Renvoie l'URL publique à stocker (qr_code_url d'une boutique, ou
// proof_image_url d'un paiement).
export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, folder } = req.body;
  // folder: 'qrcodes' ou 'proofs'
  if (!imageBase64 || !folder) {
    return res.status(400).json({ error: 'imageBase64 et folder sont obligatoires' });
  }

  try {
    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Format image invalide' });

    const contentType = matches[1];
    const extension = contentType.split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error } = await supabaseAdmin.storage.from('public').upload(filename, buffer, {
      contentType,
    });
    if (error) return res.status(500).json({ error: error.message });

    const { data } = supabaseAdmin.storage.from('public').getPublicUrl(filename);
    return res.status(200).json({ url: data.publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Échec de l'upload" });
  }
}
