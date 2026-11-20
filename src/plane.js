import * as THREE from 'three';

// Kartu ucapan dilipat jadi pesawat kertas klasik lalu terbang keluar layar.
// Lembar dibelah (di sepanjang garis lipat) jadi segitiga-segitiga kecil; tiap lipatan memutar
// semua bagian di satu sisi garis lipat, jadi lapisan kertasnya menumpuk seperti kertas sungguhan.
//
// Urutan: kartu dimiringkan sedikit (dan tetap miring), lalu (1) dilipat dua tanpa dibuka lagi,
// (2) sudut atas ke tengah, (3) tepi miring ke tengah lagi, (4) sayap diturunkan.
const HW = 0.6; // setengah lebar kartu
const HH = 0.8; // setengah tinggi kartu
const EPS = 1e-6;

// Waktu (detik sejak kartu mulai dilipat) tiap tahap.
const T = { tilt: [0, 0.5], f1: [0.5, 1.2], f2: [1.2, 1.8], f3: [1.8, 2.4], f4: [2.4, 3.0] };
export const FOLD_END = 3.0;
export const FLIGHT = 1.6;
export const PLANE_TOTAL = FOLD_END + FLIGHT;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const TOWARD_FRONT = V(0, 0, 1);
const TOWARD_BACK = V(0, 0, -1);

// ---- Definisi lipatan (sumbu dan sisi didefinisikan pada keadaan setelah lipatan sebelumnya) ----
const folds = [];
function addFold(f) {
  f.d.normalize();
  f.n.normalize();
  // Tanda sudut: sisi yang bergerak (normal n) harus berputar ke arah `toward`.
  f.angle = f.max * Math.sign(new THREE.Vector3().crossVectors(f.d, f.n).dot(f.toward));
  f.q = new THREE.Quaternion().setFromAxisAngle(f.d, f.angle);
  folds.push(f);
  return f;
}

const BIS = Math.PI / 8; // garis bagi 22,5 derajat
const FLAT = Math.PI;
// 1) lipat dua ke belakang dan TIDAK dibuka lagi: separuh kiri masuk ke belakang separuh kanan
//    (sisi bergambar tetap di luar). Pivot sedikit di belakang supaya lapisannya tidak berhimpit.
addFold({ P: V(0, 0, -0.002), d: V(0, 1, 0), n: V(-1, 0, 0), toward: TOWARD_BACK, max: FLAT, half: -1, t: T.f1 });
// 2) sudut atas (kedua lapis sekaligus) dilipat ke depan, engsel miring 45 derajat dari ujung hidung
addFold({ P: V(0, HH, 0.002), d: V(1, -1, 0), n: V(1, 1, 0), toward: TOWARD_FRONT, max: FLAT, half: 0, t: T.f2 });
// 3) tepi miring dilipat lagi ke garis tengah, engsel garis bagi sudut hidung
addFold({
  P: V(0, HH, 0.012),
  d: V(Math.sin(BIS), -Math.cos(BIS), 0),
  n: V(Math.cos(BIS), Math.sin(BIS), 0),
  toward: TOWARD_FRONT,
  max: FLAT,
  half: 0,
  t: T.f3,
});
// 4) sayap diturunkan: lapis depan (kanan) ke atas, lapis belakang (kiri) ke bawah,
//    engsel sejajar garis tengah pada jarak WING_OFF. Engsel mengikuti tinggi tiap lapis (ownZ).
const WING_OFF = 0.18;
[1, -1].forEach((s) =>
  addFold({
    P: V(WING_OFF, 0, 0),
    d: V(0, 1, 0),
    n: V(1, 0, 0),
    toward: V(0, 0, s),
    max: 1.3,
    half: s,
    ownZ: true,
    t: T.f4,
  }),
);

