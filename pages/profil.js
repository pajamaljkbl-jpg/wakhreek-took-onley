import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';
const field = { width: '100%', boxSizing: 'border-box', padding: 13, border: '1px solid #d7dde5', borderRadius: 12, marginBottom: 10, fontSize: 16 };
const btn = { width: '100%', padding: 13, border: 0, borderRadius: 12, background: BLUE, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' };

export default function Profil() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    supabase.auth.getSession().then(async ({ data }) => {
      const current = data.session;
      if (!current) {
        router.replace('/compte');
        return;
      }

      setSession(current);
      try {
        const r = await fetch('/api/members', {
          headers: { Authorization: `Bearer ${current.access_token}` },
        });
        const profile = await r.json();
        if (!r.ok) throw new Error(profile.error || 'Impossible de charger le profil.');
        setName(profile.full_name || current.user.user_metadata?.full_name || '');
        setPhone(profile.phone || current.user.user_metadata?.phone || '');
        setEmail(profile.email || current.user.email || '');
      } catch (error) {
        setMessage(error.message || 'Impossible de charger le profil.');
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function saveProfile(e) {
    e.preventDefault();
    if (!session) return;
    setSaving(true);
    setMessage('');

    try {
      const r = await fetch('/api/members', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fullName: name, phone }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Impossible d’enregistrer le profil.');
      setMessage('Profil enregistré ✅');
    } catch (error) {
      setMessage(error.message || 'Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace('/compte');
  }

  if (loading) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>Chargement du profil…</main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f7fa', padding: 20, fontFamily: 'Inter,system-ui,sans-serif', color: '#102038' }}>
      <section style={{ maxWidth: 480, margin: '20px auto', background: '#fff', padding: 24, borderRadius: 22, boxShadow: '0 14px 40px rgba(0,0,0,.08)' }}>
        <a href="/membres" style={{ color: BLUE, textDecoration: 'none', fontWeight: 700 }}>← Membres</a>
        <div style={{ display: 'grid', placeItems: 'center', margin: '18px 0' }}>
          <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#e7f6ff', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 900, color: BLUE }}>
            {(name || email || 'W').trim().charAt(0).toUpperCase()}
          </div>
        </div>
        <h1 style={{ textAlign: 'center', marginBottom: 4 }}>{name || 'Profil Wakhreek'}</h1>
        <p style={{ textAlign: 'center', color: '#657080', marginTop: 0 }}>{phone || 'Numéro non renseigné'}</p>

        <form onSubmit={saveProfile} style={{ marginTop: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Nom utilisateur</label>
          <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom utilisateur" required />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Téléphone</label>
          <input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 123 45 67" required />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>E-mail</label>
          <input style={{ ...field, background: '#f6f8fb', color: '#657080' }} value={email} readOnly />

          <button type="submit" disabled={saving} style={btn}>{saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
        </form>

        {message && <p style={{ marginTop: 14, padding: 12, background: '#eef8ff', borderRadius: 10 }}>{message}</p>}

        <button onClick={logout} style={{ width: '100%', marginTop: 18, padding: 12, borderRadius: 12, border: '1px solid #f2b8b5', background: '#fff', color: '#b42318', fontWeight: 800, cursor: 'pointer' }}>Déconnexion</button>
      </section>
    </main>
  );
}
