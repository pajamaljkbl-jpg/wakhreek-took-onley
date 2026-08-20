// Wakh Reek — empêche l'écran de se mettre en veille pendant un appel.
// Le navigateur fige son minuteur quand l'écran s'éteint : on garde l'écran
// allumé tant que la page d'appel est ouverte ou qu'un appel entrant sonne.
export function requestWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null;
  let lock = null;
  const acquire = async () => {
    try { lock = await navigator.wakeLock.request('screen'); } catch (_) { /* non supporté */ }
  };
  acquire();
  const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    try { lock?.release?.(); } catch (_) {}
  };
}
