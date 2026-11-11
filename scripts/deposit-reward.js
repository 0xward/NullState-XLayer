#!/usr/bin/env node
'use strict'

/*
 * NullState — Treasury deposit / config CLI
 * =========================================
 * A small, safe owner tool for funding and configuring the on-chain reward
 * pools from the command line (built to run in Termux on a phone, or any
 * Node environment). It signs with the CONTRACT OWNER (deployer) private
 * key, because every function it calls is onlyOwner:
 *
 *   Treasure Vault (TreasureVaultV2)
 *     - vault-set-token    setRewardToken(token)        switch payout token
 *     - vault-reward       setVaultReward(amount)        reward paid per win
 *     - vault-deposit      approve + depositVaultPool    fund the pool
 *     - vault-withdraw     withdrawVaultPool             pull unclaimed funds
 *     - store-vault-code   storeWeeklyVaultCode(wk,code) set this week's code
 *                                                        ON-CHAIN (must match
 *                                                        the Paper) so wins pay
 *     - vault-pay          submitVaultCode(user,wk,code) manually pay a winner
 *                                                        (recovery for a stuck
 *                                                        payout; owner-signed)
 *
 *   Season leaderboard bonus (NullStateRewardV3 — season ids are YYYYMM)
 *     - season-rewards      setRankRewards(r1,r2,r3)      top-3 bonus amounts
 *     - update-leaderboard  updateLeaderboard(id,top3)    publish the winners
 *     - season-deposit      approve + depositSeasonBonus  fund a season
 *     - pay                 ERC20 transfer(to, amount)    ranks 4-10, which the
 *                                                         contract cannot pay:
 *                                                         updateLeaderboard is
 *                                                         address[3] and has no
 *                                                         fourth slot
 *
 *   status                read-only overview of both contracts
 *
 * DECIMALS — the whole point of this tool. USDT and USDC on Celo are
 * 6-decimal; USDm is 18-decimal. Every --amount you pass is in HUMAN
 * DOLLARS (e.g. --amount 10 = $10); the script scales to the token's real
 * base units so you never hand-write wei or accidentally send 1e18 USDT
 * ($1,000,000,000,000). It also warns if vaultReward looks like it was left
 * in 18-decimal format while the payout token is 6-decimal.
 *
 * SETUP (Termux)
 *   pkg install nodejs git
 *   git clone <repo> && cd NullState && npm install    # or: mkdir t && cd t && npm i viem
 *   cp scripts/.env.example scripts/.env  &&  nano scripts/.env   # paste DEPLOYER_PRIVATE_KEY
 *   node scripts/deposit-reward.js status
 *
 * USAGE
 *   node scripts/deposit-reward.js <command> [flags]
 *   Flags: --token USDT|USDm|USDC  --amount <dollars>  --season <1..6>
 *          --r1 <dollars> --r2 <dollars> --r3 <dollars>
 *          --fee CELO|USDT|USDm|USDC (gas token, default CELO)
 *          --yes (skip confirm)   --dry-run (simulate, no send)   --rpc <url>
 *
 * EXAMPLES
 *   node scripts/deposit-reward.js status
 *   node scripts/deposit-reward.js vault-set-token --token USDT
 *   node scripts/deposit-reward.js vault-reward   --token USDT --amount 0.5
 *   node scripts/deposit-reward.js vault-deposit  --token USDT --amount 10
 *   node scripts/deposit-reward.js store-vault-code --code 0729   # week defaults to now
 *   node scripts/deposit-reward.js vault-pay --user 0xWINNER --code 0729   # recover a stuck payout
 *   node scripts/deposit-reward.js season-rewards --token USDT --r1 20 --r2 5 --r3 3
 *   node scripts/deposit-reward.js update-leaderboard --season 202607 --p1 0x.. --p2 0x.. --p3 0x.. --s1 120 --s2 90 --s3 70
 *   node scripts/deposit-reward.js season-deposit --season 202607 --token USDT --amount 28
 *   node scripts/deposit-reward.js pay --token USDT --to 0x.. --amount 1
 *
 * The DEPLOYER_PRIVATE_KEY must be the wallet that owns the contracts. The
 * script reads owner() on-chain first and refuses to send if your key isn't
 * the owner — so a wrong key fails safely instead of wasting gas.
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
// viem is the only external dep. In Termux the simplest install that node
// finds automatically (no NODE_PATH needed) is in your HOME dir:
//   cd ~ && npm install viem
// (node resolves require('viem') by walking up: scripts/ -> repo -> ~ ->
// ~/node_modules/viem). Fail with that hint instead of a raw stack trace.
let _viem, _viemAccounts, _viemChains
try {
  _viem = require('viem'); _viemAccounts = require('viem/accounts'); _viemChains = require('viem/chains')
} catch (_e) {
  console.error('\x1b[31m✗ viem is not installed.\x1b[0m Install it once (node finds it from your home dir):\n' +
    '    cd ~ && npm install viem\n' +
    'then re-run from the repo. (Alt: export NODE_PATH=$HOME/nsviem/node_modules if you installed it there.)')
  process.exit(1)
}
const { createPublicClient, createWalletClient, http, parseUnits, formatUnits } = _viem
const { privateKeyToAccount } = _viemAccounts
const { celo } = _viemChains

// ── addresses (Celo mainnet — mirror lib/contract-abi.ts / lib/constants/tokens.ts) ──
const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_TREASURE_VAULT_ADDRESS || '0xB145dE296cD37Cb2A62Ced70Ee4d93c1d78df742')
// NullStateRewardV3 (YYYYMM season ids). The old V2
// (0x38F85c7cE8757E2940938D4e49bCDaE1CB5D475A) is retired — its owner-only
// setters still WORK, so a stale default here would let season-rewards
// "succeed" against the wrong contract with no error. Keep this in sync
// with lib/contract-abi.ts.
const REWARD_ADDRESS = (process.env.NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS || '0xec2e7fe57a92ada02c1ab37d9415dad508b7f111')

const TOKENS = {
  USDm: { symbol: 'USDm', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, fee: '0x765DE816845861e75A25fCA122bb6898B8B1282a' },
  USDT: { symbol: 'USDT', address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6,  fee: '0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72' },
  USDC: { symbol: 'USDC', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6,  fee: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' },
}
const CELO_NATIVE = '0x471EcE3750Da237f93B8E339c536989b8978a438' // the vault's celoToken marker

// ── minimal ABIs (only what this tool calls) ──
const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }], outputs: [{ type: 'uint256' }] },
  // For `pay` — season ranks 4-10, which no contract here can reach. See that
  // subcommand for why a plain transfer is the only option.
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]
const VAULT_ABI = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'currentRewardToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'vaultReward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getAvailableVaultFunds', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'setRewardToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_newToken', type: 'address' }], outputs: [] },
  { name: 'setVaultReward', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_newReward', type: 'uint256' }], outputs: [] },
  { name: 'depositVaultPool', type: 'function', stateMutability: 'payable', inputs: [{ name: '_token', type: 'address' }, { name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'withdrawVaultPool', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_token', type: 'address' }, { name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'storeWeeklyVaultCode', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_weekId', type: 'uint256' }, { name: '_code', type: 'string' }], outputs: [] },
  { name: 'isCodeSetForWeek', type: 'function', stateMutability: 'view', inputs: [{ name: '_weekId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'submitVaultCode', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_user', type: 'address' }, { name: '_weekId', type: 'uint256' }, { name: '_code', type: 'string' }], outputs: [] },
  { name: 'hasClaimedThisWeek', type: 'function', stateMutability: 'view', inputs: [{ name: '_user', type: 'address' }, { name: '_weekId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]
const REWARD_ABI = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'rank1Reward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'rank2Reward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'rank3Reward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'setRankRewards', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_r1', type: 'uint256' }, { name: '_r2', type: 'uint256' }, { name: '_r3', type: 'uint256' }], outputs: [] },
  { name: 'depositSeasonBonus', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_seasonId', type: 'uint256' }, { name: '_rewardToken', type: 'address' }, { name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'updateLeaderboard', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_seasonId', type: 'uint256' }, { name: '_topPlayers', type: 'address[3]' }, { name: '_topScores', type: 'uint256[3]' }], outputs: [] },
]

// ── tiny .env loader (no dotenv dependency) ──
function loadEnv() {
  for (const p of [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')]) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

// ── arg parsing ──
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[key] = true
      else { out[key] = next; i++ }
    } else out._.push(a)
  }
  return out
}

const C = { r: '\x1b[0m', b: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cyn: '\x1b[36m' }
const die = (msg) => { console.error(`${C.red}✗ ${msg}${C.r}`); process.exit(1) }
const ok = (msg) => console.log(`${C.grn}✓ ${msg}${C.r}`)
const info = (msg) => console.log(`${C.cyn}${msg}${C.r}`)
const warn = (msg) => console.log(`${C.yel}⚠ ${msg}${C.r}`)

function resolveToken(sym) {
  if (!sym || sym === true) die('missing --token (USDT | USDm | USDC)')
  const key = Object.keys(TOKENS).find((k) => k.toLowerCase() === String(sym).toLowerCase())
  if (!key) die(`unknown token "${sym}" — use USDT, USDm or USDC`)
  return TOKENS[key]
}

function dollars(v, flag) {
  if (v === undefined || v === true) die(`missing ${flag} <dollars>`)
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) die(`${flag} must be a positive number of dollars`)
  return String(v)
}

function tokenBySymbolFromAddress(addr) {
  const k = Object.keys(TOKENS).find((s) => TOKENS[s].address.toLowerCase() === String(addr).toLowerCase())
  if (k) return TOKENS[k]
  if (String(addr).toLowerCase() === CELO_NATIVE.toLowerCase()) return { symbol: 'CELO', address: CELO_NATIVE, decimals: 18 }
  return { symbol: 'unknown', address: addr, decimals: 18 }
}

// Season ids are YYYYMM (e.g. 202607), matching PassSBTv3 + the app +
// NullStateRewardV3. Validate the shape so a stray "3" can't be sent.
function seasonArg(v) {
  if (v === undefined || v === true) die('missing --season <YYYYMM> (e.g. 202607)')
  const n = Number(v)
  const yyyy = Math.floor(n / 100), mm = n % 100
  if (!Number.isInteger(n) || yyyy < 2024 || yyyy > 2099 || mm < 1 || mm > 12) {
    die(`--season must be YYYYMM (e.g. 202607). Got "${v}". ` +
        `Season ids are the same YYYYMM the app uses — NOT 1..6.`)
  }
  return n
}

// The TREASURE VAULT weeks are ISO weeks (YYYYWW) — DIFFERENT from the
// season's YYYYMM. Same algorithm as the app (getISOWeekId / getVaultWeekId).
function currentVaultWeek() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return d.getUTCFullYear() * 100 + week
}
function weekArg(v) {
  if (v === undefined || v === true) return currentVaultWeek() // default to this week
  const n = Number(v)
  const yyyy = Math.floor(n / 100), ww = n % 100
  if (!Number.isInteger(n) || yyyy < 2024 || yyyy > 2099 || ww < 1 || ww > 53) {
    die(`--week must be YYYYWW ISO week (e.g. ${currentVaultWeek()}). Got "${v}".`)
  }
  return n
}

async function confirm(question, autoYes) {
  if (autoYes) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ans = await new Promise((res) => rl.question(`${C.yel}${question} [y/N] ${C.r}`, res))
  rl.close()
  return /^y(es)?$/i.test(ans.trim())
}

// Read the live economics from the public stats endpoint and print them.
//
// WHY THIS IS HERE and not only on /stats: this is the moment the decision gets
// made. Topping the pool up is the one action that turns "rewards are a
// marketing cost" into an actual transfer, and it was being taken with no view
// of what the previous rounds had cost. The numbers existed on a page nobody
// opens while holding a private key.
//
// Never blocks and never throws. A stats outage must not stop the owner
// refilling a pool that players are waiting on.
// Where /api/stats lives. This script is the one caller that cannot `import`
// lib/siteUrl.ts — it is plain CommonJS, run under bare node in Termux — so it
// reads the constant out of the file instead of keeping a sixth hand-written
// copy of the URL that would go stale the day the domain changes. The install
// instructions at the top of this file allow running it from a directory that
// holds nothing but `npm i viem`, so a missing file is expected, not an error:
// in that case STATS_URL is required, and the economics block is skipped
// rather than pointed at a guess.
function siteUrlFromRepo() {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'siteUrl.ts'), 'utf8')
    const m = src.match(/const FALLBACK = '([^']+)'/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function showEconomics(baseUrl) {
  const base = baseUrl || process.env.STATS_URL || process.env.NEXT_PUBLIC_SITE_URL || siteUrlFromRepo()
  if (!base) {
    warn('  (no STATS_URL set and lib/siteUrl.ts not found — skipping economics)')
    return
  }
  const url = base.replace(/\/+$/, '') + '/api/stats'
  let s
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    s = (await res.json()).onchain
  } catch (e) {
    warn(`  (couldn't read live economics from ${url}: ${e.message})`)
    return
  }
  if (!s) return

  const usd = (n) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '—')
  info('')
  info('  ── where the money stands ─────────────────────────')
  info(`  taken in       ${usd(s.purchaseVolumeUsd)}  from ${s.uniqueBuyers ?? '?'} paying wallet(s), ${s.purchases ?? '?'} purchase(s)`)
  info(`  paid out       ${usd(s.rewardsPaidUsd)}  across ${s.rewardsPaidCount ?? '?'} reward(s)`)
  if (typeof s.netUsd === 'number') {
    const line = `  net            ${s.netUsd < 0 ? '-' : '+'}$${Math.abs(s.netUsd).toFixed(2)}`
    if (s.netUsd < 0) warn(line + (s.rewardRatio ? `   (${s.rewardRatio.toFixed(2)}x paid out per $1 in)` : ''))
    else info(line)
  }
  // One paying wallet doing all the buying is almost always the developer
  // testing, and it is worth saying out loud before that figure gets read as
  // demand.
  if (s.uniqueBuyers === 1 && (s.purchases ?? 0) > 1) {
    warn('  every purchase so far came from ONE wallet — likely your own testing, not revenue')
  }
  info('  ───────────────────────────────────────────────────')
  info('')
}

async function main() {
  loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0]
  const dryRun = !!args['dry-run']
  const autoYes = !!args.yes

  if (!cmd || cmd === 'help' || args.help) {
    const doc = fs.readFileSync(__filename, 'utf8').match(/\/\*([\s\S]*?)\*\//)
    console.log((doc ? doc[1] : '').replace(/^ \* ?/gm, '').trim())
    return
  }

  const rpc = args.rpc || process.env.CELO_RPC_URL || 'https://forno.celo.org'
  const publicClient = createPublicClient({ chain: celo, transport: http(rpc) })

  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) die('DEPLOYER_PRIVATE_KEY not set — put it in scripts/.env (copy scripts/.env.example)')
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpc) })

  // Optional gas fee currency (Celo can pay gas in a stablecoin)
  let feeCurrency
  if (args.fee && String(args.fee).toUpperCase() !== 'CELO') {
    feeCurrency = resolveToken(args.fee).fee
  }

  const send = async (label, req) => {
    if (dryRun) { info(`[dry-run] would send: ${label}`); return null }
    const hash = await walletClient.writeContract(feeCurrency ? { ...req, feeCurrency } : req)
    info(`  tx: ${hash}`)
    info(`  ${C.dim}https://celoscan.io/tx/${hash}${C.r}`)
    const rc = await publicClient.waitForTransactionReceipt({ hash })
    if (rc.status !== 'success') die(`${label} reverted on-chain`)
    ok(`${label} confirmed`)
    return hash
  }

  const readVault = () => Promise.all([
    publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'owner' }),
    publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'currentRewardToken' }),
    publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'vaultReward' }),
    publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getAvailableVaultFunds' }),
  ])
  const readReward = () => Promise.all([
    publicClient.readContract({ address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'owner' }),
    publicClient.readContract({ address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'rank1Reward' }),
    publicClient.readContract({ address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'rank2Reward' }),
    publicClient.readContract({ address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'rank3Reward' }),
  ])

  // Guard: this key must be the owner before we attempt any write.
  const requireOwner = async (ownerAddr, which) => {
    if (ownerAddr.toLowerCase() !== account.address.toLowerCase()) {
      die(`Your key (${account.address}) is NOT the ${which} owner (${ownerAddr}).\n` +
          `  This tool can only be run by the contract owner (deployer). Deposits and\n` +
          `  config are onlyOwner — a non-owner tx would just revert and waste gas.`)
    }
  }

  // Ensure ERC20 allowance for a spender, approving if short.
  const ensureAllowance = async (token, spender, amount) => {
    const current = await publicClient.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, spender] })
    if (current >= amount) { info(`  allowance ok (${formatUnits(current, token.decimals)} ${token.symbol})`); return }
    info(`  approving ${formatUnits(amount, token.decimals)} ${token.symbol}…`)
    await send('approve', { address: token.address, abi: ERC20_ABI, functionName: 'approve', args: [spender, amount] })
  }

  const balOf = async (token, who) =>
    publicClient.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] })

  info(`${C.b}NullState treasury CLI${C.r}  ${C.dim}signer ${account.address}${C.r}`)
  if (dryRun) warn('DRY RUN — no transactions will be sent')

  switch (cmd) {
    case 'status': {
      const [vOwner, vTok, vReward, vAvail] = await readVault()
      const vt = tokenBySymbolFromAddress(vTok)
      const [rOwner, r1, r2, r3] = await readReward()
      // season rewards decimals: assume they were set in the vault's current
      // token decimals is NOT reliable; show raw + a 6-dec and 18-dec reading.
      console.log(`\n${C.b}Treasure Vault${C.r}  ${C.dim}${VAULT_ADDRESS}${C.r}`)
      console.log(`  owner            ${vOwner}${vOwner.toLowerCase() === account.address.toLowerCase() ? `  ${C.grn}(you)${C.r}` : `  ${C.red}(NOT you)${C.r}`}`)
      console.log(`  reward token     ${vt.symbol}  ${C.dim}${vTok}${C.r}`)
      console.log(`  vaultReward      ${formatUnits(vReward, vt.decimals)} ${vt.symbol}  ${C.dim}(raw ${vReward})${C.r}`)
      console.log(`  pool available   ${formatUnits(vAvail, vt.decimals)} ${vt.symbol}  ${C.dim}(accounting)${C.r}`)
      // Footgun check
      if (vt.decimals === 6 && vReward > 100000000n) {
        warn(`vaultReward = ${vReward} looks like 18-decimal but the token is 6-decimal — a claim would try to pay a huge amount. Fix: vault-reward --token ${vt.symbol} --amount <dollars>`)
      }
      console.log(`\n${C.b}Season bonus (Reward)${C.r}  ${C.dim}${REWARD_ADDRESS}${C.r}`)
      console.log(`  owner            ${rOwner}${rOwner.toLowerCase() === account.address.toLowerCase() ? `  ${C.grn}(you)${C.r}` : `  ${C.red}(NOT you)${C.r}`}`)
      console.log(`  rank1/2/3 (6dec) ${formatUnits(r1, 6)} / ${formatUnits(r2, 6)} / ${formatUnits(r3, 6)}  ${C.dim}if token is USDT/USDC${C.r}`)
      console.log(`  rank1/2/3 (18dec)${formatUnits(r1, 18)} / ${formatUnits(r2, 18)} / ${formatUnits(r3, 18)}  ${C.dim}if token is USDm${C.r}`)
      console.log('')
      // Signer balances
      for (const s of Object.keys(TOKENS)) {
        const b = await balOf(TOKENS[s], account.address)
        console.log(`  your ${s.padEnd(4)} balance  ${formatUnits(b, TOKENS[s].decimals)}`)
      }
      break
    }

    case 'vault-set-token': {
      const token = resolveToken(args.token)
      const [vOwner] = await readVault()
      await requireOwner(vOwner, 'Treasure Vault')
      warn(`Switching the vault payout token to ${token.symbol}. Remember: vaultReward must be re-set in ${token.symbol} decimals afterwards (vault-reward), and the pool must actually hold ${token.symbol}.`)
      if (!(await confirm(`setRewardToken → ${token.symbol}?`, autoYes))) return info('cancelled')
      await send(`setRewardToken(${token.symbol})`, { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'setRewardToken', args: [token.address] })
      break
    }

    case 'vault-reward': {
      const token = resolveToken(args.token)
      const amtDollars = dollars(args.amount, '--amount')
      const amount = parseUnits(amtDollars, token.decimals)
      const [vOwner] = await readVault()
      await requireOwner(vOwner, 'Treasure Vault')
      info(`  setVaultReward = $${amtDollars} = ${amount} base units (${token.decimals} dec, ${token.symbol})`)
      if (!(await confirm(`Set reward per vault win to $${amtDollars} ${token.symbol}?`, autoYes))) return info('cancelled')
      await send(`setVaultReward($${amtDollars})`, { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'setVaultReward', args: [amount] })
      break
    }

    case 'vault-deposit': {
      const token = resolveToken(args.token)
      const amtDollars = dollars(args.amount, '--amount')
      const amount = parseUnits(amtDollars, token.decimals)
      const [vOwner, vTok] = await readVault()
      await requireOwner(vOwner, 'Treasure Vault')
      if (vTok.toLowerCase() !== token.address.toLowerCase()) {
        warn(`The vault currently pays out in ${tokenBySymbolFromAddress(vTok).symbol}, but you're depositing ${token.symbol}. Payouts use the CURRENT reward token, so deposit the same token you'll pay in (run vault-set-token first).`)
      }
      const bal = await balOf(token, account.address)
      if (bal < amount) die(`insufficient ${token.symbol}: have ${formatUnits(bal, token.decimals)}, need ${amtDollars}`)
      info(`  depositing $${amtDollars} ${token.symbol} = ${amount} base units into the vault pool`)
      await showEconomics(args['stats-url'])
      if (!(await confirm(`Deposit $${amtDollars} ${token.symbol} to the Treasure Vault pool?`, autoYes))) return info('cancelled')
      await ensureAllowance(token, VAULT_ADDRESS, amount)
      await send(`depositVaultPool($${amtDollars} ${token.symbol})`, { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'depositVaultPool', args: [token.address, amount] })
      break
    }

    case 'vault-withdraw': {
      const token = resolveToken(args.token)
      const amtDollars = dollars(args.amount, '--amount')
      const amount = parseUnits(amtDollars, token.decimals)
      const [vOwner] = await readVault()
      await requireOwner(vOwner, 'Treasure Vault')
      if (!(await confirm(`Withdraw $${amtDollars} ${token.symbol} from the vault pool back to you?`, autoYes))) return info('cancelled')
      await send(`withdrawVaultPool($${amtDollars} ${token.symbol})`, { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdrawVaultPool', args: [token.address, amount] })
      break
    }

    case 'store-vault-code': {
      // Store this week's 4-digit code ON-CHAIN. The contract's
      // submitVaultCode() reverts with "Code not set for this week" until
      // this is done, which surfaced in-app as a false "Wrong code". The
      // code MUST match the value the player's Paper shows (the Firebase
      // code) — read it from your own Paper, or set it yourself in Firebase.
      const week = weekArg(args.week)
      const code = String(args.code || '')
      if (!/^\d{4}$/.test(code)) die('--code must be 4 digits (the value shown on the Paper), e.g. --code 0729')
      const [vOwner] = await readVault()
      await requireOwner(vOwner, 'Treasure Vault')
      const already = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'isCodeSetForWeek', args: [BigInt(week)] }).catch(() => false)
      if (already) die(`A code is ALREADY stored on-chain for week ${week} and can't be overwritten (contract rule). If it's wrong, you'll have to wait for next week.`)
      warn(`This can be set only ONCE for week ${week} — make sure ${code} matches the code on the Paper exactly.`)
      if (!(await confirm(`Store on-chain vault code ${code} for week ${week}?`, autoYes))) return info('cancelled')
      await send(`storeWeeklyVaultCode(${week}, ${code})`, { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'storeWeeklyVaultCode', args: [BigInt(week), code] })
      break
    }

    case 'vault-pay': {
      // Manually pay a vault winner — recovery for a payout that got stuck
      // (e.g. the backend's first-win-of-the-week request timed out after
      // storing the code but before submitVaultCode ever ran, so the win was
      // recorded off-chain but no USDT moved). submitVaultCode is onlyBackend,
      // and the contract treats the OWNER as an authorized backend
      // (`msg.sender == owner()`), so the deployer key can pay directly.
      const week = weekArg(args.week)
      const user = String(args.user || '')
      const code = String(args.code || '')
      if (!/^0x[0-9a-fA-F]{40}$/.test(user)) die('--user must be the winner\'s 0x wallet address')
      if (!/^\d{4}$/.test(code)) die('--code must be the 4-digit code (the value on the Paper), e.g. --code 0729')
      const [vOwner] = await readVault()
      await requireOwner(vOwner, 'Treasure Vault')
      const isSet = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'isCodeSetForWeek', args: [BigInt(week)] }).catch(() => false)
      if (!isSet) die(`No code stored on-chain for week ${week} yet — run store-vault-code --code ${code} first, then re-run this.`)
      const already = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'hasClaimedThisWeek', args: [user, BigInt(week)] }).catch(() => false)
      if (already) die(`${user} has ALREADY been paid for week ${week} on-chain — nothing to do.`)
      warn(`This pays the vault reward (see status) to ${user} for week ${week}. The code must match what's stored on-chain or it won't pay.`)
      if (!(await confirm(`Pay the vault reward to ${user} for week ${week}?`, autoYes))) return info('cancelled')
      await send(`submitVaultCode(${user}, ${week})`, { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'submitVaultCode', args: [user, BigInt(week), code] })
      break
    }

    case 'pay': {
      // A PLAIN ERC-20 TRANSFER, and the only way to pay season ranks 4-10.
      //
      // NullStateRewardV3 takes `address[3]` in updateLeaderboard and
      // setRankRewards(r1,r2,r3) — there is no fourth slot. Ranks 4-10 exist in
      // the frozen snapshot and on the leaderboard, so they have to be paid; the
      // contract simply cannot be the thing that pays them, and redeploying one
      // is out of scope. So: signer wallet → winner wallet, one line per rank,
      // generated by payoutCommands() in lib/server/seasonClose.ts.
      //
      // No requireOwner here, deliberately. This moves the SIGNER's own tokens
      // and touches no contract state, so being the reward contract's owner is
      // not what makes it safe — having the balance is. Every other subcommand
      // calls an onlyOwner function and would revert without that check.
      const token = resolveToken(args.token)
      const to = String(args.to || '')
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) die('--to must be a 0x wallet address')
      const amtDollars = dollars(args.amount, '--amount')
      const amount = parseUnits(amtDollars, token.decimals)
      const bal = await balOf(token, account.address)
      if (bal < amount) {
        die(`Your wallet holds ${formatUnits(bal, token.decimals)} ${token.symbol}, which is less than the $${amtDollars} this would send.`)
      }
      info(`  transfer $${amtDollars} ${token.symbol} (${token.decimals} dec) → ${to}`)
      info(`  ${C.dim}balance after: ${formatUnits(bal - amount, token.decimals)} ${token.symbol}${C.r}`)
      // Irreversible and going to an address typed on a command line, so the
      // confirmation names the recipient in full rather than an abbreviation.
      if (!(await confirm(`Send $${amtDollars} ${token.symbol} to ${to}? This CANNOT be undone.`, autoYes))) return info('cancelled')
      await send(`transfer(${to})`, { address: token.address, abi: ERC20_ABI, functionName: 'transfer', args: [to, amount] })
      break
    }

    case 'season-rewards': {
      const token = resolveToken(args.token)
      const d1 = dollars(args.r1, '--r1'), d2 = dollars(args.r2, '--r2'), d3 = dollars(args.r3, '--r3')
      const a1 = parseUnits(d1, token.decimals), a2 = parseUnits(d2, token.decimals), a3 = parseUnits(d3, token.decimals)
      const [rOwner] = await readReward()
      await requireOwner(rOwner, 'Reward')
      info(`  setRankRewards = $${d1} / $${d2} / $${d3} in ${token.symbol} (${token.decimals} dec)`)
      if (!(await confirm(`Set season top-3 bonus to $${d1}/$${d2}/$${d3} ${token.symbol}?`, autoYes))) return info('cancelled')
      await send('setRankRewards', { address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'setRankRewards', args: [a1, a2, a3] })
      break
    }

    case 'update-leaderboard': {
      // Publish the season's top-3 on-chain so claimSeasonBonus can pay them.
      // onlyBackend/owner. Addresses + scores come from your leaderboard.
      const seasonId = seasonArg(args.season)
      const players = [args.p1, args.p2, args.p3]
      const scores = [args.s1, args.s2, args.s3]
      for (let i = 0; i < 3; i++) {
        if (!players[i] || players[i] === true || !/^0x[0-9a-fA-F]{40}$/.test(String(players[i]))) die(`--p${i + 1} must be a 0x address`)
        if (scores[i] === undefined || scores[i] === true || !Number.isFinite(Number(scores[i]))) die(`--s${i + 1} must be a number (score)`)
      }
      const [rOwner] = await readReward()
      await requireOwner(rOwner, 'Reward')
      info(`  season ${seasonId} top-3: ${players.map((p, i) => `#${i + 1} ${p} (${scores[i]})`).join(', ')}`)
      if (!(await confirm(`Publish this top-3 for season ${seasonId} on-chain?`, autoYes))) return info('cancelled')
      await send(`updateLeaderboard(${seasonId})`, {
        address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'updateLeaderboard',
        args: [BigInt(seasonId), players, scores.map((s) => BigInt(Math.floor(Number(s))))],
      })
      break
    }

    case 'season-deposit': {
      const token = resolveToken(args.token)
      const seasonId = seasonArg(args.season)
      const amtDollars = dollars(args.amount, '--amount')
      const amount = parseUnits(amtDollars, token.decimals)
      const [rOwner, r1, r2, r3] = await readReward()
      await requireOwner(rOwner, 'Reward')
      const minTotal = r1 + r2 + r3
      if (amount < minTotal) {
        die(`depositSeasonBonus requires amount >= rank1+rank2+rank3 (${formatUnits(minTotal, token.decimals)} ${token.symbol} at ${token.decimals} dec). ` +
            `Either deposit more, or lower the rank rewards first with season-rewards.`)
      }
      const bal = await balOf(token, account.address)
      if (bal < amount) die(`insufficient ${token.symbol}: have ${formatUnits(bal, token.decimals)}, need ${amtDollars}`)
      info(`  depositing $${amtDollars} ${token.symbol} to season ${seasonId}`)
      await showEconomics(args['stats-url'])
      if (!(await confirm(`Deposit $${amtDollars} ${token.symbol} to season ${seasonId} bonus pool?`, autoYes))) return info('cancelled')
      await ensureAllowance(token, REWARD_ADDRESS, amount)
      await send(`depositSeasonBonus(s${seasonId}, $${amtDollars} ${token.symbol})`, { address: REWARD_ADDRESS, abi: REWARD_ABI, functionName: 'depositSeasonBonus', args: [BigInt(seasonId), token.address, amount] })
      break
    }

    default:
      die(`unknown command "${cmd}" — run without arguments for help`)
  }
}

main().catch((e) => die(e.shortMessage || e.message || String(e)))
