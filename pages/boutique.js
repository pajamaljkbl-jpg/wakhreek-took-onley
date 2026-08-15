import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const input = { width: '100%', padding: 12, marginBottom: 10, border: '1px solid #ddd', borderRadius: 12, boxSizing: 'border-box' };
const button = { width: '100%', padding: 13, border: 0, borderRadius: 12, background: BLUE, color: 'white', fontWeight: 800, cursor: 'pointer' };

async function readApiResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch {
    throw new Error(res.status === 404 ? 'Route API introuvable (404).' : `Réponse serveur invalide (${res.status}).`);
  }
}

async function uploadImage(file, folder) {
  const imageBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const res = await fetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64, folder }) });
  const data = await readApiResponse(res); if (!res.ok) throw new Error(data.error || 'Échec de l’envoi de l’image'); return data.url;
}

export default function Boutique() {
  const [form, setForm] = useState({ name: '', city: 'Dakar', quartier: '', category: '', wave_number: '', om_number: '', description: '' });
  const [qr, setQr] = useState(null); const [shop, setShop] = useState(null); const [loadingShop, setLoadingShop] = useState(true);
  const [proof, setProof] = useState(null); const [config, setConfig] = useState({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState({ name: '', description: '', category: 'Produits naturels', price: '', stock: '' }); const [productImage, setProductImage] = useState(null);

  useEffect(() => {
    fetch('/api/public-config').then((r) => r.json()).then(setConfig).catch(() => {});
    (async () => {
      try {
        const { data: { session } } = await getSupabaseBrowser().auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/shops?mine=1', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) { const existing = await res.json(); if (existing) setShop(existing); }
      } catch {} finally { setLoadingShop(false); }
    })();
  }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function createShop(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const qr_code_url = qr ? await uploadImage(qr, 'qrcodes') : null;
      const { data: { session } } = await getSupabaseBrowser().auth.getSession();
      const headers = { 'Content-Type': 'application/json' }; if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/shops', { method: 'POST', headers, body: JSON.stringify({ ...form, qr_code_url }) });
      const data = await readApiResponse(res); if (!res.ok) throw new Error(data.error || 'Création impossible'); setShop(data); setMessage('Boutique créée. Il reste à envoyer la preuve de l’abonnement.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function submitSubscription() {
    if (!proof) return setMessage('Ajoute la capture du paiement Wave.'); setBusy(true); setMessage('');
    try {
      const proofImageUrl = await uploadImage(proof, 'proofs');
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'subscription', shopId: shop.id, proofImageUrl }) });
      const data = await readApiResponse(res); if (!res.ok) throw new Error(data.error || 'Preuve non envoyée'); setMessage('Preuve envoyée. L’administrateur va valider ton abonnement.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function addProduct(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const imageUrl = productImage ? await uploadImage(productImage, 'products') : null;
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...product, shopId: shop.id, imageUrl }) });
      const data = await readApiResponse(res); if (!res.ok) throw new Error(data.error || 'Produit non ajouté');
      setMessage(`Produit « ${data.name} » ajouté à la boutique.`); setProduct({ name: '', description: '', category: 'Produits naturels', price: '', stock: '' }); setProductImage(null);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  return <main style={{ minHeight: '100vh', background: '#f5f7fa', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' }}>
    <section style={{ maxWidth: 560, margin: '20px auto', background: 'white', padding: 24, borderRadius: 22 }}>
      <a href="/" style={{ color: BLUE }}>← Retour</a>
      <h1>{shop ? 'Gérer ma boutique' : 'Créer ma boutique'}</h1>
      {loadingShop ? <p>Chargement de la boutique…</p> : !shop ? <form onSubmit={createShop}>
        <input style={input} name="name" value={form.name} onChange={change} placeholder="Nom de la boutique *" required />
        <input style={input} name="city" value={form.city} onChange={change} placeholder="Ville *" required />
        <input style={input} name="quartier" value={form.quartier} onChange={change} placeholder="Quartier" />
        <input style={input} name="category" value={form.category} onChange={change} placeholder="Catégorie" />
        <input style={input} name="wave_number" value={form.wave_number} onChange={change} placeholder="Numéro Wave *" required />
        <input style={input} name="om_number" value={form.om_number} onChange={change} placeholder="Numéro Orange Money" />
        <textarea style={{ ...input, minHeight: 90 }} name="description" value={form.description} onChange={change} placeholder="Description" />
        <label>QR Wave de la boutique (facultatif)<input style={{ ...input, marginTop: 6 }} type="file" accept="image/*" onChange={(e) => setQr(e.target.files[0])} /></label>
        <button style={button} disabled={busy}>{busy ? 'Création…' : 'Créer la boutique'}</button>
      </form> : <div>
        <p><b>{shop.name}</b></p>
        <h2>Ajouter des produits</h2><form onSubmit={addProduct}>
          <input style={input} value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="Nom : Miel de jujubier, Smen…" required />
          <textarea style={input} value={product.description} onChange={(e) => setProduct({ ...product, description: e.target.value })} placeholder="Description, origine, poids…" />
          <input style={input} value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} placeholder="Catégorie" />
          <input style={input} type="number" min="0" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} placeholder="Prix FCFA" required />
          <input style={input} type="number" min="0" value={product.stock} onChange={(e) => setProduct({ ...product, stock: e.target.value })} placeholder="Stock" required />
          <input style={input} type="file" accept="image/*" onChange={(e) => setProductImage(e.target.files[0])} />
          <button style={button} disabled={busy}>Ajouter le produit</button>
        </form>
        {!shop.subscription_active && <><hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #eee' }} /><h2>Abonnement : 6 000 F</h2>
          {config.adminWaveQrUrl && <img src={config.adminWaveQrUrl} alt="QR Wave administrateur" style={{ width: 200, height: 200, objectFit: 'contain' }} />}
          {config.adminWaveNumber && <p><b>Wave : {config.adminWaveNumber}</b></p>}
          <input style={input} type="file" accept="image/*" onChange={(e) => setProof(e.target.files[0])} />
          <button style={button} onClick={submitSubscription} disabled={busy || (!config.adminWaveQrUrl && !config.adminWaveNumber)}>{busy ? 'Envoi…' : 'Envoyer la preuve'}</button></>}
      </div>}
      {message && <p style={{ padding: 12, background: '#eef8ff', borderRadius: 12 }}>{message}</p>}
    </section>
  </main>;
}
