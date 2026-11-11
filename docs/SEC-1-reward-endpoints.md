# SEC-1 — the reward endpoints are unauthenticated

**Status:** open, deliberately deferred
**Owner's decision (2026-07-27):** *"nanti kalau rewardku sudah besar, sekarang masih kecil-kecilan"* — leave it, revisit when the pools grow.

This file exists so the next person (or agent) working on NullState does not have
to rediscover this, and — more importantly — does not "fix" it in a way that
breaks the MiniPay listing. Read the whole thing before touching these routes.

---

## The short version

Anything that hands out value can be called by anyone, from anywhere, with no
proof they ever played the game. There is no authentication, no rate limiting,
and no signature — on any endpoint.

This is **known and accepted for now**, because the prize pools are small enough
that attacking them is not worth anyone's time. It stops being acceptable the
moment that changes. The trigger is written down below; do not wait to be told.

---

## Why it is not simply "add auth"

The obvious fix — make the client sign a message and verify it server-side —
**is not available here.** MiniPay does not implement `personal_sign` or
`eth_signTypedData` at all. A signed-message scheme would work perfectly in a
desktop browser and fail on every single MiniPay device, which is the entire
target audience.

`scripts/check-minipay-copy.js` fails CI on any `signMessage` / `signTypedData`
call for exactly this reason. If you find yourself reaching for one, stop: the
check is not in your way, it is telling you the approach is wrong.

Everything proposed below is signature-free on purpose.

---

## What is actually exposed, worst first

### 1. `POST /api/abyss/score` — anyone can write any score

```
Body: { wallet, depth }
```

The route validates that `wallet` looks like an address and that `depth` is a
number. It does not, and cannot, check that the wallet ever ran the Abyss.

That leaderboard is not cosmetic: the season ranking feeds the **season bonus
payout**, which is real USDT to the top three. So a single `curl` claiming
`depth: 999999` takes the season prize from whoever actually earned it.

This is the sharpest edge in the app. If SEC-1 is only ever partly done, do this
one.

### 2. `POST /api/vault/submit` — the attempt limit is per wallet, and wallets are free

Attempts are capped (`MAX_VAULT_ATTEMPTS = 3` in `lib/vault-utils.ts`), the code
is compared against the canonical Firebase value, and a wrong guess pays
nothing. That much is sound.

The gap is where the cap lives: it is keyed on the wallet address, and anybody
can generate unlimited addresses for free. Three guesses per wallet is
effectively unlimited guesses. Whether that matters depends entirely on how
large the code space is — work that out before deciding this one is low
priority, and note that a correct guess triggers a **real on-chain payout**.

Secondary cost: every attempt does Firebase reads and contract reads. Even
failed attempts spend our RPC budget.

### 3. `POST /api/passsbt/mint` and `POST /api/marketplace/verify` — sound, and worth understanding why

These take a `txHash`, confirm the transfer on-chain, check it went to the
treasury for at least the right amount, and record the hash so it cannot be
reused. **They are not vulnerable**, because the attacker has to have actually
paid. Money moving on-chain is the authentication.

Understand this pattern before designing a fix for #1 and #2 — where possible,
the answer is to anchor on something that already costs the attacker something,
rather than to invent a new credential.

---

## When to act

Do not wait for a specific date. Act when **any** of these becomes true:

- The weekly Treasure Vault pool exceeds roughly **$50**, or
- The season bonus pool exceeds roughly **$100**, or
- The app is listed in MiniPay's discovery catalog (a much larger and much less
  friendly audience than today's), or
- `/stats` shows a leaderboard entry nobody can account for.

The last one is worth checking now and then. It is the cheapest possible
detection, and it costs nothing to look.

---

## What a fix should look like

Ordered by value per unit of effort. The first two are worth doing on their own
and do not depend on the rest.

### a. Server-side rate limiting (do this first)

Per-IP and per-wallet limits on `/api/abyss/score`, `/api/vault/submit` and
`/api/rewards/*`. Vercel offers this at the edge, or Upstash Redis works with
the free tier. This alone turns a scripted attack from trivial into tedious, and
it needs no protocol changes and no client changes at all.

### b. Make the score server-derived instead of client-asserted

The real problem with `/api/abyss/score` is not that it is unauthenticated —
it is that the client is trusted to *state* its own result. As long as the
client says "my depth was N", no amount of auth helps: a real player with a real
wallet can still lie.

The fix is to make the server the one that knows. Record run events as they
happen (floor entered, boss killed) and derive the final depth from that trail,
rejecting anything that is not physically reachable — a depth that arrived
faster than the floors could load, a jump with no intervening floors. This is
more work than (a) and it is the only thing that actually closes the hole.

### c. ODIS phone verification, for cost rather than identity

`celopedia-skill` → `odis-socialconnect.md`. MiniPay supports ODIS, and it is
signature-free, so it is compatible with everything above.

Be clear about what this buys: it does **not** authenticate a request. It makes
each *identity* cost a real phone number, which is what makes farming a reward
pool with a thousand fresh wallets uneconomic. Use it to gate reward
eligibility, not as a login.

Note the trade-off before committing: it adds a step to onboarding, in a market
where every extra step costs players. Probably worth it for reward claims only,
and not for ordinary play.

### d. Nice to have

- Cap total payouts per wallet per week server-side, so even a successful
  attack has a bounded ceiling.
- Alert when a single wallet claims more than *n* rewards in a window.

---

## Things that will not work here

- **Signed messages** — unsupported by MiniPay. See above.
- **A shared secret in the client** — anything the browser can read, an attacker
  can read. `NEXT_PUBLIC_*` is not a secret; the PostHog project key in the
  bundle is public by design and should not be taken as precedent.
- **Trusting `Origin` / `Referer`** — trivially forged by anything that is not a
  browser.
- **Obscuring the endpoints** — the client has to call them, so they are
  discoverable by definition.

---

## Related

- `MINIPAY-COMPLIANCE-CHECKLIST.md` — this is listed under "Still open" there.
- `scripts/check-minipay-copy.js` — the CI check that will block a
  signature-based fix.
- `lib/vault-utils.ts` — attempt cap and week handling.
- `app/api/marketplace/verify/route.ts` — the on-chain-anchored pattern worth
  copying where it fits.
