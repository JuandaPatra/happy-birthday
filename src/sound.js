// Efek suara disintesis di browser (Web Audio), tanpa file audio.
let ctx;
let noise;
let muted = false;

// Harus dipanggil dari aksi pengguna (klik/Enter) agar Safari mengizinkan audio.
export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx ||= new AC();
  if (ctx.state === 'suspended') ctx.resume();
}

export const setMuted = (m) => (muted = m);

export const cardIn = (i) => swoosh(i, true);
export const cardOut = (i) => swoosh(i, false);

// Desir kertas pendek + denting lembut. Masuk: sapuan dan nada naik. Kembali: kebalikannya.
function swoosh(i, up) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(up ? 1200 : 3200, t);
  bp.frequency.exponentialRampToValueAtTime(up ? 3200 : 1200, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);

  const o = ctx.createOscillator();
  o.type = 'sine';
  const step = up ? i % 8 : 7 - (i % 8);
  o.frequency.value = 520 * 2 ** ((step / 12) * 2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t + 0.05);
  og.gain.exponentialRampToValueAtTime(0.08, t + 0.07);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(og).connect(ctx.destination);
  o.start(t + 0.05);
  o.stop(t + 0.4);
}
