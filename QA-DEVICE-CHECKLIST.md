# NullState — Checklist QA Manual di Device (v70)

Test di MiniPay webview / Chrome Android dari deploy preview terbaru.
Kalau item GAGAL: screenshot + (kalau bisa) console log, catat nomor item.

> Sebelum mulai: pastikan build terbaru — buka menu → cek versi, atau hard
> refresh (tutup MiniPay app sepenuhnya, buka lagi).

## A. Combat & Weapon

- [ ] **A1 (T10-fix, BARU)** Equip Hunter's Bow → jalan 4 arah.
      Expected: bow TERLIHAT di tangan/samping badan saat idle & walk.
      (Root cause lama: file overlay bow ternyata blank — sudah diganti.)
- [ ] **A2 (BARU)** Auto-attack bow: dekati monster dari jauh.
      Expected: panah mulai nembak dari jarak ±2x lebih jauh dari
      sebelumnya (260px vs 150px), TAPI hanya kalau kamu sudah masuk
      ruangan yang sama dengan monster (gate ruangan tetap aktif).
- [ ] **A3 (BARU)** Sambil JALAN terus (analog ditahan) saat auto-attack bow.
      Expected: panah tetap terbang KE MONSTER, bukan ke arah jalanmu.
- [ ] **A4 (T4)** Melee (pedang/dagger): auto-attack hanya trigger saat
      sudah dekat/face-to-face, tidak dari jarak "belum nyampe".
- [ ] **A5 (T11)** Tiap weapon: ukuran di tangan proporsional (wScale) dan
      warna FX swing/panah sesuai warna item di marketplace.
- [ ] **A6 (T14-bug)** Pancing monster mengejar, lalu lari menjauh sampai
      dia balik ke posisinya. Expected: saat balik, monster menghadap ARAH
      JALANNYA (tidak moonwalk membelakangi arah gerak). Cek juga boss.

## B. Dunia & Visual

- [ ] **B1 (T1)** Kecepatan gerak player terasa normal (indoor & outdoor).
- [ ] **B2 (T5)** Monster tidak keluar dari ruangannya mengejar sampai lorong jauh.
- [ ] **B3 (T6)** Vault door muncul di posisi benar, bisa dibuka, tidak dobel.
- [ ] **B4 (T9+Q4+Q6)** Obor: lidah api 3-layer oranye + pool cahaya lantai
      oranye (bukan warna tema bunker) — cek minimal 2 bunker berbeda.
- [ ] **B5 (T13)** Props (crate/cabinet/wardrobe/chest/tablet) dilihat dari
      samping punya profil samping (tidak gepeng), hitbox & loot normal.
      Vault door tetap tampil frontal.
- [ ] **B6 (D1, BARU)** Outdoor: background ungu (gunung) & background
      pasar/kendi — karakter sekarang berdiri DI TANAH, tidak melayang.
      (Kedua bg di-crop ulang; 3 bg lain tidak diubah.)
- [ ] **B7 (D2, BARU)** Lighting radial: cahaya hangat mengikuti player,
      monster/props di dekat player dapat pantulan lembut, area jauh
      redup tapi MASIH kelihatan (tidak gelap total). Ada flicker halus
      gaya lilin. Cek FPS tetap lancar (kalau berat: kecilkan
      NS_LIGHT.entMax / radius via console).

## C. UI & Marketplace

- [ ] **C1 (T12)** Icon void_reaper & voidcaller di marketplace React tampil
      benar (gaya war_axe), tidak blur/kepotong di 360×640.
- [ ] **C2** Beli item testnet → equip → efek langsung kelihatan in-game.

## D. Premium (belum pernah ditest — dari catatan kamu)

- [ ] **D1** Test SEMUA weapon berbayar di testnet: walk-carry, attack
      anim, FX color, damage. (Baru bow yang ketahuan bermasalah; sisanya
      overlay-nya terverifikasi ada isinya, tapi belum QA live.)
- [ ] **D2** Test semua armor premium: 4 arah, semua anim (walk/slash/
      thrust/hurt/shoot), helm ikut set.
- [ ] **D3** Flow pembayaran USDm: beli → saldo terpotong → item terkirim
      (jangan sampai kasus Season Pass dulu terulang).
