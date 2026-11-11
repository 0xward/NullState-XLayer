#!/usr/bin/env node
/**
 * minify-game-engine.js — minify the vanilla-JS engine in public/game-engine/.
 *
 * WHY: everything under public/ is served byte-for-byte. Next never touches it,
 * so the engine ships exactly as written — 550KB of commented, formatted source.
 * PageSpeed put a number on the part of that which is on the world map's
 * critical path: audio.js, 6.5KB transferred with 2.7KB of it removable, and a
 * 172ms long task on the main thread just to parse and run it.
 *
 * OUTPUT GOES TO A SEPARATE FOLDER, NEVER OVER THE SOURCE. Two scripts read the
 * engine as text — build-hero-portrait.js pulls LPC_ARMOR/LPC_OUTFIT out of
 * assets.js, check-marketplace-sync.js diffs the price list in
 * marketplace-items.js — and CI runs `node --check` over the same files.
 * Minifying in place would break all of that the first time anyone ran a build
 * locally, and would put unreadable code in the repo's history. So the sources
 * stay exactly where they are and the minified copies land in
 * public/game-engine/min/, which is gitignored build output.
 *
 * WHAT IS DELIBERATELY NOT DONE: top-level names are not mangled and unused
 * top-level declarations are not dropped. These files are classic <script>s,
 * not modules — they share state through script-scope bindings and window
 * globals (LPC_ARMOR, MARKETPLACE_ITEMS, window.Audio2, window.NullStateGame).
 * Renaming or dropping a top-level name in one file silently breaks another
 * file that reads it, and nothing would catch it until the game was on screen.
 * terser leaves top-level alone by default; the options below say so explicitly
 * so nobody "optimises" it later. Property names are never mangled either,
 * which is what keeps `window.NullStateGame` and the mount/unmount surface
 * intact.
 *
 * WHO GUARANTEES THE SHARED NAMES SURVIVE: terser does. With
 * `mangle.toplevel: false` it resolves scopes properly and will not rename
 * anything at script scope; a name it DOES rename is one its own analysis
 * proved is function-scoped. Two regex attempts at second-guessing that were
 * written first and both were wrong — they flagged game.js, which is one big
 * `window.NullStateGame = (() => { … })()`, so its several hundred column-zero
 * names are inside a function and perfectly safe to rename. Guessing at scope
 * with a regex would have skipped 292KB of the 550KB this script exists to
 * shrink.
 *
 * The one thing terser's analysis cannot see is a name reached by STRING —
 * eval, `window['thing']`, or an inline `onclick="foo()"` in generated markup.
 * The engine has none of those (checked across all 14 files), and property
 * names are never mangled, which is what keeps `window.NullStateGame` and its
 * mount/unmount surface intact.
 *
 * VERIFIED, NOT ASSUMED. Each output must parse under the same check CI runs
 * and must still assign every `window.X` its source assigned. A file failing
 * either is deleted rather than shipped, so the loader falls back to the
 * readable original. Beyond that, the minified engine is booted in a real
 * browser and a run is played before this ships — scripts/test-engine-min.js.
 *
 * Runs as part of `npm run build`. Safe to run on its own: node scripts/minify-game-engine.js
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public/game-engine')
const OUT_DIR = path.join(SRC_DIR, 'min')

// terser is not a direct dependency; Next bundles its own copy. Try the real
// package first so adding it later Just Works, then Next's. If neither is
// there, write nothing and say so — the loader falls back to the sources, so a
// missing minifier costs speed, never correctness.
function loadTerser() {
  for (const id of ['terser', 'next/dist/compiled/terser']) {
    try {
      const t = require(id)
      if (typeof t.minify === 'function') return { minify: t.minify, from: id }
    } catch { /* try the next one */ }
  }
  return null
}

// Every `window.X` the file assigns. These are the engine's real exports and
// must still be there afterwards.
function windowExports(source) {
  const names = new Set()
  const re = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g
  let m
  while ((m = re.exec(source))) names.add(m[1])
  return names
}


;(async () => {
  const terser = loadTerser()
  if (!terser) {
    console.log('· no terser available — engine served unminified (this is not a build failure)')
    return
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js')).sort()
  const sources = new Map(files.map(f => [f, fs.readFileSync(path.join(SRC_DIR, f), 'utf8')]))

  let before = 0, after = 0, kept = 0
  const skipped = []

  for (const file of files) {
    const source = sources.get(file)
    const out = path.join(OUT_DIR, file)

    let code
    try {
      const res = await terser.minify(source, {
        ecma: 2020,
        compress: { toplevel: false, drop_console: false, passes: 2 },
        mangle: { toplevel: false },       // cross-file globals live at top level
        format: { comments: false },
        sourceMap: false,
      })
      code = res.code
      if (!code) throw new Error('terser returned nothing')
    } catch (e) {
      skipped.push(`${file} — ${e.message}`)
      fs.rmSync(out, { force: true })
      continue
    }

    // Does it still parse?
    try {
      new vm.Script(code, { filename: file })
    } catch (e) {
      skipped.push(`${file} — minified output does not parse: ${e.message}`)
      fs.rmSync(out, { force: true })
      continue
    }

    // Did the file's exports survive? Property names are never mangled, so
    // this should always hold — it is here to catch a future options change
    // that turns on property mangling without anyone noticing.
    const lost = [...windowExports(source)].filter(n => !new RegExp(`window\\.${n}\\b`).test(code))
    if (lost.length) {
      skipped.push(`${file} — lost export(s): ${lost.map(n => 'window.' + n).join(', ')}`)
      fs.rmSync(out, { force: true })
      continue
    }

    fs.writeFileSync(out, code)
    before += Buffer.byteLength(source)
    after += Buffer.byteLength(code)
    kept++
  }

  const kb = (n) => (n / 1024).toFixed(0) + 'KB'
  console.log(`✓ engine minified with ${terser.from} — ${kept}/${files.length} files, ${kb(before)} -> ${kb(after)} (${(100 * (1 - after / before)).toFixed(0)}% smaller)`)
  for (const s of skipped) console.warn(`  ! skipped ${s} (falls back to the source file)`)
})().catch(e => {
  // Never fail the build over an optimisation.
  console.warn('· engine minification skipped:', e.message)
})
