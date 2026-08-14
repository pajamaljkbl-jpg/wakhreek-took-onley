import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseBrowser } from '../../lib/supabase-browser';

const BLUE = '#019EE5';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Confirmation en cours…');
  const [profile, setProfile] = useState({ name: '', phone: '', role: '', email: '' });

  useEffect(() => {
    async function finishConfirmation() {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const errorDescription = hash.get('error_description');

        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        }

        const supabase = getSupabaseBrowser();

        // Supabase récupère la session depuis le hash de confirmation.
        await new Promise((resolve) => setTimeout(resolve, 700));

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!session) {
          throw new Error('Confirmation reçue, mais aucune session n’a été créée.');
        }

        const user = session.user;
        const meta = user.user_metadata || {};

        setProfile({
          name: meta.full_name || 'Membre Wakhreek',
          phone: meta.phone || 'Numéro non renseigné',
          role: meta.role === 'seller' ? 'Vendeur' : 'Client',
          email: user.email || '',
        });

        // Nettoie immédiatement #access_token... de la barre d’adresse.
        window.history.replaceState({}, document.title, '/auth/callback');

        setStatus('success');
        setMessage('Votre adresse e-mail a été confirmée avec succès.');
      } catch (error) {
        setStatus('error');
        setMessage(error.message || 'Impossible de terminer la confirmation.');
      }
    }

    finishConfirmation();
  }, []);

  if (status === 'loading') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Inter,system-ui,sans-serif', padding: 20, textAlign: 'center', background: '#f4f8fb' }}>
        <div>
          <div style={{ fontSize: 42, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{message}</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Inter,system-ui,sans-serif', padding: 20, background: '#f4f8fb' }}>
        <section style={{ width: '100%', maxWidth: 440, background: '#fff', padding: 26, borderRadius: 22, boxShadow: '0 14px 40px rgba(0,0,0,.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>⚠️</div>
          <h1 style={{ marginBottom: 8 }}>Confirmation impossible</h1>
          <p style={{ color: '#657080' }}>{message}</p>
          <button onClick={() => router.replace('/compte')} style={{ width: '100%', padding: 13, border: 0, borderRadius: 12, background: BLUE, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>Retour à la connexion</button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Inter,system-ui,sans-serif', padding: 20, background: 'linear-gradient(135deg,#e9f7ff,#fff7ea)' }}>
      <section style={{ width: '100%', maxWidth: 440, background: '#fff', padding: 28, borderRadius: 24, boxShadow: '0 16px 50px rgba(0,0,0,.10)', textAlign: 'center' }}>
        <div style={{ width: 86, height: 86, borderRadius: '50%', margin: '0 auto 16px', background: '#e7f6ff', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 900, color: BLUE }}>
          {(profile.name || 'W').trim().charAt(0).toUpperCase()}
        </div>

        <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Bienvenue sur Wakhreek ✅</h1>
        <p style={{ margin: '0 0 22px', color: '#657080' }}>{message}</p>

        <div style={{ textAlign: 'left', background: '#f7fafc', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: '6px 0' }}><strong>Nom :</strong> {profile.name}</p>
          <p style={{ margin: '6px 0' }}><strong>Téléphone :</strong> {profile.phone}</p>
          <p style={{ margin: '6px 0' }}><strong>E-mail :</strong> {profile.email}</p>
          <p style={{ margin: '6px 0' }}><strong>Compte :</strong> {profile.role}</p>
        </div>

        <button onClick={() => router.replace('/')} style={{ width: '100%', padding: 14, border: 0, borderRadius: 12, background: BLUE, color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>Continuer vers Wakhreek</button>
      </section>
    </main>
  );
}