// ---- Simulasi: posisi sebuah titik kertas setelah `upto` lipatan penuh ----
const tmp = V(0, 0, 0);
function moves(f, rx, p) {
  if (f.half && (f.half < 0 ? rx >= -EPS : rx <= EPS)) return false;
  return tmp.copy(p).sub(f.P).dot(f.n) > EPS;
}
// Putar titik p mengelilingi sumbu lipatan f dengan rotasi q.
function rot(f, q, p) {
  const pz = f.ownZ ? p.z : f.P.z;
  p.x -= f.P.x;
  p.y -= f.P.y;
  p.z -= pz;
  p.applyQuaternion(q);
  p.x += f.P.x;
  p.y += f.P.y;
  p.z += pz;
}
function simulate(rx, ry, upto, out) {
  out.set(rx, ry, 0);
  for (let i = 0; i < upto; i++) {
    const f = folds[i];
    if (moves(f, rx, out)) rot(f, f.q, out);
  }
  return out;
}

// ---- Membelah segitiga di sepanjang tiap garis lipat ----
function splitTriangles(tris, dist, only) {
  const out = [];
  const area = (t) => Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]));
  const fan = (poly) => {
    for (let k = 1; k < poly.length - 1; k++) {
      const t = [poly[0], poly[k], poly[k + 1]];
      if (area(t) > 1e-9) out.push(t);
    }
  };
  for (const tri of tris) {
    const d = tri.map(dist);
    const mixed = d.some((x) => x > EPS) && d.some((x) => x < -EPS);
    if (!mixed || !only(tri)) {
      out.push(tri);
      continue;
    }
    const pos = [];
    const neg = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      const da = d[k];
      const db = d[(k + 1) % 3];
      if (da >= -EPS) pos.push(a);
      if (da <= EPS) neg.push(a);
      if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
        const t = da / (da - db);
        const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        pos.push(m);
        neg.push(m);
      }
    }
    fan(pos);
    fan(neg);
  }
  return out;
}

let tris = [
  [[-HW, -HH], [HW, -HH], [HW, HH]],
  [[-HW, -HH], [HW, HH], [-HW, HH]],
];
tris = splitTriangles(tris, (p) => p[0], () => true); // garis tengah (kiri/kanan terpisah)
const centroidSide = (t) => Math.sign(t[0][0] + t[1][0] + t[2][0]);
folds.forEach((f, i) => {
  const p = V(0, 0, 0);
  tris = splitTriangles(
    tris,
    (r) => tmp.copy(simulate(r[0], r[1], i, p)).sub(f.P).dot(f.n),
    (t) => !f.half || centroidSide(t) === f.half,
  );
});

const NV = tris.length * 3;
const rest = new Float32Array(NV * 2);
const flags = new Uint8Array(NV * folds.length);
{
  const p = V(0, 0, 0);
  tris.flat().forEach(([rx, ry], v) => {
    rest[v * 2] = rx;
    rest[v * 2 + 1] = ry;
    p.set(rx, ry, 0);
    folds.forEach((f, i) => {
      if (moves(f, rx, p)) {
        flags[v * folds.length + i] = 1;
        rot(f, f.q, p);
      }
    });
  });
}

