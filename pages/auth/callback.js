import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseBrowser } from '../../lib/supabase-browser';

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Confirmation en cours…');

  useEffect(() => {
    if (!router.isReady) return;

    async function finishConfirmation() {
      try {
        const code =
          typeof router.query.code === 'string'
            ? router.query.code
            : null;

        if (!code) {
          throw new Error('Code de confirmation manquant.');
        }

        const supabase = getSupabaseBrowser();

        const { error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;

        router.replace('/');
      } catch (error) {
        setMessage(
          error.message || 'Impossible de terminer la confirmation.'
        );
      }
    }

    finishConfirmation();
  }, [router.isReady, router.query.code]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'Inter,system-ui,sans-serif',
      }}
    >
      <p>{message}</p>
    </main>
  );
}
