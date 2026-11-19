let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export async function unlockAudio(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

export async function playSignal(
  type: 'start' | 'countdown' | 'finish' = 'finish',
  enabled = true,
  force = false,
): Promise<boolean> {
  if (!enabled && !force) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(type === 'start' ? 35 : type === 'countdown' ? 25 : [90, 60, 120]);
    }
  } catch {
    // ignore vibration unsupported
  }

  const ctx = await unlockAudio();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    const tones: [number, number, number][] =
      type === 'start'
        ? [[0, 660, 0.08]]
        : type === 'countdown'
          ? [[0, 740, 0.12]]
          : [
              [0, 880, 0.15],
              [0.23, 1100, 0.15],
              [0.46, 880, 0.23],
            ];

    for (const [delay, hz, duration] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.exponentialRampToValueAtTime(type === 'start' ? 0.08 : 0.2, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

export function downloadFile(name: string, content: string | Blob, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
