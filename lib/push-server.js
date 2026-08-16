import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (!configured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://wakhreek.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

export async function userIdFromEmail(email) {
  if (!email || !supabaseAdmin?.auth?.admin) return null;
  const normalized = String(email).toLowerCase();
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const found = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === normalized);
    if (found) return found.id;
    if ((data?.users || []).length < 200) break;
  }
  return null;
}

export async function sendPushToUser(userId, payload) {
  if (!userId || !configure()) return { sent: 0, skipped: true };
  const { data: rows, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error || !rows?.length) return { sent: 0 };

  let sent = 0;
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      }, JSON.stringify(payload), { TTL: 90, urgency: 'high' });
      sent += 1;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', row.id);
      }
    }
  }));
  return { sent };
}