export function createPlane(base, baseScale) {
  const front = new THREE.MeshStandardMaterial({
    roughness: 0.8,
    emissive: '#ffffff',
    emissiveIntensity: 0.35,
    side: THREE.FrontSide,
  });
  // Sisi belakang kertas polos supaya bagian yang terlipat tidak menampilkan teks terbalik.
  const back = new THREE.MeshStandardMaterial({
    color: '#f3eee3',
    roughness: 0.9,
    emissive: '#f3eee3',
    emissiveIntensity: 0.3,
    side: THREE.BackSide,
  });

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(NV * 3), 3);
  const uvAttr = new THREE.BufferAttribute(new Float32Array(NV * 2), 2);
  for (let v = 0; v < NV; v++) uvAttr.setXY(v, (rest[v * 2] + HW) / (2 * HW), (rest[v * 2 + 1] + HH) / (2 * HH));
  geo.setAttribute('position', posAttr);
  geo.setAttribute('uv', uvAttr);

  const rig = new THREE.Group();
  [front, back].forEach((m) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false;
    rig.add(mesh);
  });
  const root = new THREE.Group();
  root.visible = false;
  root.add(rig);

  const p = V(0, 0, 0);
  const qs = folds.map(() => new THREE.Quaternion());
  const display = new THREE.Quaternion();
  const flightQ = new THREE.Quaternion();
  const naturalQ = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const FRONT = V(0, 0, 1);
  const fwd = V(0, 0, 0);
  const upw = V(0, 0, 0);
  const zA = V(0, 0, 0);
  const basis = new THREE.Matrix4();
  const euler = new THREE.Euler();

  const prog = ([a, b], t) => ease(clamp01((t - a) / (b - a)));

  return {
    root,
    setMap(tex) {
      front.map = tex;
      front.emissiveMap = tex;
      front.needsUpdate = true;
    },
    // fold = detik sejak kartu mulai dilipat. Mengembalikan kemajuan terbang (0..1).
    pose(fold) {
      // Bentuk kertas
      folds.forEach((f, i) => qs[i].setFromAxisAngle(f.d, f.angle * prog(f.t, fold)));
      const nf = folds.length;
      for (let v = 0; v < NV; v++) {
        p.set(rest[v * 2], rest[v * 2 + 1], 0);
        for (let i = 0; i < nf; i++) if (flags[v * nf + i]) rot(folds[i], qs[i], p);
        posAttr.setXYZ(v, p.x, p.y, p.z);
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();

      // Pose: kartu dimiringkan sedikit sebelum dilipat dan tetap miring selama proses lipat,
      // supaya setiap lipatan terlihat dari samping-atas.
      const tilt = prog(T.tilt, fold);
      display.setFromEuler(euler.set(-0.3 * tilt, -0.55 * tilt, 0, 'YXZ'));
      rig.position.x = -0.28 * prog(T.f1, fold); // tumpukan lipatan dipusatkan ke titik putar

      // Hidung (sumbu y kartu) mengarah ke tujuan terbang; "atas" pesawat = sumbu +x kartu
      // (lunas di bawah, sayap di atasnya). `bank` memiringkan atas pesawat ke arah kamera
      // supaya permukaan sayap terlihat.
      const orient = (out, vx, vy, vz, bank) => {
        fwd.set(vx, vy, vz).normalize();
        upw.copy(UP).addScaledVector(FRONT, bank);
        upw.addScaledVector(fwd, -fwd.dot(upw)).normalize();
        zA.crossVectors(upw, fwd);
        return out.setFromRotationMatrix(basis.makeBasis(upw, fwd, zA));
      };

      // Saat sayap diturunkan (langkah 4), pesawat diputar ke posisi alami: hidung ke depan,
      // lunas di bawah, sayap mendatar di atasnya.
      orient(naturalQ, 12, 3, -4, 0.5);
      display.slerp(naturalQ, prog(T.f4, fold));

      // Terbang: melintas ke kanan sambil naik; kemiringan badan mereda jadi mendatar
      const u = clamp01((fold - FOLD_END) / FLIGHT);
      root.position.set(base.x + 12 * u, base.y + 3 * u + 7 * u * u, base.z - 4 * u);
      if (u > 0) {
        orient(flightQ, 12, 3 + 14 * u, -4, 0.5 * (1 - ease(clamp01(u / 0.4))));
        root.quaternion.copy(flightQ);
      } else root.quaternion.copy(display);
      roll.setFromAxisAngle(UP, 0.3 * Math.sin(u * 6));
      root.quaternion.multiply(roll);
      root.scale.setScalar(baseScale * (1 - 0.5 * u));
      return u;
    },
  };
}
