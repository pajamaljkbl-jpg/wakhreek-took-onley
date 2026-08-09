import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const button = { border: 0, borderRadius: 10, padding: '10px 13px', background: BLUE, color: 'white', fontWeight: 800, cursor: 'pointer' };

export default function Vendeur() {
  const [session, setSession] = useState(null);
  const [data, setData] = useState({ shops: [], conversations: [], calls: [] });
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('Chargement…');

  async function load(currentSession) {
    if (!currentSession?.access_token) return;
    const res = await fetch('/api/vendor/conversations', { headers: { Authorization: `Bearer ${currentSession.access_token}` } });
    const body = await res.json();
    if (!res.ok) { setMessage(body.error || 'Impossible de charger tes conversations.'); return; }
    setData(body); setMessage('');
    setActive((previous) => body.conversations.find((item) => item.id === previous?.id) || body.conversations[0] || null);
  }

  useEffect(() => {
    const client = getSupabaseBrowser();
    client.auth.getSession().then(({ data: { session: current } }) => { setSession(current); if (current) load(current); else setMessage('Connecte-toi avec ton compte vendeur.'); });
    const { data: listener } = client.auth.onAuthStateChange((_event, current) => { setSession(current); if (current) load(current); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => load(session), 4000);
    return () => clearInterval(timer);
  }, [session]);

  async function send() {
    if (!text.trim() || !active) return;
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ conversationId: active.id, sender: 'shop', content: text }) });
    const body = await res.json();
    if (!res.ok) return setMessage(body.error || 'Message non envoyé.');
    setText(''); await load(session);
  }

  if (!session) return <main style={shell}><section style={card}><a href="/compte" style={{ color: BLUE }}>Se connecter comme vendeur</a><h1>Espace vendeur Wakh Reek</h1><p>{message}</p></section></main>;
  return <main style={shell}><section style={{ ...card, maxWidth: 1050 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div><a href="/" style={{ color: BLUE }}>← Marché</a><h1 style={{ marginBottom: 0 }}>Espace vendeur</h1><small>{session.user.email}</small></div><button onClick={() => getSupabaseBrowser().auth.signOut().then(() => window.location.href = '/')} style={{ ...button, background: '#64748b' }}>Déconnexion</button></header>
    {message && <p style={{ padding: 12, background: '#eef8ff', borderRadius: 10 }}>{message}</p>}
    {!data.shops.length ? <div style={{ padding: 18, marginTop: 18, background: '#fff7ed', borderRadius: 12 }}><b>Aucune boutique liée à ce compte.</b><p>Crée ta boutique avec ce même compte, ou demande à l’administrateur de la lier à ton profil.</p><a href="/boutique" style={{ color: BLUE }}>Créer une boutique</a></div> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, .8fr) minmax(0, 1.5fr)', gap: 18, marginTop: 20 }}>
      <aside style={{ borderRight: '1px solid #e5e7eb', paddingRight: 14 }}><b>Conversations</b>{data.conversations.map((conversation) => { const ringing = data.calls.some((call) => call.conversation_id === conversation.id && call.status === 'ringing'); return <button key={conversation.id} onClick={() => setActive(conversation)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 9, padding: 12, borderRadius: 10, border: active?.id === conversation.id ? `2px solid ${BLUE}` : '1px solid #e5e7eb', background: ringing ? '#fff7ed' : 'white', cursor: 'pointer' }}><b>{conversation.buyer?.email || 'Client'}</b><br /><small>{conversation.messages.at(-1)?.content || 'Nouvelle discussion'}</small>{ringing && <div style={{ color: '#dc2626', fontWeight: 800, marginTop: 5 }}>📞 Appel entrant</div>}</button>; })}</aside>
      <div>{active ? <><h2 style={{ marginTop: 0 }}>Client : {active.buyer?.email || 'Client'}</h2>{data.calls.some((call) => call.conversation_id === active.id && call.status === 'ringing') && <a href={`/appel?conversationId=${active.id}`} style={{ ...button, display: 'inline-block', textDecoration: 'none', marginBottom: 12 }}>📞 Accepter l’appel entrant</a>}<div style={{ minHeight: 280, background: '#f8fafc', padding: 12, borderRadius: 12 }}>{active.messages.map((item) => <div key={item.id} style={{ textAlign: item.sender === 'shop' ? 'right' : 'left', margin: '8px 0' }}><span style={{ display: 'inline-block', maxWidth: '75%', padding: '8px 11px', borderRadius: 12, background: item.sender === 'shop' ? BLUE : '#e5e7eb', color: item.sender === 'shop' ? 'white' : 'black' }}>{item.message_type === 'image' && <img alt="Envoyée" src={item.media_url} style={{ display: 'block', maxWidth: 180, borderRadius: 8 }} />}{item.message_type === 'audio' && <audio controls src={item.media_url} />}{item.content}</span></div>)}</div><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} placeholder="Répondre au client…" style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }} /><button onClick={send} style={button}>Envoyer</button></div></> : <p>Aucune conversation pour le moment.</p>}</div>
    </div>}
  </section></main>;
}

const shell = { minHeight: '100vh', background: '#f1f5f9', padding: 20, fontFamily: 'Inter,system-ui,sans-serif' };
const card = { maxWidth: 620, margin: '20px auto', background: 'white', padding: 24, borderRadius: 20, boxShadow: '0 10px 28px rgba(15,23,42,.1)' };
