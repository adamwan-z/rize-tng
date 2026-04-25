// Web Audio chime. Two-note arpeggio, ~250ms total.
// No assets, no library. Honors prefers-reduced-motion as a soft mute.
export function playHandoffCue() {
  if (typeof window === 'undefined') return;
  const reduced =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced) return;

  const ctx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  const notes = [659.25, 880]; // E5, A5
  const noteDuration = 0.12;
  const gap = 0.04;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = ctx.currentTime + i * (noteDuration + gap);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + noteDuration + 0.02);
  });

  setTimeout(() => ctx.close().catch(() => null), 800);
}
