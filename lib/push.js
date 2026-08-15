import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushToUser(userId, payload) {
  if (!configured() || !userId) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@wakhreek.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  const { data: rows, error } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', userId);
  if (error) throw error;
  await Promise.all((rows || []).map(async (row) => {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 60, urgency: 'high' });
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      } else console.error('Push Wakh Reek:', error?.message || error);
    }
  }));
}
