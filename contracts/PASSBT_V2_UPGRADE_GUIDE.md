# PassSBT v2 — Upgrade Guide

**Read this whole file before touching anything.** It's written so a future
session/agent (or the user themself) can pick this up cold and understand
exactly what's broken, what was built to fix it, and what steps are left.

> **STATUS as of session v34:** user (Fa) confirmed via CeloScan screenshots
> that all 6 seasons are already `initializeSeason()`'d on v1 with the wrong
> 2024 timestamps (see bug #2 below — this was newly found in v34, on top of
> the original lifetime-lock bug this guide was written for). Fa decided:
> **redeploy to v2 now, start everyone at zero (no v1 backfill needed, no
> one has minted yet).** Steps 1-4 (contract source, flattening, and the
> frontend code in step 6) are DONE as of v34 — compiled clean with solc
> 0.8.20 + optimizer 200 runs in a sandbox, matching the exact settings
> step 3 below tells you to use in Remix. **What's left is steps 3-5 below,
> which need Fa's wallet and can only happen on-device.**

---

## 1. The bugs (why v2 exists at all)

### Bug #1 — lifetime pass lock (original reason v2 was started)

The live v1 contract (`contracts/PassSBT.sol`, deployed on Celo Mainnet at
`0x5235ffBb4C02fCabf29b76Aa0011DA3E1eD96f0e`) tracks pass ownership with:

```solidity
mapping(address => uint256) public userPassSeason; // user => seasonId they hold pass for
```

Both `mintFreePass()` and `mintPaidPass()` require
`userPassSeason[msg.sender] == 0` ("Already have active pass") before minting,
and this value is **set once and never reset to 0**. Result: once *any* user
mints *any* season's pass, that `require()` permanently blocks them from ever
minting again — for August, September, or any future season. This directly
contradicts the intended design already documented in `docs/pass-system.md`
and `docs/faq.md`: **"1 pass per user per season"**, not one pass ever.

### Bug #2 — season dates initialized with 2024 timestamps (found + confirmed v34)

