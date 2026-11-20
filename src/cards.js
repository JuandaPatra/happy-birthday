import * as THREE from 'three';

export const CARD_W = 1.2;
export const CARD_H = 1.6;

const W = 512;
const H = 683; // rasio 3:4, sama dengan kartu 1.2 x 1.6
const INK = '#1d1a17';

// Bingkai ala foto cetak: tepi putih tebal, area foto di dalam.
function frame(draw, caption) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#faf7f0';
  g.fillRect(0, 0, W, H);
  g.save();
  g.beginPath();
  g.rect(32, 32, 448, 539);
  g.clip();
  draw(g);
  g.restore();
  if (caption) {
    g.fillStyle = INK;
    g.font = 'italic 400 28px Fraunces, serif';
    g.textAlign = 'center';
    g.fillText(caption, W / 2, 625, 440);
  }
  return c;
}

// Placeholder yang jujur: bertanda [FOTO n], tidak menyamar jadi foto asli.
export async function placeholderCanvas(n, note) {
  await document.fonts.load('600 44px Fraunces').catch(() => {});
  return frame((g) => {
    g.fillStyle = '#d9cdb8';
    g.fillRect(32, 32, 448, 539);
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.font = '600 48px Fraunces, serif';
    g.fillText(`[FOTO ${n}]`, W / 2, 290);
    g.font = '400 22px system-ui, sans-serif';
    g.fillText(note || 'Ganti di src/config.js', W / 2, 335);
  });
}

function wrap(g, text, maxW) {
  const lines = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && g.measureText(t).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Kartu ucapan: muncul lebih dulu sebelum foto. Teksnya juga dibacakan lewat #status.
export async function greetingCanvas(name, message) {
  await Promise.all(['600 48px Fraunces', '400 38px Fraunces'].map((f) => document.fonts.load(f))).catch(() => {});
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#faf7f0';
  g.fillRect(0, 0, 768, 1024);
  g.strokeStyle = '#7a1f2b';
  g.lineWidth = 3;
  g.strokeRect(36, 36, 696, 952);
  g.fillStyle = INK;
  g.textAlign = 'center';
  let y = 270;
  const block = (text, font, lh) => {
    g.font = font;
    for (const line of wrap(g, text, 560)) {
      g.fillText(line, 384, y);
      y += lh;
    }
  };
  block('Selamat ulang tahun,', '600 54px Fraunces, serif', 68);
  y += 6;
  block(name, '600 76px Fraunces, serif', 90);
  g.fillStyle = '#7a1f2b';
  g.fillRect(344, y, 80, 4);
  g.fillStyle = INK;
  y += 70;
  block(message, '400 44px Fraunces, serif', 64);
  return c;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    img.src = src;
  });
}

// Mengembalikan { canvas, failed }. Foto gagal dimuat diganti placeholder.
export async function buildCanvas(photo, n) {
  if (!photo) return { canvas: await placeholderCanvas(n), failed: false };
  try {
    const img = await loadImage(photo.src);
    const canvas = frame((g) => {
      const s = Math.max(448 / img.naturalWidth, 539 / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      g.drawImage(img, 32 + (448 - w) / 2, 32 + (539 - h) / 2, w, h);
    }, photo.caption);
    return { canvas, failed: false };
  } catch {
    return { canvas: await placeholderCanvas(n, 'Foto gagal dimuat'), failed: true };
  }
}

export function setFace(mesh, canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = mesh.material[4];
  m.map = tex;
  // Cahaya sedikit dari tekstur sendiri supaya kertas tidak tampak kusam di bawah lampu adegan.
  m.emissive.set('#ffffff');
  m.emissiveMap = tex;
  m.emissiveIntensity = 0.35;
  m.needsUpdate = true;
}

export function makeCard(i) {
  const edge = new THREE.MeshStandardMaterial({ color: '#f3eee3', roughness: 0.9 });
  const front = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_H, 0.03), [edge, edge, edge, edge, front, edge]);
  mesh.rotation.order = 'YXZ';
  mesh.userData.i = i;
  return mesh;
}
