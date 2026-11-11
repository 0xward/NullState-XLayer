#!/usr/bin/env node
/**
 * scripts/generate-icon.js
 *
 * Generates app icons from public/NullState_Logo.png:
 *   - public/icon-512.png  → 512×512 px, optimised PNG  (MiniPay submission)
 *   - app/icon.png         → 512×512 px, optimised PNG  (Next.js App Router)
 *   - public/favicon.ico   → 32×32 px ICO               (browser tab / bookmarks)
 *
 * Run:  node scripts/generate-icon.js
 *
 * Requires sharp (already listed as a devDependency):
 *   npm install
 */

const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

const root   = path.resolve(__dirname, '..')
const source = path.join(root, 'public', 'NullState_Logo.png')

async function main () {
  // ── 1. Read source dimensions ──────────────────────────────────────────────
  const meta = await sharp(source).metadata()
  const size = Math.max(meta.width, meta.height)   // side of the square canvas

  // ── 2. Helper: resize to square, keeping aspect, padding with transparency ─
  function squareIcon (targetSize) {
    return sharp(source)
      .resize(targetSize, targetSize, {
        fit:        'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, effort: 10 })
  }

  // ── 3. public/icon-512.png  (MiniPay submission icon) ─────────────────────
  const icon512 = path.join(root, 'public', 'icon-512.png')
  await squareIcon(512).toFile(icon512)
  const size512 = fs.statSync(icon512).size
  console.log(`✓ public/icon-512.png   ${(size512 / 1024).toFixed(1)} KB`)

  // ── 4. app/icon.png  (Next.js App Router – auto-served at /icon.png) ──────
  const appIcon = path.join(root, 'app', 'icon.png')
  await squareIcon(512).toFile(appIcon)
  const sizeApp = fs.statSync(appIcon).size
  console.log(`✓ app/icon.png          ${(sizeApp / 1024).toFixed(1)} KB`)

  // ── 5. public/favicon.ico  (32×32 raw PNG renamed to .ico – broadly ────────
  //       recognised by browsers without a dedicated ICO encoder)
  const favicon = path.join(root, 'public', 'favicon.ico')
  await sharp(source)
    .resize(32, 32, {
      fit:        'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(favicon)
  const sizeFav = fs.statSync(favicon).size
  console.log(`✓ public/favicon.ico    ${(sizeFav / 1024).toFixed(1)} KB`)
}

main().catch(err => { console.error(err); process.exit(1) })
