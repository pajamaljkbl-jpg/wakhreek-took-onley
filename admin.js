import { useState } from 'react';

const BLUE = '#019EE5';
export default function Admin() {
  const [secret, setSecret] = useState('');
  const [payments, setPayments] = useState([]);
  const [shops, setShops] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  async function load() {
    setLoading(true); setError(''); setNotice('');
    try {
      const headers = { 'x-admin-secret': secret };
      const [paymentsRes, shopsRes] = await Promise.all([
        fetch('/api/payments?status=pending', { headers }),
        fetch('/api/admin/shops', { headers }),
      ]);
      const [paymentsData, shopsData] = await Promise.all([paymentsRes.json(), shopsRes.json()]);
      if (!paymentsRes.ok) throw new Error(paymentsData.error || 'Accès refusé');
      if (!shopsRes.ok) throw new Error(shopsData.error || 'Accès refusé');
      setPayments(paymentsData);
      setShops(shopsData);
      setAuthenticated(true);
    } catch (err) {
      setAuthenticated(false);
      setError(err.message || 'Accès refusé');
    } finally {
      setLoading(false);
    }
  }

  async function review(id, action) {
    const res = await fetch(`/api/payments/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret }, body: JSON.stringify({ action }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Validation impossible');
    setPayments((items) => items.filter((p) => p.id !== id));
    setNotice(action === 'approve' ? 'Paiement approuvé.' : 'Paiement rejeté.');
  }

  async function updateShop(shopId, action) {
    setError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ shopId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mise à jour impossible');
      setShops((items) => items.map((shop) => shop.id === shopId ? data.shop : shop));
      setNotice(action === 'deactivate'
        ? 'Boutique désactivée.'
        : 'Boutique activée gratuitement sans date d’expiration.');
    } catch (err) {
      setError(err.message || 'Mise à jour impossible');
    }
  }

  return <main style={{ minHeight: '100vh', background: '#f5f7fa', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' }}>
    <section style={{ maxWidth: 760, margin: '20px auto' }}><a href="/" style={{ color: BLUE }}>← Retour</a><h1>Administration Wakh Reek</h1>
      <div style={{ display: 'flex', gap: 8 }}><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Secret administrateur" style={{ flex: 1, padding: 12, border: '1px solid #ddd', borderRadius: 12 }} /><button onClick={load} style={{ padding: '0 20px', border: 0, borderRadius: 12, background: BLUE, color: 'white', fontWeight: 800 }}>{loading ? 'Chargement…' : 'Connexion'}</button></div>
      {error && <p style={{ color: '#d00' }}>{error}</p>}
      {notice && <p style={{ color: '#166534', background: '#dcfce7', padding: 12, borderRadius: 12 }}>{notice}</p>}
      {authenticated && <>
      <h2 style={{ marginTop: 28 }}>Boutiques</h2>
      <p style={{ color: '#475569' }}>Cette commande est réservée à l’administrateur. Les autres vendeurs gardent la procédure de paiement normale.</p>
      {shops.map((shop) => {
        const active = shop.subscription_active && (!shop.subscription_expires_at || new Date(shop.subscription_expires_at) > new Date());
        return <article key={shop.id} style={{ background: 'white', padding: 16, borderRadius: 16, marginTop: 12 }}>
          <b>{shop.name}</b><p style={{ margin: '8px 0' }}>{shop.city || 'Ville non renseignée'}{shop.quartier ? ` — ${shop.quartier}` : ''}</p>
          <p style={{ margin: '8px 0', color: active ? '#15803d' : '#b45309' }}>{active ? (shop.subscription_expires_at ? `Active jusqu’au ${new Date(shop.subscription_expires_at).toLocaleDateString('fr-FR')}` : 'Active') : 'Abonnement inactif'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => updateShop(shop.id, 'activate_free')} style={{ padding: '10px 14px', border: 0, borderRadius: 10, background: '#16a34a', color: 'white', fontWeight: 700 }}>{active ? 'Laisser active sans limite' : 'Activer gratuitement sans limite'}</button>
            {active && <button onClick={() => updateShop(shop.id, 'deactivate')} style={{ padding: '10px 14px', border: 0, borderRadius: 10, background: '#dc2626', color: 'white', fontWeight: 700 }}>Désactiver</button>}
          </div>
        </article>;
      })}
      {shops.length === 0 && <p>Aucune boutique créée pour le moment.</p>}
      <h2 style={{ marginTop: 28 }}>Paiements en attente</h2>
      {payments.map((p) => <article key={p.id} style={{ background: 'white', padding: 16, borderRadius: 16, marginTop: 12 }}>
        <b>{p.type === 'subscription' ? 'Abonnement boutique — 6 000 F' : 'Entrée chat — 10 F'}</b>
        {p.shops?.name && <p>Boutique : {p.shops.name}</p>}
        <p>Envoyé le {new Date(p.created_at).toLocaleString('fr-FR')}</p>
        <a href={p.proof_image_url} target="_blank" rel="noreferrer"><img src={p.proof_image_url} alt="Preuve de paiement" style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12 }} /></a>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button onClick={() => review(p.id, 'approve')} style={{ flex: 1, padding: 12, border: 0, borderRadius: 10, background: '#16a34a', color: 'white' }}>Approuver</button><button onClick={() => review(p.id, 'reject')} style={{ flex: 1, padding: 12, border: 0, borderRadius: 10, background: '#dc2626', color: 'white' }}>Rejeter</button></div>
      </article>)}
      {!loading && payments.length === 0 && <p>Aucun paiement en attente.</p>}
      </>}
    </section>
  </main>;
}
