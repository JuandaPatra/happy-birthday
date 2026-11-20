import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/600.css';
import './style.css';
import * as THREE from 'three';
import { config } from './config.js';
import { createGift } from './gift.js';
import { FOLD_END, createPlane } from './plane.js';
import { cardIn, cardOut, setMuted, unlock } from './sound.js';
import { CARD_H, CARD_W, buildCanvas, greetingCanvas, makeCard, setFace } from './cards.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const items = config.photos.length ? config.photos : Array.from({ length: config.placeholderCount }, () => null);
const N = items.length;
const label = (i) => items[i]?.alt || `Foto ${i + 1}`;

document.title = `Kado ulang tahun untuk ${config.name}`;
$('title').textContent = `Selamat ulang tahun, ${config.name}`;
const HINT = 'Ada kado untukmu. Buka kotaknya untuk melihat isinya.';
$('lead').textContent = HINT;

// Daftar teks untuk pembaca layar; jadi galeri biasa kalau WebGL tidak ada.
const list = $('list');
items.forEach((p, i) => {
  const li = document.createElement('li');
  li.textContent = `${label(i)} dari ${N}`;
  list.append(li);
});

function showFallback() {
  document.body.classList.add('fallback');
  $('stage').hidden = true;
  $('open').hidden = true;
  $('sound').hidden = true;
  $('lead').textContent = config.message;
  list.replaceChildren(
    ...items.map((p, i) => {
      const li = document.createElement('li');
      if (p) {
        const img = new Image();
        img.src = p.src;
        img.alt = label(i);
        img.width = 300;
        img.height = 400;
        li.append(img);
      } else {
        li.className = 'ph';
        li.textContent = `[FOTO ${i + 1}]`;
      }
      return li;
    }),
  );
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
} catch {
  showFallback();
}
if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const TAN = Math.tan((40 / 2) * (Math.PI / 180));

  scene.add(new THREE.HemisphereLight('#fff6e8', '#b9a98f', 1.1));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(4, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gift = createGift();
  scene.add(gift.group);
  const ring = new THREE.Group();
  scene.add(ring);

  const step = (Math.PI * 2) / N;
  const R = Math.max(3, N * 0.25);
  const RING_Y = 2.9;
  const cards = items.map((_, i) => makeCard(i));

  // Kartu ucapan: keluar dari kotak lebih dulu, lalu kembali masuk sebelum foto muncul.
  const GREET_S = 1.7;
  const GREET_POS = new THREE.Vector3(0, 2.6, 2);
  const greeting = makeCard(-1);
  scene.add(greeting);
  // Saat lanjut ke foto, kartu ucapan dilipat jadi pesawat kertas dan terbang keluar layar.
  const plane = createPlane(GREET_POS, GREET_S);
  scene.add(plane.root);

  // ---- State ----
  // closed | opening | greeting | revealing | gallery | focus | closing
  let state = 'closed';
  let idx = 0;
  let ringAngle = 0;
  let ringTarget = 0;
  let time = 0;
  const tl = { t: 0 };
  const STAGGER = Math.min(0.12, 1.6 / N);
  const G = 2.0; // waktu timeline saat kartu ucapan terbuka penuh
  const PHOTOS_AT = G + FOLD_END; // foto mulai keluar saat pesawat mulai terbang
  const TOTAL = PHOTOS_AT + (N - 1) * STAGGER + 1.1;

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
  const mod = (a) => ((a % N) + N) % N;

  function applyTimeline(t) {
    const u = clamp01(t / 1.6);
    const a = ease(clamp01(u / 0.5));
    const b = ease(clamp01((u - 0.5) / 0.5));
    gift.lid.position.set(2.9 * b, 1.6 + 1.4 * a - 2.8 * b, 0.4 * b);
    gift.lid.rotation.y = 0.5 * b;
    // Saat menutup kembali, kartu ucapan tidak ditampilkan lagi (sudah terbang pergi).
    const closing = state === 'closing';
    const v = ease(clamp01((t - 0.9) / 1.1));
    const fold = t - G;
    greeting.visible = !closing && v > 0 && fold <= 0;
    plane.root.visible = !closing && fold > 0;
    if (plane.root.visible && plane.pose(fold) >= 1) plane.root.visible = false;
    greeting.position.set(GREET_POS.x * v, 1.5 + (GREET_POS.y - 1.5) * v + Math.sin(Math.PI * v) * 0.4, GREET_POS.z * v);
    greeting.scale.setScalar(0.5 + (GREET_S - 0.5) * v);
    greeting.rotation.set((1 - v) * (-Math.PI / 2), 0, 0);
    cards.forEach((c, i) => {
      const e = ease(clamp01((t - (PHOTOS_AT + i * STAGGER)) / 1.1));
      c.visible = e > 0;
      const ang = i * step;
      c.position.set(Math.sin(ang) * R * e, 1.5 + (RING_Y - 1.5) * e + Math.sin(Math.PI * e) * 0.8, Math.cos(ang) * R * e);
      c.scale.setScalar(0.5 + 0.5 * e);
      c.rotation.set((1 - e) * (-Math.PI / 2), ang, (((i * 5) % 7) - 3) * 0.012 * e);
    });
  }
  applyTimeline(0);

  // ---- UI ----
  const ctl = ['open', 'continue', 'prev', 'caption', 'next', 'zoom', 'back', 'reset'];
  const SHOW = {
    closed: ['open'],
    opening: [],
    greeting: ['continue'],
    revealing: [],
    closing: [],
    gallery: ['prev', 'caption', 'next', 'zoom', 'reset'],
    focus: ['prev', 'caption', 'next', 'back'],
  };
  const say = (s) => ($('status').textContent = s);
  function setState(s) {
    state = s;
    document.body.dataset.state = s;
    ctl.forEach((id) => ($(id).hidden = !SHOW[s].includes(id)));
  }
  function updateCaption() {
    const text = `${label(mod(idx))} (${mod(idx) + 1} dari ${N})`;
    $('caption').textContent = text;
    return text;
  }
  function goTo(k) {
    idx = k;
    ringTarget = -k * step;
    say(updateCaption());
  }

  // Pindah state animasi; dengan reduced-motion langsung lompat ke akhir timeline.
  function run(next, endT) {
    setState(next);
    if (reduced.matches) {
      tl.t = endT;
      applyTimeline(endT);
      settle();
    }
  }
  function settle() {
    if (state === 'opening') {
      setState('greeting');
      $('lead').textContent = 'Ada kartu ucapan untukmu.';
      say(`Kado dibuka. Kartu ucapan: ${config.message}`);
      $('continue').focus();
    } else if (state === 'revealing') {
      setState('gallery');
      $('lead').textContent = config.message;
      say(`Foto-fotonya muncul. ${updateCaption()}`);
      $('next').focus();
    } else if (state === 'closing') {
      setState('closed');
      $('open').focus();
    }
  }
  function openGift() {
    if (state !== 'closed') return;
    unlock();
    goTo(0);
    run('opening', G);
  }
  function showPhotos() {
    if (state !== 'greeting') return;
    unlock();
    run('revealing', TOTAL);
  }
  $('sound').onclick = (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', on);
    e.currentTarget.textContent = on ? 'Sound:On' : 'Sound:Off';
    setMuted(!on);
    if (on) unlock();
  };
  function closeGift() {
    if (state !== 'gallery') return;
    $('lead').textContent = HINT;
    goTo(0);
    run('closing', 0);
  }
  function zoom() {
    if (state !== 'gallery') return;
    setState('focus');
    $('back').focus();
  }
  function back() {
    if (state !== 'focus') return;
    setState('gallery');
    $('zoom').focus();
  }
  const move = (d) => (state === 'gallery' || state === 'focus') && goTo(idx + d);

  $('open').onclick = openGift;
  $('continue').onclick = showPhotos;
  $('reset').onclick = closeGift;
  $('zoom').onclick = zoom;
  $('back').onclick = back;
  $('prev').onclick = () => move(-1);
  $('next').onclick = () => move(1);
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'Escape') back();
  });

  // ---- Pointer: drag memutar cincin, ketuk memilih ----
  const canvas = $('canvas');
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e, objs) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objs, true)[0];
  }
  function pickCard(e) {
    return pick(e, cards.filter((c) => c.visible))?.object.userData.i;
  }
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, last: e.clientX, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      if (Math.abs(e.clientX - drag.x) > 6) drag.moved = true;
      if (drag.moved && state === 'gallery') {
        ringTarget += (e.clientX - drag.last) * 0.006;
        idx = Math.round(-ringTarget / step);
        updateCaption();
      }
      drag.last = e.clientX;
      canvas.style.cursor = drag.moved ? 'grabbing' : 'pointer';
      return;
    }
    if (state === 'closed') canvas.style.cursor = pick(e, [gift.group]) ? 'pointer' : 'default';
    else if (state === 'gallery') canvas.style.cursor = pickCard(e) !== undefined ? 'pointer' : 'grab';
    else canvas.style.cursor = 'default';
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) {
      if (state === 'gallery') goTo(idx);
    } else if (state === 'closed' && pick(e, [gift.group])) {
      openGift();
    } else if (state === 'gallery') {
      const i = pickCard(e);
      if (i !== undefined) {
        let diff = mod(i - idx);
        if (diff > N / 2) diff -= N;
        goTo(idx + diff);
        zoom();
      }
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => (drag = null));

  // ---- Kamera ----
  const goalPos = new THREE.Vector3();
  const goalTarget = new THREE.Vector3();
  const camTarget = new THREE.Vector3(0, 0.9, 0);
  let aspect = 1;
  function computeGoal() {
    if (state === 'closed' || state === 'closing') {
      const d = Math.max(9, 4 / (2 * TAN * aspect));
      const a = reduced.matches ? 0 : Math.sin(time * 0.4) * 0.5;
      goalPos.set(Math.sin(a) * d, 3.4, Math.cos(a) * d);
      goalTarget.set(0, 0.9, 0);
    } else if (state === 'opening' || state === 'greeting') {
      const d = Math.max((CARD_H * GREET_S * 1.4) / (2 * TAN), (CARD_W * GREET_S * 1.25) / (2 * TAN * aspect));
      goalPos.set(0, GREET_POS.y, GREET_POS.z + d);
      goalTarget.copy(GREET_POS);
    } else if (state === 'focus') {
      const d = Math.max(2 / (2 * TAN), 1.5 / (2 * TAN * aspect));
      goalPos.set(0, RING_Y, R + d);
      goalTarget.set(0, RING_Y, R);
    } else {
      const d = Math.max(5.5, 3 / (2 * TAN * aspect));
      goalPos.set(0, 3.2, R + d);
      goalTarget.set(0, 1.9, 0);
    }
  }
  const stage = $('stage');
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  computeGoal();
  camera.position.copy(goalPos);
  camera.lookAt(camTarget);

  // ---- Loop ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    if (state === 'opening' || state === 'revealing' || state === 'closing') {
      const end = state === 'opening' ? G : state === 'revealing' ? TOTAL : 0;
      const prev = tl.t;
      tl.t += state === 'closing' ? -dt : dt;
      // Efek tepat saat tiap kartu foto mulai keluar (revealing) atau mulai kembali ke kotak (closing).
      cards.forEach((_, i) => {
        const s = PHOTOS_AT + i * STAGGER;
        if (state === 'revealing' && prev < s && tl.t >= s) cardIn(i);
        if (state === 'closing' && prev >= s + 1.1 && tl.t < s + 1.1) cardOut(i);
      });
      tl.t = state === 'closing' ? Math.max(0, tl.t) : Math.min(end, tl.t);
      applyTimeline(tl.t);
      if (tl.t === end) settle();
    }
    ringAngle += (ringTarget - ringAngle) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 6));
    ring.rotation.y = ringAngle;
    computeGoal();
    const k = reduced.matches ? 1 : 1 - Math.exp(-dt * 2.5);
    camera.position.lerp(goalPos, k);
    camTarget.lerp(goalTarget, k);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---- Muat foto ----
  let done = 0;
  const loading = $('loading');
  Promise.all(
    items.map(async (p, i) => {
      const r = await buildCanvas(p, i + 1);
      setFace(cards[i], r.canvas);
      loading.textContent = `Memuat foto ${++done} dari ${N}`;
      return r.failed;
    }),
  ).then(async (fails) => {
    setFace(greeting, await greetingCanvas(config.name, config.message));
    plane.setMap(greeting.material[4].map);
    ring.add(...cards);
    const n = fails.filter(Boolean).length;
    if (n) loading.textContent = `${n} foto tidak bisa dimuat dan diganti placeholder.`;
    else loading.hidden = true;
    $('open').disabled = false;
  });

  requestAnimationFrame(frame);
}