Separately, `SEASONS_CONFIGURATION.md` (the doc used to copy-paste values
into CeloScan's `initializeSeason` form) had every one of its 12 timestamps
off by exactly 2 years — labeled "2026" but actually 2024. **Fa confirmed
via CeloScan (session v34) that this was already called on-chain**: the
`SeasonCreated` event log for `seasonId 202607` shows `startDate:
1719792000, endDate: 1722470399` — 1 Jul 2024 to 31 Jul 2024, not 2026 — and
all 6 seasons show as already-initialized in the contract's transaction
history. Since `initializeSeason()` has `require(seasonStartDate[_seasonId]
== 0, "Season already exists")`, none of these 6 seasonIds can be
re-initialized with corrected dates on the v1 contract — there is no
"update" function either. This is the direct cause of the "Season ended"
bug reported against the live game (punch-list item #4): the frontend's
`daysRemaining()` in `components/game/SeasonPassCard.tsx` computes that
status text purely from the on-chain `endDate` vs. `Date.now()`, and a 2024
`endDate` will always read as expired.

### Why neither bug can be patched in place

- **v1 is not upgradeable.** Plain OpenZeppelin `ERC721`/`Ownable`, no proxy
  pattern. What's deployed is permanent.
- **v1's owner has no reset/update function.** The only owner-only functions
  are `initializeSeason`, `addToWhitelist`/`removeFromWhitelist`, and their
  batch variants. There is no "reset this user's pass status" or "fix this
  season's dates" function anywhere.

So: **a new contract deployment is the only fix for either bug** — and since
we need one anyway, `PassSBTv2.sol` fixes both at once. `SEASONS_CONFIGURATION.md`
has already been corrected to the right 2026 timestamps (section 5 below
uses those corrected values).

---

## 2. What's in this folder

- **`PassSBTv2.sol`** — the new contract source. Read the big comment block
  at the top of the file first — it explains exactly what changed vs. v1 and
  why, function by function. Short version:
  - Per-season mint tracking (`userMintedSeason[user][seasonId]`) replaces
    the old lifetime flag. A user can now mint once per season, for all 6
    seasons, instead of once ever.
  - `hasPass(address)` now means "does this user have a pass for the
    **currently active** season" (determined on-chain from timestamps),
    which is what the game docs actually describe. v1's `hasPass()` answered
    a different question ("has this user ever minted anything").
  - `getUserPassSeason(address)` keeps its v1 name/signature (needed for
    `NullStateReward.sol`'s `IPassSBT` interface) but now means "most
    recently minted season" — informational only.
  - New: `hasPassForSeason(address, seasonId)` and `getCurrentSeasonId()`.
  - Unchanged from v1: `PASS_PRICE` (0.3 USDm), `TOTAL_SEASONS` (6),
    `BASE_URI`, the USDm token address, whitelist/FCFS mechanics, and the
    Soulbound (non-transferable) behavior. **This is a bugfix, not a
    redesign** — nothing else is different.
- **`PassSBTv2.flattened.sol`** — the same contract, pre-flattened into a
  single file (OpenZeppelin's `ERC721`, `Ownable`, `Strings`, `Context`,
  etc. all inlined, one `SPDX-License-Identifier`, one `pragma`). This is
  what you paste into Remix to deploy, and what you paste into CeloScan's
  "Verify & Publish" single-file form. It was generated with `npx hardhat
  flatten` against `@openzeppelin/contracts@5.0.2` in a sandbox that *does*
  have npm registry access — this sidesteps the ARM64/Termux Foundry
  incompatibility that blocked flattening on-device before (see the
  long-term background on this project: Foundry binaries don't run on
  Termux/ARM64). If you ever need to re-flatten after editing
  `PassSBTv2.sol`, do it in an environment with npm access (this sandbox,
  a GitHub Codespace, a laptop, etc.) — not directly in Termux.

---

## 3. Deployment steps

Given the user develops entirely from Termux on Android with no local
Solidity toolchain, **Remix IDE (remix.ethereum.org) in a mobile browser**
is the most reliable path — it's what MiniPay/Celo docs generally recommend
for this exact situation, and needs no local install.

> ✅ **Pre-verified (session v34):** `PassSBTv2.flattened.sol` was
> test-compiled in a sandbox with `solc@0.8.20`, optimizer enabled, 200
> runs — **the exact settings step 2 below tells you to use in Remix** —
> and it compiled clean (only two harmless "could be `pure`" warnings on
> `approve()`/`setApprovalForAll()`, no errors). So the settings below are
> confirmed correct before you spend gas on mobile; if Remix errors out
> with these same settings, something changed in the paste (check for a
> truncated copy).

1. Open remix.ethereum.org, create a new file, paste in the full contents
   of `PassSBTv2.flattened.sol`.
2. In the Solidity Compiler tab: set compiler version to **0.8.20** (exact
   patch version — anything not confirmed can cause a verification mismatch
   later), enable the optimizer, **200 runs**. Compile.
3. In the Deploy & Run tab: environment = "Injected Provider" (this will
   prompt MiniPay/whatever wallet is active in the mobile browser), make
   sure the network shown is **Celo Mainnet (chain ID 42220)**, then deploy
   `PassSBTv2`. Confirm the transaction in the wallet.
4. **Note the new deployed contract address** — you'll need it for every
   step below. Call it `PASS_SBT_V2_ADDRESS` for the rest of this doc.

---

## 4. Verify on CeloScan

1. Go to `https://celoscan.io/address/0x390239A07616624b6521EC0022D348512d09053b#code`.
2. Click "Verify and Publish".
3. Compiler type: **Solidity (Single file)**.
4. Compiler version: **v0.8.20** (must match what you compiled with in
   Remix — same as above).
5. License: MIT.
6. Optimization: **Yes**, runs: **200** (must match Remix settings).
7. Paste the full contents of `PassSBTv2.flattened.sol` into the source box.
8. Submit. If it fails with a bytecode mismatch, the most common cause is a
   compiler version or optimizer-runs mismatch between what Remix actually
   used to deploy vs. what you told CeloScan — double check Remix's
   compiler tab shows the exact same settings before retrying.

---

## 5. Initialize all 6 seasons on the new contract

State does **not** carry over from v1 — `PASS_SBT_V2_ADDRESS` starts empty,
so every season needs `initializeSeason()` called again, exactly like it
was for v1 (same values, from `SEASONS_CONFIGURATION.md`):

Go to `https://celoscan.io/address/0x390239A07616624b6521EC0022D348512d09053b#writeContract`,
connect the owner wallet, and call `initializeSeason` once per row:

> ⚠️ **KOREKSI v33:** tabel ini sebelumnya berisi timestamp tahun 2024
> (bukan 2026) — kesalahan yang sama juga ditemukan dan dikoreksi di
> `SEASONS_CONFIGURATION.md` (lihat bagian "BUG DITEMUKAN SESI v33" di
> file itu untuk detail lengkap). Nilai di bawah ini sudah benar per
> 2026.

| Season | `_seasonId` | `_startDate` | `_endDate` | `_maxSupply` |
|--------|-----------|--------------|------------|--------------|
| July 2026 | 202607 | 1782864000 | 1785542399 | 1000 |
| August 2026 | 202608 | 1785542400 | 1788220799 | 1000 |
| September 2026 | 202609 | 1788220800 | 1790812799 | 1000 |
| October 2026 | 202610 | 1790812800 | 1793491199 | 1000 |
| November 2026 | 202611 | 1793491200 | 1796083199 | 1000 |
| December 2026 | 202612 | 1796083200 | 1798761599 | 1000 |

(Yes, initialize July too, even though it's underway/nearly over — this
keeps `getCurrentSeasonId()` consistent across the whole 6-season set, and
costs nothing to include.)

---

## 6. Wire the new address into the frontend

> ✅ **Parts 2 and 3 below are DONE (session v34)** — `lib/contract-abi.ts`
> already has the corrected ABI and an address that intentionally resolves
> to `'0x'` (pass features cleanly no-op) until you complete part 1. Full
> project `tsc --noEmit` passes clean with these changes. **You only need
> to do part 1 below** once you have `PASS_SBT_V2_ADDRESS` from step 3.

1. **[YOU DO THIS]** Update `NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS` in
   Vercel's environment variables to `PASS_SBT_V2_ADDRESS`, then redeploy
   via Vercel.
2. ~~Update the hardcoded fallback in `lib/contract-abi.ts`~~ — done
   differently than originally planned: instead of hardcoding the new
   address as a fallback (which would require another code change + deploy
   right after this one), `PASS_SBT_ADDRESS` now has **no hardcoded
   fallback at all** and reads purely from
   `NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS`, defaulting to `'0x'` if unset.
   Every call site in `hooks/usePassSBT.ts` already guards against
   `PASS_SBT_ADDRESS === '0x'` and no-ops instead of calling the (now
   retired) v1 address by accident. Once you complete step 1 above, this
   just works — no further code change needed.
3. **`PASS_SBT_ABI` in the same file — done.** Added `hasPassForSeason`,
   `getCurrentSeasonId`, `lastPassSeason`, and the `SeasonCreated` event.
   Removed the v1-only `userPassSeason` entry (grepped the whole frontend
   first — nothing referenced it directly, only comments).
4. Confirm `contracts/NullStateReward.sol`'s `IPassSBT` interface still
   matches (it only calls `hasPass(address)` and
   `getUserPassSeason(address)` — both unchanged in signature — so **no
   change needed there** even though it currently isn't calling either one
   per prior sessions' notes).
5. **[YOU DO THIS]** After step 1's Vercel redeploy, test a mint end-to-end
   on mobile.

---

## 7. What happens to existing v1 pass holders

**DECIDED (session v34): not applicable — no backfill needed.** Fa
confirmed no one has minted a v1 pass yet, so v2 starting everyone at zero
is a non-issue in practice. The section below is kept for the record in
case that assumption turns out to be wrong later (e.g. if a v1 mint is
found after the fact) — no code for a backfill function was written.

Anyone who *had* already minted a v1 pass (mainly Season 1 / July 2026
buyers) would keep that v1 SBT in their wallet — it does not disappear,
transfer, or break. Per `docs/pass-system.md`'s own FAQ ("Do I keep pass
NFT after season? Yes, it stays in your wallet... but it won't grant play
benefits in next season"), a pass not carrying forward into the next
season was already the intended behavior — the *bug* was that v1 also
blocked them from ever minting a *new* one, which v2 fixes.

**v2 starts everyone at zero, including any past v1 buyers.** If a July
buyer wanted an August pass under v2, they'd mint fresh under v2 like
anyone else (0.3 USDm, one-time for that season) — v1 ownership isn't
automatically carried over. An owner-only backfill function (e.g.
`adminGrantPass(address user, uint256 seasonId)`) could be added to
`PassSBTv2.sol` later if this assumption changes — ask before building it.

---

## 8. Testing recommendation (optional but cheap)

Celo Sepolia testnet is already wired up in this project (`lib/
Web3Providers.tsx` registers the `celoSepolia` chain, and
`forno.celo-sepolia.celo-testnet.org` is already in the network manifest).
If there's time, deploying `PassSBTv2` there first, running through a full
mint on a season, then trying a second season's mint with the same wallet,
is a cheap way to confirm the per-season fix actually behaves as expected
before spending real USDm/CELO on Mainnet. Not required — the change is
small and well-isolated — but offered as a low-cost safety net given this
touches a live, non-upgradeable, real-money contract.
