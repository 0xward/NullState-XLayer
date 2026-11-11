# NullState — Detailed QA Manual di Device (v71)

**Setup**: Buka MiniPay di phone, deploy preview terbaru, hard refresh. Bawa screenshot + console log kalau item FAIL.

---

## A. Combat & Weapon

### A1 (T10-fix) — Bow di Tangan Saat Walk
**Trigger**:
1. Equip Hunter's Bow di marketplace
2. Jalan ke 4 arah (hold movement di dua bunker berbeda)

**Expected**: 
- Panah terlihat di tangan/samping tubuh saat idle & walk (semua 4 arah)
- Panah TIDAK hilang saat bergerak

**Fail criteria**: Panah tidak nampak, atau hilang saat walk

---

### A2 (BARU) — Auto-Attack Bow Jarak Jauh
**Trigger**:
1. Equip Hunter's Bow
2. Dekati monster dari jarak jauh (~2x radius sebelumnya)
3. Berdiri di depan pintu, monster di ruangan sebelah
4. Gerak lebih dekat (~260px dari monster)
5. Auto-attack harus trigger; releaskan stick

**Expected**:
- Auto-attack hanya trigger jika di RUANGAN YANG SAMA (tidak tembus pintu)
- Panah mulai nembak dari jarak ~2x lebih jauh dari sebelumnya (vs melee 52px)
- Panah terbang KE MONSTER, tidak meleset

**Fail criteria**: Ngebak tembok, panah meleset, atau tidak auto-attack

---

### A3 (BARU) — Arrow Aim Lock Saat Walk
**Trigger**:
1. Equip Hunter's Bow, dekati monster
2. Auto-attack terpicu, TERUS JALAN (analog ditahan)
3. Amati arah panah vs arah jalanmu

**Expected**:
- Panah terbang KE MONSTER meski kamu masih jalan ke arah lain
- Panah tidak ikut arah jalanmu

**Fail criteria**: Panah meleset atau ikut arah gerakan player

---

### A4 (T4) — Melee Auto-Attack Gate
**Trigger**:
1. Equip pedang/dagger (jangan bow)
2. Coba "dekati" monster dari JAUH (lihat di layar tapi belum sampe)

**Expected**:
- Auto-attack TIDAK trigger kalau belum dekat (belum face-to-face ~52px)
- Hanya trigger kalau sudah dekat

**Fail criteria**: Auto-attack trigga dari jauh

---

### A5 (T11) — Weapon Size & FX Color
**Trigger**:
1. Equip tiap weapon di marketplace (dagger → longsword → bow → war_axe)
2. Lihat swing FX di saat attack

**Expected**:
- Setiap weapon punya ukuran di tangan beda (wScale)
- Swing FX punya warna unik per weapon (sesuai fxColor di marketplace)
- Panah juga ikut warna weapon

**Fail criteria**: Semua weapon size sama, atau FX color tidak sesuai

---

### A6 (T14-bug) — Monster Facing Saat Kembali Rumah
**Trigger**:
1. Pancing monster jauh dari spawn-nya
2. Berhenti sebentar (monster marah, maju ke kamu)
3. Lari JAUH (monster kehilangan agresi, balik ke spawn)
4. Lihat arah hadap monster saat dia balik

**Expected**:
- Monster hadap ARAH JALANNYA (jika balik ke kiri, hadap kiri)
- Monster TIDAK moonwalk (badan hadap belakang)

**Fail criteria**: Monster moonwalk atau hadap arah aneh

---

## B. Dunia & Visual

### B1 (T1) — Kecepatan Gerak Player Normal
**Trigger**:
1. Jalan indoor + outdoor (2-3 bunker berbeda)
2. Time a movement line (misal pojok ke pojok ruangan)

**Expected**: Gerak smooth, tidak lambat/cepat aneh

---

### B2 (T5) — Monster Tidak Keluar Ruangan
**Trigger**:
1. Pancing monster ke arah pintu keluar ruangan
2. Lari ke lorong sampai jauh
3. Lihat apakah monster follow ke lorong/ruangan lain

**Expected**: Monster stop di batas ruangan, tidak chase ke lorong jauh

---

### B3 (T6) — Vault Door Spawn & Behavior
**Trigger**:
1. Buka vault door di satu ruangan
2. Jalan ke ruangan lain & balik
3. Buka vault door lagi (atau cek kalau sudah open)

**Expected**:
- Door muncul di posisi benar (tidak bergeser)
- Bisa dibuka & explore
- Tidak dobel/duplikat

---

### B4 (T9+Q4+Q6) — Torch Flame & Light Pool
**Trigger**:
1. Masuk ruangan yang ada obor/lilin (minimal 2 bunker beda: v65 stone + field/desert)
2. Lihat api + cahaya lantai di bawah obor

**Expected**:
- Lidah api punya 3 layer: luar (lebar soft), tengah (body), dalam (core bright)
- Warna api = ORANYE CONSISTENT (tidak hijau/biru)
- Pool cahaya di lantai ORANYE (bukan warna tembok)

**Fail criteria**: Api hijau/biru, atau pool cahaya tidak ada/warna salah

---

### B5 (T13) — Props Profile Samping
**Trigger**:
1. Lihat props (crate, cabinet, wardrobe, chest, tablet) dari SAMPING (lihat profile 3D)
2. Bandingkan dengan lihat dari DEPAN

**Expected**:
- Samping: prop punya DEPTH (tidak gepeng, ada shadow/outline)
- Depan: prop tetap proporsional
- Vault door (pengecualian): tetap frontal
- Hitbox & loot normal (bisa pecah/buka)

