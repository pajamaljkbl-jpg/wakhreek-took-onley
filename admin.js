import { useState } from 'react';

const BLUE = '#019EE5';
export default function Admin() {
  const [secret, setSecret] = useState('');
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setError('');
    const res = await fetch('/api/payments?status=pending', { headers: { 'x-admin-secret': secret } });
    const data = await res.json(); setLoading(false);
    if (!res.ok) return setError(data.error || 'Accès refusé');
    setPayments(data);
  }

  async function review(id, action) {
    const res = await fetch(`/api/payments/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret }, body: JSON.stringify({ action }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Validation impossible');
    setPayments((items) => items.filter((p) => p.id !== id));
  }

  return <main style={{ minHeight: '100vh', background: '#f5f7fa', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' }}>
    <section style={{ maxWidth: 760, margin: '20px auto' }}><a href="/" style={{ color: BLUE }}>← Retour</a><h1>Administration Wakh Reek</h1>
      <div style={{ display: 'flex', gap: 8 }}><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Secret administrateur" style={{ flex: 1, padding: 12, border: '1px solid #ddd', borderRadius: 12 }} /><button onClick={load} style={{ padding: '0 20px', border: 0, borderRadius: 12, background: BLUE, color: 'white', fontWeight: 800 }}>{loading ? 'Chargement…' : 'Connexion'}</button></div>
      {error && <p style={{ color: '#d00' }}>{error}</p>}
      {payments.map((p) => <article key={p.id} style={{ background: 'white', padding: 16, borderRadius: 16, marginTop: 12 }}>
        <b>{p.type === 'subscription' ? 'Abonnement boutique — 6 000 F' : 'Entrée chat — 10 F'}</b>
        {p.shops?.name && <p>Boutique : {p.shops.name}</p>}
        <p>Envoyé le {new Date(p.created_at).toLocaleString('fr-FR')}</p>
        <a href={p.proof_image_url} target="_blank" rel="noreferrer"><img src={p.proof_image_url} alt="Preuve de paiement" style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12 }} /></a>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button onClick={() => review(p.id, 'approve')} style={{ flex: 1, padding: 12, border: 0, borderRadius: 10, background: '#16a34a', color: 'white' }}>Approuver</button><button onClick={() => review(p.id, 'reject')} style={{ flex: 1, padding: 12, border: 0, borderRadius: 10, background: '#dc2626', color: 'white' }}>Rejeter</button></div>
      </article>)}
      {!loading && payments.length === 0 && !error && <p>Aucun paiement en attente.</p>}
    </section>
  </main>;
}
