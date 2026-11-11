#!/usr/bin/env node
/**
 * check-minipay-copy.js — enforce MiniPay's listing rules that live in *copy*.
 *
 * MiniPay's readiness review rejects Mini Apps over wording, not just
 * behaviour. Three of its rules are things a normal build, type-check and
 * asset audit are all completely blind to:
 *
 *   1. Banned vocabulary. "Gas", "onramp", "offramp" and "crypto" must be
 *      "Network fee", "Deposit", "Withdraw" and "Stablecoin". Also "Add Cash",
 *      which the docs name as MiniPay's own screen but which the copy rules say
 *      not to use as *our* button label.
 *   2. "Connect wallet" copy. Inside MiniPay the address resolves with no
 *      interaction, so a connect prompt is always wrong there.
 *   3. Message signing. personal_sign / eth_signTypedData are not supported by
 *      MiniPay at all, so any call is a hard failure on a real device.
 *
 * Every one of these had already regressed at least once: an "Add Cash" link
 * label in four files, and a "Connect wallet to load profile." line on /profile
 * that was permanently visible because the card was never handed an address.
 *
 * SCOPE — deliberately narrow, because a copy checker that cries wolf gets
 * switched off. Rules 1 and 2 look only at text a user can actually read: JSX
 * text nodes, and the string values of the props that render as text. Code
 * identifiers (`gasEstimate`, `feeCurrency`, `eth_gasPrice`), comments and
 * import paths are technical and are never inspected. Rule 3 is a plain
 * source-wide search, because there is no legitimate use of those methods here.
 *
 * Exit code 1 on any hit, so it can gate CI.
 *
 * Run: npm run check:copy
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIRS = ['app', 'components'].map(d => path.join(ROOT, d))
const problems = []

const CONNECT_RULE = 'MiniPay connects with zero clicks — drop the prompt'

// Banned wording → what MiniPay wants instead.
// \b-anchored so "Gastown" or "encrypto" can't trip them.
const BANNED = [
  [/\bgas\s*(fee|fees|price|cost|costs)?\b/i, 'say "Network fee"'],
  [/\bon-?ramp\w*\b/i, 'say "Deposit"'],
  [/\boff-?ramp\w*\b/i, 'say "Withdraw"'],
  [/\bcrypto\w*\b/i, 'say "Stablecoin" or "Digital dollar"'],
  [/\badd\s+cash\b/i, 'label the action "Deposit"'],
  // Any article, not just "your". The first version matched `connect your
  // wallet` and `connect wallet`, and sailed straight past "Connect a wallet to
  // keep it" sitting in Settings — same prompt, same problem, different
  // determiner. A pattern that only catches the phrasings you happened to think
  // of gives false confidence, which is worse than no check.
  [/\bconnect\s+(a|an|the|your|my)?\s*wallet\b/i, CONNECT_RULE],
]

// Props whose string value is rendered to the user. `alt` counts: screen
// readers read it out. Deliberately excludes className, href, id, key, src.
const TEXT_PROPS = /\b(title|label|placeholder|alt|aria-label|ariaLabel|buttonText|cta|heading|subtitle|tooltip)\s*=\s*(['"])([^'"]{2,})\2/g

// A JSX text node: between > and <, containing at least one letter, and no
// braces (which would make it an expression container, not literal copy).
const JSX_TEXT = />([^<>{}]*[A-Za-z][^<>{}]*)</g

// Terms and Privacy are exempt from the COPY rules — vocabulary and
// connect-wallet both. The message-signing rule still applies everywhere.
//
// MiniPay's copy rules exist so a first-time user is never asked to understand
// the machinery. They govern product surfaces: buttons, errors, tooltips. Legal
// pages have the opposite duty — they must describe the machinery accurately.
// "NullState Point is not a cryptocurrency, security, or money" has to name the
// category to mean anything, and "when you connect a wallet, guest progress is
// migrated onto your wallet account" is a statement of what the software does
// with someone's data, not an invitation to do it.
//
// The connect-wallet rule was originally kept in force here, on the reasoning
// that a legal page has no business prompting anyone. That reasoning confused
// prompting with describing: the privacy policy has to explain the wallet-
// connection path precisely because that is the moment local data moves. A rule
// that forces a privacy policy to be vaguer about data handling is working
// against its own purpose.
//
// Signing is not waived, because that is a claim about code, not prose — and
// there is no legitimate reason for either file to reference it.
const VOCAB_EXEMPT = [path.join('app', 'terms'), path.join('app', 'privacy')]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// Strip comments so a comment explaining a rule can't trip the rule. Order
// matters: block comments first, then line comments.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
   .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '))

const lineOf = (src, index) => src.slice(0, index).split('\n').length

let scanned = 0
for (const dir of SRC_DIRS) {
  if (!fs.existsSync(dir)) continue
  for (const file of walk(dir)) {
    if (!/\.(tsx|jsx)$/.test(file)) continue
    scanned++
    const raw = fs.readFileSync(file, 'utf8')
    const src = stripComments(raw)
    const rel = path.relative(ROOT, file)

    for (const re of [JSX_TEXT, TEXT_PROPS]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(src))) {
        const text = (re === JSX_TEXT ? m[1] : m[3]).trim()
        if (!text) continue
        // Legal pages skip every prose rule; see VOCAB_EXEMPT above.
        const legalPage = VOCAB_EXEMPT.some(p => rel.startsWith(p))
        for (const [pattern, fix] of BANNED) {
          if (legalPage) continue
          if (pattern.test(text)) {
            problems.push(`${rel}:${lineOf(src, m.index)} — "${text}" → ${fix}`)
          }
        }
      }
    }
  }
}

// Rule 3: message signing. Source-wide, including the engine — MiniPay does not
// implement these methods, so a call is dead on arrival on a real device.
const SIGN_RE = /\b(personal_sign|eth_signTypedData\w*|signMessage|signTypedData)\b/
for (const dir of ['app', 'components', 'lib', 'hooks', 'public/game-engine']) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
    const src = stripComments(fs.readFileSync(file, 'utf8'))
    src.split('\n').forEach((line, i) => {
      if (SIGN_RE.test(line)) {
        problems.push(`${path.relative(ROOT, file)}:${i + 1} — message signing is unsupported in MiniPay`)
      }
    })
  }
}

console.log(`scanned ${scanned} component files for MiniPay copy rules`)
if (!problems.length) {
  console.log('✓ no banned copy, no connect-wallet prompt, no message signing')
  process.exit(0)
}
console.error(`\n${problems.length} MiniPay copy violation(s):`)
for (const p of problems) console.error('  ✗ ' + p)
process.exit(1)
