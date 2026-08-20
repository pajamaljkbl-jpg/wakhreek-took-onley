import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { CATEGORIES, CATEGORY_ALL, categoryMatches } from '../lib/categories';

const VILLES = [
  'Toutes Villes', 'Dakar', 'Pikine-Guédiawaye', 'Thiès', 'Mbour', 'Saint-Louis',
  'Touba', 'Kaolack', 'Ziguinchor', 'Diourbel', 'Louga', 'Tambacounda', 'Kolda',
];
const BLUE = '#019EE5';

export default function Home() {
  const [buyer, setBuyer] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupError, setSignupError] = useState('');
  const [authSession, setAuthSession] = useState(null);
  const [ville, setVille] = useState('Dakar');
  const [categorie, setCategorie] = useState('toutes');
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [activeShop, setActiveShop] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const [profileShop, setProfileShop] = useState(null);
  const [showBuyerProfile, setShowBuyerProfile] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({ adminWaveNumber: '', adminWaveQrUrl: '' });

  const [cart, setCart] = useState([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [customer, setCustomer] = useState({ customerName: '', customerPhone: '', deliveryAddress: '' });

  useEffect(() => {
    const client = getSupabaseBrowser();
    client.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setAuthSession(session);
      if (!session) return;
      const { data: profile } = await client.from('profiles').select('phone, full_name').eq('id', session.user.id).maybeSingle();
      if (!profile?.phone) return;
      const res = await fetch('/api/buyers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ email: session.user.email, phone: profile.phone }) });
      if (res.ok) {
        const b = await res.json();
        setBuyer(b);
        setCustomer((old) => ({ ...old, customerName: profile?.full_name || old.customerName, customerPhone: profile?.phone || old.customerPhone }));
      }
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setAuthSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!buyer) return;
    setLoadingShops(true);
    fetch(`/api/shops?city=${encodeURIComponent(ville)}`).then((r) => r.json()).then(setShops).finally(() => setLoadingShops(false));
  }, [ville, buyer]);

  useEffect(() => {
    if (!conversation) return;
    const load = () => fetch(`/api/messages?conversationId=${conversation.id}`).then((r) => r.json()).then(setMessages);
    load(); const interval = setInterval(load, 3000); return () => clearInterval(interval);
  }, [conversation]);

  useEffect(() => { fetch('/api/public-config').then((r) => r.json()).then(setPaymentConfig).catch(() => {}); }, []);

  async function handleSignup() {
    setSignupError('');
    const res = await fetch('/api/buyers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, phone }) });
    const data = await res.json(); if (!res.ok) return setSignupError(data.error || 'Erreur inscription'); setBuyer(data);
  }

  async function openShop(shop) {
    setActiveShop(shop);
    const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyerId: buyer.id, shopId: shop.id }) });
    setConversation(await res.json());
  }

  function addToCart(product, shop) {
    setOrderMessage('');
    setCart((current) => {
      if (current.length && current[0].shop_id !== product.shop_id) {
        setOrderMessage('Termine d’abord la commande de la boutique actuelle.');
        return current;
      }
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min((item.quantity || 1) + 1, Number(product.stock) || 1) } : item);
      return [...current, { ...product, quantity: 1, shopName: shop.name }];
    });
    setOrderOpen(true);
  }

  function changeQty(id, delta) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min((item.quantity || 1) + delta, Number(item.stock) || 1)) } : item));
  }
  function removeFromCart(id) { setCart((current) => current.filter((item) => item.id !== id)); }
  const orderTotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

  async function submitOrder() {
    if (!cart.length) return;
    if (!customer.customerName.trim() || !customer.customerPhone.trim() || !customer.deliveryAddress.trim()) return setOrderMessage('Nom, téléphone et adresse de livraison obligatoires.');
    setOrdering(true); setOrderMessage('');
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyerId: buyer?.id || null, ...customer, items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commande impossible');
      setOrderMessage(`✅ Commande ${data.id.slice(0, 8)} enregistrée. La boutique va te contacter.`);
      setCart([]);
      fetch(`/api/shops?city=${encodeURIComponent(ville)}`).then((r) => r.json()).then(setShops).catch(() => {});
    } catch (error) { setOrderMessage(error.message); }
    finally { setOrdering(false); }
  }

  async function handleProofUpload(e) {
    const file = e.target.files[0]; if (!file) return; setSubmittingProof(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const uploadRes = await fetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: reader.result, folder: 'proofs' }) });
      const { url, error } = await uploadRes.json(); if (error) { alert(error); setSubmittingProof(false); return; }
      await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'entry_fee', conversationId: conversation.id, proofImageUrl: url }) });
      setProofSubmitted(true); setSubmittingProof(false);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!conversation || conversation.entry_fee_paid || !proofSubmitted) return;
    const interval = setInterval(async () => {
      const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyerId: buyer.id, shopId: activeShop.id }) });
      const updated = await res.json(); if (updated.entry_fee_paid) setConversation(updated);
    }, 5000);
    return () => clearInterval(interval);
  }, [conversation, proofSubmitted]);

  async function sendMessage() {
    if (!text.trim()) return;
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conversation.id, sender: 'buyer', content: text }) });
    if (res.status === 403) { const data = await res.json(); return alert(data.error); }
    setText(''); setMessages(await fetch(`/api/messages?conversationId=${conversation.id}`).then((r) => r.json()));
  }

  async function uploadMedia(file, folder) {
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const res = await fetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64: dataUrl, folder }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Envoi du média impossible'); return data.url;
  }
  async function sendMedia(file, type, durationSeconds) {
    try { const url = await uploadMedia(file, type === 'audio' ? 'messages/audio' : 'messages/images'); const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conversation.id, sender: 'buyer', type, mediaUrl: url, durationSeconds }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Message impossible à envoyer'); setMessages((items) => [...items, data]); } catch (error) { alert(error.message); }
  }
  async function toggleRecording() {
    if (recording) return recorderRef.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const chunks = []; const startedAt = Date.now();
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); setRecording(false); const file = new File([new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })], 'message.webm', { type: recorder.mimeType || 'audio/webm' }); await sendMedia(file, 'audio', Math.ceil((Date.now() - startedAt) / 1000)); };
      recorder.start(); recorderRef.current = recorder; setRecording(true);
    } catch { alert('Autorise le microphone pour enregistrer un message vocal.'); }
  }

  if (!buyer) return <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#e10600,#ff6a00,#ffcc00)', display: 'flex', justifyContent: 'center', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' }}><div style={{ background: '#fffef8', width: '100%', maxWidth: 420, borderRadius: 28, padding: '28px 24px', alignSelf: 'center' }}><img src="/hero-3d.png" alt="Wakh Reek" style={{ width: 140, height: 140, margin: '0 auto 16px', borderRadius: 28, objectFit: 'cover', display: 'block', boxShadow: '0 12px 30px rgba(0,0,0,.18)' }} /><h1 style={{ textAlign: 'center', fontWeight: 900 }}>ONLY TOK<br /><span style={{ color: BLUE }}>WAKH REEK</span></h1><p style={{ textAlign: 'center', fontSize: 12, color: '#8aa0b5', margin: '12px 0 20px' }}>Inscris-toi pour accéder aux boutiques et à la messagerie.</p><a href="/compte" style={{ display: 'block', textAlign: 'center', color: BLUE, marginBottom: 14, fontWeight: 700 }}>Créer un compte sécurisé ou se connecter</a><p style={{ color: '#657080', textAlign: 'center', fontSize: 14 }}>Inscription avec e-mail et téléphone obligatoire.</p><a href="/compte" style={{ ...btnStyle, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16 }}>S’inscrire / Se connecter</a></div></div>;

  return <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <header style={{ background: BLUE, color: 'white', padding: '18px 16px 14px', textAlign: 'center' }}><a href="/" style={{ display: 'block', color: 'white', textDecoration: 'none', fontSize: 24, lineHeight: 1.1, fontWeight: 900 }}>ONLY TOK – WAKH REEK</a><nav style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 14 }}><a href="/boutique" style={{ color: 'white', fontWeight: 800 }}>Créer une boutique</a><a href="/membres" style={{ color: 'white', fontWeight: 800 }}>Membres</a><a href="/vendeur" style={{ color: 'white', fontWeight: 800 }}>Espace vendeur</a></nav></header>
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: 12 }}>{VILLES.map((v) => <button key={v} onClick={() => setVille(v)} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', whiteSpace: 'nowrap', background: v === ville ? BLUE : '#eee', color: v === ville ? 'white' : '#333', fontWeight: 700 }}>{v}</button>)}</div>
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 12px 12px' }}>{[CATEGORY_ALL, ...CATEGORIES].map((c) => <button key={c.id} onClick={() => setCategorie(c.id)} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid #e2e8f0', whiteSpace: 'nowrap', background: c.id === categorie ? '#0f172a' : '#fff', color: c.id === categorie ? 'white' : '#333', fontWeight: 700, cursor: 'pointer' }}>{c.emoji} {c.label}</button>)}</div>
    {loadingShops && <p style={{ padding: 12 }}>Chargement des boutiques...</p>}
    <div style={{ padding: 12, display: 'grid', gap: 10 }}>{shops.filter((shop) => categorie === 'toutes' || categoryMatches(shop.category, (CATEGORIES.find((c) => c.id === categorie) || {}).label)).map((shop) => <div key={shop.id} style={{ background: 'white', borderRadius: 16, padding: 12, boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}><b>{shop.name}</b> — {shop.quartier}, {shop.city}<div style={{ fontSize: 12, color: '#666', margin: '4px 0' }}>{shop.category}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, margin: '10px 0' }}>{(shop.products || []).map((p) => <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>{p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} /> : <div style={{ height: 170, display: 'grid', placeItems: 'center', background: '#fff4e5', fontSize: 44 }}>🛍️</div>}<div style={{ padding: 10 }}><div style={{ fontWeight: 900, marginBottom: 4 }}>{p.name}</div>{p.description && <div style={{ fontSize: 12, color: '#666', minHeight: 34 }}>{p.description}</div>}<div style={{ marginTop: 7, fontWeight: 900 }}>{p.price ? `${p.price} FCFA` : 'Prix à définir'}</div>{p.stock !== null && p.stock !== undefined && <div style={{ fontSize: 12, color: p.stock > 0 ? '#15803d' : '#b91c1c', marginTop: 3 }}>{p.stock > 0 ? `Stock : ${p.stock}` : 'Rupture de stock'}</div>}<button disabled={!p.stock} onClick={() => addToCart(p, shop)} style={{ ...btnStyle, marginTop: 9, background: p.stock ? '#16a34a' : '#94a3b8' }}>🛒 Commander</button></div></div>)}</div><div style={{ display: 'flex', gap: 8, marginTop: 6 }}><button onClick={() => openShop(shop)} style={{ ...btnStyle, flex: 1 }}>Discuter</button><button onClick={() => setProfileShop(shop)} style={{ ...btnStyle, flex: 1, background: '#eee', color: '#333' }}>Profil</button></div></div>)}{!loadingShops && shops.length === 0 && <p>Aucune boutique à {ville} pour l'instant.</p>}</div>

    {orderOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', padding: 14 }}><div style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 20, padding: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ margin: 0 }}>🛒 Ma commande</h2>{cart[0]?.shopName && <small>{cart[0].shopName}</small>}</div><button onClick={() => setOrderOpen(false)} style={{ border: 0, background: 'none', fontSize: 24 }}>✕</button></div>{cart.map((item) => <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eee' }}>{item.image_url && <img src={item.image_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />}<div style={{ flex: 1 }}><b>{item.name}</b><div>{item.price} F × {item.quantity}</div></div><button onClick={() => changeQty(item.id, -1)} style={qtyBtn}>−</button><button onClick={() => changeQty(item.id, 1)} style={qtyBtn}>+</button><button onClick={() => removeFromCart(item.id)} style={{ border: 0, background: 'none', color: '#b91c1c' }}>✕</button></div>)}<h3>Total : {orderTotal} FCFA</h3><input style={formField} value={customer.customerName} onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })} placeholder="Nom du client" /><input style={formField} value={customer.customerPhone} onChange={(e) => setCustomer({ ...customer, customerPhone: e.target.value })} placeholder="Téléphone" /><textarea style={{ ...formField, minHeight: 80 }} value={customer.deliveryAddress} onChange={(e) => setCustomer({ ...customer, deliveryAddress: e.target.value })} placeholder="Adresse de livraison" />{orderMessage && <p style={{ padding: 10, borderRadius: 10, background: '#eef8ff' }}>{orderMessage}</p>}<button disabled={ordering || !cart.length} onClick={submitOrder} style={{ ...btnStyle, background: '#16a34a' }}>{ordering ? 'Enregistrement…' : '✅ Confirmer la commande'}</button></div></div>}

    {activeShop && conversation && <div style={{ position: 'fixed', inset: 0, background: 'white', display: 'flex', flexDirection: 'column', zIndex: 8000 }}><div style={{ background: BLUE, color: 'white', padding: 12, display: 'flex', justifyContent: 'space-between' }}><b>{activeShop.name}</b><button onClick={() => { setActiveShop(null); setConversation(null); }} style={{ background: 'none', border: 'none', color: 'white' }}>✕</button></div>{!conversation.entry_fee_paid ? <div style={{ padding: 20, textAlign: 'center' }}><p>Entrée foire symbolique : <b>10F</b>, à payer via Wave à l'administrateur.</p>{!proofSubmitted ? <><p>1. Paye 10F via Wave.<br />2. Envoie une capture de la preuve.</p><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProofUpload} disabled={submittingProof} /></> : <p style={{ color: BLUE, fontWeight: 700 }}>Preuve envoyée — en attente de validation.</p>}</div> : <><div style={{ display: 'flex', gap: 8, padding: '8px 12px' }}><a href={`/appel?conversationId=${conversation.id}`} style={{ ...btnStyle, textDecoration: 'none', textAlign: 'center' }}>📞 Appel Wakh Reek</a></div><div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>{messages.map((m) => <div key={m.id} style={{ textAlign: m.sender === 'buyer' ? 'right' : 'left', margin: '6px 0' }}><span style={{ display: 'inline-block', background: m.sender === 'buyer' ? BLUE : '#eee', color: m.sender === 'buyer' ? 'white' : 'black', padding: '8px 12px', borderRadius: 14, maxWidth: '75%' }}>{m.message_type === 'image' && <img src={m.media_url} alt="" style={{ display: 'block', maxWidth: 230, borderRadius: 10 }} />}{m.message_type === 'audio' && <audio controls src={m.media_url} />}{m.content}</span></div>)}</div><div style={{ display: 'flex', padding: 10 }}><label style={{ padding: 8 }}>🖼️<input type="file" hidden onChange={(e) => e.target.files[0] && sendMedia(e.target.files[0], 'image')} /></label><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Écrire..." style={{ ...inputStyle, flex: 1 }} /><button onClick={toggleRecording} style={{ ...btnStyle, marginLeft: 8, width: 'auto', background: recording ? '#dc2626' : '#64748b' }}>{recording ? '■' : '🎤'}</button><button onClick={sendMessage} style={{ ...btnStyle, marginLeft: 8, width: 'auto' }}>Envoyer</button></div></>}</div>}

    {profileShop && <div style={{ position: 'fixed', inset: 0, zIndex: 8500, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setProfileShop(null)}><div style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}><h2>{profileShop.name}</h2><p>{profileShop.category}</p><p>{profileShop.quartier}, {profileShop.city}</p>{profileShop.description && <p>{profileShop.description}</p>}<p>Wave : {profileShop.wave_number}</p><button onClick={() => setProfileShop(null)} style={btnStyle}>Fermer</button></div></div>}
    {showBuyerProfile && <div />}
  </div>;
}

const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 999, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: 12, borderRadius: 999, border: 'none', background: BLUE, color: 'white', fontWeight: 800, cursor: 'pointer' };
const formField = { width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #d7dde5', borderRadius: 12, marginBottom: 9, fontSize: 16 };
const qtyBtn = { width: 34, height: 34, borderRadius: 10, border: '1px solid #ddd', background: 'white', fontSize: 20, cursor: 'pointer' };
