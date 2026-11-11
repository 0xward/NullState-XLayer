#!/usr/bin/env node
/**
 * clean-logo-halo.js — strip the baked background halo from the NullState logo
 * and emit the hero-sized derivative.
 *
 * THE PROBLEM: NullState_Logo_Transparent.webp is only partly transparent. Half
 * its pixels are opaque, and a blocky dark-green halo is baked around every
 * shape — the remains of a dark background that was keyed out by eye. On the
 * game's dark screens that halo shows up as faint squares crawling around the
 * wordmark, which is what makes the logo look unfinished.
 *
 * THE FIX: flood-fill inward from the image border through "background-ish"
 * pixels (transparent, or luminance <= LO) and clear only what that fill
 * reaches. A plain global threshold would also punch out any dark pixel
 * ENCLOSED by the artwork — the dithering inside the axe heads — so the fill is
 * what keeps the logo's own shading intact.
 *
 * LO sits at 100: the halo's brightest colour measures ~77 luminance and the
 * logo's darkest real colour ~173, so the gap is wide and the threshold is not
 * delicate.
 *
 * Outputs:
 *   public/NullState_Logo_Transparent.webp  (cleaned, in place — also used by
 *                                            the in-game Settings modal)
 *   public/logo-hero.webp                   (840px wide: exactly 2x the 420px
 *                                            display cap on the landing page,
 *                                            so phones and desktops both get a
 *                                            single clean downscale)
 *
 * Run: node scripts/clean-logo-halo.js
 * Re-run if the logo art is ever replaced.
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public/NullState_Logo_Transparent.webp')
const HERO = path.join(ROOT, 'public/logo-hero.webp')
const LO = 100

;(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels

  const lum = (i) => {
    const o = i * ch
    return 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }
  const isBackgroundish = (i) => data[i * ch + 3] < 8 || lum(i) <= LO

  // Breadth-first fill seeded from every border pixel.
  const seen = new Uint8Array(W * H)
  const queue = []
  for (let x = 0; x < W; x++) { queue.push(x); queue.push((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { queue.push(y * W); queue.push(y * W + W - 1) }

  let head = 0
  while (head < queue.length) {
    const i = queue[head++]
    if (i < 0 || i >= W * H || seen[i]) continue
    if (!isBackgroundish(i)) continue
    seen[i] = 1
    const x = i % W, y = (i / W) | 0
    if (x > 0) queue.push(i - 1)
    if (x < W - 1) queue.push(i + 1)
    if (y > 0) queue.push(i - W)
    if (y < H - 1) queue.push(i + W)
  }

  const out = Buffer.from(data)
  let cleared = 0
  for (let i = 0; i < W * H; i++) {
    if (seen[i] && data[i * ch + 3] !== 0) { out[i * ch + 3] = 0; cleared++ }
  }

  const cleaned = await sharp(out, { raw: { width: W, height: H, channels: ch } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer()
  fs.writeFileSync(SRC, cleaned)

  await sharp(cleaned)
    .resize({ width: 840, kernel: 'lanczos3' })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(HERO)

  const kb = (p) => Math.round(fs.statSync(p).size / 1024) + 'KB'
  console.log(`✓ cleared ${cleared.toLocaleString()} halo pixels`)
  console.log(`  ${path.relative(ROOT, SRC)}  ${W}x${H}  ${kb(SRC)}`)
  console.log(`  ${path.relative(ROOT, HERO)}  840px  ${kb(HERO)}`)
})().catch(e => { console.error(e); process.exit(1) })
