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

async function registerNativeToken(token) {
  if (!token) return false;
  const client = getSupabaseBrowser();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) return false;
  const response = await fetch('/api/push/native-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ token })
  });
  if (!response.ok) console.warn('Wakhreek native token registration failed:', response.status);
  return response.ok;
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    let nativeToken = window.__WAKHREEK_FCM_TOKEN || '';
    let stopped = false;
    let retryTimer = null;
    let retryCount = 0;

    const registerNative = async () => {
      if (stopped) return false;
      nativeToken = window.__WAKHREEK_FCM_TOKEN || nativeToken;
      if (!nativeToken) return false;
      return registerNativeToken(nativeToken);
    };

    const scheduleRetries = () => {
      clearInterval(retryTimer);
      retryCount = 0;
      retryTimer = setInterval(async () => {
        retryCount += 1;
        const ok = await registerNative();
        if (ok || retryCount >= 20) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 1500);
    };

    const onNativeToken = async (event) => {
      nativeToken = event?.detail?.token || window.__WAKHREEK_FCM_TOKEN || nativeToken;
      const ok = await registerNative();
      if (!ok) scheduleRetries();
    };

    const onResume = () => {
      if (document.visibilityState === 'visible') {
        registerNative().then((ok) => { if (!ok) scheduleRetries(); });
      }
    };

    window.addEventListener('wakhreek-native-token', onNativeToken);
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);

    const client = getSupabaseBrowser();
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setTimeout(() => {
          registerNative().then((ok) => { if (!ok) scheduleRetries(); });
        }, 300);
      }
    });

    registerNative().then((ok) => { if (!ok) scheduleRetries(); });

    if ('serviceWorker' in navigator) {
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          await enableCallNotifications(registration);
        } catch (error) { console.error('Notifications Wakh Reek:', error); }
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    return () => {
      stopped = true;
      clearInterval(retryTimer);
      window.removeEventListener('wakhreek-native-token', onNativeToken);
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
      authListener?.subscription?.unsubscribe?.();
    };
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
