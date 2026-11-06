let context: AudioContext | undefined;

// Tiny synthesized earcons, created only after a real interaction. No speech,
// audio downloads, or background playback.
export function playAnswer(correct: boolean) {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime;
    for (const [index, frequency] of (correct ? [659.25, 880] : [220, 185]).entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + index * (correct ? 0.085 : 0.065);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(correct ? 0.065 : 0.045, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.22);
    }
  } catch { /* The game still works when browser audio is unavailable. */ }
}
