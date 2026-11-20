import * as THREE from 'three';

// Kertas krem tua dan satu pita burgundy: satu-satunya aksen warna di adegan.
const PAPER = '#cdbd9f';
const RIBBON = '#7a1f2b';

export function createGift() {
  const group = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.85 });
  const ribbon = new THREE.MeshStandardMaterial({ color: RIBBON, roughness: 0.5 });

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  add(group, box(2, 1.4, 2), paper, 0, 0.7, 0);
  add(group, box(0.34, 1.402, 2.02), ribbon, 0, 0.701, 0);
  add(group, box(2.02, 1.402, 0.34), ribbon, 0, 0.701, 0);

  // Rongga kotak yang terlihat setelah tutup diangkat.
  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    new THREE.MeshStandardMaterial({ color: '#3a2a24', roughness: 1 }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 1.404;
  group.add(hole);

  const lid = new THREE.Group();
  lid.position.y = 1.6;
  group.add(lid);
  add(lid, box(2.2, 0.4, 2.2), paper);
  add(lid, box(0.34, 0.402, 2.22), ribbon);
  add(lid, box(2.22, 0.402, 0.34), ribbon);

  const loop = new THREE.TorusGeometry(0.28, 0.09, 12, 28);
  const left = add(lid, loop, ribbon, -0.3, 0.45, 0);
  left.rotation.z = 0.5;
  left.scale.y = 1.2;
  const right = add(lid, loop, ribbon, 0.3, 0.45, 0);
  right.rotation.z = -0.5;
  right.scale.y = 1.2;
  add(lid, new THREE.SphereGeometry(0.13, 16, 12), ribbon, 0, 0.36, 0);

  return { group, lid };
}
