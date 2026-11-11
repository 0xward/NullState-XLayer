// ─── Self-hosted fonts via next/font/google ──────────────────────────────────
// Sebelumnya font di-load lewat <link href="https://fonts.googleapis.com/..."> di
// app/layout.tsx DAN lewat @import di styles/globals.css (double render-blocking
// request ke Google Fonts CDN sebelum first paint — lihat PSI audit v58).
//
// next/font/google men-download font file saat build time, self-host dari
// domain sendiri (no external network round-trip), generate CSS @font-face
// inline, dan otomatis kasih font-display: swap + fallback metric matching
// (mengurangi CLS). Weight per font SENGAJA dipertahankan sama persis dengan
// yang sebelumnya di-request ke Google Fonts (dicek dulu satu-satu ke
// styles/globals.css & seluruh komponen sebelum port, biar gak ada weight
// yang keputus / kekurangan):
//   - Share Tech Mono : cuma dipakai default (regular) -> weight 400 saja
//   - Cinzel          : dipakai default (~500 fallback) & font-weight:700 -> 500;700
//   - Rajdhani        : dipakai via var(--font-hud) + Tailwind font-hud utility
//                       lintas banyak komponen dengan berbagai font-weight-* ->
//                       pertahankan semua weight yang sebelumnya di-load: 300-700
//   - Orbitron        : dipakai luas via Tailwind font-display utility (58
//                       pemakaian) dengan berbagai font-weight-* -> pertahankan
//                       semua weight yang sebelumnya di-load: 400;700;900
//
// Masing-masing diexport sebagai CSS variable (--font-mono, --font-cinzel,
// --font-hud, --font-display) yang di-attach ke <html> di layout.tsx, lalu
// dipakai di styles/globals.css & tailwind.config.ts lewat var(--font-...)
// menggantikan nama literal 'Cinzel' / 'Share Tech Mono' / dst.

import { Share_Tech_Mono, Cinzel, Rajdhani, Orbitron } from 'next/font/google'

export const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const cinzel = Cinzel({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

export const rajdhani = Rajdhani({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-hud',
  display: 'swap',
})

export const orbitron = Orbitron({
  weight: ['400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

// Digabung jadi satu string className supaya gampang di-spread di layout.tsx
export const fontVariables = [
  shareTechMono.variable,
  cinzel.variable,
  rajdhani.variable,
  orbitron.variable,
].join(' ')
