import { assertSupabaseConfigured } from '../../../lib/supabase';

export default async function handler(req, res) {
  try {
    const supabaseAdmin = assertSupabaseConfigured();

    if (req.method === 'GET') {
      const { city, mine } = req.query;

      if (mine === '1') {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ error: 'Connexion requise' });
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !authData?.user) return res.status(401).json({ error: 'Session invalide' });

        const { data, error } = await supabaseAdmin
          .from('shops')
          .select('*, products(*)')
          .eq('owner_id', authData.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data || null);
      }

      let query = supabaseAdmin.from('shops').select('*, products(*)').order('created_at', { ascending: false });
      if (city && city !== 'Toutes Villes') query = query.eq('city', city);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { name, city, quartier, category, wave_number, om_number, qr_code_url, latitude, longitude, description, products } = req.body;

      if (!name || !city || !wave_number) {
        return res.status(400).json({ error: 'Nom, ville et numéro Wave sont obligatoires' });
      }

      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const { data: authData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null };
      const { data: shop, error } = await supabaseAdmin
        .from('shops')
        .insert({ name, city, quartier, category, wave_number, om_number, qr_code_url, latitude, longitude, description, owner_id: authData?.user?.id || null })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      if (Array.isArray(products) && products.length) {
        const validProducts = products
          .filter((p) => p && typeof p.name === 'string' && p.name.trim())
          .map((p) => ({ shop_id: shop.id, name: p.name.trim(), price: Number(p.price) || 0 }));
        if (validProducts.length) {
          const { error: productsError } = await supabaseAdmin.from('products').insert(validProducts);
          if (productsError) return res.status(500).json({ error: productsError.message });
        }
      }

      const ownerEmail = authData?.user?.email;
      const adminEmail = process.env.ADMIN_EMAIL;
      const emails = [];

      if (ownerEmail) {
        emails.push({
          to: ownerEmail,
          subject: 'Votre boutique Wakhreek est créée',
          text: `Bonjour,\n\nVotre boutique "${shop.name}" a bien été créée sur Wakhreek.\nElle reste en attente de validation après réception et approbation du paiement.\n\nMerci,\nWakhreek`,
        });
      }

      if (adminEmail) {
        emails.push({
          to: adminEmail,
          subject: 'Nouvelle boutique créée sur Wakhreek',
          text: `Nouvelle boutique : ${shop.name}\nVille : ${shop.city}\nTéléphone Wave : ${shop.wave_number}\n\nConnectez-vous à la لوحة الإدارة pour la gérer.`,
        });
      }

      if (process.env.RESEND_API_KEY && emails.length) {
        await Promise.allSettled(
          emails.map(async (email) => {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Wakhreek <noreply@wakhreek.com>',
                ...email,
              }),
            });
            if (!response.ok) throw new Error(await response.text());
          })
        );
      }
      return res.status(201).json(shop);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('Erreur API /api/shops:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur interne lors de la création de la boutique'
    });
  }
}
