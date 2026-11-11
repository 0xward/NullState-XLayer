#!/usr/bin/env node
/**
 * build-worldmap-icons.js — encode the world-map rail icons for the web.
 *
 * WHY: PageSpeed put /game's biggest single win here. The nine rail icons
 * (Bag, Shop, Craft, Settings, Daily, Rewards, Pass, Invite, plus the door
 * Lock) shipped as 128x128 PNGs at 37-45KB EACH — 372KB of a 645KB page, for
 * artwork that occupies 46 CSS px. On the throttled 4G PageSpeed measures on
 * (~200KB/s) that is nearly two seconds of the Largest Contentful Paint spent
 * on nine little buttons.
 *
 * WebP at q90 takes the same nine files to 45KB — an 88% cut with no visible
 * change: checked by decoding both and comparing at 4x, the pixels are the
 * same to the eye.
 *
 * WHY NOT ALSO SHRINK THEM. 96px would save another 12KB, and it is tempting
 * because they are drawn at 46 CSS px. But 128 -> 96 is a 3:4 ratio, so four
 * source pixels become three: on pixel art with single-pixel highlights, and
 * with `image-rendering: pixelated` on the element, that visibly mangles the
 * detail. 128 is the artwork's own resolution and it is still under 3x for a
 * DPR-3 phone, so it stays.
 *
 * The PNG masters live in assets-src/worldmap/icons/ — outside public/, so
 * they are versioned in the repo but never deployed. Re-run after changing one.
 *
 * Run: node scripts/build-worldmap-icons.js
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'assets-src/worldmap/icons')
const OUT = path.join(ROOT, 'public/worldmap/icons')

;(async () => {
  if (!fs.existsSync(SRC)) {
    console.error(`No masters at ${path.relative(ROOT, SRC)} — nothing to encode.`)
    process.exit(1)
  }
  fs.mkdirSync(OUT, { recursive: true })

  const names = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort()
  let before = 0, after = 0

  for (const file of names) {
    const from = path.join(SRC, file)
    const to = path.join(OUT, file.replace(/\.png$/, '.webp'))
    await sharp(from).webp({ quality: 90, alphaQuality: 100 }).toFile(to)
    const a = fs.statSync(from).size, b = fs.statSync(to).size
    before += a; after += b
    console.log(`  ${file.padEnd(14)} ${(a / 1024).toFixed(1)}KB -> ${(b / 1024).toFixed(1)}KB`)
  }

  const kb = (n) => (n / 1024).toFixed(0) + 'KB'
  console.log(`✓ ${names.length} icons -> ${path.relative(ROOT, OUT)}/`)
  console.log(`  ${kb(before)} -> ${kb(after)}  (${(100 * (1 - after / before)).toFixed(0)}% smaller)`)
})().catch(e => { console.error(e); process.exit(1) })
