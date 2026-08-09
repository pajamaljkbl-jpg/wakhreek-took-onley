import { useEffect, useRef, useState } from 'react';

const VILLES = [
  'Toutes Villes', 'Dakar', 'Pikine-Guédiawaye', 'Thiès', 'Mbour', 'Saint-Louis',
  'Touba', 'Kaolack', 'Ziguinchor', 'Diourbel', 'Louga', 'Tambacounda', 'Kolda',
];

const BLUE = '#019EE5';

export default function Home() {
  // --- Compte acheteur (remplace localStorage) ---
  const [buyer, setBuyer] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupError, setSignupError] = useState('');

  // --- Boutiques (remplace le tableau codé en dur) ---
  const [ville, setVille] = useState('Dakar');
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // --- Conversation / chat réel ---
  const [activeShop, setActiveShop] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);

  // Charge les boutiques depuis l'API à chaque changement de ville
  useEffect(() => {
    if (!buyer) return;
    setLoadingShops(true);
    fetch(`/api/shops?city=${encodeURIComponent(ville)}`)
      .then((r) => r.json())
      .then(setShops)
      .finally(() => setLoadingShops(false));
  }, [ville, buyer]);

  // Rafraîchit les messages toutes les 3s tant qu'une conversation est ouverte
  useEffect(() => {
    if (!conversation) return;
    const load = () =>
      fetch(`/api/messages?conversationId=${conversation.id}`)
        .then((r) => r.json())
        .then(setMessages);
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [conversation]);

  async function handleSignup() {
    setSignupError('');
    const res = await fetch('/api/buyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone }),
    });
    const data = await res.json();
    if (!res.ok) return setSignupError(data.error || 'Erreur inscription');
    setBuyer(data);
  }

  async function openShop(shop) {
    setActiveShop(shop);
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId: buyer.id, shopId: shop.id }),
    });
    const conv = await res.json();
    setConversation(conv);
  }

  const [profileShop, setProfileShop] = useState(null);
  const [showBuyerProfile, setShowBuyerProfile] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({ adminWaveNumber: '', adminWaveQrUrl: '' });

  useEffect(() => {
    fetch('/api/public-config').then((r) => r.json()).then(setPaymentConfig).catch(() => {});
  }, []);

  async function handleProofUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSubmittingProof(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const uploadRes = await fetch('/api/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: reader.result, folder: 'proofs' }),
      });
      const { url, error } = await uploadRes.json();
      if (error) {
        alert(error);
        setSubmittingProof(false);
        return;
      }
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'entry_fee', conversationId: conversation.id, proofImageUrl: url }),
      });
      setProofSubmitted(true);
      setSubmittingProof(false);
    };
    reader.readAsDataURL(file);
  }

  // Vérifie périodiquement si l'admin a validé le paiement des 10F
  useEffect(() => {
    if (!conversation || conversation.entry_fee_paid || !proofSubmitted) return;
    const interval = setInterval(async () => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId: buyer.id, shopId: activeShop.id }),
      });
      const updated = await res.json();
      if (updated.entry_fee_paid) setConversation(updated);
    }, 5000);
    return () => clearInterval(interval);
  }, [conversation, proofSubmitted]);

  async function sendMessage() {
    if (!text.trim()) return;
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversation.id, sender: 'buyer', content: text }),
    });
    if (res.status === 403) {
      const data = await res.json();
      return alert(data.error); // "Paiement des 10F requis..."
    }
    setText('');
    const updated = await fetch(`/api/messages?conversationId=${conversation.id}`).then((r) => r.json());
    setMessages(updated);
  }

  async function uploadMedia(file, folder) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    });
    const res = await fetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64: dataUrl, folder }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Envoi du média impossible');
    return data.url;
  }

  async function sendMedia(file, type, durationSeconds) {
    try {
      const url = await uploadMedia(file, type === 'audio' ? 'messages/audio' : 'messages/images');
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conversation.id, sender: 'buyer', type, mediaUrl: url, durationSeconds }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Message impossible à envoyer');
      setMessages((items) => [...items, data]);
    } catch (error) { alert(error.message); }
  }

  async function toggleRecording() {
    if (recording) return recorderRef.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = []; const startedAt = Date.now();
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); setRecording(false);
        const file = new File([new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })], 'message.webm', { type: recorder.mimeType || 'audio/webm' });
        await sendMedia(file, 'audio', Math.ceil((Date.now() - startedAt) / 1000));
      };
      recorder.start(); recorderRef.current = recorder; setRecording(true);
    } catch { alert('Autorise le microphone pour enregistrer un message vocal.'); }
  }

  // --- Écran d'inscription (remplace le localStorage) ---
  if (!buyer) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#e10600,#ff6a00,#ffcc00)', display: 'flex', justifyContent: 'center', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' }}>
        <div style={{ background: '#fffef8', width: '100%', maxWidth: 420, borderRadius: 28, padding: '28px 24px', alignSelf: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'linear-gradient(135deg,#e10600,#ffcc00)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 22 }}>WR</div>
          <h1 style={{ textAlign: 'center', fontWeight: 900 }}>ONLY TOK<br /><span style={{ color: BLUE }}>WAKH REEK</span></h1>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#8aa0b5', margin: '12px 0 20px' }}>Inscris-toi pour accéder aux boutiques et à la messagerie.</p>
          <a href="/compte" style={{ display: 'block', textAlign: 'center', color: BLUE, marginBottom: 14, fontWeight: 700 }}>Créer un compte sécurisé ou se connecter</a>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" style={inputStyle} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" style={{ ...inputStyle, marginTop: 12 }} />
          {signupError && <div style={{ color: '#e10600', fontSize: 12, marginTop: 8 }}>{signupError}</div>}
          <button onClick={handleSignup} style={{ ...btnStyle, marginTop: 16 }}>S'inscrire</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: BLUE, color: 'white', padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
        <b>ONLY TOK - WAKH REEK</b>
        <div style={{ display: 'flex', gap: 12 }}><a href="/marche" style={{ color: 'white' }}>السوق</a><a href="/boutique" style={{ color: 'white' }}>Créer une boutique</a><span onClick={() => setShowBuyerProfile(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{buyer.email}</span></div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: 12 }}>
        {VILLES.map((v) => (
          <button key={v} onClick={() => setVille(v)} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', whiteSpace: 'nowrap', background: v === ville ? BLUE : '#eee', color: v === ville ? 'white' : '#333', fontWeight: 700 }}>
            {v}
          </button>
        ))}
      </div>

      {loadingShops && <p style={{ padding: 12 }}>Chargement des boutiques...</p>}

      <div style={{ padding: 12, display: 'grid', gap: 10 }}>
        {shops.map((shop) => (
          <div key={shop.id} style={{ background: 'white', borderRadius: 16, padding: 12, boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
            <b>{shop.name}</b> — {shop.quartier}, {shop.city}
            <div style={{ fontSize: 12, color: '#666', margin: '4px 0' }}>{shop.category}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
              {(shop.products || []).map((p) => (
                <span key={p.id} style={{ fontSize: 11, background: '#fff4e5', padding: '4px 8px', borderRadius: 999 }}>
                  {p.name} {p.price ? `${p.price}F` : '(prix à définir)'}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => openShop(shop)} style={{ ...btnStyle, flex: 1 }}>Discuter</button>
              <button onClick={() => setProfileShop(shop)} style={{ ...btnStyle, flex: 1, background: '#eee', color: '#333' }}>Profil</button>
              {shop.latitude && shop.longitude && (
                <a href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} target="_blank" rel="noreferrer" style={{ ...btnStyle, flex: 1, background: '#eee', color: '#333', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📍 Carte</a>
              )}
            </div>
          </div>
        ))}
        {!loadingShops && shops.length === 0 && <p>Aucune boutique à {ville} pour l'instant.</p>}
      </div>

      {activeShop && conversation && (
        <div style={{ position: 'fixed', inset: 0, background: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: BLUE, color: 'white', padding: 12, display: 'flex', justifyContent: 'space-between' }}>
            <b>{activeShop.name}</b>
            <button onClick={() => { setActiveShop(null); setConversation(null); }} style={{ background: 'none', border: 'none', color: 'white' }}>✕</button>
          </div>

          {!conversation.entry_fee_paid ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <p>Entrée foire symbolique : <b>10F</b>, à payer via Wave à l'administrateur.</p>
              <p style={{ fontSize: 12, color: '#666' }}>Filtre les visiteurs sérieux avant de débloquer la messagerie.</p>
              {!proofSubmitted ? (
                <>
                  {paymentConfig.adminWaveQrUrl && (
                    <img src={paymentConfig.adminWaveQrUrl} alt="QR code Wave Wakh Reek" style={{ width: 190, height: 190, objectFit: 'contain', borderRadius: 16, border: '1px solid #eee' }} />
                  )}
                  {paymentConfig.adminWaveNumber && <p><b>Numéro Wave : {paymentConfig.adminWaveNumber}</b></p>}
                  {!paymentConfig.adminWaveQrUrl && !paymentConfig.adminWaveNumber && (
                    <p style={{ color: '#e10600', fontWeight: 700 }}>Le moyen de paiement Wave doit être configuré par l’administrateur.</p>
                  )}
                  <p style={{ fontSize: 13 }}>1. Paye 10F via le QR Wave de l'administrateur.<br />2. Envoie une capture de la preuve de paiement ci-dessous.</p>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProofUpload} disabled={submittingProof || (!paymentConfig.adminWaveQrUrl && !paymentConfig.adminWaveNumber)} />
                  {submittingProof && <p style={{ fontSize: 12, color: '#666' }}>Envoi en cours...</p>}
                </>
              ) : (
                <p style={{ color: BLUE, fontWeight: 700 }}>Preuve envoyée — en attente de validation par l'administrateur.</p>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #eee' }}>
                <a href={`/appel?conversationId=${conversation.id}`} style={{ ...btnStyle, flex: 1, textDecoration: 'none', textAlign: 'center' }}>📞 Appel Wakh Reek</a>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ textAlign: m.sender === 'buyer' ? 'right' : 'left', margin: '6px 0' }}>
                    <span style={{ display: 'inline-block', background: m.sender === 'buyer' ? BLUE : '#eee', color: m.sender === 'buyer' ? 'white' : 'black', padding: '8px 12px', borderRadius: 14, maxWidth: '75%' }}>
                      {m.message_type === 'image' && <img src={m.media_url} alt="Image envoyée" style={{ display: 'block', maxWidth: 230, borderRadius: 10 }} />}
                      {m.message_type === 'audio' && <audio controls src={m.media_url} style={{ maxWidth: 230 }} />}
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', padding: 10, borderTop: '1px solid #eee' }}>
                <label title="Envoyer une image" style={{ cursor: 'pointer', padding: '8px 10px', fontSize: 21 }}>🖼️<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => e.target.files[0] && sendMedia(e.target.files[0], 'image')} /></label>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Écrire..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={toggleRecording} title="Message vocal" style={{ ...btnStyle, marginLeft: 8, width: 'auto', padding: '0 13px', background: recording ? '#dc2626' : '#64748b' }}>{recording ? '■' : '🎤'}</button>
                <button onClick={sendMessage} style={{ ...btnStyle, marginLeft: 8, width: 'auto', padding: '0 16px' }}>Envoyer</button>
              </div>
            </>
          )}
        </div>
      )}

      {profileShop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setProfileShop(null)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{profileShop.name}</h2>
            <p style={{ fontSize: 13, color: '#666' }}>{profileShop.category}</p>
            <p>{profileShop.quartier}, {profileShop.city}</p>
            {profileShop.description && <p>{profileShop.description}</p>}
            <p style={{ fontSize: 13 }}>Wave : {profileShop.wave_number}</p>
            {profileShop.om_number && <p style={{ fontSize: 13 }}>Orange Money : {profileShop.om_number}</p>}
            <button onClick={() => setProfileShop(null)} style={btnStyle}>Fermer</button>
          </div>
        </div>
      )}

      {showBuyerProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowBuyerProfile(false)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Mon profil</h2>
            <p><b>Email :</b> {buyer.email}</p>
            <p><b>Téléphone :</b> {buyer.phone}</p>
            <button onClick={() => setShowBuyerProfile(false)} style={btnStyle}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 999, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: 12, borderRadius: 999, border: 'none', background: BLUE, color: 'white', fontWeight: 800, cursor: 'pointer' };
