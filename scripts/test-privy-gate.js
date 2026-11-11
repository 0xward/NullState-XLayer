#!/usr/bin/env node
/**
 * test-privy-gate.js — temporary scaffolding that must stay invisible.
 *
 * OWNER, 2026-08-02: *"untuk user non minipay, aku mau ada koneksi wallet
 * barengan dengan login google … pake privy aja … tp ini hanya untuk user dan
 * penjurian talent.app saja muncul nya … selebihnya jgn pernah tampilkan untuk
 * user minipay, karena ini sementara saja."*
 *
 * Three promises, and breaking any one of them costs real players:
 *
 *   1. OFF BY DEFAULT. A judging-period feature that ships enabled becomes
 *      permanent by forgetting. With no NEXT_PUBLIC_PRIVY_GATE and no app id,
 *      nothing changes for anybody.
 *   2. NEVER INSIDE MINIPAY. MiniPay resolves an address with zero clicks and
 *      its listing rules reject a screen between the player and the game. The
 *      flag must not be able to switch that off.
 *   3. NEVER DOWNLOADED WHEN OFF. @privy-io/react-auth is a large SDK. If it
 *      landed in the initial chunk, every MiniPay player would pay for a screen
 *      they can never see — on the connections least able to afford it.
 *
 * The browser half runs the DEFAULT path, which is the one every real player is
 * on today. The gate itself cannot be rendered here: it needs a Privy app id,
 * which is a credential this sandbox does not have and must not invent. What
 * that leaves untested is Privy's own modal — stated plainly rather than
 * implied by a passing run.
 *
 *   npm run build
 *   node scripts/test-privy-gate.js --serve
 */
const { chromium } = require('playwright-core')
const { spawn } = require('child_process')
const fs = require('fs'), path = require('path')
const SERVE = process.argv.includes('--serve')
const PORT = Number(process.env.PORT || 3191)
const BASE = SERVE ? `http://127.0.0.1:${PORT}` : (process.env.BASE_URL || 'http://127.0.0.1:3178')
let fails = 0, server = null
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }
const clean = () => { if (server) { try { process.kill(-server.pid) } catch {} server = null } }

async function serve() {
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try { if ((await fetch(`${BASE}/game`)).ok) return } catch { /* not up */ }
  }
  throw new Error('server did not come up')
}

// ── the guarantees, asserted where they live ────────────────────────────────
const flag = fs.readFileSync(path.join(__dirname, '..', 'lib', 'privyGateFlag.ts'), 'utf8')
const flow = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'GameFlowManager.tsx'), 'utf8')
const gate = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'PrivyGate.tsx'), 'utf8')
const layout = fs.readFileSync(path.join(__dirname, '..', 'app', 'game', 'layout.tsx'), 'utf8')
const gamecss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'game.css'), 'utf8')

ok('the gate is OFF unless the env var says exactly "1"',
  /const ENV_ON = process\.env\.NEXT_PUBLIC_PRIVY_GATE === '1'/.test(flag))
ok('the hook seeds FALSE, so the default render loads nothing',
  /useState\(false\)/.test(flag))
ok('no app id means the gate is off, not a login that cannot complete',
  /if \(!privyAppId\(\)\) return false/.test(flag))
ok('and the component refuses to mount the provider without one',
  /if \(!appId\) return null/.test(gate))

// THE MINIPAY GUARANTEE. The gate reuses shouldOfferSignIn() rather than
// carrying a second condition, so `!isMiniPay` cannot drift out of it.
ok('the gate is gated on shouldOfferSignIn(), not a second copy of the rule',
  /const showPrivyGate = privyGateOn && !gateDone && shouldOfferSignIn\(\)/.test(flow))

