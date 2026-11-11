# Treasure Vault — how it works & owner setup

This is the weekly "crack-the-code" reward loop. A player who finds the two
weekly items and enters the correct 4-digit code at the Act 5 vault door gets
paid an on-chain reward. This doc explains the full flow and **exactly where
the owner sets the two numbers: the weekly CODE and the reward AMOUNT.**

---

## The loop, end to end

1. **Find the two items.** While dungeon-crawling, two special drops come out
   of the "vault-like" interactive containers — Rotten Armoire (`wardrobe`),
   Lost Cache (`chest`), Rusted Strongbox (`safe`), Iron Footlocker
   (`footlocker`), Old Dresser (`dresser`), Ornate Cabinet (`cabinet_ornate`)
   and Stocked Shelf (`shelf_stocked`):
   - **Golden Key** — capped 1 / wallet / week (`goldenKeyClaims/{weekId}/{wallet}`).
   - **Paper** — capped 1 / wallet / week (`paperClaims/{weekId}/{wallet}`).
   Drop chance is 16% per eligible container per item (client rolls in
   `public/game-engine/props.js` `rollLootSlots()`; server gates the weekly cap
   in `/api/paper/claim` and `/api/goldenkey/claim`).

2. **Read the code off the Paper.** Tapping the Paper in the inventory shows
   the current week's 4-digit **vault code**. The Paper itself has no unique
   code — it's the item that lets you *view* the one global weekly code stored
   at `vaultCodes/{weekId}`. The code is only returned to a wallet that has
   actually claimed Paper this week (`/api/paper/status`).

3. **Enter the code at the vault door.** Act 5's boss room contains the
   **Sealed Vault Door** (`vault_door` decor, spawned in `game.js`
   `spawnDecorInto` when `campaignActIndex===4`). The player submits the
   4-digit code — **max 3 attempts per week** (`vaultAttempts/{weekId}/{wallet}`).

