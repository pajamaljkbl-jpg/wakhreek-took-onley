import { useEffect, useState } from 'react';

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

  async function payEntryFee() {
    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'entry_fee', conversationId: conversation.id }),
    });
    const { checkoutUrl, error } = await res.json();
    if (error) return alert(error);
    // Redirige vers la vraie page de paiement Wave — l'accès ne sera
    // débloqué qu'après confirmation réelle via le webhook, pas au clic.
    window.location.href = checkoutUrl;
  }

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

  // --- Écran d'inscription (remplace le localStorage) ---
  if (!buyer) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#e10600,#ff6a00,#ffcc00)', display: 'flex', justifyContent: 'center', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' }}>
        <div style={{ background: '#fffef8', width: '100%', maxWidth: 420, borderRadius: 28, padding: '28px 24px', alignSelf: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'linear-gradient(135deg,#e10600,#ffcc00)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 22 }}>WR</div>
          <h1 style={{ textAlign: 'center', fontWeight: 900 }}>ONLY TOK<br /><span style={{ color: BLUE }}>WAKH REEK</span></h1>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#8aa0b5', margin: '12px 0 20px' }}>Inscris-toi pour accéder aux boutiques et à la messagerie.</p>
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
        <span>{buyer.email}</span>
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
            <button onClick={() => openShop(shop)} style={{ ...btnStyle, marginTop: 6 }}>Discuter avec la boutique</button>
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
              <p>Entrée foire symbolique : <b>10F</b>, payée directement à la boutique.</p>
              <p style={{ fontSize: 12, color: '#666' }}>Filtre les visiteurs sérieux avant de débloquer la messagerie.</p>
              <button onClick={payEntryFee} style={btnStyle}>Payer 10F via Wave</button>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ textAlign: m.sender === 'buyer' ? 'right' : 'left', margin: '6px 0' }}>
                    <span style={{ display: 'inline-block', background: m.sender === 'buyer' ? BLUE : '#eee', color: m.sender === 'buyer' ? 'white' : 'black', padding: '8px 12px', borderRadius: 14, maxWidth: '75%' }}>
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', padding: 10, borderTop: '1px solid #eee' }}>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Écrire..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={sendMessage} style={{ ...btnStyle, marginLeft: 8, width: 'auto', padding: '0 16px' }}>Envoyer</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 999, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: 12, borderRadius: 999, border: 'none', background: BLUE, color: 'white', fontWeight: 800, cursor: 'pointer' };
