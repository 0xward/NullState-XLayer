#!/usr/bin/env node
'use strict'

/*
 * Verify NullStateRewardV3 on OKLink (X Layer) — runs in Termux.
 * ====================================================================
 * Submits the exact Standard-JSON-Input the contract was compiled from
 * (scripts/artifacts/NullStateRewardV3.standard-input.json — its bytecode
 * was confirmed byte-identical to the deployed code), so verification is a
 * guaranteed match. No solc, no hardhat — just node's built-in fetch.
 *
 * OKLink's contract-verification API (docs: https://www.oklink.com/docs/en/):
 *   POST /api/v5/explorer/contract/verify-source-code
 *   POST /api/v5/explorer/contract/check-verify-result
 * with header `Ok-Access-Key: <key>` and a JSON body. You need a free
 * OKLink key (https://www.oklink.com/ → My account → API management).
 *
 * NOTE on the source: scripts/artifacts/*.standard-input.json embeds the
 * contract source with its comments cleaned for the X Layer move. Comments
 * do not affect bytecode, so the compiled output is still byte-identical
 * to the deployed contract and verification still matches.
 *
 * SETUP (Termux)
 *   # in the repo (has scripts/artifacts/*.standard-input.json):
 *   echo 'OKLINK_API_KEY=yourkey' >> scripts/.env
 *   node scripts/verify-reward-v3.js
 *
 * Flags:
 *   --address 0x..     contract to verify (default: the deployed testnet V3)
 *   --chain XLAYER_TESTNET|XLAYER   default XLAYER_TESTNET (1952); XLAYER is mainnet (196)
 *   --api-url <url>    override endpoint (default https://www.oklink.com)
 *
 * On mainnet there is no deployed V3 yet — --chain XLAYER requires --address.
 */

const fs = require('fs')
const path = require('path')

const TESTNET_DEPLOYED = '0x3a8396D2c8f5aA22b382b9DB03517CB453190334' // NullStateRewardV3 on X Layer testnet (1952)
const TESTNET_PASS_SBT = '0x52Fa686f14849B69309b8772EcE8051D508f7B98' // constructor _passSBT on testnet
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
function encodedCtorArgs(passSbt) {
  return passSbt.toLowerCase().replace(/^0x/, '').padStart(64, '0')
}

async function main() {
  loadEnv()
  if (typeof fetch !== 'function') die('this needs Node 18+ (built-in fetch). Run: node -v')

  const apiKey = process.env.OKLINK_API_KEY
  if (!apiKey) die('set OKLINK_API_KEY in scripts/.env — free at https://www.oklink.com/ (My account → API management)')
  if (!fs.existsSync(STD_INPUT)) die(`missing ${STD_INPUT}`)

  const chainShortName = arg('chain', 'XLAYER_TESTNET').toUpperCase()
  if (chainShortName !== 'XLAYER_TESTNET' && chainShortName !== 'XLAYER') {
    die(`--chain must be XLAYER_TESTNET or XLAYER, got "${chainShortName}"`)
  }
  const isTestnet = chainShortName === 'XLAYER_TESTNET'
  const address = arg('address', isTestnet ? TESTNET_DEPLOYED : null)
  if (!address) die('no mainnet V3 deployed yet — pass --address 0x.. (or drop --chain XLAYER to verify testnet)')
  const passSbt = isTestnet ? TESTNET_PASS_SBT : arg('pass-sbt', null)
  if (!passSbt) die('mainnet verification also needs --pass-sbt 0x.. (the PassSBTv3 constructor arg)')
  const apiBase = arg('api-url', 'https://www.oklink.com').replace(/\/+$/, '')
  const explorer = isTestnet ? 'https://www.oklink.com/xlayer-test' : 'https://www.oklink.com/xlayer'
  const sourceCode = fs.readFileSync(STD_INPUT, 'utf8')

  console.log(`${C.b}Verify NullStateRewardV3${C.r}`)
  console.log(`  address   ${address}`)
  console.log(`  chain     ${chainShortName}`)
  console.log(`  compiler  ${COMPILER}`)
  console.log(`  endpoint  ${apiBase}/api/v5/explorer/contract/verify-source-code`)

  // OKLink's docs do not list a constructor-args field for
  // solidity-standard-json-input; it is sent anyway (the verifier needs the
  // args from somewhere, and unknown JSON fields are ignored if unneeded).
  // If submission is rejected, drop constructorArguements first.
  const submitRes = await fetch(`${apiBase}/api/v5/explorer/contract/verify-source-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Ok-Access-Key': apiKey },
    body: JSON.stringify({
      chainShortName,
      contractAddress: address,
      contractName: CONTRACT_NAME,
      sourceCode,
      codeFormat: 'solidity-standard-json-input',
      compilerVersion: COMPILER,
      optimization: '1',
      optimizationRuns: '200',
      constructorArguements: encodedCtorArgs(passSbt),
    }),
  })
  const j = await submitRes.json().catch(() => ({}))
  if (String(j.code) !== '0' || !Array.isArray(j.data) || !j.data[0]) {
    die(`submit failed: ${j.msg || JSON.stringify(j)}`)
  }
  const guid = j.data[0]
  console.log(`  guid      ${guid}\n  ${C.dim}polling status…${C.r}`)

  for (let i = 0; i < 20; i++) {
    await sleep(5000)
    const r = await fetch(`${apiBase}/api/v5/explorer/contract/check-verify-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Ok-Access-Key': apiKey },
      body: JSON.stringify({ chainShortName, guid }),
    })
    const s = await r.json().catch(() => ({}))
    const result = Array.isArray(s.data) ? s.data[0] : ''
    if (/pending/i.test(result || '')) { process.stdout.write('.'); continue }
    if (result === 'Success') {
      console.log(`\n${C.grn}✓ verified${C.r} → ${explorer}/address/${address}#code`)
      return
    }
    die(`\nverification failed: ${result || s.msg || JSON.stringify(s)}`)
  }
  die('timed out waiting for verification status — check OKLink directly')
}

main().catch((e) => die(e.message || String(e)))
