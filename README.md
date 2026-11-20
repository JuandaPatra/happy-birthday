# Kado Ulang Tahun 3D

Satu halaman web 3D sebagai kado ulang tahun. Kotak kado dibuka, kartu ucapan keluar lebih dulu, lalu dilipat jadi pesawat kertas dan terbang keluar layar. Setelah itu kartu-kartu foto keluar dari kotak dan tersusun melingkar sebagai galeri.

Dibuat dengan [Vite](https://vite.dev) dan [Three.js](https://threejs.org), tanpa backend.

## Menjalankan

```bash
npm install
npm run dev       # server pengembangan
npm run build     # hasil produksi di folder dist/
npm run preview   # mencoba hasil build
```

Hasil `dist/` bisa di-upload ke hosting statis mana pun.

## Mengisi nama, ucapan, dan foto

Semua isi diatur di satu file: `src/config.js`.

```js
export const config = {
  name: 'Budi',
  message: 'Semoga harimu penuh tawa.',
  photos: [
    { src: '/photos/01.jpg', alt: 'Budi di pantai', caption: 'Bali, 2025' },
    { src: '/photos/02.jpg', alt: 'Budi dan keluarga' },
  ],
  placeholderCount: 8,
};
```

- Taruh file foto di `public/photos/`, lalu daftarkan di `photos`.
- `alt` dipakai pembaca layar. `caption` opsional dan tampil di bawah foto pada kartu.
- Kalau `photos` kosong, tampil kartu placeholder bertanda `[FOTO n]` sebanyak `placeholderCount`.
- Foto yang gagal dimuat otomatis diganti kartu placeholder dan ada catatan di layar.
- Foto di-crop ke rasio 3:4 (potret), jadi pilih foto yang subjeknya ada di tengah.

## Alur interaksi

1. **Tertutup:** tekan "Buka kadonya" (atau klik kotaknya).
2. **Kartu ucapan:** muncul di depan kamera. Tekan "Lihat foto-fotonya".
3. **Pesawat kertas:** kartu dilipat dan terbang keluar layar.
4. **Galeri:** geser (drag) untuk memutar, atau pakai tombol "Foto sebelumnya/berikutnya" dan panah kiri/kanan. "Perbesar foto" memperbesar kartu terpilih, Escape untuk kembali.
5. **Tutup kembali kadonya** untuk mengulang dari awal.

Tombol "Suara" di pojok kanan atas menyalakan atau mematikan efek suara (dibuat langsung di browser, tanpa file audio). Pilihan ini tidak disimpan setelah halaman dimuat ulang.

## Struktur

```
index.html          kerangka halaman dan tombol
src/config.js       nama, ucapan, foto (satu-satunya yang perlu diedit)
src/main.js         adegan 3D, state, input, kamera
src/gift.js         model kotak kado
src/cards.js        kartu foto, kartu ucapan, placeholder
src/plane.js        animasi lipat pesawat kertas dan terbang
src/sound.js        efek suara (Web Audio)
src/style.css       tampilan dan warna
public/photos/      foto asli
```

Warna latar diatur di `src/style.css` (`--paper`) dan otomatis dipakai juga oleh adegan 3D. Satu-satunya warna aksen (burgundy `#7a1f2b`) dipakai pada pita kado dan tombol utama.

Waktu animasi lipat ada di bagian atas `src/plane.js` (konstanta `T`, `FOLD_END`, `FLIGHT`).

## Aksesibilitas dan ketahanan

- Semua kontrol bisa dipakai dengan keyboard (Tab, Enter, Spasi, panah, Escape) dan punya fokus yang terlihat.
- Teks status diumumkan ke pembaca layar, termasuk isi kartu ucapan.
- `prefers-reduced-motion`: animasi dilewati dan langsung ke galeri, tanpa suara animasi.
- Tanpa WebGL, halaman menampilkan galeri foto biasa.
- Kontras teks memenuhi WCAG AA.

## Kompatibilitas

Diuji di Chrome (desktop, viewport mobile 375px, dan reduced-motion). **Belum diuji langsung di Safari dan HP asli.** Penyesuaian untuk Safari sudah ada (cadangan `100vh`, `webkitAudioContext`, audio baru aktif setelah klik), tetapi belum terbukti. Di iPhone, pastikan mode senyap tidak aktif agar efek suara terdengar.

## Batasan yang diketahui

- Bundel JavaScript sekitar 540 kB (sebagian besar Three.js).
- Animasi lipat menghitung ulang bentuk kertas tiap frame. Jumlah segitiganya kecil, tetapi performanya di HP lama belum diukur.
- Pilihan suara tidak disimpan.
