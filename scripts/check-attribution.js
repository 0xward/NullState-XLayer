#!/usr/bin/env node
/**
 * check-attribution.js — every Celo transaction must carry its ERC-8021 tag.
 *
 * Celo traces transactions back to the app that produced them via a small
 * attribution suffix on the calldata (@celo/attribution-tags). It feeds
 * ecosystem-impact tracking and future reward distribution, and the important
 * property is this: **it cannot be backfilled**. A transaction sent without the
 * suffix is unattributed forever. There is no migration that fixes it later.
 *
 * That makes a missing tag a uniquely bad kind of regression — silent, and
 * permanent for every transaction sent before somebody notices. It is invisible
 * to types (dataSuffix is optional), invisible to tests (the tx succeeds either
 * way), and invisible on-chain unless you go looking.
 *
 * It had already happened: the four transactions the BACKEND signs — the
 * Treasure Vault payout and its code write, the Season Pass mint, and the
 * referral pass gift — were all untagged, because the only helper that existed
 * derived the code from window.location and there is no window on a server. The
 * vault payout is the transaction that moves real USDT to a player.
 *
 * What this checks: every call to writeContract() or sendTransaction() in the
 * app source passes a tag, either as a `dataSuffix:` property or via
 * withAttribution() on its `data`.
 *
 * NOT checked: scripts/ (operator CLI tools run by hand from a treasury wallet,
 * not app traffic) and node_modules.
 *
 * Exit code 1 on any untagged call, so it can gate CI.
 *
 * Run: npm run check:attribution
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIRS = ['app', 'lib', 'hooks', 'components'].map(d => path.join(ROOT, d))
const problems = []

// How far past the call site to look for the tag. The calls in this repo span
// 6–10 lines (address, abi, functionName, args, account, …), so a window of 14
// covers them with room to spare without bleeding into the next statement.
const WINDOW = 14

const TX_CALL = /\.(writeContract|sendTransaction)\s*\(\s*\{/
const TAGGED = /dataSuffix\s*:|withAttribution\s*\(/

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// Strip comments — a comment mentioning dataSuffix must not satisfy the check,
// and a commented-out call must not trip it.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
   .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '))

let calls = 0
for (const dir of SRC_DIRS) {
  if (!fs.existsSync(dir)) continue
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue
    const rel = path.relative(ROOT, file)
    const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n')

    lines.forEach((line, i) => {
      if (!TX_CALL.test(line)) return
      calls++
      const block = lines.slice(i, i + WINDOW).join('\n')
      if (!TAGGED.test(block)) {
        problems.push(`${rel}:${i + 1} — ${line.trim().slice(0, 70)}`)
      }
    })
  }
}

console.log(`checked ${calls} transaction call site(s) for ERC-8021 attribution`)
if (!problems.length) {
  console.log('✓ every transaction carries its attribution tag')
  process.exit(0)
}
console.error(`\n${problems.length} untagged transaction(s) — attribution cannot be backfilled:`)
for (const p of problems) console.error('  ✗ ' + p)
console.error('\nAdd `dataSuffix: getAttributionSuffix()` (client) or')
console.error('`dataSuffix: getServerAttributionSuffix()` (server), or wrap raw')
console.error('calldata with withAttribution(). See lib/attribution-tag.ts.')
process.exit(1)