4. **Backend validates & pays.** `POST /api/vault/submit` checks, in order:
   - the week's code exists at `vaultCodes/{weekId}` (else 404),
   - the wallet holds **both** Paper **and** Golden Key this week (ownership
     gate — a shared code alone can't unlock it),
   - not already solved this week, attempts < 3,
   - submitted code === stored code.
   On a correct code it signs `submitVaultCode(user, weekId, code)` on
   `TreasureVaultV2` with `BACKEND_PRIVATE_KEY`, which transfers `vaultReward`
   of `currentRewardToken` to the player, and records
   `vaultCompleted/{weekId}/{wallet}`.

**weekId** = `getISOWeekId()` → `YYYYWW`, resetting every **Monday 00:00 UTC**
(`lib/web3-client.ts`). Example: the week of 2026-07-22 is **`202630`**.

---

## OWNER SETUP — the two numbers

### 1. The weekly CODE  →  Firebase Realtime Database

Path: **`vaultCodes/{weekId}`**, value shape:

```json
{ "code": "1234", "generatedAt": 1750000000000 }
```

- **It auto-generates.** The first time *any* player opens their Paper in a new
  week, `/api/paper/status` (`ensureWeeklyCode`) writes a **random** 4-digit
  code via an atomic transaction. So if you do nothing, the loop still works —
  a random code is used that week.
- **To CHOOSE the code yourself**, write `vaultCodes/{weekId}` **before the
  first player views their Paper that week** (Firebase console → Realtime
  Database, or a small Admin-SDK script). `weekId` is the current ISO week as
  `YYYYWW` — e.g. `vaultCodes/202630` = `{ "code": "0729" }`.
- To **change** a code mid-week, overwrite the same path. Players who already
  read the old code will have the wrong one — only do this at a week boundary.
- There is intentionally **no admin UI** for this; it's a direct RTDB write.

> Sanity check: a missing `vaultCodes/{weekId}` makes `/api/vault/submit`
> return `404 "Vault code not found"` and the Paper shows no code — but in
> practice the lazy-generator fills it on the first Paper view, so this only
> happens if nobody has viewed a Paper yet that week.

### 2. The reward AMOUNT  →  on-chain, owner-only

Contract: **`TreasureVaultV2.sol`**, function **`setVaultReward(uint256 _newReward)`**
(`onlyOwner`).

- Units are **smallest-units of the current reward token, and the token's
  decimals DIFFER**: USDM & CELO are **18-decimal** (1 token = `1e18`), but
  **USDT and USDC are 6-decimal** (1 token = `1e6`). Always match the amount
  to whatever `currentRewardToken` is set to — passing an 18-decimal amount
  for a 6-decimal token overpays by a factor of a trillion.
  - The game pays rewards in **USDT** (6-decimal), so with USDT selected:
    - 1 USDT → `setVaultReward(1000000)` (`1e6`).
    - 5 USDT → `setVaultReward(5000000)` (`5e6`).
    - 0.5 USDT → `setVaultReward(500000)` (`5e5`).
  - If you ever switch the reward token to USDM (18-decimal): 1 USDM → `1e18`.
- Related owner-only knobs on the same contract:
  - `setRewardToken(addr)` — pick which supported token pays out
    (`currentRewardToken`; must be one of USDM/USDT/USDC/CELO). The game
    default is **USDT**.
  - `depositVaultPool(token, amount)` — **fund the pool** the payouts come
    from. If the pool is empty, a correct code can't be paid.
  - `withdrawVaultPool(token, amount)` — pull unused funds back out.
  - `setBackendAddress(backendWallet, true)` — authorize the backend signer.

### 3. One-time backend wiring (already configured in prod)

- `BACKEND_PRIVATE_KEY` env on the server = the wallet authorized via
  `setBackendAddress(..., true)`. This wallet signs every `submitVaultCode`.
- `TREASURE_VAULT_ADDRESS` / ABI in `lib/contract-abi.ts`, RPC via
  `CELO_RPC_URL` (falls back to `https://forno.celo.org`).
- Firebase Admin credentials (`getAdminDb()` in `firebase-config.ts`) so the
  API routes can read/write the RTDB paths above.

---

## Deposit & config from the phone — `scripts/deposit-reward.js`

An owner CLI that funds/configures both pools without hand-writing wei. It
signs with the **contract owner (deployer) key**, because every deposit and
setter is `onlyOwner` — the app cannot do these from a normal MiniPay wallet
unless that wallet is the owner. It reads `owner()` on-chain first and
refuses to send if your key isn't the owner (fails safe, no wasted gas).

**Why a CLI and not raw Celoscan:** USDT/USDC on Celo are **6-decimal**,
USDM is 18. Passing `--amount 10` means **$10** and the script scales to the
right base units, so you can't accidentally send `1e18` USDT ($1 trillion).
It also warns if `vaultReward` was left in 18-decimal format while the
payout token is 6-decimal.

### Setup (Termux)
```
pkg install nodejs git
# lightweight: just viem, no full app install
mkdir ns-treasury && cd ns-treasury && npm init -y && npm i viem
# copy scripts/deposit-reward.js + scripts/.env.example here (or clone the repo)
cp .env.example .env && nano .env      # paste DEPLOYER_PRIVATE_KEY
node deposit-reward.js status
```
`scripts/.env` is gitignored — **never commit a real private key.**

### Switch both pools to USDT (one-time)
```
node deposit-reward.js vault-set-token --token USDT          # vault pays USDT
node deposit-reward.js vault-reward   --token USDT --amount 0.5   # $0.50 per win
node deposit-reward.js season-rewards --token USDT --r1 20 --r2 5 --r3 3
```

### Fund (repeat monthly with whatever budget)
```
node deposit-reward.js vault-deposit  --token USDT --amount 10       # $10 into the vault pool
node deposit-reward.js season-deposit --season 3 --token USDT --amount 28
```

Other flags: `--fee USDT` (pay gas in a stablecoin if the wallet has no
CELO), `--dry-run` (simulate, no send), `--yes` (skip the confirm prompt),
`--rpc <url>`. Run with no arguments for full help. `vault-withdraw
--token USDT --amount <n>` pulls unclaimed funds back out.

> Accounting note: the vault tracks one `totalVaultPoolDeposited` counter,
> not per-token. If you ever deposited USDM then switched to USDT, withdraw
> the old USDM first so the counter reflects the token you actually pay in.

## Season bonus — fixed via `NullStateRewardV3` (redeploy)

**Why:** `NullStateRewardV2` capped `seasonId` at 1–6, but PassSBTv3 and the
app key seasons by **YYYYMM** (e.g. `202607`). So `depositSeasonBonus(202607)`
reverted, and even at 1–6 the pass check `hasPassForSeason(user, 1..6)` was
always false (passes live under YYYYMM) — the season bonus was impossible to
use. V2 isn't upgradeable, so the fix is a redeploy.

`contracts/NullStateRewardV3.sol` is V2 verbatim with only the three
`_seasonId <= TOTAL_SEASONS` guards relaxed to `_seasonId > 0`, so season ids
are the same YYYYMM the app already sends. No funds to migrate (V2's season
pool was never funded; passes live on PassSBTv3).

### Deploy (Termux, no solc needed)
The contract is pre-compiled to `scripts/artifacts/NullStateRewardV3.json`
(solc 0.8.20, optimizer 200 runs — same verified compiler as the other
contracts). The deploy script just needs `node` + `viem`.
```
cp scripts/.env.example scripts/.env && nano scripts/.env    # DEPLOYER_PRIVATE_KEY
node scripts/deploy-reward-v3.js --dry-run                   # sanity check
node scripts/deploy-reward-v3.js                             # deploy (deployer becomes owner)
```
Constructor arg is the PassSBTv3 address (auto-filled). The deployer wallet
needs a little CELO for gas.

### Verify on Celoscan (Termux)
Deployed V3: `0xec2e7fe57a92ada02c1ab37d9415dad508b7f111`. The exact
Standard-JSON-Input it was compiled from is committed at
`scripts/artifacts/NullStateRewardV3.standard-input.json` (bytecode confirmed
byte-identical to the deployed code), so verification is a guaranteed match:
```
# free key from https://etherscan.io/myapikey (Etherscan V2 covers Celo)
echo 'ETHERSCAN_API_KEY=yourkey' >> scripts/.env
node scripts/verify-reward-v3.js
```

### After deploy
1. Set `NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS=<new address>` in Vercel, redeploy
   the app. Send the address back so `lib/contract-abi.ts`'s hardcoded
   fallback + retired-list can be updated (and the old V2 marked retired).
2. Set the top-3 bonus amounts (USDT, 6-dec):
   ```
   node scripts/deposit-reward.js season-rewards --token USDT --r1 20 --r2 5 --r3 3
   ```
3. Each season, publish the winners on-chain, then fund the pool:
   ```
   node scripts/deposit-reward.js update-leaderboard --season 202607 \
       --p1 0x.. --p2 0x.. --p3 0x.. --s1 120 --s2 90 --s3 70
   node scripts/deposit-reward.js season-deposit --season 202607 --token USDT --amount 28
   ```
   (`--season` is YYYYMM now, not 1–6. Point the CLI at the new contract by
   setting `NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS` in your shell/`.env`.)

Top-3 pass-holders then claim in-app (Rewards → Claim Rewards).

## Quick reference

| What | Where | Who sets it |
|------|-------|-------------|
| Weekly 4-digit code | Firebase RTDB `vaultCodes/{weekId}` = `{code}` | Auto-generated; owner overrides in RTDB to choose it |
| Reward amount | `TreasureVaultV2.setVaultReward(wei)` | Owner (on-chain tx) |
| Reward token | `TreasureVaultV2.setRewardToken(addr)` | Owner (on-chain tx) |
| Reward pool funding | `TreasureVaultV2.depositVaultPool(token, amount)` | Owner (on-chain tx) |
| Attempts / week | `3` (`MAX_VAULT_ATTEMPTS`, `lib/vault-utils.ts`) | Code constant |
| Drop rate per container | `16%` each, Paper & Golden Key | Code constant (`props.js`) |
| Week boundary | Monday 00:00 UTC (`getISOWeekId`) | Code constant |
