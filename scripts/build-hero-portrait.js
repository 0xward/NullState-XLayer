#!/usr/bin/env node
/**
 * build-hero-portrait.js — bake a still portrait of the player character for
 * EVERY look they can equip.
 *
 * The hero is not a single sprite. entities.js drawLPCComposite() stacks an LPC
 * body with an armour layer set and tints it, so the character only exists as a
 * composite at runtime. Anything outside the canvas — a menu avatar, a
 * character sheet — has no sprite to point at.
 *
 * public/sprites/player/knight_*.png is NOT that character. assets.js keeps it
 * only as "the in-dungeon decode-race fallback sprite set"; it is a leftover
 * from an earlier design and is not what a player sees.
 *
 * WHICH LAYER SET IS VISIBLE follows drawLPCComposite exactly:
 *     outfit (LPC_OUTFIT[outfitId])
 *  || armor  (LPC_ARMOR[armorId])
 *  || LPC_OUTFIT.default_skin
 * so one portrait per possible winner covers every combination — nine files,
 * about 1KB each, instead of compositing layers in the browser.
 *
 * The layer sets are READ OUT OF assets.js rather than copied here. Copying
 * them would create the same drift problem the two marketplace price lists had:
 * change a skin in the engine and the avatar quietly keeps the old look.
 *
 * Per look this mirrors the engine's own steps:
 *   1. BODY_male.png, row 2 (facing camera), frame 0
 *   2. the set's layers in the engine's order: legs, torso, arms, feet, head
 *   3. the set's tint at its own tintA via source-atop, so the tint lands on
 *      the armour silhouette and never on the face
 *   4. the tinted armour composited over the bare body
 *
 * Run: node scripts/build-hero-portrait.js
 * Re-run whenever LPC_ARMOR or LPC_OUTFIT changes.
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const ASSETS = path.join(ROOT, 'public/game-engine/assets.js')
const LPC = path.join(ROOT, 'public/sprites/lpc_source/base/walkcycle')
const OUTDIR = path.join(ROOT, 'public/sprites/player/portraits')
// Skin shop icons are the SAME composite as the portrait, so they are emitted
// from here too rather than being drawn separately. marketplace.ts has claimed
// for a while that "the shop preview == what you wear"; now one file produces
// both, so it cannot stop being true.
const SHOPDIR = path.join(ROOT, 'public/sprites/marketplace')

const FW = 64, FH = 64
const ROW_DOWN = 2          // LPC_DIRS = ['up','left','down','right']
const FRAME = 0
const LAYER_ORDER = ['legs', 'torso', 'arms', 'feet', 'head']

/**
 * Pull a top-level `const NAME = { … };` object literal out of assets.js and
 * evaluate it. The literals hold only strings and numbers, so this is a plain
 * data read — but it is still OUR OWN source file being parsed, not input from
 * anywhere else.
 */
function readObjectLiteral(source, name) {
  const start = source.indexOf(`const ${name} = {`)
  if (start === -1) throw new Error(`${name} not found in assets.js`)
  const open = source.indexOf('{', start)
  let depth = 0, end = -1
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error(`unbalanced braces reading ${name}`)
  // eslint-disable-next-line no-new-func
  return new Function(`return ${source.slice(open, end + 1)}`)()
}

const frameOf = (file) =>
  sharp(path.join(LPC, file))
    .extract({ left: FRAME * FW, top: ROW_DOWN * FH, width: FW, height: FH })
    .png()
    .toBuffer()

;(async () => {
  const src = fs.readFileSync(ASSETS, 'utf8')
  const LPC_ARMOR = readObjectLiteral(src, 'LPC_ARMOR')
  const LPC_OUTFIT = readObjectLiteral(src, 'LPC_OUTFIT')

  // Every set a player can end up wearing. Outfits win over armour, so both
  // namespaces need a portrait; `default_skin` is the render-only fallback.
  const looks = new Map()
  for (const [id, def] of Object.entries(LPC_OUTFIT)) looks.set(id, def)
  for (const [id, def] of Object.entries(LPC_ARMOR)) if (!looks.has(id)) looks.set(id, def)

  fs.mkdirSync(OUTDIR, { recursive: true })
  const body = await frameOf('BODY_male.png')
  const built = []

  for (const [id, def] of looks) {
    const layers = []
    let missing = false
    for (const part of LAYER_ORDER) {
      const file = def[part]
      if (!file) continue
      if (!fs.existsSync(path.join(LPC, file))) {
        console.warn(`  ! ${id}: ${part} layer ${file} not in walkcycle/ — skipped`)
        missing = true
        continue
      }
      layers.push({ input: await frameOf(file), blend: 'over' })
    }
    if (!layers.length) { console.warn(`  ! ${id}: no usable layers, skipped`); continue }

    // Armour stack on its own transparent canvas so the tint can be confined to
    // it — tinting the whole composite would recolour the face.
    let armour = await sharp({
      create: { width: FW, height: FH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(layers).png().toBuffer()

    if (def.tint) {
      const hex = def.tint.replace('#', '')
      const tint = {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: def.tintA != null ? def.tintA : 0.25,   // engine's own default
      }
      const tintLayer = await sharp({ create: { width: FW, height: FH, channels: 4, background: tint } }).png().toBuffer()
      // libvips 'atop' is the same operator as the canvas 'source-atop' the
      // engine uses: paint only where the armour is already opaque.
      armour = await sharp(armour).composite([{ input: tintLayer, blend: 'atop' }]).png().toBuffer()
    }

    const out = path.join(OUTDIR, `${id}.png`)
    await sharp(body).composite([{ input: armour, blend: 'over' }]).png({ compressionLevel: 9 }).toFile(out)

    // Shop icon, for OUTFITS only. Weapons and armour have their own bespoke
    // item art (a sword, a breastplate) — skins are the only ones shown as a
    // little character. default_skin is not for sale, so it gets no icon.
    let shopped = false
    if (id !== 'default_skin' && Object.prototype.hasOwnProperty.call(LPC_OUTFIT, id)) {
      fs.copyFileSync(out, path.join(SHOPDIR, `${id}.png`))
      shopped = true
    }
    built.push({ id, kb: (fs.statSync(out).size / 1024).toFixed(1), missing, shopped })
  }

  // The default look also lands at the old flat path, so anything still
  // pointing there keeps working.
  fs.copyFileSync(path.join(OUTDIR, 'default_skin.png'), path.join(ROOT, 'public/sprites/player/hero-portrait.png'))

  console.log(`✓ ${built.length} portraits -> ${path.relative(ROOT, OUTDIR)}/`)
  for (const b of built) {
    console.log(`   ${b.id.padEnd(16)} ${b.kb}KB${b.shopped ? '  + shop icon' : ''}${b.missing ? '  (some layers missing)' : ''}`)
  }
})().catch(e => { console.error(e); process.exit(1) })
