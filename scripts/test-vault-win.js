#!/usr/bin/env node
/**
 * test-vault-win.js — the one screen where real money moves.
 *
 * OWNER, after cracking a vault for real: "tidak ada pop up untuk user, pop up
 * menang usdt dan jumlahnya, dan penjelasan auto transfer."
 *
 * He was right, and it was the worst gap in the game. Winning showed one line
 * inside the code panel — "Reward sent to your wallet" — with NO amount, NO
 * currency, and nothing saying the transfer is automatic. Then the bunker
 * auto-finished 1.4 seconds later and took it off screen. The server had
 * already read the exact amount and token off the vault contract to stamp the
 * Rewards history, and simply did not return them.
 *
 * Three things this holds to, because the player has no other way to learn any
 * of them:
 *   1. HOW MUCH, and in what — the largest text on the screen;
 *   2. that it is ALREADY SENT and needs no claim — the MiniPay failure mode is
 *      a player hunting for a claim button that does not exist and concluding
 *      they were not paid;
 *   3. that nothing takes it away on a timer.
 *
 * A pending payout must NOT invent a figure — a wrong number here is worse than
 * no number.
 *
 *   npm run build && npx next start -p 3183 &
 *   node scripts/test-vault-win.js
 */
const { chromium } = require('playwright-core')
const fs = require('fs'), path = require('path')
const ENGINE_BASE = process.env.ENGINE_BASE_URL || 'http://127.0.0.1:3180'
const HARNESS = '__vwin'
let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }

// Same harness every engine test here uses: every DOM id DungeonGame.tsx
// renders, read out of that file so the markup cannot drift from what the
// engine queries. vwinTx is an <a> because the popup sets an href on it.
const tsx = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'DungeonGame.tsx'), 'utf8')
const ids = [...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map((m) => m[1]))].sort()
const special = {
  game: '<canvas id="game"></canvas>',
  vaultCodeInput: '<input id="vaultCodeInput" />',
  vwinTx: '<a id="vwinTx" class="hidden"></a>',
}
const scripts = ['audio.js', 'assets.js', 'story.js', 'story_campaign.js', 'dungeon.js', 'items.js',
  'marketplace-items.js', 'props.js', 'monster-config.js', 'effects.js', 'entities.js', 'outdoor.js',
  'run-session.js', 'game.js']
const dir = path.join(__dirname, '..', 'public', HARNESS)
fs.mkdirSync(dir, { recursive: true })
// The REAL stylesheet, copied in: without it the popup is unstyled text and
// the overflow check below would pass on a phone it would actually break.
fs.copyFileSync(path.join(__dirname, '..', 'styles', 'dungeon.css'), path.join(dir, 'dungeon.css'))
fs.writeFileSync(path.join(dir, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<link rel="stylesheet" href="./dungeon.css">'
  + '<style>.hidden{display:none}.overlay{position:fixed;inset:0;display:flex}</style>'
  + '<div class="ns-game-root">'
  + ids.map((i) => special[i] || `<div id="${i}"></div>`).join('') + '</div>'
  + scripts.map((x) => `<script src="/game-engine/${x}"></script>`).join(''))
const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true }) } catch {} }

