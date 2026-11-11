#!/usr/bin/env node
'use strict'

/*
 * Verify NullStateRewardV3 on Celoscan (Etherscan V2) — runs in Termux.
 * ====================================================================
 * Submits the exact Standard-JSON-Input the contract was compiled from
 * (scripts/artifacts/NullStateRewardV3.standard-input.json — its bytecode
 * was confirmed byte-identical to the deployed code), so verification is a
 * guaranteed match. No solc, no hardhat — just node's built-in fetch.
 *
 * You need a free API key. Celo is on Etherscan's unified V2 API, so ONE
 * Etherscan key (https://etherscan.io/myapikey) verifies Celo (chainid
 * 42220). A classic Celoscan key + --api-url https://api.celoscan.io/api
 * also works.
 *
 * SETUP (Termux)
 *   # in the repo (has scripts/artifacts/*.standard-input.json):
 *   echo 'ETHERSCAN_API_KEY=yourkey' >> scripts/.env
 *   node scripts/verify-reward-v3.js
 *
 * Flags:
 *   --address 0x..     contract to verify (default: the deployed V3)
 *   --api-url <url>    override endpoint (default Etherscan V2)
 *   --chainid <n>      default 42220 (Celo mainnet)
 */

const fs = require('fs')
const path = require('path')

const DEPLOYED = '0xec2e7fe57a92ada02c1ab37d9415dad508b7f111' // NullStateRewardV3
const PASS_SBT = '0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39' // constructor _passSBT
const COMPILER = 'v0.8.20+commit.a1b79de6'
const CONTRACT_NAME = 'NullStateRewardV3.sol:NullStateRewardV3'
const STD_INPUT = path.join(__dirname, 'artifacts', 'NullStateRewardV3.standard-input.json')

function loadEnv() {
  for (const p of [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')]) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
const C = { r: '\x1b[0m', b: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m' }
const die = (m) => { console.error(`${C.red}✗ ${m}${C.r}`); process.exit(1) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

// ABI-encode the single address constructor arg (32-byte left-padded, no 0x).
function encodedCtorArgs() {
  return PASS_SBT.toLowerCase().replace(/^0x/, '').padStart(64, '0')
}

async function main() {
  loadEnv()
  if (typeof fetch !== 'function') die('this needs Node 18+ (built-in fetch). Run: node -v')

  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.CELOSCAN_API_KEY
  if (!apiKey) die('set ETHERSCAN_API_KEY (or CELOSCAN_API_KEY) in scripts/.env — free at https://etherscan.io/myapikey')
  if (!fs.existsSync(STD_INPUT)) die(`missing ${STD_INPUT}`)

  const address = arg('address', DEPLOYED)
  const chainId = arg('chainid', '42220')
  const apiUrl = arg('api-url', 'https://api.etherscan.io/v2/api')
  const sourceCode = fs.readFileSync(STD_INPUT, 'utf8')

  console.log(`${C.b}Verify NullStateRewardV3${C.r}`)
  console.log(`  address   ${address}`)
  console.log(`  compiler  ${COMPILER}`)
  console.log(`  endpoint  ${apiUrl} (chainid ${chainId})`)

  const submit = new URLSearchParams({
    chainid: chainId,
    module: 'contract',
    action: 'verifysourcecode',
    apikey: apiKey,
    codeformat: 'solidity-standard-json-input',
    sourceCode,
    contractaddress: address,
    contractname: CONTRACT_NAME,
    compilerversion: COMPILER,
    constructorArguements: encodedCtorArgs(),
  })

  const res = await fetch(`${apiUrl}?chainid=${chainId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: submit,
  })
  const j = await res.json().catch(() => ({}))
  if (String(j.status) !== '1') {
    if (/already verified/i.test(j.result || '')) { console.log(`${C.grn}✓ already verified${C.r}`); return }
    die(`submit failed: ${j.result || JSON.stringify(j)}`)
  }
  const guid = j.result
  console.log(`  guid      ${guid}\n  ${C.dim}polling status…${C.r}`)

  for (let i = 0; i < 20; i++) {
    await sleep(5000)
    const q = new URLSearchParams({ chainid: chainId, module: 'contract', action: 'checkverifystatus', guid, apikey: apiKey })
    const r = await fetch(`${apiUrl}?${q.toString()}`)
    const s = await r.json().catch(() => ({}))
    const msg = s.result || ''
    if (/pending/i.test(msg)) { process.stdout.write('.'); continue }
    if (String(s.status) === '1' || /already verified/i.test(msg)) {
      console.log(`\n${C.grn}✓ verified${C.r} → https://celoscan.io/address/${address}#code`)
      return
    }
    die(`\nverification failed: ${msg}`)
  }
  die('timed out waiting for verification status — check Celoscan directly')
}

main().catch((e) => die(e.message || String(e)))
