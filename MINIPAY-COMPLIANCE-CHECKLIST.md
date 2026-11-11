# MiniPay Compliance Checklist — NULL_STATE

**Last updated:** 2026-07-26
**Scope:** Current state after the economy/listing work (retired `NullState.sol`, free NULL_STRIKE, off-chain registration, guest mode, flexible stablecoin). Complements the broader `MINIPAY-COMPLIANCE-AUDIT-v71.md`; this file is the focused listing checklist.

---

## Core MiniPay requirements

| # | Requirement | Status | Where it's handled |
|---|---|---|---|
| 1 | **No "Connect Wallet" button inside MiniPay** — connection is implicit | ✅ | `lib/WalletProvider.tsx` auto-connects the injected connector on load (`WalletExtrasProvider` effect); MiniPay is detected via `window.ethereum.isMiniPay`. No UI element calls `connect()` — verified: zero `.connect()` call sites in `components/` or `app/`. |
| 2 | **Wallet balance is readable** | ✅ | Native/CELO balance via wagmi `useBalance` (`celoBalance` in `WalletProvider`). Stablecoin balances read via `balanceOf` in `pickBestPaymentToken`/`pickBestFeeCurrency` (`lib/constants/tokens.ts`). NullState Point balance shown in Marketplace/Rewards. `insufficientFunds` + `addCashUrl` drive a "Deposit in MiniPay" prompt. The CELO balance is read but **never rendered** — `celoBalance` stops at the provider and no component displays it (MiniPay hides CELO from users). |
| 3 | **Transaction errors are shown to the user** | ✅ | `lib/errorUtils.ts` `getUserFriendlyError()` turns viem/wallet errors into clean human strings. Surfaced in `MarketplaceScreen` (`setMsg{kind:'err'}`), `SeasonPassScreen` (`setMintError`/`setPerkMsg`), and Crafting. User-rejected and insufficient-funds cases are distinguished. |

---

## Economy & payments (MiniPay-relevant)

- ✅ **No speculative token** — economy is stablecoin (USDm/USDC/USDT) + in-game **NullState Point** (faucet-only, non-withdrawable). No project token is minted or sold.
- ✅ **NULL_STRIKE is free** — no per-action fee or wallet prompt during combat; it is gated by an in-engine cooldown. (Retired the old 0.005 USDm fee and `NullState.sol`.)
- ✅ **Flexible stablecoin (fee-abstraction)** — payments and gas default to whichever of USDm/USDC/USDT the wallet holds the most of, via CIP-64 `feeCurrency` and `pickBestPaymentToken`; the user can still switch manually.
- ✅ **Registration is off-chain** — no `register()` transaction; a wallet is a player the moment it holds a Firebase username. First-time users are never blocked by a signing step.
- ✅ **Purchases are explicit** — Marketplace and Season Pass are the only player-signed transactions; each shows price, token, and a confirm step.

---

## Access & play

- ✅ **Guest mode (outside MiniPay)** — playable with no wallet; progress stored in `localStorage` and migrated onto the wallet on first connect (`lib/guestMigration.ts`). Stablecoin claims are gated behind a connected wallet with a clear message.
- ✅ **Mobile/touch** — on-screen joystick + action buttons for touch; WASD/arrows + mouse for desktop; OS cursor is never hidden off the landing page.
- ✅ **Readable UI** — body/subtitle contrast raised to ~5:1 (`--null-muted`), meeting legibility expectations on small screens.

---

## Legal & disclosure

- ✅ **Privacy Policy** (`/privacy`) and **Terms of Service** (`/terms`) reflect the actual flow: on-chain vs off-chain (Firebase) vs local-device (guest) data, stablecoin rewards, NullState Point as non-money, and guest-mode migration. Operated by 1892 Studio.
- ✅ **Not affiliated** disclaimers for MiniPay / Opera / Celo Foundation are present in both docs.
- ⏳ **Owner confirmation still needed** (flagged in the Privacy Policy draft note): exact data-retention timelines and the formal deletion-request process.

---

## Pre-submission manual checks (device)

