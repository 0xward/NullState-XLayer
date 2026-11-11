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
| **Backend** | `0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6` | `BACKEND_PRIVATE_KEY` on Vercel | Auto-signs the weekly vault code + payout. Needs a little CELO for gas. |

Both wallets need a small CELO balance for gas.

## Contracts (Celo mainnet)

| Contract | Address | ID scheme |
|----------|---------|-----------|
| Treasure Vault (weekly) | `0xB145dE296cD37Cb2A62Ced70Ee4d93c1d78df742` | ISO week `YYYYWW` |
| Season Bonus / RewardV3 (monthly) | `0xec2e7fe57a92ada02c1ab37d9415dad508b7f111` | Month `YYYYMM` |

Tokens (Celo): **USDT** `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` (6 dec) ·
**USDC** `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` (6 dec) ·
**USDM** `0x765DE816845861e75A25fCA122bb6898B8B1282a` (18 dec).
All `--amount` flags are in **human dollars** — the script scales to the token's
decimals for you.

---

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
Just make sure the backend wallet holds a little CELO for that gas.

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

> **Historical note.** The ledger below records the rank rewards being set to
> $1 / $0.60 / $0.40 on 2026-07-22 while the app's `RANK_REWARDS_USD` said
> $20 / $5 / $3 — so `/stats` promised a figure `claimSeasonBonus` would not have
> paid. Step 1 is now emitted as `commands[0]` of every payout so the two are
> re-synced by the act of paying.

`--s1/--s2/--s3` are the winners' Abyss depth/scores (for display on-chain),
not money. Get them from the Abyss leaderboard.

---

## Recovery — a winner didn't get paid

If a player entered the correct code but no USDT arrived, the payout got stuck
(the backend recorded the win but its `submitVaultCode` tx never landed — e.g.
a serverless timeout on the first win of the week, or the backend wallet was
out of CELO gas). Two ways to recover:

1. **Easiest:** make sure the backend wallet `0xAb73…` has a little CELO, then
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

- 2026-07-22 · vault reward set $0.05 USDT · tx 0xa211c9f3b982e31812bcde5ce7757c14a9957f9d8ff63acf3d92ae9f0b0a018c
- 2026-07-22 · vault · +$1 USDT · tx 0x8cf4a8a8276167b9765562922378faa6ab32bcfa3de7615a36908c0ede10ab5f
- 2026-07-22 · vault-pay winner 0x444e…c0Bb (recovery, week 202630) · −$0.05 USDT · tx 0x6b7e6605919d6fd8d17aa37b0e56104b0b0c1bb143d022ccbd7f6202a3c30225
- 2026-07-22 · season 202607 rank rewards set $1 / $0.60 / $0.40 USDT · tx 0xf4ab89932f5a496fba0eb227d812a0ebdf1617255719336ea2d9dbd2b16ad735
- 2026-07-22 · season 202607 · +$2 USDT · tx 0x8bdaa6b3ab8423a0bc8baf82988867e3f943b8b7b0ad52e1bbb92ec3777a085c
