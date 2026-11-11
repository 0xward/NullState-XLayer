#!/usr/bin/env node
/**
 * build-map-path-overlay.js — pull the glowing trail (and the bunker door
 * lights) out of the world-map art into a separate transparent layer.
 *
 * WHY: the owner wanted the path on the map to breathe — "jalan nya berkedip,
 * redup terang hijau". The trail is painted INTO map-bg.webp, so there is
 * nothing to animate: you cannot pulse part of a flat image.
 *
 * Rather than hand-drawing a path in SVG and hoping it lines up, this extracts
 * the trail's own pixels by colour. The result is perfectly registered with the
 * map by construction — it IS the map's pixels — so the overlay can be stacked
 * on top at the same size and its opacity animated. Nothing can drift out of
 * alignment because there is only one source of geometry.
 *
 * The same colour test also catches the green lamps beside each bunker door,
 * which is a bonus rather than an accident: those pulsing too is what makes the
 * doors read as powered rather than painted.
 *
 * COLOUR TEST: the trail sits around rgb(85-131, 124-183, 100-156) — green
 * clearly above red, and above blue. Measured off the art, not guessed:
 *   g > 115        bright enough to be lit rather than terrain
 *   g - b > 14     warmer than the map's blue-grey snow
 *   g - r > 30     genuinely green rather than pale
 *
 * THE MISSING SPUR: four of the five bunkers have a trail running to their
 * door. Hollow Market does not — the main trail passes to its left and nothing
 * connects, so on the map that bunker looked unreachable. A spur is DRAWN here.
 *
 * It is drawn INTO THE MAP ITSELF, not just into the overlay. An earlier
 * attempt put it only in the overlay and it was nearly invisible — the painted
 * trail shows up because the overlay REINFORCES art that is already there,
 * while the spur had bare snow underneath and a half-opacity `screen` blend
 * over bare snow is almost nothing. Drawing it into the base first means the
 * extraction below picks it up automatically, so the spur ends up in both
 * layers and behaves exactly like the trail the artist painted.
 *
 * MATCHING THE ARTIST, MEASURED NOT GUESSED. The first spur was drawn as fat
 * neon-green blobs in rgb(96,214,120) and read as graffiti sprayed over the art
 * — the owner's words were "kamu menggambar jalan dengan tidak benar", and they
 * were right. So the reference used here is the spur the artist DID draw, from
 * the main trail up to the Sunken Field door, sampled pixel by pixel
 * (assets-src, x≈620-630, y≈1044-1080):
 *
 *   it is DASHED       runs of 3-6 lit rows, then 1-3 dark — not a stroke
 *   it is THIN         ~2px of core at 1024px wide
 *   it is FAINT        core rgb(111,164,130) over rgb(55,104,99) ground
 *   it is WARM         green over red by ~53, over blue by ~34
 *   it REACHES the door — it stops at the threshold, not short of it
 *
 * The route: `from` is a point ON the painted trail (its rightmost bulge, traced
 * row by row off the source) so the spur reads as a fork rather than a line
 * starting in mid-air, and `to` is the doorway threshold, matching how the
 * Sunken Field spur terminates. The old curve started at (51.5%, 38.4%), which
 * is not on the trail at all, bulged south through open snow, and stopped in
 * the middle of the ground — a line that began nowhere and arrived nowhere.
 *
 * The pristine art lives at assets-src/worldmap/map-bg-source.webp and is never
 * written to, so re-running always re-derives from clean pixels rather than
 * stacking a second spur on top of the first. assets-src/ is outside public/,
 * so the source copy is in the repo but never deployed.
 *
 * Outputs: public/worldmap/map-bg.webp    (art + spur)
 *          public/worldmap/map-path.webp  (the lit pixels, transparent)
 * Run: node scripts/build-map-path-overlay.js
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'assets-src/worldmap/map-bg-source.webp')
const MAP_OUT = path.join(ROOT, 'public/worldmap/map-bg.webp')
const OUT = path.join(ROOT, 'public/worldmap/map-path.webp')

;(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels
  const base = Buffer.from(data)          // the map, which the spur is painted into

  // ── Draw the spur to Hollow Market ────────────────────────────────────────
  // Percentages of the map. `from` is a point ON the painted trail (its
  // rightmost bulge, traced row by row off the source) so the spur reads as a
  // fork rather than a line that starts in mid-air; `to` is the node's own `gy`
  // from the NODES table in WorldMapHub, the patch of ground the entry ring
  // sits on. The two control points bend it around the rubble to the door's
  // left rather than running straight through it.
  const spur = {
    from: [58.0, 40.4],
    c1:   [60.6, 40.4],
    c2:   [62.3, 38.5],
    to:   [62.4, 35.4],
  }
  const pt = (p) => [W * p[0] / 100, H * p[1] / 100]
  const bez = (t, a, b, c, d) => {
    const u = 1 - t
    return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d
  }
  const [ax, ay] = pt(spur.from), [bx, by] = pt(spur.c1)
  const [cx, cy] = pt(spur.c2),   [dx, dy] = pt(spur.to)

  // The trail's own ink. Not the colour you read off a lit pixel — that is the
  // ink already blended with the snow underneath. This is what has to be laid
  // ON the snow to arrive at the painted trail's numbers: warm yellow-green,
  // low blue. Over Hollow Market's rgb(110,158,155) ground at the alphas below
  // it lands on rgb(153,191,161)..rgb(181,213,165), which is the range the
  // artist's own line occupies.
  const INK = [205, 232, 168]

  // Soft round stamp alpha-blended into the map, brightest at the centre — the
  // painted trail's dots have a lit core and a halo, not a hard edge.
  function stamp(x0, y0, radius, strength) {
    const r = Math.ceil(radius)
    for (let y = Math.round(y0) - r; y <= Math.round(y0) + r; y++) {
      if (y < 0 || y >= H) continue
      for (let x = Math.round(x0) - r; x <= Math.round(x0) + r; x++) {
        if (x < 0 || x >= W) continue
        const d = Math.hypot(x - x0, y - y0)
        if (d > radius) continue
        const a = Math.pow(1 - d / radius, 1.6) * strength
        if (a <= 0.004) continue
        const i = (y * W + x) * ch
        for (let k = 0; k < 3; k++) base[i + k] = Math.round(base[i + k] * (1 - a) + INK[k] * a)
      }
    }
  }

  // Dashes measured in PIXELS along the curve, not in parameter steps — a cubic
  // bezier is not travelled at constant speed, so stepping `t` evenly would
  // bunch the dashes up at one end. Distance is accumulated as the curve is
  // walked and the dash pattern keyed off that, which is why the run reads
  // evenly from the fork to the door.
  const DASH = 4.4, GAP = 3.4                        // the artist's rhythm
  const CORE = 1.05                                  // ~2px of core, as measured
  const STEPS = 1400                                 // ~0.07px per step
  let dist = 0, px0 = null, py0 = null, dashes = 0, wasOn = false
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    // Deterministic wobble (fixed sines, never Math.random) so re-running the
    // script produces the same file byte for byte.
    const x = bez(t, ax, bx, cx, dx) + Math.sin(t * 17.0) * 0.8
    const y = bez(t, ay, by, cy, dy) + Math.cos(t * 13.0) * 0.6
    if (px0 !== null) dist += Math.hypot(x - px0, y - py0)
    px0 = x; py0 = y

    const on = (dist % (DASH + GAP)) < DASH
    if (!on) { wasOn = false; continue }
    if (!wasOn) { dashes++; wasOn = true }

    // Fade in over the first fifth so the fork blends into the trail instead of
    // butting against it; hold full strength at the door, because the artist's
    // spur arrives lit rather than petering out.
    const ease = Math.min(1, t / 0.2)
    const a = (0.50 + 0.26 * Math.abs(Math.sin(t * 9.0))) * ease
    stamp(x, y, CORE, a)
    stamp(x, y, CORE * 1.9, a * 0.13)                // the soft edge, not a halo
  }
  console.log(`  drew the Hollow Market spur — ${dashes} dashes over ${dist.toFixed(0)}px`)

  // q78, down from q86. With the rail icons fixed, this file became the single
  // largest download on /game (219KB) and its own LCP element, so the encode is
  // worth another look: q78 is 173KB, a fifth off, and decoded side by side at
  // 2.5x against q86 the difference is not findable — the palette is flat, the
  // edges are already hard, and the map is drawn at roughly half scale on a
  // phone anyway. q72 (145KB) also held up, but 78 leaves margin on artwork
  // that cannot be re-derived if it turns out to matter on a better screen.
  //
  // The trail extraction below is unaffected either way: it reads `base`, the
  // raw pixels, before any of this encoding happens.
  //
  // NOT resized. PageSpeed calls the file oversized because it is 1024x1536
  // for a 960x1440 box on the phone it emulates, but that is one viewport —
  // on a wider one the same file is displayed larger — and a non-integer
  // downscale is exactly what mangles pixel art.
  await sharp(base, { raw: { width: W, height: H, channels: ch } })
    .webp({ quality: 78, effort: 6 })
    .toFile(MAP_OUT)

  // ── Extract the lit pixels from the RESULT, so the spur is in both layers ──
  const out = Buffer.alloc(W * H * 4, 0)
  let kept = 0
  for (let i = 0; i < W * H; i++) {
    const o = i * ch
    const r = base[o], g = base[o + 1], b = base[o + 2]
    if (g > 115 && g - b > 14 && g - r > 30) {
      out[i * 4]     = Math.round(r * 0.7)
      out[i * 4 + 1] = Math.min(255, Math.round(g * 1.2))
      out[i * 4 + 2] = Math.round(b * 0.78)
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((g - 90) * 3)))
      kept++
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(OUT)

  const kb = (f) => Math.round(fs.statSync(f).size / 1024) + 'KB'
  console.log(`✓ ${path.relative(ROOT, MAP_OUT)} — ${W}x${H}, ${kb(MAP_OUT)}`)
  console.log(`✓ ${path.relative(ROOT, OUT)} — ${W}x${H}, ${kb(OUT)}`)
  console.log(`  ${kept.toLocaleString()} lit pixels (${(100 * kept / (W * H)).toFixed(2)}% of the map)`)
})().catch(e => { console.error(e); process.exit(1) })
