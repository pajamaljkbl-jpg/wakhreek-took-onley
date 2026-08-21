// Wake Lock intentionally disabled.
// Keeping this module as a no-op preserves existing imports while preventing
// browser wake-lock behavior from interfering with calls or page lifecycle.
export function requestWakeLock() {
  return undefined;
}
