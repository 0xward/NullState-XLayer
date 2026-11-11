# NullState Season Configuration

## 🐞 BUG DITEMUKAN SESI v33, DIKONFIRMASI + DIPUTUSKAN SESI v34

**Ringkasan buat Fa (non-teknis):** semua tanggal "mulai" dan "selesai"
season di dokumen ini ketulis salah tahun sejak awal — nulisnya "2026" tapi
angka detik di baliknya itu sebenarnya tahun **2024**. Jadi kontrak mikirnya
season Juli 2026 itu sudah berakhir dari 2 tahun lalu → makanya layar Season
Pass bilang "Season ended" padahal secara kalender belum berakhir. Ini murni
salah ketik angka timestamp waktu dokumen ini dibikin, bukan bug di kode
game.

**STATUS: DIKONFIRMASI KEJADIAN di on-chain (screenshot Celoscan, sesi v34).**
Fa cek langsung `getSeasonInfo`/tx log di Celoscan: event `SeasonCreated`
buat `seasonId 202607` beneran nyimpen `startDate: 1719792000, endDate:
1722470399` (2024, bukan 2026) — dan halaman transaksi kontrak nunjukin
SEMUA 6 season sudah di-`initializeSeason()` (6 dari 6 transaksi). Jadi
bukan cuma dugaan lagi.

**Keputusan Fa (sesi v34):** redeploy ke PassSBTv2 SEKARANG, mulai dari nol
(nggak perlu fungsi backfill buat pass v1 — belum ada yang mint). Lihat
`contracts/PASSBT_V2_UPGRADE_GUIDE.md` buat langkah deploy lengkap dari HP
(Remix + Celoscan verify), dan tabel timestamp yang SUDAH dikoreksi di bawah
buat langkah "Initialize all 6 seasons" di guide itu.

**Bukti teknis (kenapa ini penyebab pastinya, bukan cuma korelasi):**
1. `date -u -d @1719792000` → hasilnya **1 Juli 2024**, bukan 1 Juli 2026.
   Semua 12 timestamp lain di dokumen ini (Season 1-6, start & end)
   sama-sama offset persis 2 tahun terlalu awal.
2. `components/game/SeasonPassCard.tsx` (`daysRemaining()` +
   `statusLine`) menghitung teks "Season ended" MURNI dari `info.endDate`
   (dibaca on-chain) dikurangi `Date.now()` — endDate tahun 2024 pasti
   menghasilkan `'Season ended'`, persis gejala yang dilaporkan.
3. `contracts/PassSBT.sol` (kontrak v1) TIDAK punya fungsi buat
   mengoreksi tanggal season yang sudah di-`initializeSeason()` —
   `require(seasonStartDate[_seasonId] == 0, "Season already exists")`
   bikin re-init dengan ID yang sama selalu revert. Makanya harus pindah
   kontrak, bukan sekadar panggil ulang dengan angka yang benar.

Tabel & instruksi Celoscan di bawah ini **SUDAH DIKOREKSI** ke tahun 2026
yang benar, dan instruksi Celoscan-nya sudah diarahkan ke kontrak v2 (bukan
alamat v1 yang pensiun) — dokumen lama yang salah sudah ditimpa, bukan
dokumen baru terpisah.

---

## 📅 SEASONS (6 bulan, July - December 2026)

> ⚠️ **KOREKSI v33:** semua timestamp di tabel ini SEBELUMNYA salah tahun
> (2024, bukan 2026) — lihat `## 🐞 BUG DITEMUKAN SESI v33` di bawah untuk
> penjelasan lengkap dan status perbaikan. Nilai di bawah ini SUDAH dikoreksi
> ke 2026.

### **Season 1: July 2026** (202607)
- Start: `1782864000` (2026-07-01 00:00 UTC)
- End: `1785542399` (2026-07-31 23:59 UTC)
- Max Supply: 1000
- Top 1 Reward: 20 USDm
- Top 2 Reward: 5 USDm
- Top 3 Reward: 3 USDm
- Total Bonus Pool: 28 USDm

