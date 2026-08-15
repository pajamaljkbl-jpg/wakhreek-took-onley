import { useEffect } from 'react';
import Head from 'next/head';
import { getSupabaseBrowser } from '../lib/supabase-browser';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function enableCallNotifications(registration) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission === 'denied') return;
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  const client = getSupabaseBrowser();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) return;
  await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await enableCallNotifications(registration);
      } catch (error) { console.error('Notifications Wakh Reek:', error); }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return <><Head>
    <meta name="application-name" content="Wakhreek" />
    <meta name="theme-color" content="#019EE5" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Wakhreek" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/icon-192.png" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
  </Head><Component {...pageProps} /></>;
}
