# NullState — Owner Runbook

What the owner does to keep the live game (and its MiniPay listing) healthy,
now that development is done. Operational companion to
[`TREASURY-OPS.md`](./TREASURY-OPS.md) (the funding/command cheat-sheet).

All treasury commands below are `node scripts/deposit-reward.js <command>`, run
from Termux, signed by the **deployer key** in `scripts/.env` (gitignored — see
Security at the bottom).

---

## 🗓️ Daily (5–10 min)

1. **Support** — check Telegram (`t.me/nullstate_id`) and reply. MiniPay
   requires **critical issues fixed within 24h** or the listing can be
   suspended. This is the single most important recurring task.
2. **Backend gas** — the backend wallet `0xAb73e0E9…F92f2eb6` auto-signs vault
   payouts and stores the weekly code. **If its CELO runs out, payouts fail.**
   Keep a small CELO balance on it.
3. **Quick health check** — open the game (Continue / New Game both work?),
   glance at Vercel (no red errors) and `/stats` (no weird spikes).

## 📅 Weekly — Treasure Vault

The weekly code is stored on-chain **automatically** by the backend on the first
correct submit — you never set it by hand. Your only weekly job is keeping the
pool funded:

```bash
node scripts/deposit-reward.js vault-deposit --token USDT --amount 1   # +$1 ≈ 20 wins @ $0.05
node scripts/deposit-reward.js status                                   # check pool + per-win reward
```

Top up so there's enough USDT for the week's expected wins. Depositing mid-week
is always safe (it accumulates).

## 🗓️ Monthly — Season (end of month, UTC)

Season id = `YYYYMM` (e.g. July 2026 → `202607`).

**You no longer work out the winners yourself.** A cron freezes the ranking the
moment the season ends (GAME-DESIGN.md §9) and hands you the exact commands.
Money still needs your signature — no deployer key lives on the server.

**Ten places are paid: $20 / $5 / $3, then $1 each down to rank 10 — $35 a
month.** The reward contract holds exactly three (`updateLeaderboard` takes
`address[3]`), so ranks 4–10 are **direct transfers**, one command each. That
split is not a preference; there is no fourth slot to put anyone in.

### 1. Open the payout status

```
https://<your-host>/api/season/status
```

It answers with the frozen top 10 **and a `commands` array** — every line below,
already filled in with the right addresses, scores and amounts. Paste them in
order; do not retype them.

`/stats` shows the same thing in amber — **"Winners frozen — payout pending"** —
until step 3. If you ever see that line lingering, a payout is owed.

### 2. Run what it gives you

```bash
# commands[0] — make the contract's amounts match what the app promises.
# Cheap no-op when nothing changed; the one time it is NOT a no-op is the time
# it would otherwise have paid the wrong figure. Run it, don't skip it.
node scripts/deposit-reward.js season-rewards --token USDT --r1 20 --r2 5 --r3 3

# commands[1] — publish the podium on-chain so they can claim
node scripts/deposit-reward.js update-leaderboard --season 202607 \
  --p1 0x.. --p2 0x.. --p3 0x.. --s1 120 --s2 90 --s3 70

# commands[2] — fund the pool. $28: the podium's share ONLY. Depositing all $35
# would strand $7 in a contract with no way to release it.
node scripts/deposit-reward.js season-deposit --season 202607 --token USDT --amount 28

# commands[3..9] — ranks 4-10, one transfer each. These are the seven the
# contract cannot pay. Skipping them pays seven people nothing, silently.
node scripts/deposit-reward.js pay --token USDT --to 0x.. --amount 1   # rank 4
# … through rank 10
```

### Lines starting with `#` are for you, not for pasting

A player who signs in with Google is ranked under an address derived from their
account id — SHA-256 of it. That address can RECEIVE money and can never send
it, because no private key for it exists anywhere. USDT paid there is destroyed,
not delayed.

So the list now tells you three things before it tells you anything else:

```
# ⚠ NO ADDRESS — do NOT pay these, the money would be destroyed:
#   rank 4  Rondo  $1  (ranked as 0x…, which is an account key, not a wallet)
#   Ask each of them for a wallet address, then pay by hand.
```
No command is generated for them at all. Ask them for a wallet and send it
yourself.

```
# ⛔ ON-CHAIN PAYOUT WITHHELD. Rank 2 cannot claim:
```
The contract pays by **claim**, and someone who cannot sign can never claim. If
a podium winner has no wallet, funding the pool locks your deposit in a contract
with no way out — so the whole on-chain half is withheld until you have an
address from them. Ranks 4-10 still pay normally; one blocked winner does not
stop the rest.

```
# ⚠ UNVERIFIED — ranked before payout addresses were recorded.
```
These are paid at their ranked address, as before. Unknown is not the same as
safe: it means nobody has checked. Confirm with them that it is a wallet they
control before you run the line.

