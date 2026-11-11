# Treasury Operations — Owner Cheat Sheet

Running note for the owner (deployer wallet) on how to fund and configure the
two on-chain reward pools from Termux. Everything below is run with
`node scripts/deposit-reward.js <command>` from inside the repo, signed by the
**deployer key** (`DEPLOYER_PRIVATE_KEY` in `scripts/.env`).

> Keep a deposit log at the bottom of this file so you never lose track of what
> was funded and when.

---

## Wallets

| Role | Address | Where its key lives | Used for |
|------|---------|--------------------|----------|
| **Deployer / Owner** | `0x2A6b5204B83C7619c90c4EB6b5365AA0b7d912F7` | `scripts/.env` (Termux only) | All `onlyOwner` CLI ops below |
| **Backend** | `0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6` | `BACKEND_PRIVATE_KEY` on Vercel | Auto-signs the weekly vault code + payout. Needs a little OKB for gas. |

Both wallets need a small OKB balance for gas.

## Contracts (X Layer testnet — live test deployment, chain 1952)

Mainnet contracts are not deployed yet — add their addresses here after the mainnet deploy.

| Contract | Address | ID scheme |
|----------|---------|-----------|
| PassSBTv3 | `0x52Fa686f14849B69309b8772EcE8051D508f7B98` | Season `YYYYMM` |
| Treasure Vault (weekly) | `0x0Bf0F45774848A9d4B9cC672b247f575A5822638` | ISO week `YYYYWW` |
| Season Bonus / RewardV3 (monthly) | `0x3a8396D2c8f5aA22b382b9DB03517CB453190334` | Month `YYYYMM` |

Redeployed 2026-11-11 (new testnet wallet — the previous deployment's owner key was lost, so these replace it).

Tokens (X Layer): **USDC** `0xB6CEceAB302E2E4948951eE7843FC24E92933061` (6 dec) ·
**USDT0** `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` (6 dec).
Testnet: **tUSD** `0x3FF2324b603C079dD17506858856a9e4ab4AF4e9` (test token).
All `--amount` flags are in **human dollars** — the script scales to the token's
decimals for you.

## Which commands can be re-run, and when

| Command | Repeatable? | Notes |
|---------|:-----------:|-------|
| `vault-deposit` | ✅ any time, same week too | Adds to the pool (accumulates). Deposit $1 again → pool = $2. |
| `vault-reward` | ✅ any time | Overwrites the per-win amount. |
| `vault-set-token` | ✅ any time | Overwrites payout token. Re-set `vault-reward` after switching (decimals change). |
| `season-rewards` | ✅ any time | Overwrites the rank1/2/3 amounts. |
| `season-deposit` | ✅ any time | Adds to that season's pool. `--amount` must be ≥ r1+r2+r3. |
| `update-leaderboard` | ✅ per season | Publishes/updates the top-3 winners. Do it at season end. |
| **`store-vault-code`** | ❌ **once per week** | Contract locks `isCodeSetForWeek` — can't overwrite. **Now automatic** via the backend on the first correct submit, so you normally never run this by hand. |

**Takeaway:** the only once-per-week lock is `store-vault-code`, and it's
automated. Depositing more mid-week is always fine.

---

## Weekly Vault — setup / top-up

```bash
# One-time (or when changing token): point the vault at USDT and set the per-win reward
node scripts/deposit-reward.js vault-set-token --token USDT
node scripts/deposit-reward.js vault-reward   --token USDT --amount 0.05   # $0.05 per win

# Fund the pool (re-run any time to add more)
node scripts/deposit-reward.js vault-deposit  --token USDT --amount 1      # +$1 → pays 20 wins

# Check
node scripts/deposit-reward.js status
```

The weekly code is stored on-chain **automatically** by the backend the first
time a player submits the correct code — no manual `store-vault-code` needed.
Just make sure the backend wallet holds a little OKB for that gas.

## Monthly Season Bonus — setup / top-up

Season id = `YYYYMM` (e.g. July 2026 → `202607`).

Ten places are paid — **$20 / $5 / $3, then $1 each to rank 10 ($35/month)** —
but the contract holds only three. `updateLeaderboard` takes `address[3]`, so
ranks 4–10 are direct transfers. `/api/season/status` generates all of these
filled in; the shapes are here for reference.

```bash
# 1. Set the top-3 bonus amounts (must match RANK_REWARDS_USD in the app)
node scripts/deposit-reward.js season-rewards --token USDT --r1 20 --r2 5 --r3 3

# 2. Fund the season pool with the PODIUM's share only ($28, not $35).
#    The other $7 never enters the contract — it cannot come back out.
node scripts/deposit-reward.js season-deposit --season 202607 --token USDT --amount 28

# 3. AT SEASON END — publish the winners so they can claim
node scripts/deposit-reward.js update-leaderboard --season 202607 \
  --p1 0xWINNER1 --p2 0xWINNER2 --p3 0xWINNER3 \
  --s1 <score1> --s2 <score2> --s3 <score3>

# 4. Ranks 4-10 — a plain transfer each, from your own wallet. No contract
#    involved, and no way to undo one.
node scripts/deposit-reward.js pay --token USDT --to 0xRANK4 --amount 1
```

> **Note.** Step 1 is emitted as `commands[0]` of every payout so the on-chain amounts and the app's `RANK_REWARDS_USD` are re-synced by the act of paying.

`--s1/--s2/--s3` are the winners' Abyss depth/scores (for display on-chain),
not money. Get them from the Abyss leaderboard.

---

## Recovery — a winner didn't get paid

If a player entered the correct code but no USDT arrived, the payout got stuck
(the backend recorded the win but its `submitVaultCode` tx never landed — e.g.
a serverless timeout on the first win of the week, or the backend wallet was
out of OKB gas). Two ways to recover:

1. **Easiest:** make sure the backend wallet `0xAb73…` has a little OKB, then
   have the player **reopen the vault and enter the code again**. The server
   now self-heals — it retries only the payout (the code is already stored
   on-chain, so it's a single fast tx) and pays out.

2. **Manual (owner pays directly from Termux):**
   ```bash
   node scripts/deposit-reward.js vault-pay --user 0xWINNER_WALLET --code 0729
   ```
   `submitVaultCode` is owner-authorized, so the deployer key pays the winner
   the configured `vaultReward`. It refuses if the winner was already paid, or
   if this week's code isn't stored on-chain yet. `--week` defaults to the
   current ISO week; pass `--week YYYYWW` to target another.

Verify with `status` afterwards — `pool available` should drop by one reward.

## Deposit log

Append a line each time you fund something. Format:
`YYYY-MM-DD · <vault|season YYYYMM> · +$<amount> <token> · tx <hash>`