// Drive the popup through the engine's own handler, with the exact response
// shape /api/vault/submit returns. Nothing here reimplements the UI.
async function openWith(page, payload) {
  return page.evaluate((p) => {
    window.__NS.openVaultWinPopup(p)
    const win = document.getElementById('vaultWinWindow')
    const tx = document.getElementById('vwinTx')
    return {
      open: !!win && !win.classList.contains('hidden'),
      amount: (document.getElementById('vwinAmount') || {}).textContent || '',
      note: (document.getElementById('vwinNote') || {}).textContent || '',
      txShown: !!tx && !tx.classList.contains('hidden'),
      txHref: tx ? tx.getAttribute('href') : null,
    }
  }, payload)
}

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))

  await page.goto(`${ENGINE_BASE}/${HARNESS}/index.html`, { waitUntil: 'load' })

  // Rebuild the popup's real nesting: the harness flattens every id, and a
  // layout assertion on a flattened tree would be meaningless.
  await page.evaluate(() => {
    const win = document.getElementById('vaultWinWindow')
    const inner = document.createElement('div'); inner.className = 'vwin-inner'
    const burst = document.createElement('div'); burst.className = 'vwin-burst'
    const title = document.createElement('div'); title.className = 'vwin-title'; title.textContent = 'VAULT CRACKED'
    const amt = document.getElementById('vwinAmount'); amt.className = 'vwin-amount'
    const note = document.getElementById('vwinNote'); note.className = 'vwin-note'
    const tx = document.getElementById('vwinTx'); tx.className = 'vwin-tx hidden'
    const btn = document.getElementById('vwinClose'); btn.className = 'big-btn vwin-btn'; btn.textContent = 'CONTINUE'
    win.className = 'overlay hidden'
    inner.append(burst, title, amt, note, tx, btn)
    win.appendChild(inner)
  })
  ok('the win popup exists in the markup', await page.evaluate(() => !!document.getElementById('vaultWinWindow')))
  ok('and starts hidden',
    await page.evaluate(() => document.getElementById('vaultWinWindow').classList.contains('hidden')))

  // ── a paid win: the number is the point ───────────────────────────────
  const paid = await openWith(page, {
    isCorrect: true, rewardStatus: 'paid', amount: 0.5, token: 'USDT',
    txHash: '0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd',
  })
  ok('it opens on a win', paid.open)
  ok('the AMOUNT is shown (' + paid.amount + ')', /0\.5/.test(paid.amount))
  ok('and the currency, by name', /USDT/.test(paid.amount))
  ok('it says the money is already sent', /sent/i.test(paid.note), paid.note.slice(0, 60))
  ok('and that NO CLAIM is needed — the MiniPay failure mode',
    /no claim/i.test(paid.note))
  ok('it warns the wallet may take a moment, so a delay is not read as a loss',
    /few seconds|moment/i.test(paid.note))
  ok('the transaction is linkable', paid.txShown && /celoscan\.io\/tx\/0xabc123/.test(paid.txHref || ''), paid.txHref)

  // ── it must NOT go away on its own ────────────────────────────────────
  await page.waitForTimeout(2600)   // comfortably past the old 1.4s auto-finish
  ok('it is STILL open after the old auto-dismiss would have fired',
    await page.evaluate(() => !document.getElementById('vaultWinWindow').classList.contains('hidden')))

  // ── a pending payout must not invent a figure ─────────────────────────
  const pending = await openWith(page, { isCorrect: true, rewardStatus: 'pending', txHash: null })
  ok('a pending reward says pending, not a number', /pending/i.test(pending.amount), pending.amount)
  // It must say the win is SAFE and the payout retries — but it must NOT name a
  // cause the server never checked. This assertion used to require the words
  // "topped up", which is how the popup came to tell every failed payout that
  // the reward pool was empty. On the week the owner hit it the pool held 0.85
  // USDT against a 0.05 reward and the real fault was a dropped transaction;
  // that sentence cost him, and then an agent, an hour in the treasury.
  ok('and explains the win is kept and the payout retries',
    /retries|recorded|by itself/i.test(pending.note), pending.note.slice(0, 80))
  ok('and does NOT blame the reward pool when nothing checked it',
    !/pool/i.test(pending.note), pending.note.slice(0, 80))
  ok('with no transaction link to a transaction that does not exist', !pending.txShown)

  // The server sends the real reason down with the response (see
  // VAULT_FAILURE_MESSAGE in lib/server/vaultChain.ts). The popup must print
  // THAT, not a guess of its own.
  const poolPending = await openWith(page, {
    isCorrect: true, rewardStatus: 'pending', txHash: null, reason: 'pool_empty',
    message: 'Your win is recorded. The reward pool needs topping up — the transfer completes by itself as soon as it is funded.',
  })
  ok('a pool problem the server DID check is named as one', /pool/i.test(poolPending.note),
    poolPending.note.slice(0, 80))
  const rpcPending = await openWith(page, {
    isCorrect: true, rewardStatus: 'pending', txHash: null, reason: 'rpc',
    message: 'Your win is recorded. The network dropped the payout transaction — it retries automatically and completes within a day.',
  })
  ok('a dropped transaction is named as one, and never as a pool problem',
    /network dropped/i.test(rpcPending.note) && !/pool/i.test(rpcPending.note), rpcPending.note.slice(0, 80))

  // ── the amount read failed server-side: say "sent", never guess ───────
  const noAmount = await openWith(page, { isCorrect: true, rewardStatus: 'paid', txHash: '0xdef456' })
  ok('a paid win with no amount says "sent" rather than inventing one',
    /sent/i.test(noAmount.amount) && !/\d/.test(noAmount.amount), noAmount.amount)

  // ── a large amount must not overflow a 390px phone ────────────────────
  const big = await openWith(page, { isCorrect: true, rewardStatus: 'paid', amount: 1234.56, token: 'USDT' })
  ok('a four-figure prize still renders', /1234\.56/.test(big.amount), big.amount)
  const overflows = await page.evaluate(() => {
    const el = document.getElementById('vaultWinWindow')
    return { over: el.scrollWidth > window.innerWidth + 1, win: el.scrollWidth, vw: window.innerWidth }
  })
  // This one found a real bug: .vwin-burst is deliberately wider than the card
  // (inset -10% each side) and stuck 34px out of both, pushing a 390px phone
  // into horizontal scroll. The card clips it now. Nobody would have seen this
  // by looking at the screenshot.
  ok('and does not push the popup off a 390px screen', !overflows.over,
    overflows.win + 'px in a ' + overflows.vw + 'px viewport')

  ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean')

  await b.close(); clean()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch((e) => { clean(); console.error('ERROR', e.message); process.exit(2) })
