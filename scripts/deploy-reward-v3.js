#!/usr/bin/env node
'use strict'

/*
 * Deploy NullStateRewardV3 (X Layer mainnet) — runs in Termux, no solc needed.
 * ========================================================================
 * V3 fixes the season-bonus seasonId scheme (see contracts/NullStateRewardV3.sol
 * header): V2 capped seasonId at 1..6 while PassSBTv3 + the app use YYYYMM
 * (e.g. 202607), which made every season deposit/claim revert. V3 relaxes
 * that cap so the pass check finally matches.
 *
 * This deploys the PRE-COMPILED artifact (scripts/artifacts/NullStateRewardV3.json,
 * solc 0.8.20, optimizer 200 runs) with viem, so Termux only needs node + viem.
 *
 * SETUP (Termux)
 *   pkg install nodejs git
 *   # in a folder with viem installed (npm i viem) and this repo's
 *   # scripts/ + scripts/artifacts/ present:
 *   cp scripts/.env.example scripts/.env && nano scripts/.env   # DEPLOYER_PRIVATE_KEY
 *   node scripts/deploy-reward-v3.js            # add --dry-run to simulate first
 *   node scripts/deploy-reward-v3.js --testnet  # X Layer testnet (1952) instead
 *
 * The deployer key must be the wallet you want to OWN the new contract
 * (Ownable(msg.sender) — the deployer becomes owner). Constructor takes the
 * PassSBTv3 address: on --testnet it defaults to the deployed testnet PassSBTv3;
 * on mainnet it MUST be set via NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS (the
 * mainnet PassSBTv3 does not exist yet — do not guess its address).
 *
 * AFTER DEPLOY (checklist is printed at the end):
 *   1. Set NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS = <new address> in Vercel, redeploy.
 *   2. (per season) publish top-3 on-chain: updateLeaderboard(seasonId, [a,b,c], [s1,s2,s3])
 *   3. Set rank rewards in the payout token's decimals (USDC/USDT0 = 6):
 *      season-rewards via scripts/deposit-reward.js  --token USDT0 --r1 20 --r2 5 --r3 3
 *   4. Fund a season: season-deposit --season <YYYYMM> --token USDT0 --amount <total>
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
let _viem, _viemAccounts, _viemChains
try {
  _viem = require('viem'); _viemAccounts = require('viem/accounts'); _viemChains = require('viem/chains')
} catch (_e) {
  console.error('\x1b[31m✗ viem is not installed.\x1b[0m Install it once:\n    cd ~ && npm install viem\nthen re-run from the repo.')
  process.exit(1)
}
const { createPublicClient, createWalletClient, http } = _viem
const { privateKeyToAccount } = _viemAccounts
const { xLayer, xLayerTestnet } = _viemChains

const TESTNET_PASS_SBT = '0x5e51fe3036ed867053e1625edca3e0c0e96aac94' // PassSBTv3 on X Layer testnet (1952)
const ARTIFACT = path.join(__dirname, 'artifacts', 'NullStateRewardV3.json')

function loadEnv() {
  for (const p of [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')]) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
const C = { r: '\x1b[0m', b: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cyn: '\x1b[36m' }
const die = (m) => { console.error(`${C.red}✗ ${m}${C.r}`); process.exit(1) }

async function confirm(q, autoYes) {
  if (autoYes) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const a = await new Promise((res) => rl.question(`${C.yel}${q} [y/N] ${C.r}`, res)); rl.close()
  return /^y(es)?$/i.test(a.trim())
}

async function main() {
  loadEnv()
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const autoYes = args.includes('--yes')
  const testnet = args.includes('--testnet')
  const chain = testnet ? xLayerTestnet : xLayer
  const rpc = process.env.XLAYER_RPC_URL || (testnet ? 'https://testrpc.xlayer.tech' : 'https://rpc.xlayer.tech')
  const explorer = testnet ? 'https://www.oklink.com/xlayer-test' : 'https://www.oklink.com/xlayer'
  const PASS_SBT = testnet
    ? (process.env.NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS || TESTNET_PASS_SBT)
    : process.env.NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS
  if (!PASS_SBT) die('mainnet PassSBTv3 address unknown — set NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS (or use --testnet)')

  if (!fs.existsSync(ARTIFACT)) die(`artifact missing: ${ARTIFACT}`)
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'))
  if (!artifact.bytecode || !artifact.abi) die('artifact has no bytecode/abi')

  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) die('DEPLOYER_PRIVATE_KEY not set — put it in scripts/.env (copy scripts/.env.example)')
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)

  const publicClient = createPublicClient({ chain, transport: http(rpc) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpc) })

  console.log(`${C.b}Deploy NullStateRewardV3${C.r}  ${C.dim}X Layer ${testnet ? 'testnet (1952)' : 'mainnet (196)'}${C.r}`)
  console.log(`  compiler   ${artifact.compiler}`)
  console.log(`  deployer   ${account.address}  ${C.dim}(becomes owner)${C.r}`)
  console.log(`  PassSBTv3  ${PASS_SBT}  ${C.dim}(constructor arg)${C.r}`)
  console.log(`  rpc        ${rpc}`)

  const bal = await publicClient.getBalance({ address: account.address })
  console.log(`  OKB gas    ${Number(bal) / 1e18} OKB`)
  if (bal === 0n) console.log(`  ${C.yel}⚠ deployer holds 0 OKB — you need a little OKB for deploy gas${C.r}`)

  if (dryRun) { console.log(`${C.cyn}[dry-run] not deploying${C.r}`); return }
  if (!(await confirm('Deploy this contract now?', autoYes))) return console.log('cancelled')

  const hash = await walletClient.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [PASS_SBT] })
  console.log(`  tx: ${hash}`)
  console.log(`  ${C.dim}${explorer}/tx/${hash}${C.r}`)
  const rc = await publicClient.waitForTransactionReceipt({ hash })
  if (rc.status !== 'success' || !rc.contractAddress) die('deployment reverted')

  const addr = rc.contractAddress
  console.log(`\n${C.grn}✓ NullStateRewardV3 deployed:${C.r} ${C.b}${addr}${C.r}`)
  console.log(`  ${explorer}/address/${addr}\n`)
  console.log(`${C.b}Next steps${C.r}`)
  console.log(`  1. Set NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS=${addr} in Vercel, redeploy the app.`)
  console.log(`     (and send this address back so the hardcoded fallback + retired-list in`)
  console.log(`      lib/contract-abi.ts can be updated to match.)`)
  console.log(`  2. Set rank rewards in USDT0 (6-dec):`)
  console.log(`       node scripts/deposit-reward.js season-rewards --token USDT0 --r1 20 --r2 5 --r3 3`)
  console.log(`  3. Each season, publish the top-3 on-chain (updateLeaderboard) then fund it:`)
  console.log(`       node scripts/deposit-reward.js season-deposit --season <YYYYMM> --token USDT0 --amount <total>`)
  console.log(`  ${C.dim}Note: scripts/deposit-reward.js talks to whatever REWARD address is configured;`)
  console.log(`  set NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS in your shell/.env to ${addr} before using it.${C.r}`)
}

main().catch((e) => die(e.shortMessage || e.message || String(e)))
