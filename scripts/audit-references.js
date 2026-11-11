#!/usr/bin/env node
/**
 * audit-references.js — find things the code points at that are not there.
 *
 * The failures this catches all look the same from the outside: a silent
 * missing image, a sprite that never draws, a script tag that 404s. None of
 * them is a type error, none of them fails a build, and every one of them is
 * only visible on the screen where it happens — which is exactly how a
 * marketplace icon renamed from .png to .webp, or an LPC layer that moved to
 * assets-src/, gets to production without anybody noticing.
 *
 * What it checks:
 *   1. Every /-rooted asset path written as a string literal in the app source
 *      resolves to a file in public/.
 *   2. Every LPC layer named in assets.js exists in the walkcycle folder.
 *   3. Every marketplace item's `sprite` exists — in both the TypeScript source
 *      and the engine mirror, since they are separate lists.
 *   4. Every engine script DungeonGame loads exists, minified and unminified.
 *   5. Every weapon in NS_WEAPON has the ULPC sheets the renderer expects.
 *
 * Exit code 1 on any miss, so it can gate CI.
 *
 * Run: npm run audit
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const problems = []
const note = (what, detail) => problems.push(`${what}: ${detail}`)

const exists = (p) => fs.existsSync(path.join(PUBLIC, p.replace(/^\//, '').split('?')[0]))

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// ── 1. asset string literals ─────────────────────────────────────────────────
// Only extensions that name a real file. Deliberately NOT every "/..." string:
// route paths, API paths and CSS selectors all look the same to a regex, and a
// checker that cries wolf gets switched off.
const ASSET_RE = /['"`](\/[A-Za-z0-9._\-/]+\.(png|webp|jpg|jpeg|svg|gif|mp3|ogg|wav|mp4|json|js))(\?[^'"`]*)?['"`]/g
const SRC_DIRS = ['app', 'components', 'lib', 'hooks', 'styles'].map(d => path.join(ROOT, d))
const CSS_RE = /url\((['"]?)(\/[A-Za-z0-9._\-/]+\.(png|webp|jpg|jpeg|svg|gif))\1\)/g

let checkedAssets = 0
for (const dir of SRC_DIRS) {
  if (!fs.existsSync(dir)) continue
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|jsx|css)$/.test(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    for (const re of [ASSET_RE, CSS_RE]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(src))) {
        const p = re === CSS_RE ? m[2] : m[1]
        // Next's own build output and API routes are not files in public/.
        if (p.startsWith('/_next') || p.startsWith('/api/')) continue
        checkedAssets++
        if (!exists(p)) note('missing asset', `${path.relative(ROOT, file)} -> ${p}`)
      }
    }
  }
}

// ── 2. LPC layers named in assets.js ─────────────────────────────────────────
const assetsJs = fs.readFileSync(path.join(PUBLIC, 'game-engine/assets.js'), 'utf8')
const WALK = path.join(PUBLIC, 'sprites/lpc_source/base/walkcycle')
let checkedLayers = 0
for (const m of assetsJs.matchAll(/(torso|legs|feet|head|arms|behind)\s*:\s*'([A-Za-z0-9_]+\.png)'/g)) {
  checkedLayers++
  if (!fs.existsSync(path.join(WALK, m[2]))) note('missing LPC layer', `assets.js ${m[1]}: ${m[2]}`)
}

// ── 3. marketplace sprites, both lists ───────────────────────────────────────
for (const [label, file] of [
  ['marketplace.ts', path.join(ROOT, 'lib/constants/marketplace.ts')],
  ['marketplace-items.js', path.join(PUBLIC, 'game-engine/marketplace-items.js')],
]) {
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/sprite\s*:\s*'([^']+)'/g)) {
    checkedAssets++
    if (!exists(m[1])) note('missing item sprite', `${label} -> ${m[1]}`)
  }
}

// ── 4. engine scripts, source and minified ───────────────────────────────────
const dg = fs.readFileSync(path.join(ROOT, 'components/game/DungeonGame.tsx'), 'utf8')
const listMatch = dg.match(/const ENGINE_SCRIPTS = \[([\s\S]*?)\]/)
if (!listMatch) note('engine', 'could not find ENGINE_SCRIPTS in DungeonGame.tsx')
else {
  const names = [...listMatch[1].matchAll(/'([^']+\.js)'/g)].map(m => m[1])
  if (!names.length) note('engine', 'ENGINE_SCRIPTS parsed as empty')
  for (const n of names) {
    if (!exists(`/game-engine/${n}`)) note('missing engine script', n)
    // min/ is gitignored build output — only checked when it has been built.
    if (fs.existsSync(path.join(PUBLIC, 'game-engine/min')) && !exists(`/game-engine/min/${n}`)) {
      note('missing minified engine script', `min/${n} (run npm run build:engine)`)
    }
  }
}

// ── 5. ULPC sheets per weapon ────────────────────────────────────────────────
const ULPC = path.join(PUBLIC, 'sprites/lpc_source/weapon_ulpc')
const wpnBlock = assetsJs.slice(assetsJs.indexOf('const NS_WEAPON = {'))
// Enemy weapons deliberately have no ULPC animation — they render through the
// pinned-sprite path — so only the weapons assets.js declares as having sheets
// are checked for them. Both halves matter: a weapon in the list without sheets
// means 404s on every load, and one with sheets but not in the list silently
// loses its animation.
const ulpcList = [...(assetsJs.match(/const ULPC_WEAPONS = \[([\s\S]*?)\]/) || [, ''])[1]
  .matchAll(/'([a-z_]+)'/g)].map(m => m[1])
if (!ulpcList.length) note('engine', 'ULPC_WEAPONS list not found in assets.js')
for (const id of ulpcList) {
  for (const kind of ['atk_fg', 'atk_bg', 'walk_fg', 'walk_bg']) {
    if (!fs.existsSync(path.join(ULPC, `${id}_${kind}.png`))) note('missing ULPC sheet', `${id}_${kind}.png`)
  }
}
for (const f of fs.readdirSync(ULPC).filter(f => f.endsWith('.png'))) {
  const id = f.replace(/_(atk|walk)_(fg|bg)\.png$/, '')
  if (!ulpcList.includes(id)) note('ULPC sheet not declared', `${f} exists but ${id} is not in ULPC_WEAPONS`)
}
let checkedWeapons = 0
for (const m of wpnBlock.matchAll(/^\s{2}([a-z_]+):\s*\{ src:`\$\{NS_WPN\}\/([a-z_]+\.png)`/gm)) {
  checkedWeapons++
  if (!exists(`/sprites/weapons/${m[2]}`)) note('missing weapon sprite', m[2])
}

// ── 6. one place decides the Celo RPC ────────────────────────────────────────
// The endpoint was configured in six places. Five read CELO_RPC_URL then
// NEXT_PUBLIC_CELO_RPC; the sixth — wagmi's transport, the one every player's
// browser uses — hardcoded Forno. So setting the variable moved the server and
// left the browser behind, which is the half that generates the load. A config
// knob that silently only half-works is worse than no knob.
const rpcHosts = []
for (const dir of ['app', 'lib', 'hooks']) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    if (!/\.(ts|tsx)$/.test(file)) continue
    const rel = path.relative(ROOT, file)
    if (rel === path.join('lib', 'celoRpc.ts')) continue // the one place allowed to name it
    const src = fs.readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    if (/forno\.celo\.org|NEXT_PUBLIC_CELO_RPC|CELO_RPC_URL/.test(src)) rpcHosts.push(rel)
  }
}
for (const f of rpcHosts) {
  note('RPC endpoint set outside lib/celoRpc.ts', f)
}

// ── 7. one place decides the public URL ──────────────────────────────────────
// Same failure as the RPC, with a worse blast radius. The production URL was
// written out by hand in the metadata base, robots.txt, the sitemap, the
// server-side attribution hostname and the treasury CLI. Moving to a real
// domain — which is exactly what the Celo review asked for — means every one of
// those has to change together.
//
// The attribution hostname is the one that cannot be repaired after the fact:
// the Celo app code is a hash of the hostname, so a client on the new domain
// and a server still holding the old one file as two unrelated apps, and
// attribution is not backfillable. Half the project's on-chain history would be
// stranded under a dead URL, permanently.
const urlHosts = []
for (const dir of ['app', 'lib', 'hooks', 'components', 'scripts']) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue
    const rel = path.relative(ROOT, file)
    if (rel === path.join('lib', 'siteUrl.ts')) continue // the one place allowed to name it
    const src = fs.readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    // The literal domain is banned everywhere. Reading NEXT_PUBLIC_SITE_URL is
    // only banned in TypeScript, which can import the constant — the treasury
    // CLI is plain CommonJS run under bare node and has no import to reach for.
    const bad = /\.(ts|tsx)$/.test(file)
      ? /nullstate[a-z0-9-]*\.vercel\.app|NEXT_PUBLIC_SITE_URL/
      : /nullstate[a-z0-9-]*\.vercel\.app/
    if (bad.test(src)) urlHosts.push(rel)
  }
}
for (const f of urlHosts) {
  note('production URL set outside lib/siteUrl.ts', f)
}

// ── 8. the NFT metadata URL burned into the contract is actually served ──────
// PassSBTv3.BASE_URI is a `string public constant` — deployed, no setter — and
// tokenURI() hands it to every wallet and explorer that renders a Season Pass.
// Nothing served that path for months: public/assets/sbt-pass/ did not exist,
// so every pass ever minted resolved to a 404 and showed up as an unnamed
// token with no image. It went unnoticed because the game draws the pass from
// its own UI and never reads tokenURI, so the only broken view was the one the
// developer never looks at.
//
// An on-chain constant cannot be corrected later, which makes "is something
// actually behind it" worth failing a build over.
const solPath = path.join(ROOT, 'contracts', 'PassSBTv3.sol')
if (fs.existsSync(solPath)) {
  const sol = fs.readFileSync(solPath, 'utf8')
  const m = sol.match(/string\s+public\s+constant\s+BASE_URI\s*=\s*"([^"]+)"/)
  if (!m) {
    note('PassSBTv3.sol', 'BASE_URI not found — the metadata guard cannot check anything')
  } else {
    let urlPath
    try { urlPath = new URL(m[1]).pathname } catch { urlPath = null }
    if (!urlPath) {
      note('PassSBTv3.sol BASE_URI is not a parseable URL', m[1])
    } else {
      const clean = urlPath.replace(/^\/+|\/+$/g, '')          // assets/sbt-pass/metadata
      const asStatic = path.join(ROOT, 'public', clean)
      // A route handler lives one segment deeper, under a dynamic segment.
      const routeDir = path.join(ROOT, 'app', clean)
      const servedByRoute =
        fs.existsSync(routeDir) &&
        fs.readdirSync(routeDir).some((d) =>
          /^\[.+\]$/.test(d) && fs.existsSync(path.join(routeDir, d, 'route.ts')))
      if (!fs.existsSync(asStatic) && !servedByRoute) {
        note('nothing serves PassSBTv3.BASE_URI', `${urlPath} — every minted pass resolves to a 404`)
      }
    }
  }
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`checked ${checkedAssets} asset paths, ${checkedLayers} LPC layers, ${checkedWeapons} weapons`)
if (!problems.length) {
  console.log('✓ every reference resolves')
  process.exit(0)
}
console.error(`\n${problems.length} broken reference(s):`)
for (const p of problems) console.error('  ✗ ' + p)
process.exit(1)