// ── THE MINIPAY FLASH ───────────────────────────────────────────────────────
//
// The rule was right and the TIMING was wrong. `isMiniPay` comes from wagmi,
// and wagmi mounts on requestIdleCallback with a 1500ms ceiling — so inside
// MiniPay the bridge answered `isMiniPay: false` for up to a second and a half
// and the gate rendered. Owner: *"masih sempet muncul halaman loginnya."*
//
// Holding the gate until wagmi reported was written, measured and thrown away:
// it kept MiniPay clean but put the map on screen at 50ms and the login at
// 1272ms, which is the ORIGINAL complaint wearing a different hat. The
// guarantee lives in a synchronous read instead, so the gate still renders on
// the first paint.
ok('the gate does NOT wait for wagmi — that fix cost the placement',
  !/gateArmed/.test(flow))
ok('and the flag reads MiniPay straight off window.ethereum, needing nothing mounted',
  /if \(isMiniPayNow\(\)\) return false/.test(flag) &&
  /ethereum\?: \{ isMiniPay\?: boolean \}/.test(flag))
// Injection a moment late is the one way a synchronous read can be wrong, so
// the flag is re-read for the same 1500ms ceiling wagmi gets — one way only.
ok('and it keeps re-checking briefly, in case the provider is injected late',
  /setInterval\(\(\) => \{/.test(flag) && /if \(!readPrivyGateFlag\(\)\) \{ setOn\(false\)/.test(flag))

// ── THE VEIL ────────────────────────────────────────────────────────────────
//
// The map is in the PRERENDERED HTML, so it paints before any JavaScript runs
// and was visible under the gate for ~0.5s. Only something that runs earlier
// than React can fix that, so an inline script marks <html> before first paint.
//
// Measured, three ways:
//   inside MiniPay            no mark, home visible 102ms   (untouched)
//   new player outside        mark 144→509ms, home NEVER visible, gate 547ms
//   returning (skipped once)  no mark, home visible 95ms    (no black screen)
ok('MiniPay is the FIRST thing the inline script checks',
  /if\(window\.ethereum&&window\.ethereum\.isMiniPay\)return;/.test(layout) &&
  layout.indexOf('isMiniPay)return') < layout.indexOf("getItem('nullstate-auth-address')"))
ok('a player who already has an account or skipped once is never veiled',
  /getItem\('nullstate-auth-address'\)\)return;/.test(layout) &&
  /getItem\('nullstate-signin-skipped'\)==='1'\)return;/.test(layout))
// An overlay ELEMENT was the first attempt and Next's hydration deleted it at
// 261ms, 600ms before the gate could cover anything. An attribute React never
// rendered survives that reconciliation.
ok('it marks <html> rather than appending a node hydration would delete',
  /setAttribute\('data-ns-gate','1'\)/.test(layout) && !/appendChild/.test(layout))
ok('and lifts itself after 3s even if React never arrives',
  /setTimeout\(function\(\)\{h\.removeAttribute\('data-ns-gate'\)\},3000\)/.test(layout))
ok('the stylesheet hides the home screen while that mark is set',
  /html\[data-ns-gate\] \.ns-home-root \{ visibility: hidden \}/.test(gamecss))
// visibility, not display/removal: the map's image request must survive, or a
// player who skips the gate pays for it twice.
ok('by visibility, so the map image is not fetched twice',
  !/html\[data-ns-gate\][^\n]*display: *none/.test(gamecss))
ok('the gate lifts it once it has painted',
  /useEffect\(\(\) => \{ liftGateVeil\(\) \}, \[\]\)/.test(gate))
ok('and the flow manager lifts it the moment the gate turns out not to be coming',
  /if \(walletReady && !showPrivyGate\) liftGateVeil\(\)/.test(flow))

// The query override must not be an escape hatch INTO MiniPay.
ok('and no ?privy=1 can force a login screen into MiniPay',
  flag.indexOf('if (isMiniPayNow()) return false') < flag.indexOf("get('privy')"))
ok('and shouldOfferSignIn still starts with !isMiniPay',
  /!isMiniPay && !realAddress && !getStoredAuthAddress\(\) && !hasSkippedSignIn\(\)/.test(flow))
ok('the SDK is dynamically imported, never in the initial chunk',
  /const PrivyGate = dynamic\(\(\) => import\('\.\/PrivyGate'\), \{ ssr: false \}\)/.test(flow))
ok('skipping is remembered, so it asks once and not again',
  /onSkip=\{\(\) => \{ acct\.rememberSkipped\(\); setGateDone\(true\) \}\}/.test(flow))

// The screen promises the run "follows you anywhere". That is only true if
// signing in actually keys the save on the account — through the SAME adopt()
// the Firebase screen uses, which migrates guest progress before storing the
// identity. A gate that merely closed itself would be a lie on the glass.
ok('signing in adopts the account rather than just closing the screen',
  /await acct\.adopt\(uid, label\)/.test(flow))
ok('and it cannot strand the player if the migration throws',
  /\} finally \{[\s\S]{0,200}setGateDone\(true\)/.test(flow))
ok('the account is keyed on Privy\'s user id, not a wallet address',
  /onAuthenticated\(\s*user\.id,/.test(gate))
ok('adopting runs once, not on every Privy re-render',
  /adopted\.current = true/.test(gate))

// With the gate on, the OLD Google/email screen is off — it would be a second
// way to make the same account. With the flag off it returns untouched, which
// is what the `!privyGateOn &&` shape guarantees.
ok('the old sign-in screen is off when the gate is on, and only then',
  /if \(!privyGateOn && shouldOfferSignIn\(\)\) \{/.test(flow))

// ── THE TWO BUGS THE OWNER FOUND, PINNED SO THEY CANNOT COME BACK ───────────
//
// 1. PLACEMENT. The gate shipped BELOW `phase === 'menu'`, and 'menu' is what
//    renders the world map. So the login could not appear until something moved
//    the phase off it, and it turned up AFTER the map — owner: *"harusnya
//    sebelum user membuka maps."* Order in the file IS the behaviour here,
//    because these are sequential early returns.
ok('the gate renders BEFORE the map, not after it',
  flow.indexOf('if (showPrivyGate)') > 0 &&
  flow.indexOf('if (showPrivyGate)') < flow.indexOf("if (phase === 'menu')"))

// 2. STYLING. The first version used class names this app does not define
//    (`ns-signin-card`, `ns-signin-sub`), so it rendered as unstyled text on a
//    black rectangle — owner: *"halaman login nya jelek banget."* Nothing
//    caught it: tsc does not know about CSS, and check:cssvars only checks
//    custom properties. This does: every ns- class the gate names must actually
//    be declared in the stylesheet it imports.
{
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'signin.css'), 'utf8')
  const used = [...gate.matchAll(/className="([^"]+)"/g)]
    .flatMap((m) => m[1].split(/\s+/))
    .filter((c) => c.startsWith('ns-'))
  const missing = [...new Set(used)].filter((c) => !new RegExp('\\.' + c + '[\\s,{:.]').test(css))
  ok('every class the gate uses is really declared in signin.css',
    missing.length === 0, missing.join(', ') || `${new Set(used).size} classes`)
}

// 3. The three methods are on the SCREEN, not hidden behind one button that
//    opens a modal to ask the question this screen exists to ask.
for (const [label, re] of [
  ['Google', /Continue with Google/],
  ['email', /Continue with email/],
  ['wallet', /I already have a wallet/],
]) ok(`${label} is offered as its own button`, re.test(gate))
ok('and each button opens Privy narrowed to that one method',
  /login\(\{ loginMethods: \[method\] \}\)/.test(gate))

// 4. GOOGLE IS ONE TAP, NOT TWO SCREENS. `login({loginMethods:['google']})`
//    opens a Privy modal holding a single Google button — the same question
//    this screen just asked — before Google's own chooser. initOAuth skips it.
//    Owner: *"kalo aku klik google, ga muncul 2x pop up kan?"*
ok('Google goes straight to Google, with no Privy screen in between',
  /initOAuth\(\{ provider: 'google' \}\)/.test(gate) &&
  /onClick=\{startGoogle\}/.test(gate))
// The hook is @experimental upstream. An unrecoverable login is worse than an
// extra screen, so a throw must land back on the modal.
ok('and falls back to the modal if that experimental path throws',
  /\} catch \{\s*\n\s*login\(\{ loginMethods: \['google'\] \}\)/.test(gate))
ok('the wallet button still avoids the phrase MiniPay bans',
  !/connect\s+(a|an|the|your|my)?\s*wallet/i.test(gate))
ok('Privy is a real dependency, not an aspiration',
  !!JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    .dependencies['@privy-io/react-auth'])

;(async () => {
  if (SERVE) await serve()
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

  // ── the DEFAULT path: what every real player gets today ────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    const chunks = []
    page.on('request', (r) => { const u = r.url(); if (/\.js(\?|$)/.test(u)) chunks.push(u) })
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)))
    for (const [u, j] of [
      ['**/api/energy?**', { freeRemaining: 5, bonus: 0, total: 5, resetAt: Date.now() + 3.6e6 }],
      ['**/api/vault/fragments?**', { fragments: 0, nextGoal: null }],
      ['**/api/weapons/craft?**', { craft: null, serverNow: Date.now() }],
      ['**/api/contracts?**', { completed: 0, contracts: [] }],
      ['**/api/streak', { streak: 0, best: 0, day: 1, claimedToday: false, granted: null, ladder: [] }],
      ['**/api/season/status', { snapshot: null, commands: [] }],
    ]) page.route(u, (r) => r.fulfill({ json: j }))

    await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
    await page.waitForTimeout(4000)

    ok('with the flag off, a brand-new player lands on the MAP as before',
      !!(await page.$('.ns-hub-map')))
    const body = (await page.textContent('body')) || ''
    ok('and is not shown the gate', !/KEEP YOUR RUN/.test(body))
    ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean')
    // The veil must not fire on the default path either — a black screen for a
    // gate that is never coming is worse than the flash it was fixing.
    ok('and the home screen is never veiled with the flag off',
      !(await page.evaluate(() => document.documentElement.hasAttribute('data-ns-gate'))))
    await page.context().close()
  }

  // ── forcing it on WITHOUT an app id must fall back, not break ───────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)))
    for (const [u, j] of [
      ['**/api/energy?**', { freeRemaining: 5, bonus: 0, total: 5, resetAt: Date.now() + 3.6e6 }],
      ['**/api/vault/fragments?**', { fragments: 0, nextGoal: null }],
      ['**/api/weapons/craft?**', { craft: null, serverNow: Date.now() }],
      ['**/api/contracts?**', { completed: 0, contracts: [] }],
      ['**/api/streak', { streak: 0, best: 0, day: 1, claimedToday: false, granted: null, ladder: [] }],
      ['**/api/season/status', { snapshot: null, commands: [] }],
    ]) page.route(u, (r) => r.fulfill({ json: j }))

    await page.goto(BASE + '/game?privy=1', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.ns-hub-map', { timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(4000)
    // A deployment that turns the flag on and forgets the credential must get
    // the ordinary game, not a login screen that can never log anyone in.
    ok('?privy=1 with no app id falls back to the map rather than a dead screen',
      !!(await page.$('.ns-hub-map')))
    ok('and still throws nothing', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean')
    await page.context().close()
  }

  await b.close(); clean()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  console.log('  NOTE: Privy\'s own modal is NOT covered — it needs an app id this sandbox has none of.')
  process.exit(fails ? 1 : 0)
})().catch((e) => { clean(); console.error('ERROR', e.message); process.exit(2) })