**Fail criteria**: Samping tampil gepeng, atau vault door berubah ke 3D

---

### B6 (D1, BARU) — Outdoor Ground Alignment
**Trigger**:
1. Selesai satu bunker, jalan outdoor scene
2. Lihat karakter posisi kaki di tanah (kedua bg bermasalah: ungu & pasar/kendi)

**Expected**:
- Kaki karakter berdiri DI TANAH (bukan floating di tengah sky)
- Bayangan jatuh di tanah (bukan melayang)

**Fail criteria**: Karakter melayang di udara, kaki di horizon/sky

---

### B7 (D2, BARU) — Radial Lighting & Performance
**Trigger**:
1. Masuk dungeon (encounter monster)
2. Lihat cahaya hangat di sekitar player
3. Amati pantulan di monster & props dekat player
4. Amati area jauh dari player (apakah gelap total atau masih kelihatan?)
5. Gerak & cek FPS / stutter (terutama low-end device)

**Expected**:
- Cahaya hangat (oranye) mengikuti player (gaya lilin-di-tangan)
- Monster/props dekat player dapat rim cahaya lembut (hangat)
- Area jauh REDUP tapi MASIH kelihatan (tidak gelap total = maxDark 42%)
- Ada flicker halus gaya lilin
- FPS tetap lancar (min 24fps, ideal 30fps+)

**Fail criteria**: 
- Stutter/lag di setiap frame
- Cahaya tidak ikut player
- Area jauh gelap total (tidak bisa lihat)
- FPS drop drastis (<20fps)

**Tuning kalau berat**: Buka console → ketik:
```javascript
window.NS_LIGHT.entMax = 6;        // kurangi entity dari 12
window.NS_LIGHT.radius = 200;      // kurangi jangkauan cahaya
```

---

## C. UI & Marketplace

### C1 (T12) — Marketplace Icons Display
**Trigger**:
1. Buka marketplace di React UI (360×640 viewport)
2. Scroll through items (void_reaper, voidcaller, war_axe, others)

**Expected**:
- Semua icon tampil benar (tidak blur, tidak kepotong)
- Layout responsif di 360px width
- Bisa scroll & select item

**Fail criteria**: Icon blur/corrupt, atau tampil kepotong di edge

---

### C2 (dari v70) — Buy & Equip Flow
**Trigger**:
1. Beli item di marketplace (testnet USDm)
2. Equip dari inventory
3. Lihat efek in-game langsung

**Expected**:
- Saldo terdebit
- Item muncul di inventory
- Efek visual/gameplay apply (damage boost, size change, FX color)

**Fail criteria**: Item tidak terkirim, atau efek tidak apply

---

## D. Premium Items (Tidak Pernah Ditest Live)

### D1 — Semua Weapon Premium Walk & Attack
**Trigger**:
1. Equip tiap weapon premium di testnet (ancient_blade, frost_spear, hunters_bow, war_axe, void_reaper, voidcaller_scythe)
2. Walk ke 4 arah
3. Attack (lihat swing & animation)

**Expected**:
- Weapon terlihat di tangan saat walk (semua 4 arah)
- Attack animation smooth & jelas
- FX color sesuai item
- Damage apply

**Fail criteria**: Weapon hilang, animation broken, FX salah

---

### D2 — Armor Premium Equip & Visual
**Trigger**:
1. Equip armor premium (leather_guard, iron_plate, rune_armor, warden_plate, ancient_aegis)
2. Lihat character di 4 arah
3. Lihat di walk + attack pose

**Expected**:
- Armor terlihat di semua 4 arah (tidak hanya depan/belakang)
- Helm ikut armor set
- Walk cycle animasi smooth
- Attack animation cocok

**Fail criteria**: Armor tidak tampil, helm hilang, animasi janggal

---

### D3 — USDm Payment Flow (Premium)
**Trigger**:
1. Beli weapon/armor premium via USDm stablecoin
2. Amati saldo before/after
3. Amati item delivery

**Expected**:
- Wallet approve transaction
- Saldo USDm berkurang sesuai harga
- Item langsung terkirim ke inventory (NOT stuck in "pending")
- Bisa equip & pakai immediately

**Fail criteria**: 
- Transaction stuck/pending
- Saldo terdebit tapi item tidak sampai (Season Pass incident repeat)
- Item terkirim lambat (>5 detik)

**Jika fail**: Ambil screenshot saldo before/after + tx hash dari Celoscan

---

## E. Outdoor Scene (Normal Behavior)

### E1 — Equipment Tidak Tampil di Outdoor (NORMAL)
**Note**: Outdoor scene adalah NARRATIVE WALK antar bunker (bukan combat).  
Equipment (armor, weapon) tidak ditampilkan di sini — **ini normal, bukan bug**.

**Trigger**:
1. Equip weapon + armor di bunker
2. Selesai bunker, keluar ke outdoor scene
3. Lihat karakter

**Expected**:
- Karakter tampil dengan base outfit saja (tanpa equipped armor/weapon visual)
- Equipment tetap di inventory (tidak hilang)
- Saat masuk bunker berikutnya, equipment tetap equipped & terlihat

**Fail criteria** (ini adalah BUG, bukan expected):
- Equipment HILANG dari inventory
- Equipment equipped tapi tidak bisa di-unequip
- Character melayang di outdoor (ini adalah D1 issue, bukan E1)

---

## Notes
- Screenshot WAJIB kalau FAIL + console log (F12 → Console tab)
- Testnet USDm faucet: [link setup]
- Low-end device: use Android Chrome, budget phone (ram 2-3GB), bukan flagship
