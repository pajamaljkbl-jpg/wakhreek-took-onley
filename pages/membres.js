import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const btn = { border: 0, borderRadius: 12, padding: '11px 13px', background: BLUE, color: '#fff', fontWeight: 800, cursor: 'pointer' };
const input = { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1px solid #d7dde5', fontSize: 16 };

export default function Membres() {
  const [session, setSession] = useState(null); const [me, setMe] = useState(null);
  const [query, setQuery] = useState(''); const [results, setResults] = useState([]); const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]); const [active, setActive] = useState(null); const [messages, setMessages] = useState([]); const [text, setText] = useState('');
  const [error, setError] = useState(''); const recorderRef = useRef(null); const [recording, setRecording] = useState(false);
  const auth = () => ({ Authorization: `Bearer ${session?.access_token}` });

  async function api(path, options = {}) {
    const r = await fetch(path, { ...options, headers: { ...auth(), ...(options.headers || {}) } });
    const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'Erreur'); return data;
  }
  async function refresh() {
    if (!session) return;
    try { const [profile, list, saved] = await Promise.all([api('/api/members'), api('/api/member-conversations'), api('/api/members/contacts')]); setMe(profile); setConversations(list); setContacts(saved); } catch (e) { setError(e.message); }
  }
  useEffect(() => { const client = getSupabaseBrowser(); client.auth.getSession().then(({ data }) => setSession(data.session)); const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next)); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { refresh(); }, [session]);
  useEffect(() => { if (!active || !session) return; const load = () => api(`/api/member-messages?conversationId=${active.id}`).then(setMessages).catch((e) => setError(e.message)); load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [active, session]);
  useEffect(() => { const t = setTimeout(async () => { if (query.trim().length < 3 || !session) return setResults([]); try { setResults(await api(`/api/members/search?q=${encodeURIComponent(query.trim())}`)); } catch (e) { setError(e.message); } }, 350); return () => clearTimeout(t); }, [query, session]);
  async function openMember(member) { try { const conv = await api('/api/member-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: member.id }) }); setActive({ ...conv, partner: member }); await refresh(); } catch (e) { setError(e.message); } }
  async function contact(memberId) { try { await api('/api/members/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }) }); await refresh(); } catch (e) { setError(e.message); } }
  async function block(memberId) { if (!confirm('Bloquer ce membre ? Il ne pourra plus te contacter ni voir tes stories.')) return; try { await api('/api/members/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }) }); setActive(null); await refresh(); } catch (e) { setError(e.message); } }
  async function send(content = text, messageType = 'text', mediaUrl = null, durationSeconds = null) { try { if (!active) return; const message = await api('/api/member-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: active.id, content, messageType, mediaUrl, durationSeconds }) }); setMessages((old) => [...old, message]); setText(''); } catch (e) { setError(e.message); } }
  async function upload(file, folder) { const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); const r = await fetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify({ fileBase64: source, folder }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Upload impossible'); return data.url; }
  async function pickMedia(e) { const file = e.target.files?.[0]; if (!file) return; try { const type = file.type.startsWith('video/') ? 'video' : 'image'; const url = await upload(file, `members/${type}`); await send('', type, url); } catch (err) { setError(err.message); } e.target.value = ''; }
  async function toggleAudio() { if (recording) return recorderRef.current?.stop(); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const chunks = []; const start = Date.now(); recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data); recorder.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); setRecording(false); try { const file = new File([new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })], 'vocal.webm', { type: recorder.mimeType || 'audio/webm' }); const url = await upload(file, 'members/audio'); await send('', 'audio', url, Math.ceil((Date.now() - start) / 1000)); } catch (err) { setError(err.message); } }; recorder.start(); recorderRef.current = recorder; setRecording(true); } catch { setError('Autorise le microphone pour envoyer un vocal.'); } }

  if (!session) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#f3f7fa', padding: 20 }}><section style={{ maxWidth: 460, background: 'white', borderRadius: 20, padding: 28, textAlign: 'center' }}><h1>Wakh Reek Membres</h1><p>Crée un compte ou connecte-toi pour discuter avec les membres enregistrés.</p><a href="/compte" style={{ ...btn, display: 'inline-block', textDecoration: 'none' }}>Accéder à mon compte</a></section></main>;

  return <main style={{ minHeight: '100vh', background: '#f3f7fa', fontFamily: 'Inter,system-ui,sans-serif', color: '#102038', overflowX: 'hidden' }}>
    <header style={{ background: BLUE, color: 'white', padding: 16, textAlign: 'center' }}>
      <a href="/" style={{ color: 'white', fontWeight: 900, fontSize: 23, textDecoration: 'none' }}>ONLY TOK – WAKH REEK</a>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/" style={{ color: 'white' }}>Marché</a><span style={{ opacity: .65 }}>·</span><b>Membres</b><span style={{ opacity: .65 }}>·</span><a href="/profil" style={{ color: 'white', fontWeight: 800 }}>Profil</a><span style={{ opacity: .65 }}>·</span><a href="/vendeur" style={{ color: 'white' }}>Espace vendeur</a>
      </div>
    </header>

    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 16, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><b>{me?.full_name || session.user.email}</b><span style={{ color: '#61718b' }}> · session active sur cet appareil</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/profil" style={{ ...btn, textDecoration: 'none', background: '#e7f6ff', color: BLUE }}>Mon profil</a>
          <button onClick={() => getSupabaseBrowser().auth.signOut().then(() => location.href = '/compte')} style={{ border: 0, background: 'none', color: '#b42318', padding: '10px 4px', cursor: 'pointer' }}>Déconnexion</button>
        </div>
      </div>

      {error && <p style={{ background: '#fff0f0', padding: 10, borderRadius: 10, color: '#b42318' }}>{error}</p>}

      <section style={{ background: 'white', padding: 16, borderRadius: 16 }}>
        <h2 style={{ marginTop: 0 }}>Trouver un membre</h2>
        <input style={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom ou numéro de téléphone" />
        {results.map((member) => <div key={member.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eef1f4', flexWrap: 'wrap' }}><div style={{ flex: '1 1 180px' }}><b>{member.full_name || 'Membre Wakh Reek'}</b><div style={{ color: '#657080', fontSize: 13 }}>{member.phone || 'Téléphone non affiché'} · {member.role === 'seller' ? 'Vendeur' : 'Membre'}</div></div><button onClick={() => openMember(member)} style={btn}>Discuter</button><button onClick={() => contact(member.id)} style={{ ...btn, background: '#e7f6ff', color: BLUE }}>Ajouter</button><button onClick={() => block(member.id)} style={{ border: 0, color: '#b42318', background: 'none' }}>Bloquer</button></div>)}
      </section>

      <div className="member-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, .8fr) minmax(0, 2fr)', gap: 16, marginTop: 16 }}>
        <aside style={{ background: 'white', borderRadius: 16, padding: 16, minWidth: 0 }}>
          <h2>Mes amis</h2>
          {contacts.length ? contacts.map((p) => <button key={p.id} onClick={() => openMember(p)} style={{ width: '100%', textAlign: 'left', padding: 10, border: 0, borderBottom: '1px solid #eef1f4', background: 'white' }}><b>{p.full_name || p.phone}</b></button>) : <p style={{ color: '#657080' }}>Aucun ami enregistré. C’est facultatif.</p>}
          <h2>Discussions</h2>
          {conversations.map((c) => <button key={c.id} onClick={() => setActive(c)} style={{ width: '100%', textAlign: 'left', padding: 10, border: 0, borderBottom: '1px solid #eef1f4', background: active?.id === c.id ? '#e7f6ff' : 'white' }}><b>{c.partner?.full_name || c.partner?.phone || 'Membre'}</b></button>)}
        </aside>

        <section style={{ background: 'white', borderRadius: 16, padding: 16, minHeight: 470, minWidth: 0 }}>
          {active ? <><h2 style={{ marginTop: 0 }}>{active.partner?.full_name || active.partner?.phone || 'Discussion'}</h2><div style={{ height: 310, overflowY: 'auto', background: '#f6f8fb', borderRadius: 12, padding: 12 }}>{messages.map((m) => <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_id === session.user.id ? 'flex-end' : 'flex-start', margin: '8px 0' }}><div style={{ maxWidth: '76%', background: m.sender_id === session.user.id ? BLUE : '#e7ebf0', color: m.sender_id === session.user.id ? 'white' : '#182230', padding: 10, borderRadius: 14, overflowWrap: 'anywhere' }}>{m.content}{m.message_type === 'image' && <img src={m.media_url} alt="image" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginTop: 4 }} />}{m.message_type === 'audio' && <audio src={m.media_url} controls style={{ maxWidth: '100%', marginTop: 4 }} />}{m.message_type === 'video' && <video src={m.media_url} controls style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4 }} />}</div></div>)}</div><div className="composer" style={{ display: 'flex', gap: 8, marginTop: 12 }}><input style={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Écrire un message" /><label style={{ ...btn, display: 'grid', placeItems: 'center' }}>📷<input hidden type="file" accept="image/*,video/*" onChange={pickMedia} /></label><button onClick={toggleAudio} style={{ ...btn, background: recording ? '#e11d48' : '#64748b' }}>{recording ? '■' : '🎙️'}</button><button onClick={() => send()} style={btn}>Envoyer</button></div></> : <div style={{ display: 'grid', placeItems: 'center', minHeight: 320, color: '#657080', textAlign: 'center', padding: 20 }}>Choisis ou cherche un membre enregistré.</div>}
        </section>
      </div>
    </div>

    <style jsx>{`
      @media (max-width: 760px) {
        .member-grid { grid-template-columns: 1fr !important; }
        .composer { flex-wrap: wrap; }
        .composer input { flex: 1 1 100%; }
      }
    `}</style>
  </main>;
}
