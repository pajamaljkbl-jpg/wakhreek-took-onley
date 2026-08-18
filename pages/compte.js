import { useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const field = { width: '100%', boxSizing: 'border-box', padding: 13, border: '1px solid #d7dde5', borderRadius: 12, marginBottom: 10, fontSize: 16 };

export default function Compte() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('buyer');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function forgotPassword() {
    if (!email) {
      setMessage('Entre d’abord ton adresse e-mail.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const supabaseBrowser = getSupabaseBrowser();
      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://wakhreek.com/reset-password',
      });
      if (error) throw error;
      setMessage('Lien de réinitialisation envoyé. Vérifie ta boîte e-mail.');
    } catch (error) {
      setMessage(error.message || 'Impossible d’envoyer le lien de réinitialisation.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const supabaseBrowser = getSupabaseBrowser();
      if (mode === 'signup') {
        if (phone.replace(/\D/g, '').length < 8) throw new Error('Entre un numéro de téléphone valide.');
        if (!acceptTerms) throw new Error('Tu dois accepter les règles de Wakh Reek pour créer un compte.');

        // Vérification côté serveur AVANT de créer l'utilisateur Supabase.
        // Un e-mail et un numéro de téléphone ne peuvent appartenir qu'à un seul compte.
        const identityResponse = await fetch('/api/auth/check-identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone }),
        });
        const identity = await identityResponse.json().catch(() => ({}));
        if (!identityResponse.ok) throw new Error(identity.error || 'Impossible de vérifier ce compte.');

        const { data, error } = await supabaseBrowser.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: 'https://wakhreek.com/auth/callback',
            data: { full_name: name.trim(), role, phone: phone.trim() },
          },
        });
        if (error) throw error;
        if (data.user) {
          const token = data.session?.access_token;
          if (token) {
            const profileResponse = await fetch('/api/members', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ fullName: name, phone, acceptedTerms: true }),
            });
            const profileResult = await profileResponse.json().catch(() => ({}));
            if (!profileResponse.ok) throw new Error(profileResult.error || 'Impossible d’enregistrer le numéro de téléphone.');
          }
        }
        if (data.session) window.location.href = role === 'seller' ? '/vendeur' : '/';
        else setMessage('Compte créé. Vérifie ton e-mail puis connecte-toi.');
      } else {
        const { error } = await supabaseBrowser.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
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
          <input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (ex. +221 77 123 45 67)" required />
          <select style={field} value={role} onChange={(e) => setRole(e.target.value)}><option value="buyer">Je suis client</option><option value="seller">Je suis vendeur</option></select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, margin: '4px 0 14px', color: '#3d4856' }}><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required /> <span>J’accepte les règles de Wakh Reek : respect des personnes, pas de fraude, pas de contenu illégal ou nuisible. Les signalements sont examinés par un administrateur.</span></label></>}
        <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
        <input style={field} type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (6 caractères minimum)" required />
        {mode === 'login' && <button type="button" onClick={forgotPassword} disabled={busy} style={{ display: 'block', margin: '-2px 0 14px auto', border: 0, background: 'transparent', color: BLUE, fontWeight: 700, cursor: 'pointer' }}>Mot de passe oublié ?</button>}
        <button disabled={busy} style={{ width: '100%', padding: 13, border: 0, borderRadius: 12, background: BLUE, color: 'white', fontWeight: 800, fontSize: 16 }}>{busy ? 'Patiente…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
      {message && <p style={{ padding: 12, background: '#eef8ff', borderRadius: 10 }}>{message}</p>}
      <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }} style={{ width: '100%', marginTop: 14, border: 0, background: 'transparent', color: BLUE, cursor: 'pointer' }}>{mode === 'login' ? 'Créer un nouveau compte' : 'J’ai déjà un compte'}</button>
    </section>
  </main>;
}
