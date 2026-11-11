# Sample Transactions — MiniPay Submission Requirement

MiniPay requires a Celoscan link to a sample transaction for **every
user-facing contract method**. Fill in the `<TX_HASH>` placeholders below
by finding a real past transaction for each method (Celoscan → contract
page → Transactions tab, filter by "Method" column, or your own wallet
history), then paste the link.

Method names below were confirmed this session (v57) directly against
`contracts/*.sol` in this repo — no more guessing needed, just find the
tx hash on Celoscan.

| Contract | Address (Celo Mainnet) | Method | User-facing action | Sample tx (Celoscan) |
|---|---|---|---|---|
| PassSBTv3 | `0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39` | `mintFreePass()` | Free Season Pass mint | tx: `<TX_HASH>` |
| PassSBTv3 | `0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39` | `backendMintPass()` (backend-signed after off-chain payment verification — `/api/passsbt/mint`) | Paid Season Pass mint | tx: `<TX_HASH>` |
| — (marketplace) | Treasury wallet `0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6` | ERC-20 `transfer()` (plain token transfer, NOT a TreasureVaultV2 method — confirmed via `buyMarketplaceItem` → `payToTreasury` in `lib/WalletProvider.tsx`) | Marketplace item purchase | tx: `<TX_HASH>` |
| TreasureVaultV2 | `0xB145dE296cD37Cb2A62Ced70Ee4d93c1d78df742` | `submitVaultCode()` (backend-signed — `/api/vault/submit`) | Vault Quest code submission + payout | tx: `<TX_HASH>` |
| NullStateRewardV3 | `0xec2e7fe57a92ada02c1ab37d9415dad508b7f111` | `claimSeasonBonus(uint256 _seasonId)` | Season bonus claim (top-3, seasonId = YYYYMM) | tx: `<TX_HASH>` |

Retired / removed (do NOT list these on the submission):
- **NullState.sol `register()` / `payUsdmFee()`** — the old game contract is
  retired: registration is off-chain now and NULL_STRIKE is free (no fee
  transaction exists to link).
- **NullStateRewardV2 (`0x38F85c…`)** — replaced by NullStateRewardV3
  (season-id scheme fix). `claimWeeklyRewards` is dormant product-wise
  (burns are off-chain NullState Point now), so it needs no sample tx.

Notes:
- **Correction from v56 draft**: TreasureVaultV2 does NOT have a
  marketplace-buy function — its public methods are all Vault Quest
  weekly-code related (`submitVaultCode`, `storeWeeklyVaultCode`,
  `unlockVaultForNewWeek`). The actual marketplace purchase flow is a
  plain ERC-20 `transfer()` straight to the treasury wallet, confirmed
  by tracing `MarketplaceScreen.tsx` → `buyMarketplaceItem` →
  `payToTreasury` in `lib/WalletProvider.tsx`. This matches what
  `docs/network-manifest.md` already noted ("marketplace ERC-20
  `transfer()`") — this file was out of sync with that until now.
- `PASS_SBT_ADDRESS`, `REWARD_CONTRACT_ADDRESS`, and `TREASURE_VAULT_ADDRESS`
  above are the hardcoded fallbacks in `lib/contract-abi.ts` (source of
  truth per that file's own comments). If Vercel's env vars override them
  to something else, double check on Celoscan before using these addresses.
- Vault Quest (`submitVaultCode` etc.) is a real user-facing flow too but
  wasn't in MiniPay's required-methods list in the v56 draft — add a row
  for it here if the submission form asks for every contract, not just
  payment/mint/claim ones.
- If a method has never been called on mainnet yet (e.g. still early),
  you'll need to trigger one real transaction first before you can link it.
- I can't browse Celoscan's transaction list from the sandbox (not on the
  allowed domain list for this environment) — finding the actual tx
  hashes is still on Fa.
