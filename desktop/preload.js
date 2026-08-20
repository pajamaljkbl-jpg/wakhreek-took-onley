// Pont entre le site Wakhreek (chargé dans la fenêtre) et l'application.
// Lit la session Supabase stockée dans localStorage et l'envoie au processus
// principal, qui s'en sert pour détecter les appels entrants en arrière-plan.
const { contextBridge, ipcRenderer } = require('electron');

function readSupabaseToken() {
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      // Supabase stocke la session sous "sb-<ref>-auth-token"
      if (key && key.endsWith('-auth-token')) {
        const raw = window.localStorage.getItem(key);
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token;
        if (token) {
          return {
            access_token: token,
            refresh_token: parsed.refresh_token || null,
            expires_at: parsed.expires_at ? parsed.expires_at * 1000 : null,
          };
        }
      }
    }
  } catch (_) {}
  return null;
}

function pushToken() {
  const token = readSupabaseToken();
  if (token) ipcRenderer.send('wakhreek-auth', token);
}

// Transmet la session régulièrement + au démarrage + à chaque changement.
pushToken();
setInterval(pushToken, 2000);
window.addEventListener('focus', pushToken);

contextBridge.exposeInMainWorld('wakhreekDesktop', {
  openCall: (url) => ipcRenderer.send('wakhreek-open-call', url),
});
