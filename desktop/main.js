// Wakhreek Desktop — application Windows (type WhatsApp Desktop).
// - Reste dans la barre des tâches quand on ferme la fenêtre.
// - Surveille les appels entrants (même fenêtre fermée) et sonne.
// - Affiche une notification "Répondre / Refuser".
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const SITE_URL = 'https://www.wakhreek.com';
const POLL_MS = 2000; // interroge le serveur toutes les 2 s
const AUTH_FILE = () => path.join(app.getPath('userData'), 'wakhreek-auth.json');

let mainWindow = null;
let tray = null;
let quitting = false;

// --- Configuration publique (Supabase) récupérée du site ---
let config = { supabaseUrl: '', supabaseAnonKey: '', siteUrl: SITE_URL };

// --- Session stockée (pour interroger l'API en arrière-plan) ---
let session = null; // { access_token, refresh_token, expires_at }

// --- État d'appel courant (anti-doublon) ---
let ringingCallId = null;
let ringingNotification = null;

function loadStoredSession() {
  try {
    const raw = fs.readFileSync(AUTH_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.access_token) session = parsed;
  } catch (_) { /* pas encore de session */ }
}

function saveStoredSession() {
  try {
    if (session) fs.writeFileSync(AUTH_FILE(), JSON.stringify(session));
  } catch (_) {}
}

function clearSession() {
  session = null;
  try { fs.unlinkSync(AUTH_FILE()); } catch (_) {}
}

async function fetchConfig() {
  try {
    const res = await fetch(`${SITE_URL}/api/public-config`, { cache: 'no-store' });
    const data = await res.json();
    if (data?.supabaseUrl) config = { supabaseUrl: data.supabaseUrl, supabaseAnonKey: data.supabaseAnonKey, siteUrl: data.siteUrl || SITE_URL };
  } catch (_) {}
}

async function refreshToken() {
  if (!session?.refresh_token || !config.supabaseUrl || !config.supabaseAnonKey) return false;
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    saveStoredSession();
    return true;
  } catch (_) {
    return false;
  }
}

async function ensureFreshToken() {
  if (!session) return null;
  if (session.expires_at && Date.now() > session.expires_at - 60_000) {
    const ok = await refreshToken();
    if (!ok) { clearSession(); return null; }
  }
  return session.access_token;
}

async function checkIncomingCall() {
  const token = await ensureFreshToken();
  if (!token) return;

  let call = null;
  try {
    const res = await fetch(`${SITE_URL}/api/calls?incoming=1`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) {
      const ok = await refreshToken();
      if (!ok) { clearSession(); }
      return;
    }
    if (res.ok) call = await res.json();
  } catch (_) { return; }

  if (call && call.id && call.status === 'ringing') {
    if (ringingCallId !== call.id) {
      ringingCallId = call.id;
      showIncomingCall(call);
    }
  } else if (!call && ringingCallId) {
    // L'appel a expiré ou a été annulé → on referme la sonnerie.
    ringingCallId = null;
    try { ringingNotification?.close?.(); } catch (_) {}
    ringingNotification = null;
  }
}

function callUrl(call) {
  const conv = call.conversation_id || '';
  return `${SITE_URL}/appel?conversationId=${encodeURIComponent(conv)}`;
}

function openCall(call) {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.loadURL(callUrl(call));
}

async function refuseCall(call) {
  const token = await ensureFreshToken();
  if (!token) return;
  try {
    await fetch(`${SITE_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'end', conversationId: call.conversation_id, callId: call.id }),
    });
  } catch (_) {}
}

function showIncomingCall(call) {
  const callerName = call.caller?.full_name || call.caller?.phone || 'Un membre Wakh Reek';
  const isVideo = call.call_type === 'video';

  if (Notification.isSupported()) {
    ringingNotification = new Notification({
      title: isVideo ? 'Appel vidéo Wakh Reek' : 'Appel audio Wakh Reek',
      body: `${callerName} vous appelle`,
      silent: false,
      urgency: 'critical',
      actions: [
        { type: 'button', text: '📞 Répondre' },
        { type: 'button', text: '✖ Refuser' },
      ],
    });
    ringingNotification.on('click', () => openCall(call));
    ringingNotification.on('action', (_event, index) => {
      if (index === 0) openCall(call);
      else refuseCall(call);
    });
    ringingNotification.on('close', () => { ringingNotification = null; });
    ringingNotification.show();
  }

  // Ouvre aussi la fenêtre (sans la mettre en avant) pour que la page
  // d'appel sonne comme sur le site.
  if (mainWindow) {
    try { mainWindow.loadURL(callUrl(call)); } catch (_) {}
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(SITE_URL);

  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide(); // fermer = minimiser dans la barre des tâches
    }
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.ico'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  const menu = Menu.buildFromTemplate([
    { label: 'Ouvrir Wakhreek', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setToolTip('Wakhreek');
  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// --- Réception du jeton depuis la page (localStorage du site) ---
ipcMain.on('wakhreek-auth', (_event, token) => {
  if (token && token.access_token) {
    const changed = !session || session.access_token !== token.access_token;
    session = {
      access_token: token.access_token,
      refresh_token: token.refresh_token || session?.refresh_token || null,
      expires_at: token.expires_at || Date.now() + 3600_000,
    };
    if (changed) saveStoredSession();
  }
});

ipcMain.on('wakhreek-open-call', (_event, url) => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.loadURL(url); }
});

app.whenReady().then(async () => {
  loadStoredSession();
  await fetchConfig();
  createWindow();
  createTray();

  setInterval(checkIncomingCall, POLL_MS);
  checkIncomingCall();

  app.on('activate', () => { mainWindow?.show(); });
});

app.on('window-all-closed', () => {
  // On ne quitte pas : l'app reste dans la barre des tâches.
});
