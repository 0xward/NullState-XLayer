#!/usr/bin/env node
/**
 * build-weapon-skins.js — repaint the in-hand weapon animation in the colours
 * of the weapon the player actually bought.
 *
 * THE PROBLEM. Every marketplace weapon has bespoke pixel art for its shop
 * icon, but the thing in the hero's hand is a Universal-LPC animation sheet:
 * correctly posed for all four facings and every frame, and drawn in the stock
 * LPC palette. So the player bought a violet katana and swung a white one, a
 * green scythe and swung a grey one, a crossbow with dark wood and carried a
 * red one. The engine tried to close the gap at runtime with `ovlTint`, a flat
 * translucent wash of one colour over the whole sprite — which shifts the hue
 * but flattens the shading, because a wash cannot know that a blade's edge and
 * its shadow should move to DIFFERENT colours.
 *
 * WHAT THIS DOES INSTEAD. It transfers the icon's palette by luminance. The
 * icon's own opaque pixels are sorted by brightness and split into bands, and
 * every pixel of the animation frame is mapped through that ramp by its own
 * brightness. A dark pixel of the LPC weapon lands on the icon's darkest tone,
 * a highlight on the icon's highlight. The shape, the pose and the artist's
 * shading all survive; only the identity changes. Baked into the files, so it
 * costs nothing at runtime and the wash can be switched off.
 *
 * NOT A SHAPE CHANGE, AND IT CANNOT BE. This makes a spear the right colours;
 * it does not turn a plain spear into a carved ice spear. An earlier audit of
 * mine claimed the shapes were wrong too — that was a mistake, made by sampling
 * the frame with the most pixels, which for a slashing weapon is the SWING
 * TRAIL, not the weapon. Sampled at rest the shapes are right: maul, crossbow,
 * axe, sword, spear, scythe, katana, bow, each the object its icon shows.
 *
 * ENEMY WEAPONS ARE COPIED THROUGH UNTOUCHED. bone_blade, rusted_shiv,
 * orc_hacker and bone_spear are render-only monster kit with no shop icon and
 * no palette to inherit — and they are deliberately grubby, so borrowing a
 * premium palette would be exactly wrong.
 *
 * Masters live in assets-src/weapon_ulpc/ and are never written. Output goes to
 * public/sprites/lpc_source/weapon_ulpc/. CREDITS.md is copied across because
 * the LPC art is licensed and the attribution has to ship with it.
 *
 * After running: remove `ovlTint` from the re-skinned weapons in assets.js, or
 * the runtime wash tints an already-correct sprite a second time.
 *
 * Run: npm run build:weapons
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'assets-src/weapon_ulpc')
const OUT = path.join(ROOT, 'public/sprites/lpc_source/weapon_ulpc')
const ICONS = path.join(ROOT, 'public/sprites/marketplace')

const BANDS = 20
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * A brightness -> colour ramp built from the icon's own pixels.
 *
 * The very darkest pixels of an icon are usually its outline, which is near
 * black on every weapon and carries no identity, so the bottom slice is
 * trimmed: without that, half the animation frame maps onto black and the
 * weapon reads as a silhouette.
 */
async function rampFromIcon(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const C = info.channels
  const px = []
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 128) continue
    px.push([data[i], data[i + 1], data[i + 2], lum(data[i], data[i + 1], data[i + 2])])
  }
  if (px.length < BANDS) return null
  px.sort((a, b) => a[3] - b[3])
  const trimmed = px.slice(Math.floor(px.length * 0.10))     // drop the outline
  const ramp = []
  for (let b = 0; b < BANDS; b++) {
    const lo = Math.floor(trimmed.length * b / BANDS)
    const hi = Math.max(lo + 1, Math.floor(trimmed.length * (b + 1) / BANDS))
    let r = 0, g = 0, bl = 0
    for (let i = lo; i < hi; i++) { r += trimmed[i][0]; g += trimmed[i][1]; bl += trimmed[i][2] }
    const n = hi - lo
    ramp.push([Math.round(r / n), Math.round(g / n), Math.round(bl / n)])
  }
  return ramp
}

/**
 * Repaint one sheet.
 *
 * The luminance range is measured across the WHOLE sheet rather than per
 * frame: measured per frame, a frame that happens to contain only the dark
 * haft would stretch that haft across the full ramp and flicker bright for one
 * frame of the walk cycle.
 */
async function reskinSheet(file, ramp) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const C = info.channels
  let lo = 255, hi = 0
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 40) continue
    const L = lum(data[i], data[i + 1], data[i + 2])
    if (L < lo) lo = L
    if (L > hi) hi = L
  }
  if (hi <= lo) return null                       // empty sheet, nothing to paint
  const span = hi - lo
  const out = Buffer.from(data)
  let painted = 0
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] < 40) continue
    const t = (lum(data[i], data[i + 1], data[i + 2]) - lo) / span
    const c = ramp[Math.min(BANDS - 1, Math.max(0, Math.round(t * (BANDS - 1))))]
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]
    painted++
  }
  return { buf: out, info, painted }
}

;(async () => {
  if (!fs.existsSync(SRC)) {
    console.error(`No masters at ${path.relative(ROOT, SRC)} — nothing to build.`)
    process.exit(1)
  }
  fs.mkdirSync(OUT, { recursive: true })

  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort()
  const ids = [...new Set(files.map(f => f.replace(/_(atk|walk)_(fg|bg)\.png$/, '')))]

  const ramps = new Map()
  const skipped = []
  for (const id of ids) {
    const icon = path.join(ICONS, `${id}.png`)
    if (!fs.existsSync(icon)) { skipped.push(id); continue }
    const ramp = await rampFromIcon(icon)
    if (!ramp) { skipped.push(`${id} (icon too small to sample)`); continue }
    ramps.set(id, ramp)
  }

  let repainted = 0, copied = 0
  for (const file of files) {
    const id = file.replace(/_(atk|walk)_(fg|bg)\.png$/, '')
    const from = path.join(SRC, file)
    const to = path.join(OUT, file)
    const ramp = ramps.get(id)
    if (!ramp) { fs.copyFileSync(from, to); copied++; continue }
    const res = await reskinSheet(from, ramp)
    if (!res) { fs.copyFileSync(from, to); copied++; continue }
    await sharp(res.buf, { raw: { width: res.info.width, height: res.info.height, channels: res.info.channels } })
      .png({ compressionLevel: 9 }).toFile(to)
    repainted++
  }

  // The LPC art is licensed; its attribution ships with it.
  const credits = path.join(SRC, 'CREDITS.md')
  if (fs.existsSync(credits)) fs.copyFileSync(credits, path.join(OUT, 'CREDITS.md'))

  console.log(`✓ ${repainted} sheets repainted, ${copied} copied through`)
  for (const [id, ramp] of ramps) {
    const c = (a) => `rgb(${a.join(',')})`
    console.log(`   ${id.padEnd(20)} ${c(ramp[1])} .. ${c(ramp[BANDS - 1])}`)
  }
  if (skipped.length) console.log(`   no shop icon (left as drawn): ${skipped.join(', ')}`)
})().catch(e => { console.error(e); process.exit(1) })
