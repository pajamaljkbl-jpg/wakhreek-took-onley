import { supabaseAdmin } from '../../../lib/supabase';
import crypto from 'crypto';

// Les images sont envoyées au Storage Supabase dans le bucket public.
// Le navigateur n'a jamais accès à la clé service_role.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

const BUCKET = 'wakhreek-images';
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'video/webm',
  'video/mp4',
  'video/quicktime',
]);

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

function safeFolder(value) {
  if (typeof value !== 'string' || !value.trim()) return 'uploads';
  // Empêche ../ et les chemins absolus.
  const cleaned = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!cleaned || cleaned.includes('..') || !/^[a-zA-Z0-9/_-]+$/.test(cleaned)) {
    return 'uploads';
  }
  return cleaned;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { imageBase64, fileBase64, folder } = req.body || {};
    const source = fileBase64 || imageBase64;

    if (!source || typeof source !== 'string') {
      return res.status(400).json({ error: 'Fichier obligatoire' });
    }

    // Accepte uniquement un Data URL image, audio ou courte vidéo.
    const match = source.match(
      /^data:((?:image\/(?:jpeg|png|webp|gif)|audio\/(?:webm|ogg|mpeg|mp4)|video\/(?:webm|mp4|quicktime)));base64,([A-Za-z0-9+/=\s]+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: 'Format invalide. Image, audio ou vidéo WebM/MP4 courte uniquement.',
      });
    }

    const contentType = match[1];
    const base64 = match[2].replace(/\s/g, '');
    const buffer = Buffer.from(base64, 'base64');

    if (!buffer.length) {
      return res.status(400).json({ error: 'Fichier vide' });
    }

    // Limite applicative : compatible avec le traitement Vercel par Data URL.
    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Fichier trop volumineux (maximum 4,5 Mo)' });
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Type de fichier non autorisé' });
    }

    const extension = EXTENSIONS[contentType];
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const path = `${safeFolder(folder)}/${filename}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);
      return res.status(500).json({
        error: 'Impossible d’enregistrer le fichier dans Supabase Storage',
      });
    }

    const { data } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      return res.status(500).json({ error: 'URL publique impossible à générer' });
    }

    return res.status(201).json({
      url: data.publicUrl,
      path,
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return res.status(500).json({ error: 'Erreur serveur pendant l’upload' });
  }
}