These require a real MiniPay devmode session and cannot be asserted from code alone:

- [ ] Open in MiniPay devmode — confirm no "Connect Wallet" button appears and the wallet is already connected.
- [ ] Confirm the wallet balance renders and updates after a purchase.
- [ ] Make a Marketplace purchase — confirm the tx signs, succeeds, and the item unlocks.
- [ ] Reject a transaction — confirm a friendly "transaction cancelled" style message appears (no raw stack trace).
- [ ] Trigger an insufficient-funds purchase — confirm the "Deposit in MiniPay" prompt appears **and the deeplink opens the Add Cash screen** (the deeplinks docs page is still marked "available soon", so this is the one item that can only be proven on a device).
- [ ] Play a run as a guest (plain browser), then connect a wallet — confirm progress migrates.

---

## Listing re-audit — 2026-07-26

A pass over the whole app against `minipay-requirements.md` (Stage 1 + Stage 2).
Five things were wrong. All five are fixed; the sixth entry is the guard that
now stops them coming back.

### Fixed

1. **Add Cash deeplink pointed at a host MiniPay does not publish.**
   `MINIPAY_ADD_CASH_URL` was `https://minipay.opera.com/add_cash`. The canonical
   reference — `docs.minipay.xyz/technical-references/deeplinks.html`, fetched
   2026-07-26 — states *"All deep links use the host link.minipay.xyz"* and
   documents Add Cash as `link.minipay.xyz/add_cash[?tokens=…]`. It lists no
   `minipay.opera.com` host at all. The comment justifying the old value claimed
   `link.minipay.xyz` was the unrelated P2P "Cash Links" feature; that was wrong.
   Now `https://link.minipay.xyz/add_cash?tokens=USDT,USDC,USDM`.
   *Caveat:* that docs page is titled **"Deeplinks (available soon)"**, so the
   device check above is the only thing that can prove it end to end.

2. **"Add Cash" used as our own button label** (Navbar ×4, Marketplace, Crafting,
   Season Pass). §3 maps this action to **Deposit**. All seven now read
   "Deposit". "Add Cash" survives only in code comments, where it correctly names
   MiniPay's own screen.

3. **"Connect your wallet to mint a pass." / "Connect to claim daily perks."**
   (`SeasonPassScreen`) — a connect prompt inside the Mini App, which §1's
   zero-click-connect rule forbids. Both now name the actionable step instead.

4. **`/profile` was permanently stuck on "Connect wallet to load profile."**
   `app/profile/page.tsx` rendered `<PlayerProfileCard />` with no
   `walletAddress`, and nothing else ever passed one — so the card could never
   leave that branch. Two violations in one dead page. The card now reads the
   wallet its own route already provides.

5. **`/profile` printed a full raw `0x…` address.** §1 (phone-first identity)
   bans a raw address as the primary identifier. It now goes through
   `maskAddress()`, and the name field falls back to the masked form. Swept the
   rest of the app: this was the only place not already masked.

### Verified clean, no change needed

- **No message signing** — no `personal_sign` / `eth_signTypedData` /
  `signMessage` / `signTypedData` anywhere in `app`, `components`, `lib`,
  `hooks` or the engine.
- **No CELO shown** — `celoBalance` is read by `WagmiIsland` and passed through
  the bridge, but no component renders it.
- **Banned vocabulary** — no "gas"/"onramp"/"offramp"/"crypto" in any user-facing
  string. The only matches in the repo are skill reference docs, an internal
  architecture note, and a script comment. `/terms` deliberately says
  "cryptocurrency" in a legal disclaimer; that is exempted on purpose.
- **360 × 640** — `/profile`, `/stats`, `/terms` and `/privacy` all render with
  no horizontal overflow at MiniPay's minimum; `/game` is covered by
  `scripts/test-perf-changes.js` (20/20).
- **ToS, Privacy and support** are all reachable in-app from Settings.

### The guard

