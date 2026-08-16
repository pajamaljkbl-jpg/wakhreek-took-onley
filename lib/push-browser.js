import { getSupabaseBrowser } from './supabase-browser';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enableBackgroundCallNotifications() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Les notifications en arrière-plan ne sont pas prises en charge sur cet appareil.');
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('Clé de notifications Wakh Reek absente.');

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorise les notifications Wakh Reek dans les réglages du téléphone.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const oldKey = subscription.options?.applicationServerKey;
    const wanted = urlBase64ToUint8Array(publicKey);
    if (oldKey && oldKey.byteLength === wanted.byteLength) {
      const current = new Uint8Array(oldKey);
      let same = true;
      for (let i = 0; i < wanted.length; i += 1) if (current[i] !== wanted[i]) { same = false; break; }
      if (!same) { await subscription.unsubscribe(); subscription = null; }
    }
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  const client = getSupabaseBrowser();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Connecte-toi avant d’activer les appels en arrière-plan.');
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Impossible d’enregistrer ce téléphone pour les appels.');
  try { navigator.vibrate?.([250, 120, 250]); } catch {}
  return true;
}
