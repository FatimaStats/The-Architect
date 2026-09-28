// Minimal synthesised sound design (no audio files). Soft, low, architectural.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone({ freq = 220, type = 'sine', dur = 0.15, gain = 0.3, attack = 0.005, glide = 0, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function thud(freq = 90, gain = 0.4, dur = 0.12) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq * 6;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
  tone({ freq, type: 'sine', dur: dur * 1.2, gain: gain * 0.5, glide: 0.6 });
}

const SOUNDS = {
  roll: () => thud(80, 0.35, 0.1),
  stand: () => thud(110, 0.45, 0.12),
  drift: () => thud(70, 0.25, 0.09),
  switch: () => {
    tone({ freq: 660, type: 'triangle', dur: 0.08, gain: 0.12 });
    tone({ freq: 990, type: 'sine', dur: 0.12, gain: 0.08, delay: 0.05 });
  },
  key: () => [880, 1320, 1760].forEach((f, i) => tone({ freq: f, dur: 0.25, gain: 0.08, delay: i * 0.06 })),
  teleport: () => tone({ freq: 300, type: 'sine', dur: 0.4, gain: 0.15, glide: 3 }),
  crumble: () => thud(60, 0.25, 0.25),
  break: () => thud(50, 0.5, 0.35),
  fall: () => tone({ freq: 220, type: 'sine', dur: 0.8, gain: 0.15, glide: 0.25 }),
  lift: () => tone({ freq: 140, type: 'triangle', dur: 0.35, gain: 0.1, glide: 1.5 }),
  rotor: () => thud(95, 0.2, 0.2),
  win: () => [392, 523.25, 659.25, 783.99].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 1.2, gain: 0.09, delay: i * 0.09 })),
  ui: () => tone({ freq: 520, type: 'sine', dur: 0.05, gain: 0.05 }),
};

export function play(name) {
  SOUNDS[name]?.();
}
export function setMuted(m) {
  muted = m;
}
export function isMuted() {
  return muted;
}