### **Season 2: August 2026** (202608)
- Start: `1785542400` (2026-08-01 00:00 UTC)
- End: `1788220799` (2026-08-31 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 3: September 2026** (202609)
- Start: `1788220800` (2026-09-01 00:00 UTC)
- End: `1790812799` (2026-09-30 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 4: October 2026** (202610)
- Start: `1790812800` (2026-10-01 00:00 UTC)
- End: `1793491199` (2026-10-31 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 5: November 2026** (202611)
- Start: `1793491200` (2026-11-01 00:00 UTC)
- End: `1796083199` (2026-11-30 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 6: December 2026** (202612)
- Start: `1796083200` (2026-12-01 00:00 UTC)
- End: `1798761599` (2026-12-31 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

---

## 🎮 CELOSCAN INSTRUCTIONS

> ✅ **UPDATE sesi v55:** kontrak yang LIVE sekarang adalah **PassSBTv3** di
> `0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39`. Kontrak v2.1 yang dulu
> ditandai "SELESAI sesi v37" (`0x1AB2AFA55d9B14Df1200ada0495C8D78d4bA3f16`)
> sudah pensiun sejak sesi v44, digantikan v3. Alamat percobaan pertama
> (`0x390239A07616624b6521EC0022D348512d09053b`, solc 0.8.36 non-rilis, gagal
> verify), alamat v1 lama (`0x5235ffBb4C02fCabf29b76Aa0011DA3E1eD96f0e`, bug
> lifetime-lock + tanggal 2024), dan alamat v2.1
> (`0x1AB2AFA55d9B14Df1200ada0495C8D78d4bA3f16`) — SEMUANYA pensiun, jangan
> dipakai lagi buat apapun.

### **Initialize All 6 Seasons** — ✅ SUDAH DIJALANKAN (sesi v37, di kontrak v2.1 yang sekarang sudah pensiun — lihat kontrak PassSBTv3 di atas untuk alamat live)

Buka: `https://celoscan.io/address/0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39#writeContract`

**Connect wallet:** 0x2A6b5204B83C7619c90c4EB6b5365AA0b7d912F7 (owner)

**For each season, call `initializeSeason` with:**

```
_seasonId: [season number from above]
_startDate: [start timestamp]
_endDate: [end timestamp]
_maxSupply: 1000
```

Then click "Write" and approve di wallet (MetaMask/MiniPay/whatever aktif).

---

## 📋 QUICK REFERENCE

| Season | ID | Start Date | End Date | Timestamp Start | Timestamp End |
|--------|-----|-----------|----------|-----------------|---------------|
| July | 202607 | 2026-07-01 | 2026-07-31 | 1782864000 | 1785542399 |
| August | 202608 | 2026-08-01 | 2026-08-31 | 1785542400 | 1788220799 |
| **September** | **202609** | **2026-09-01** | **2026-09-30** | **1788220800** | **1790812799** |
| **October** | **202610** | **2026-10-01** | **2026-10-31** | **1790812800** | **1793491199** |
| November | 202611 | 2026-11-01 | 2026-11-30 | 1793491200 | 1796083199 |
| December | 202612 | 2026-12-01 | 2026-12-31 | 1796083200 | 1798761599 |

---

## ⏱️ TIMESTAMPS EXPLAINED

- **1788220800** = 2026-09-01 00:00:00 UTC
- **1790812799** = 2026-09-30 23:59:59 UTC
- **1790812800** = 2026-10-01 00:00:00 UTC
- **1793491199** = 2026-10-31 23:59:59 UTC

---

## 🛠️ UNTUK SEPTEMBER (202609):

**Di Celoscan, call `initializeSeason` dengan:**
```
_seasonId: 202609
_startDate: 1788220800
_endDate: 1790812799
_maxSupply: 1000
```

---

## 🛠️ UNTUK OCTOBER (202610):

**Di Celoscan, call `initializeSeason` dengan:**
```
_seasonId: 202610
_startDate: 1790812800
_endDate: 1793491199
_maxSupply: 1000
```
