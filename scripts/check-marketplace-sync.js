#!/usr/bin/env node
/**
 * check-marketplace-sync.js — fail loudly when the two marketplace price lists
 * disagree.
 *
 * Marketplace items are declared TWICE by design:
 *   • lib/constants/marketplace.ts        — the source of truth (React UI + the
 *                                           server-side purchase/swap verifiers)
 *   • public/game-engine/marketplace-items.js — the in-canvas engine copy, a
 *                                           plain script the engine loads by
 *                                           <script> tag and therefore cannot
 *                                           import the TypeScript module
 *
 * Both files say "keep in sync" in a comment, and until now a comment was the
 * entire enforcement mechanism. Drift here is not cosmetic: the shop card and
 * the engine would quote different prices for the same sword, and only one of
 * them is what the verifier actually charges.
 *
 * This parses both files textually (the engine copy is an IIFE that assigns
 * window.NS_MARKET, so it cannot simply be require()d in Node) and compares
 * every id → price / tokenPrice pair.
 *
 * Usage: npm run check:market   → exit 0 when identical, 1 with a diff when not
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TS_FILE = path.join(ROOT, 'lib/constants/marketplace.ts')
const JS_FILE = path.join(ROOT, 'public/game-engine/marketplace-items.js')

/**
 * Pull { id: { price, tokenPrice } } out of a file. Both files declare items as
 * object literals starting with `id:'...'`, so one pattern reads both: split on
 * the id key, then look ahead only as far as the next id (so a missing price
 * can never be filled in by the following item's).
 */
function extractItems(source, label) {
  const items = {}
  const idRe = /\bid\s*:\s*'([a-z0-9_]+)'/g
  const bounds = []
  let m
  while ((m = idRe.exec(source)) !== null) bounds.push({ id: m[1], at: m.index })

  bounds.forEach((b, i) => {
    const end = i + 1 < bounds.length ? bounds[i + 1].at : source.length
    const chunk = source.slice(b.at, end)
    const price = chunk.match(/\bprice\s*:\s*([0-9]+(?:\.[0-9]+)?)/)
    const tokenPrice = chunk.match(/\btokenPrice\s*:\s*([0-9]+)/)
    // A repeated id means one of the lists has a duplicate entry — whichever
    // copy the lookup helper finds first would silently win at runtime.
    if (items[b.id]) {
      console.error(`✗ ${label}: duplicate entry for '${b.id}'`)
      process.exitCode = 1
    }
    items[b.id] = {
      price: price ? Number(price[1]) : null,
      tokenPrice: tokenPrice ? Number(tokenPrice[1]) : null,
    }
  })
  return items
}

const ts = extractItems(fs.readFileSync(TS_FILE, 'utf8'), 'marketplace.ts')
const js = extractItems(fs.readFileSync(JS_FILE, 'utf8'), 'marketplace-items.js')

// LEGACY_ITEM_IDS in the TS file are read-side aliases (old ids kept so wallets
// that bought a since-renamed item still resolve), not items — they carry no
// price and are absent from the engine copy by design.
const ALIAS_ONLY = new Set(
  Object.keys(ts).filter(id => ts[id].price === null && !(id in js))
)

const problems = []
const ids = new Set([...Object.keys(ts), ...Object.keys(js)].filter(id => !ALIAS_ONLY.has(id)))

for (const id of [...ids].sort()) {
  const a = ts[id]
  const b = js[id]
  if (!a) { problems.push(`${id}: present in the engine copy but MISSING from marketplace.ts`); continue }
  if (!b) { problems.push(`${id}: present in marketplace.ts but MISSING from the engine copy`); continue }
  if (a.price !== b.price) {
    problems.push(`${id}: price differs — marketplace.ts $${a.price} vs engine $${b.price}`)
  }
  if (a.tokenPrice !== b.tokenPrice) {
    problems.push(`${id}: tokenPrice differs — marketplace.ts ${a.tokenPrice} vs engine ${b.tokenPrice}`)
  }
}

if (problems.length) {
  console.error('✗ Marketplace price lists are OUT OF SYNC:\n')
  problems.forEach(p => console.error(`  • ${p}`))
  console.error(
    `\nFix both files: lib/constants/marketplace.ts is the source of truth,\n` +
    `public/game-engine/marketplace-items.js mirrors it.`
  )
  process.exit(1)
}

console.log(`✓ Marketplace lists in sync — ${ids.size} items match on price and tokenPrice.`)
