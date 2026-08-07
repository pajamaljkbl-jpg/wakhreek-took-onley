import { supabaseAdmin } from '../../../lib/supabase';

// GET  -> réservé admin : liste les paiements (ex: ?status=pending) à valider
// POST -> une boutique ou un acheteur soumet une preuve de paiement
//         (capture d'écran déjà uploadée via /api/uploads -> proof_image_url)
export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    const { status } = req.query;
    let query = supabaseAdmin
      .from('payments')
      .select('*, shops(name), conversations(id)')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { type, shopId, conversationId, proofImageUrl } = req.body;
    // type: 'subscription' (6000F) ou 'entry_fee' (10F)

    if (type !== 'subscription' && type !== 'entry_fee') {
      return res.status(400).json({ error: 'type invalide' });
    }
    if (!proofImageUrl) {
      return res.status(400).json({ error: 'La capture de preuve de paiement est obligatoire' });
    }

    const amount = type === 'subscription' ? 6000 : 10;

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        type,
        amount,
        proof_image_url: proofImageUrl,
        shop_id: type === 'subscription' ? shopId : null,
        conversation_id: type === 'entry_fee' ? conversationId : null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Rien n'est débloqué ici — ça reste "pending" jusqu'à validation
    // manuelle par l'admin via /api/payments/[id]/review.
    return res.status(201).json(data);
  }

  return res.status(405).end();
}
