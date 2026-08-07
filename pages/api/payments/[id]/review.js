import { supabaseAdmin } from '../../../../lib/supabase';

// Réservé à l'admin (toi) — appelé depuis un tableau de bord protégé.
// action: 'approve' | 'reject'
// À l'approbation : active l'abonnement de la boutique (30 jours) OU
// débloque l'accès au chat, selon le type de paiement.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { id } = req.query;
  const { action } = req.body;
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'action invalide' });
  }

  const { data: payment, error: fetchError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError || !payment) return res.status(404).json({ error: 'Paiement introuvable' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (updateError) return res.status(500).json({ error: updateError.message });

  if (action === 'approve') {
    if (payment.type === 'subscription' && payment.shop_id) {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      await supabaseAdmin
        .from('shops')
        .update({ subscription_active: true, subscription_expires_at: expires.toISOString() })
        .eq('id', payment.shop_id);
    }
    if (payment.type === 'entry_fee' && payment.conversation_id) {
      await supabaseAdmin
        .from('conversations')
        .update({ entry_fee_paid: true })
        .eq('id', payment.conversation_id);
    }
  }

  return res.status(200).json({ status: newStatus });
}
