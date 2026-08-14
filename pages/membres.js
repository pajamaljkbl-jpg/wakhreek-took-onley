import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const btn = { border: 0, borderRadius: 12, padding: '11px 13px', background: BLUE, color: '#fff', fontWeight: 800, cursor: 'pointer' };
const input = { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1px solid #d7dde5', fontSize: 16 };
function Avatar({ person, size = 46 }) { const label = (person?.full_name || person?.phone || 'W').trim().charAt(0).toUpperCase(); return person?.avatar_url ? <img src={person.avatar_url} alt="Photo de profil" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: `0 0 ${size}px`, border: '2px solid #e7f6ff' }} /> : <div style={{ width: size, height: size, borderRadius: '50%', background: '#e7f6ff', color: BLUE, display: 'grid', placeItems: 'center', fontWeight: 900, flex: `0 0 ${size}px` }}>{label}</div>; }

export default function Membres() {
  const [session, setSession] = useState(null); const [me, setMe] = useState(null);
  const [query, setQuery] = useState(''); const [results, setResults] = useState([]); const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]); const [active, setActive] = useState(null); const [messages, setMessages] = useState([]); const [text, setText] = useState('');
  const [error, setError] = useState(''); const recorderRef = useRef(null); const [recording, setRecording] = useState(false);
  const auth = () => ({ Authorization: `Bearer ${session?.access_token}` });
  async function api(path, options = {}) { const r = await fetch(path, { ...options, headers: { ...auth(), ...(options.headers || {}) } }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'Erreur'); return data; }
  async function refresh() { if (!session) return; try { const [profile, list, saved] = await Promise.all([api('/api/members'), api('/api/member-conversations'), api('/api/members/contacts')]); setMe(profile); setConversations(list); setContacts(saved); } catch (e) { setError(e.message); } }
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

  async function toggleAudio() {
    if (recording) {
      try { recorderRef.current?.stop(); } catch {}
      return;
    }
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone non disponible sur cet appareil.');
      if (typeof MediaRecorder === 'undefined') throw new Error('Enregistrement audio non pris en charge par ce navigateur.');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      const startedAt = Date.now();

      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => { stream.getTracks().forEach((t) => t.stop()); setRecording(false); setError('Erreur pendant l’enregistrement audio.'); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        recorderRef.current = null;
        try {
          if (!chunks.length) throw new Error('Aucun son enregistré. Réessaie en parlant après le démarrage.');
          const finalType = recorder.mimeType || mimeType || 'audio/webm';
          const ext = finalType.includes('mp4') ? 'm4a' : finalType.includes('ogg') ? 'ogg' : 'webm';
          const blob = new Blob(chunks, { type: finalType });
          const file = new File([blob], `vocal.${ext}`, { type: finalType });
          const url = await upload(file, 'members/audio');
          await send('', 'audio', url, Math.max(1, Math.ceil((Date.now() - startedAt) / 1000)));
        } catch (err) { setError(err.message || 'Impossible d’envoyer le message vocal.'); }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') setError('Autorise le microphone dans les réglages de Wakhreek puis réessaie.');
      else if (name === 'NotFoundError') setError('Aucun microphone détecté sur cet appareil.');
      else setError(err?.message || 'Impossible d’utiliser le microphone.');
    }
  }

  if (!session) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#f3f7fa', padding: 20 }}><section style={{ maxWidth: 460, background: 'white', borderRadius: 20, padding: 28, textAlign: 'center' }}><h1>Wakh Reek Membres</h1><p>Crée un compte ou connecte-toi pour discuter avec les membres enregistrés.</p><a href="/compte" style={{ ...btn, display: 'inline-block', textDecoration: 'none' }}>Accéder à mon compte</a></section></main>;
  return <main style={{ minHeight: '100vh', background: '#f3f7fa', fontFamily: 'Inter,system-ui,sans-serif', color: '#102038', overflowX: 'hidden' }}>
    <header style={{ background: BLUE, color: 'white', padding: 16, textAlign: 'center' }}><a href="/" style={{ color: 'white', fontWeight: 900, fontSize: 23, textDecoration: 'none' }}>ONLY TOK – WAKH REEK</a><div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}><a href="/" style={{ color: 'white' }}>Marché</a><span>·</span><b>Membres</b><span>·</span><a href="/profil" style={{ color: 'white', fontWeight: 800 }}>Profil</a><span>·</span><a href="/vendeur" style={{ color: 'white' }}>Espace vendeur</a></div></header>
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 16, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar person={me} size={48}/><div><b>{me?.full_name || session.user.email}</b><div style={{ color: '#61718b', fontSize: 13 }}>{me?.phone || 'session active sur cet appareil'}</div></div></div><div style={{ display: 'flex', gap: 8 }}><a href="/profil" style={{ ...btn, textDecoration: 'none', background: '#e7f6ff', color: BLUE }}>Mon profil</a><button onClick={() => getSupabaseBrowser().auth.signOut().then(() => location.href = '/compte')} style={{ border: 0, background: 'none', color: '#b42318' }}>Déconnexion</button></div></div>
      {error && <p style={{ background: '#fff0f0', padding: 10, borderRadius: 10, color: '#b42318' }}>{error}</p>}
      <section style={{ background: 'white', padding: 16, borderRadius: 16 }}><h2 style={{ marginTop: 0 }}>Trouver un membre</h2><input style={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom ou numéro de téléphone" />{results.map((member) => <div key={member.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eef1f4', flexWrap: 'wrap' }}><Avatar person={member}/><div style={{ flex: '1 1 150px' }}><b>{member.full_name || 'Membre Wakh Reek'}</b><div style={{ color: '#657080', fontSize: 13 }}>{member.phone || 'Téléphone non affiché'} · {member.role === 'seller' ? 'Vendeur' : 'Membre'}</div></div><button onClick={() => openMember(member)} style={btn}>Discuter</button><button onClick={() => contact(member.id)} style={{ ...btn, background: '#e7f6ff', color: BLUE }}>Ajouter</button><button onClick={() => block(member.id)} style={{ border: 0, color: '#b42318', background: 'none' }}>Bloquer</button></div>)}</section>
      <div className="member-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, .8fr) minmax(0, 2fr)', gap: 16, marginTop: 16 }}>
        <aside style={{ background: 'white', borderRadius: 16, padding: 16, minWidth: 0 }}><h2>Mes amis</h2>{contacts.length ? contacts.map((p) => <button key={p.id} onClick={() => openMember(p)} style={{ width: '100%', textAlign: 'left', padding: 10, border: 0, borderBottom: '1px solid #eef1f4', background: 'white', display: 'flex', alignItems: 'center', gap: 10 }}><Avatar person={p} size={40}/><b>{p.full_name || p.phone}</b></button>) : <p style={{ color: '#657080' }}>Aucun ami enregistré. C’est facultatif.</p>}<h2>Discussions</h2>{conversations.map((c) => <button key={c.id} onClick={() => setActive(c)} style={{ width: '100%', textAlign: 'left', padding: 10, border: 0, borderBottom: '1px solid #eef1f4', background: active?.id === c.id ? '#e7f6ff' : 'white', display: 'flex', alignItems: 'center', gap: 10 }}><Avatar person={c.partner} size={40}/><b>{c.partner?.full_name || c.partner?.phone || 'Membre'}</b></button>)}</aside>
        <section style={{ background: 'white', borderRadius: 16, padding: 16, minHeight: 470, minWidth: 0 }}>{active ? <><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><Avatar person={active.partner} size={48}/><div><h2 style={{ margin: 0 }}>{active.partner?.full_name || active.partner?.phone || 'Discussion'}</h2><small style={{ color: '#657080' }}>{active.partner?.phone || ''}</small></div></div><div style={{ height: 310, overflowY: 'auto', background: '#f6f8fb', borderRadius: 12, padding: 12 }}>{messages.map((m) => <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_id === session.user.id ? 'flex-end' : 'flex-start', margin: '8px 0' }}><div style={{ maxWidth: '76%', background: m.sender_id === session.user.id ? BLUE : '#e7ebf0', color: m.sender_id === session.user.id ? 'white' : '#182230', padding: 10, borderRadius: 14, overflowWrap: 'anywhere' }}>{m.content}{m.message_type === 'image' && <img src={m.media_url} alt="image" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginTop: 4 }} />}{m.message_type === 'audio' && <audio src={m.media_url} controls style={{ maxWidth: '100%', marginTop: 4 }} />}{m.message_type === 'video' && <video src={m.media_url} controls style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4 }} />}</div></div>)}</div><div className="composer" style={{ display: 'flex', gap: 8, marginTop: 12 }}><input style={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Écrire un message" /><label style={{ ...btn, display: 'grid', placeItems: 'center' }}>📷<input hidden type="file" accept="image/*,video/*" onChange={pickMedia} /></label><button onClick={toggleAudio} aria-label={recording ? 'Arrêter le vocal' : 'Enregistrer un vocal'} style={{ ...btn, background: recording ? '#e11d48' : '#64748b', minWidth: 52 }}>{recording ? '■' : '🎙️'}</button><button onClick={() => send()} style={btn}>Envoyer</button></div>{recording && <div style={{ marginTop: 8, color: '#e11d48', fontWeight: 800 }}>● Enregistrement en cours… appuie sur ■ pour envoyer</div>}</> : <div style={{ display: 'grid', placeItems: 'center', minHeight: 320, color: '#657080', textAlign: 'center', padding: 20 }}>Choisis ou cherche un membre enregistré.</div>}</section>
      </div>
    </div><style jsx>{`@media (max-width:760px){.member-grid{grid-template-columns:1fr!important}.composer{flex-wrap:wrap}.composer input{flex:1 1 100%}}`}</style>
  </main>;
}
