import { useState } from 'react';
import { supabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const field = { width: '100%', boxSizing: 'border-box', padding: 13, border: '1px solid #d7dde5', borderRadius: 12, marginBottom: 10, fontSize: 16 };

export default function Compte() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('buyer');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error('La clé publique Supabase n’est pas encore configurée sur Vercel.');
      }
      if (mode === 'signup') {
        const { data, error } = await supabaseBrowser.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, role } },
        });
        if (error) throw error;
        if (data.session) window.location.href = role === 'seller' ? '/boutique' : '/';
        else setMessage('Compte créé. Vérifie ton e-mail puis connecte-toi.');
      } else {
        const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (error) {
      setMessage(error.message || 'Une erreur est survenue.');
    } finally { setBusy(false); }
  }

  return <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#e10600,#ff6a00,#ffcc00)', padding: 20, display: 'grid', placeItems: 'center', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <section style={{ width: '100%', maxWidth: 440, background: 'white', padding: 28, borderRadius: 24, boxShadow: '0 16px 50px rgba(0,0,0,.2)' }}>
      <a href="/" style={{ color: BLUE }}>← Retour</a>
      <h1 style={{ marginBottom: 6 }}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>
      <p style={{ color: '#657080', marginTop: 0 }}>Wakh Reek — commerces et échanges de confiance.</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" required />
          <select style={field} value={role} onChange={(e) => setRole(e.target.value)}><option value="buyer">Je suis client</option><option value="seller">Je suis vendeur</option></select></>}
        <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
        <input style={field} type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (6 caractères minimum)" required />
        <button disabled={busy} style={{ width: '100%', padding: 13, border: 0, borderRadius: 12, background: BLUE, color: 'white', fontWeight: 800, fontSize: 16 }}>{busy ? 'Patiente…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
      {message && <p style={{ padding: 12, background: '#eef8ff', borderRadius: 10 }}>{message}</p>}
      <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }} style={{ width: '100%', marginTop: 14, border: 0, background: 'transparent', color: BLUE, cursor: 'pointer' }}>{mode === 'login' ? 'Créer un nouveau compte' : 'J’ai déjà un compte'}</button>
    </section>
  </main>;
}
