#!/usr/bin/env node
/**
 * check-css-vars.js — a stylesheet must not depend on a token another
 * stylesheet might not have loaded.
 *
 * THE BUG THIS EXISTS FOR
 * `.ns-confirm-btn.primary` in game.css set `background: var(--green)`, while
 * `--green` was declared only on `.ns-game-root` in dungeon.css. That was fine
 * when one sheet covered the whole /game route. Then the CSS split moved the
 * dungeon's sheet behind a dynamic import and left the rule behind.
 *
 * An undefined `var()` does not error and does not fall back to anything
 * visible — it resolves to nothing, which for `background` means transparent.
 * So the New Game dialog's primary button became near-black text on a dark
 * modal for anyone who had not been inside the dungeon that session: present in
 * the DOM, correctly sized, clickable, and unreadable. It shipped, because it
 * is not a type error, not a broken reference, and it passes any test that only
 * asks whether the button exists and responds to a click.
 *
 * THE RULE
 * A stylesheet may use `var(--x)` only if:
 *   - it declares `--x` itself, or
 *   - `--x` is declared in a sheet that is ALWAYS loaded (globals.css, imported
 *     by the root layout), or
 *   - it is a font token from next/font, which are attached to <html> at
 *     runtime and so exist for every route.
 *
 * Depending on a token from a lazily-imported sheet is the bug, and it is the
 * only thing this fails on.
 *
 * Run: npm run check:cssvars
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const STYLES = path.join(ROOT, 'styles')

// Always in the document, whatever route you are on.
const ALWAYS_LOADED = ['globals.css']

// Declared by next/font on the <html> element (lib/fonts.ts), not by any
// stylesheet, so no sheet can be expected to declare them.
const RUNTIME_TOKENS = new Set([
  '--font-mono', '--font-cinzel', '--font-hud', '--font-display',
])

const declaredIn = (src) =>
  new Set([...src.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map(m => m[1]))

// Only uses WITHOUT a fallback. `var(--drift, 20px)` is the documented way to
// depend on a token that may not be set — the fallback is the definition for
// every case where it isn't — so flagging it would be flagging correct code,
// and a checker that cries wolf gets switched off.
const usedIn = (src) =>
  [...src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)]
    .filter(m => m[2] === ')')
    .map(m => m[1])

if (!fs.existsSync(STYLES)) {
  console.error('no styles/ directory')
  process.exit(1)
}

const sheets = fs.readdirSync(STYLES).filter(f => f.endsWith('.css'))

// Everything the always-loaded sheets provide to everyone else.
const globalTokens = new Set()
for (const f of ALWAYS_LOADED) {
  const p = path.join(STYLES, f)
  if (fs.existsSync(p)) for (const t of declaredIn(fs.readFileSync(p, 'utf8'))) globalTokens.add(t)
}

const problems = []
let checked = 0

for (const f of sheets) {
  const src = fs.readFileSync(path.join(STYLES, f), 'utf8')
  const own = declaredIn(src)
  const seen = new Set()
  for (const token of usedIn(src)) {
    if (seen.has(token)) continue
    seen.add(token)
    checked++
    if (own.has(token) || globalTokens.has(token) || RUNTIME_TOKENS.has(token)) continue
    // Which sheet DOES have it? Naming it turns the error into a fix.
    const source = sheets.find(o => o !== f && declaredIn(fs.readFileSync(path.join(STYLES, o), 'utf8')).has(token))
    problems.push(
      `styles/${f} uses ${token}, declared only in ${source ? `styles/${source}` : 'no stylesheet at all'}`,
    )
  }
}

console.log(`checked ${checked} custom-property use(s) across ${sheets.length} stylesheet(s)`)
if (!problems.length) {
  console.log('✓ every stylesheet declares the tokens it depends on')
  process.exit(0)
}
console.error(`\n${problems.length} cross-stylesheet token dependenc(ies):`)
for (const p of problems) console.error('  ✗ ' + p)
console.error('\nAn undefined var() resolves to nothing — for `background` that is')
console.error('transparent, not an error. Declare the token in the sheet that uses it.')
process.exit(1)
