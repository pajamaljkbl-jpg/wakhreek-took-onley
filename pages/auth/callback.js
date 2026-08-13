import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseBrowser } from '../../lib/supabase-browser';

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Confirmation en cours…');

  useEffect(() => {
    async function finishConfirmation() {
      try {
        const hash = new URLSearchParams(
          window.location.hash.replace(/^#/, '')
        );

        const errorDescription = hash.get('error_description');

        if (errorDescription) {
          throw new Error(
            decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          );
        }

        const supabase = getSupabaseBrowser();

        // Supabase JS récupère automatiquement la session
        // depuis #access_token / #refresh_token.
        await new Promise((resolve) => setTimeout(resolve, 700));

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
          throw new Error(
            'Confirmation reçue, mais aucune session n’a été créée.'
          );
        }

        router.replace('/');
      } catch (error) {
        setMessage(
          error.message || 'Impossible de terminer la confirmation.'
        );
      }
    }

    finishConfirmation();
  }, [router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'Inter,system-ui,sans-serif',
        padding: 20,
        textAlign: 'center',
      }}
    >
      <p>{message}</p>
    </main>
  );
}