**Check every address before signing.** Nothing is filtered out server-side
beyond the destroyed-money case above — your review is the safeguard, which is
why the payout was never automated end to end. The `pay` command is a plain
transfer out of your own wallet and cannot be undone.

### 3. Mark it paid

```bash
curl -X POST https://<your-host>/api/season/status \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"seasonId":202607,"note":"<tx hash>"}'
```

This only sets a flag — it cannot move money or change who won. `/stats` turns
green and stops nagging, and the in-game **Leaderboard** shows the season under
*Last season* as ✓ Paid instead of ● Payout pending.

**Do it even if you paid by hand.** A direct transfer moves the money but leaves
no record the app can see, so without this flag every player is still being told
the payout is pending.

The next season starts automatically. Announce winners on Telegram/Twitter for
retention.

> **If a month is ever missed**, the cron runs daily and will freeze it on the
> next run. To force one: `curl -H "Authorization: Bearer $CRON_SECRET"
> https://<your-host>/api/cron/season`

### Setup, once: `CRON_SECRET` and `ADMIN_SECRET`

Until both are set, the two routes above **refuse** and nothing is frozen — see
`.env.example`. Neither is a key, and neither can spend anything.

This ran on `openssl rand -hex 32` for a while, which is fine on a laptop and
not much help on a phone — which is where this project is actually operated
from.

**Any of these, in order of least effort:**

| Where | How |
|---|---|
| A password manager | Generator → length **48+**, **symbols OFF** (letters and digits only) |
| Termux (you have Node already) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Termux with openssl | `pkg install openssl-tool` then `openssl rand -hex 32` |

Run it **twice** — two different values, one per variable.

**Symbols off is not fussiness.** These get pasted into an HTTP header and into
a shell command, and `$`, backtick, quotes and `\` misbehave in both. Hex from
the Node or openssl line is `0-9a-f` only, so it is safe by construction.

**Never a website that generates it for you** — the site sees the value. And
never in the repo: it is public.

**Then, in Vercel:** Settings → Environment Variables → add each one to
**Production** → Deployments → newest → ⋯ → **Redeploy**.

That last step is not optional. A new environment variable does not reach a
deployment that is already running, and the symptom is identical to never
having set it.

The name must be **exactly** `CRON_SECRET`. Vercel Cron only sends
`Authorization: Bearer <value>` when the variable has that name; misspell it and
the cron still fires, is rejected every time, and nothing tells you.

**Check it worked, from a phone browser** — open
`https://<your-host>/api/cron/season`:

| Response | Meaning |
|---|---|
| `{"error":"CRON_SECRET is not configured"}` | not set, or not redeployed yet |
| `{"error":"Unauthorized"}` | ✅ **working** — the route found your secret and correctly refused a browser that has no token |

`Unauthorized` is the answer you want. `ADMIN_SECRET` has no browser test (it is
a POST); it proves itself on the step-3 `curl` above.

**If one ever leaks**, generate a new one, replace it in Vercel, redeploy. That
is the whole recovery — no money is at risk either way.

## 🔧 As needed

- **Top up gas (CELO)** on both wallets: deployer `0x2A6b5204…b7d912F7` (Termux
  ops) and backend `0xAb73e0E9…F92f2eb6` (Vercel).
- **Watch `/stats`** — a rising failed-tx rate usually means something broke.
- **Ship fixes/features** — but **batch** several changes into one PR/deploy so
  Vercel builds don't pile up (Hobby plan runs one build at a time).
- **Growth** — referrals, socials, community.

## ⚠️ Don't let these slip (they take the game "down")

| Risk | Effect | Prevent |
|------|--------|---------|
| Backend gas runs out | Payouts & pass mints fail | Daily gas check |
| Vault / season pool empty | Rewards can't be paid | Weekly / monthly top-up |
| Critical issue open > 24h | MiniPay may suspend the listing | Monitor support |
| Private key leaks | Treasury funds can be drained | Keep keys out of the repo (below) |

**Realistic priority:** the only truly non-negotiable routines are
**(1) support**, **(2) backend gas**, **(3) topping up the vault/season pools.**

---

## 🔐 Security (this repo is PUBLIC)

- **Never commit a private key.** Wallet + contract *addresses* are public
  on-chain and fine to have in the repo; **private keys are not.**
- **Where keys live:** `DEPLOYER_PRIVATE_KEY` → `scripts/.env` (gitignored, on
  your Termux device only). `BACKEND_PRIVATE_KEY` + `FIREBASE_PRIVATE_KEY` →
  Vercel Environment Variables (never in code).
- **Verified clean** (2026-07-24 audit): no `.env` with real values tracked, no
  private keys / API keys / Firebase service-account committed. Keep it that way
  — if you ever paste a key into a file, make sure that file is gitignored
  before committing.
- If a key is ever exposed: rotate it immediately (move funds to a new wallet /
  set a new backend signer via `setBackendAddress`) — a leaked key means anyone
  can act as that wallet.
