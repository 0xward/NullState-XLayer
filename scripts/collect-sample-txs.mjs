#!/usr/bin/env node
/**
 * Collect one sample Celoscan transaction per user-facing on-chain method,
 * for the MiniPay listing submission form ("Sample Transactions" field).
 *
 * WHY THIS EXISTS: MiniPay's readiness checklist (celopedia-skill ->
 * minipay-requirements.md §5) asks for a sample Celoscan tx link for every
 * user-facing contract method. This script pulls them automatically via the
 * Etherscan V2 unified API (one Etherscan key works for Celo, chainid 42220 —
 * which is why creating a "Celoscan" key now redirects you to Etherscan).
 *
 * USAGE:
 *   ETHERSCAN_API_KEY=xxxxx node scripts/collect-sample-txs.mjs
 *
 * The key is read from the environment ONLY — it is never written to disk or
 * committed. Requires Node 18+ (uses global fetch). No npm deps.
 */

const KEY = process.env.ETHERSCAN_API_KEY
if (!KEY) {
  console.error('Missing ETHERSCAN_API_KEY. Run: ETHERSCAN_API_KEY=xxxxx node scripts/collect-sample-txs.mjs')
  process.exit(1)
}

const CHAIN = 42220 // Celo mainnet
const BASE = `https://api.etherscan.io/v2/api?chainid=${CHAIN}`
const TX = (h) => `https://celoscan.io/tx/${h}`

// User-facing contracts + the methods we want a sample of.
const CONTRACTS = [
  { name: 'PassSBTv3 (Season Pass)',      address: '0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39', methods: ['mintFreePass', 'mintPaidPass'] },
  { name: 'NullStateRewardV3 (rewards)',  address: '0xec2e7fe57a92ada02c1ab37d9415dad508b7f111', methods: ['claimSeasonBonus', 'claimWeeklyRewards'] },
  { name: 'TreasureVaultV2 (vault)',      address: '0xB145dE296cD37Cb2A62Ced70Ee4d93c1d78df742', methods: ['submitVaultCode'] },
]

// Marketplace purchases are plain ERC-20 transfer()s INTO the treasury wallet.
const TREASURY = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6'
const PAY_TOKENS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': 'USDM',
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': 'USDC',
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 'USDT',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function apiGet(params) {
  const res = await fetch(`${BASE}&${params}&apikey=${KEY}`)
  const json = await res.json()
  if (json.status !== '1' && !Array.isArray(json.result)) {
    throw new Error(`${json.message || 'API error'}: ${JSON.stringify(json.result).slice(0, 160)}`)
  }
  return Array.isArray(json.result) ? json.result : []
}

const methodOf = (fn, methodId) => (fn ? String(fn).split('(')[0].trim() : (methodId || ''))

async function main() {
  console.log('# NullState — sample transactions for MiniPay submission')
  console.log(`# chain: Celo (${CHAIN}) · generated ${new Date().toISOString()}\n`)

  for (const c of CONTRACTS) {
    console.log(`## ${c.name}\n#  ${c.address}`)
    let txs = []
    try {
      txs = await apiGet(`module=account&action=txlist&address=${c.address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc`)
    } catch (e) {
      console.log(`   ! could not fetch: ${e.message}\n`)
      await sleep(250); continue
    }
    for (const want of c.methods) {
      const hit = txs.find((t) => t.isError === '0' && methodOf(t.functionName, t.methodId).toLowerCase() === want.toLowerCase())
      console.log(hit ? `   ${want}: ${TX(hit.hash)}` : `   ${want}: (no successful tx found yet)`)
    }
    console.log('')
    await sleep(250)
  }

  // Marketplace purchase: an incoming stablecoin transfer to the treasury.
  console.log(`## Marketplace purchase — ERC-20 transfer() to treasury\n#  ${TREASURY}`)
  try {
    const transfers = await apiGet(`module=account&action=tokentx&address=${TREASURY}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc`)
    const seen = new Set()
    let printed = 0
    for (const t of transfers) {
      if (String(t.to).toLowerCase() !== TREASURY.toLowerCase()) continue
      const sym = PAY_TOKENS[String(t.contractAddress).toLowerCase()]
      if (!sym || seen.has(sym)) continue
      seen.add(sym)
      console.log(`   purchase (${sym} transfer): ${TX(t.hash)}`)
      if (++printed >= 3) break
    }
    if (!printed) console.log('   (no stablecoin transfers to treasury found yet)')
  } catch (e) {
    console.log(`   ! could not fetch: ${e.message}`)
  }
  console.log('\n# Done. Paste the links above into the MiniPay submission form.')
}

main().catch((e) => { console.error(e); process.exit(1) })
