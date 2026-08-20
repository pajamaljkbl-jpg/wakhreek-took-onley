import crypto from 'crypto';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

function webPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureWebPush() {
  if (!webPushConfigured()) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'https://wakhreek.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  } catch (error) {
    console.error('Web Push VAPID configuration invalid:', error?.message || error);
    return false;
  }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

let cachedGoogleToken = null;
let cachedGoogleTokenExpiresAt = 0;

async function firebaseAccessToken() {
  if (cachedGoogleToken && Date.now() < cachedGoogleTokenExpiresAt - 60_000) return cachedGoogleToken;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  if (!response.ok) {
    console.error('Firebase OAuth:', response.status, await response.text());
    return null;
  }
  const data = await response.json();
  cachedGoogleToken = data.access_token || null;
  cachedGoogleTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedGoogleToken;
}

export async function sendNativePushToUser(userId, payload) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!userId || !projectId || !supabaseAdmin) return { sent: 0, skipped: true, reason: 'config' };
  const accessToken = await firebaseAccessToken();
  if (!accessToken) return { sent: 0, skipped: true, reason: 'oauth' };

  const { data: rows, error } = await supabaseAdmin
    .from('native_push_tokens')
    .select('id, token')
    .eq('user_id', userId);
  if (error) return { sent: 0, error: error.message };
  if (!rows?.length) return { sent: 0, reason: 'no-token' };

  const dataPayload = {
    kind: String(payload.kind || ''),
    callId: String(payload.callId || ''),
    caller: String(payload.caller || payload.body || 'Wakhreek'),
    callType: String(payload.callType || 'audio'),
    url: String(payload.url || 'https://www.wakhreek.com')
  };

  let sent = 0;
  const failures = [];
  await Promise.all(rows.map(async (row) => {
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            data: dataPayload,
            android: { priority: 'high', ttl: '45s' }
          }
        })
      });
      const body = await response.text();
      if (response.ok) {
        sent += 1;
        return;
      }
      failures.push({ status: response.status, body: body.slice(0, 500) });
      console.error('FCM send:', response.status, body);
      if (response.status === 404 || response.status === 400) {
        if (/UNREGISTERED|registration-token-not-registered|Requested entity was not found/i.test(body)) {
          await supabaseAdmin.from('native_push_tokens').delete().eq('id', row.id);
        }
      }
    } catch (error) {
      failures.push({ status: 0, body: error?.message || String(error) });
      console.error('FCM native push:', error);
    }
  }));
  return { sent, failures };
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
  if (!userId) return { sent: 0, skipped: true };

  let webSent = 0;
  if (configureWebPush()) {
    const { data: rows, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!error && rows?.length) {
      await Promise.all(rows.map(async (row) => {
        try {
          await webpush.sendNotification({
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth }
          }, JSON.stringify(payload), { TTL: 90, urgency: 'high' });
          webSent += 1;
        } catch (err) {
          console.error('Web Push send:', err?.message || err);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', row.id);
          }
        }
      }));
    }
  }

  const nativeResult = await sendNativePushToUser(userId, payload);
  return { sent: webSent + Number(nativeResult.sent || 0), webSent, nativeSent: Number(nativeResult.sent || 0), native: nativeResult };
}