`scripts/check-minipay-copy.js` (`npm run check:copy`, wired into CI) enforces
the three rules that live in copy and are invisible to a build, a type-check and
the asset audit alike: banned vocabulary, connect-wallet prompts, and message
signing. It scans only text a user can read — JSX text nodes and text-bearing
props — so code identifiers like `feeCurrency` and `eth_gasPrice` are untouched.
Each of the three rules was verified by reintroducing a real violation and
confirming the check goes red.

### Still open

- **SEC-1** — reward endpoints are still unauthenticated (task #26). Deferred by
  the owner on 2026-07-27 while the pools are small. Written up in full, with
  the exposure ranked, the trigger to act, and the approaches that will *not*
  work under MiniPay's no-signing constraint: **`docs/SEC-1-reward-endpoints.md`**.
- **Screenshots** for the submission (≥3, ≤500 KB each) not yet captured.
- The device checklist above.

---

## Celo-wide audit (celopedia, beyond the MiniPay listing form) — 2026-07-26

The listing checklist only covers MiniPay. This pass went through the rest of
the celopedia references — fee abstraction, attribution, token addresses,
Celo-specific security risks, and the app-fit constraints.

### Fixed: the backend's transactions were unattributed

ERC-8021 attribution traces a transaction back to the app that sent it. It feeds
Celo's impact tracking and future reward distribution, and it **cannot be
backfilled** — an untagged transaction is unattributed permanently.

`lib/attribution-tag.ts` derived the code from `window.location.hostname`, which
does not exist on a server. So the four transactions the **backend** signs were
all going out bare:

| Where | Transaction |
|---|---|
| `app/api/vault/submit` | Treasure Vault payout — *real USDT to a player* |
| `app/api/vault/submit` | Weekly vault code write |
| `app/api/passsbt/mint` | Season Pass mint |
| `lib/server/referrals.ts` | Referral pass gift |

The payout is the single most worth-attributing transaction the project sends,
and it was the one being lost. `getServerAttributionSuffix()` now covers all
four. The hostname is hardcoded to the production host rather than read from a
request header, for two reasons: it has to produce the *same* code as the
browser (`celo_135bf4523d70`, verified by round-tripping through
`fromDataSuffix`) or the dashboard splits NullState in two, and a header is
attacker-controlled — deriving from one would let anyone send transactions under
our code.

`scripts/check-attribution.js` (`npm run check:attribution`, in CI) now fails the
build on any `writeContract`/`sendTransaction` without a tag. 8 call sites, all
covered; verified by removing a tag and watching it go red.

### Verified correct, no change needed

- **Fee-currency adapters** — the single easiest thing to get wrong here. USDC
  and USDT must pass their *adapter* address in `feeCurrency`, not the token
  address; USDm passes its own. `lib/constants/tokens.ts` has all three right
  (`0x2F25deB3…` / `0x0E2A3e05…`), and `balanceOf` correctly reads the *token*
  address, not the adapter.
- **Token addresses** — USDm, USDC and USDT all match the canonical list
  exactly.
- **Preferred-stablecoin adaptation** — `pickBestTokenSymbol()` normalizes
  6-decimal USDC/USDT against 18-decimal USDm before comparing, so the "which
  does the user hold most of" answer is not skewed by decimals.
- **Legacy transactions only** — no `maxFeePerGas` / `maxPriorityFeePerGas` /
  `gasPrice` anywhere. MiniPay does not accept EIP-1559 fields.
- **CIP-64 fee-abstraction accounting** — the purchase verifier matches an ERC20
  `Transfer` event to the treasury rather than diffing balances, so a user
  paying network fees in the same token they are spending cannot corrupt the
  check. Also uses `>=`, not `==`.
- **CELO token duality** — not applicable; every contract path is ERC20
  stablecoin, none accepts native CELO.

### Noted, deliberately not changed

The UI labels the Mento Dollar **USDM** (uppercase), which is a real, *different*
token on Celo — Mountain Protocol USD, `0x59D9356E…`. Ours is Mento's USDm,
`0x765DE816…`, and the address in code is correct; only the display string is
ambiguous. This was a deliberate product decision (task #14) so it stands, but
it is worth knowing if a reviewer asks.
