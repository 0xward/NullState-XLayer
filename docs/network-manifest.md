# NullState — Network Manifest

Complete list of external network origins contacted by the NullState frontend and API routes.
This table is intended to be copy-paste-ready for the MiniPay submission form's network manifest
field.

**Last audited:** 2026-07-26

**Audit method:** a real browser, not a grep. Chromium loads `/`, `/game`, `/docs`,
`/stats` and `/profile` and every request is recorded, so what is listed below is
what the app *actually* contacts — not what the source suggests it might.

The previous audit was grep-based and overstated the surface badly. Grep cannot
tell a build-time import from a runtime fetch, a live component from a dead one,
or a config key that has since been deleted. Three entries were wrong:

- **`fonts.googleapis.com` / `fonts.gstatic.com`** — listed as *required*. They
  are not contacted at all. Fonts moved to `next/font/google`, which downloads
  them at **build** time and self-hosts from our own origin; the browser never
  reaches Google.
- **`pbs.twimg.com` / `abs.twimg.com`** — listed from an `images.domains` entry
  in `next.config.js` that no longer exists.
- **`token-logos-static.s3.amazonaws.com`** — listed as *required*, from
  `components/common/USDmDisplay.tsx`. That component is imported by nothing, and
  would have thrown if it ever were (a remote `next/image` src with no
  `images.domains` configured). It now points at the local `/assets/tokens/usdm.png`,
  so the origin is gone for good rather than merely dormant.

Verified at runtime, the app contacts exactly **two** external origins.

---

| Domain | Purpose | Where used (file) | Required for core functionality? |
|---|---|---|---|
| `forno.celo.org` | Celo Mainnet JSON-RPC endpoint (on-chain reads/writes) | `lib/Web3Providers.tsx`, `lib/useContractPlayer.ts`, `.env.example` | Yes |
| `forno.celo-sepolia.celo-testnet.org` | Celo Sepolia testnet JSON-RPC (default transport for `celoSepolia` chain via wagmi) | `lib/Web3Providers.tsx` (wagmi chain default) | No (testnet only) |
| `twitter.com` | Twitter/X share-intent links and profile links (outbound links only, no fetch) | `lib/utils.ts`, `components/ui/Footer.tsx` | No (social feature) |
| `firestore.googleapis.com` | Firebase Firestore — player data, leaderboard, game state persistence | `lib/firebase.ts` | Yes |
| `identitytoolkit.googleapis.com` | Firebase Authentication REST API | Firebase SDK (client-side) | Yes |
| `securetoken.googleapis.com` | Firebase Auth token exchange | Firebase SDK (client-side) | Yes |
| `*.firebaseio.com` | Firebase Realtime Database (used for `FIREBASE_DATABASE_URL` in admin SDK) | `.env.example` (`FIREBASE_DATABASE_URL`) | Yes |
| `firebasestorage.googleapis.com` | Firebase Storage (configured via `storageBucket` in `lib/firebase.ts`) | Firebase SDK | No (storage not actively used) |
| `celoscan.io` | Celo blockchain explorer — contract/transaction links shown in UI | `components/ui/Footer.tsx`, `app/terms/page.tsx` | No (informational links only) |
| `t.me` (`t.me/nullstate_id`) | Telegram support channel (outbound link only, no fetch) | `components/ui/Footer.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx` | No (support link) |
| `github.com` | GitHub repository link (outbound link only, no fetch) | `components/ui/Footer.tsx` | No (informational link) |
| `us.i.posthog.com` (server-side) | Reads the Web Vitals p75 back out of PostHog so /stats can display it. Runs **only on the server** (`app/api/webvitals`) with a personal API key that never reaches the browser; the client receives five aggregate numbers. Unset env vars = never called. | `app/api/webvitals/route.ts` | No (display only) |
| `us.i.posthog.com` | Real-user Web Vitals (LCP/INP/CLS/FCP/TTFB) — MiniPay grades load speed on the p75 of real users, not a PageSpeed run. One POST per pageview, fired as the page is being hidden. Carries an anonymous random id, the URL and the timings — **never the wallet address**. Silent and never contacted unless `NEXT_PUBLIC_POSTHOG_KEY` is set. | `lib/webVitals.ts`, `components/common/WebVitals.tsx` | No (measurement only) |
| `talent.app` | Talent Protocol project verification (meta tag + outbound link) | `app/layout.tsx`, `app/docs/page.tsx` | No (optional) |

---

## Notes

- **Session v59 (2026-07-14) — crosscheck vs official MiniPay/Celopedia docs +
  asset optimization. Still awaiting deploy + real PSI re-run (v58's fixes
  have STILL never been measured live — see v58 entry below, unchanged).**
  Work done this session:
  - **Crosscheck task**: fetched and read `celopedia-skills` reference docs
    (`minipay-requirements.md`, `minipay-guide.md`, `minipay-templates.md`,
    `odis-socialconnect.md`, `minipay-live-apps.md` — all from
    `github.com/celo-org/celopedia-skills`), plus live-fetched
    `minipay.to/mini-apps`, `developer.minipay.to/mini-app-listing`, and
    `docs.celo.org/build/build-on-minipay/deeplinks` directly. Verified
    against actual code (not assumed): no `personal_sign`/`signMessage`/
    `signTypedData` anywhere (clean); no raw `0x…` address shown as primary
    identifier anywhere (Leaderboard/Marketplace use the username system,
    clean); wallet auto-connect exists but does **not** gate on
    `window.ethereum?.isMiniPay` the way the official pattern in
    `minipay-guide.md` does — connects any injected wallet unconditionally
    (`lib/WalletProvider.tsx`) — **flagged, not changed, needs an explicit
    decision** (see NEXT-SESSION-PROMPT-v60.txt).
  - **IMPORTANT CORRECTION — do NOT change `MINIPAY_ADD_CASH_URL` again**:
    the `celopedia-skills` reference docs (`minipay-requirements.md` /
    `minipay-templates.md`) state the Add Cash deeplink is
    `https://link.minipay.xyz/add_cash`. This was cross-checked directly
    against the primary source, `docs.celo.org/build/build-on-minipay/deeplinks`
    (fetched live 2026-07-14), which states clearly:
    `https://minipay.opera.com/add_cash`. **The primary source wins.** The
    code (`lib/errorUtils.ts` → `MINIPAY_ADD_CASH_URL`) already had the
    correct value — a prior session (2026-07-13) had already investigated
    this exact question and reached the right answer. The `celopedia-skills`
    community doc appears to be stale/wrong on this one specific point.
  - **Asset optimization — PNG → WebP (lossless)**: `NullState_Logo_Transparent.png`
    + `backgrounds/{forest,desert,snow,field,back}.png` (all 256-color
    indexed/palette PNGs) converted to lossless WebP. 1668 KB → 1392 KB
    (-277 KB, -16.6%). Updated: `components/game/SettingsModal.tsx` (logo
    `src`), `public/game-engine/assets.js` (`backgrounds` array +
    `BG_BY_KEY`), and fixed a hidden dependency in `public/game-engine/game.js`
    line ~537 — the floor-name banner parsed the background filename via
    `.replace('.png','')`, which would have shown "FOREST.WEBP" instead of
    "FOREST" if left unfixed; changed to a generic extension-stripping regex.
    Old PNGs deleted after confirming (repo-wide grep) no other references.
    Validated: `tsc --noEmit` 0 errors, and a full `next build` (via the
    same font-fetch-stub trick as v58, see below) completed successfully —
    root `/` still 240 kB First Load JS, `/game` 313 kB, unchanged from
    before this session's asset work (only byte-weight of images changed).
  - **NOT touched this session** (in scope for later, low-to-medium risk):
    `NullState_Logo.png` (2.7 MB) and `icon-512.png` — confirmed via grep to
    be unused at runtime (only referenced by `scripts/generate-icon.js` as a
    build-time source/output), so they don't affect PSI or user-facing load
    weight; left as PNG since converting them has zero measurable benefit.
    `catacombs_main.png`, `paper-scroll-large.png`, `Season_1-6.png`, and the
    LPC character sprite sheets — not yet converted.
  - **Wallet-connect pattern — investigated, changed, then reverted, same
    session (2026-07-14)**: initially changed `lib/WalletProvider.tsx` /
    `lib/Web3Providers.tsx` to gate auto-connect on `isMiniPay` and target
    the `metaMask` connector, per the *example code* in `minipay-guide.md`.
    On closer re-read of the actual requirement text
    (`minipay-requirements.md` line 46/79: **"no 'Connect Wallet' button
    when `window.ethereum.isMiniPay === true`"**), that's a narrower,
    conditional rule about the *button* — it does not forbid auto-connecting
    to non-MiniPay injected wallets too. The original code (no button ever,
    anywhere, silent auto-connect to any injected wallet) already fully
    satisfied the actual written requirement. The `isMiniPay`-gated version
    was an unnecessary narrowing (would have dropped MetaMask in-app-browser
    compatibility) based on treating an illustrative code sample as if it
    were a compliance rule. **Reverted back to the original behavior**
    (connector: plain `injected()`; auto-connect effect: no `isMiniPay`
    gate) per explicit user decision. `isMiniPay` remains available as a
    display/analytics flag only, same as before this session started.
    **Lesson for future sessions**: `minipay-guide.md` code samples show
    *one way* to implement something for MiniPay specifically — they are
    not automatically compliance requirements. Always check
    `minipay-requirements.md`'s actual checklist wording (or the primary
    docs.celo.org/docs.minipay.xyz source) before treating a guide's sample
    code as mandatory. Validated: `tsc --noEmit` 0 errors, `next build`
    succeeded, bundle sizes unchanged (root 240 kB, `/game` 313 kB).
  - **Sandbox caveat (same as v58)**: this session's sandbox also blocks
    `fonts.googleapis.com`/`fonts.gstatic.com` (confirmed again). `next build`
    fails at the `next/font` fetch step unless `lib/fonts.ts` is temporarily
    stubbed in a throwaway copy of the project (not shipped) — same
    workaround as v58, confirmed to still work.

- **PageSpeed session v58 (2026-07-14) — fixes applied, awaiting re-run on
  Vercel to confirm actual score.** Starting point: Performance 83 (see v57
  entry below for full breakdown). Work done this session:
  1. **Render-blocking font requests — fixed.** Fonts were actually loaded
     **twice**: once via `<link href="https://fonts.googleapis.com/...">`
     in `app/layout.tsx`, and again via `@import` at the top of
     `styles/globals.css` (a duplicate render-blocking request that hadn't
     been caught before). Both removed. All 4 fonts (Share Tech Mono,
     Cinzel, Rajdhani, Orbitron) migrated to `next/font/google` — see new
     `lib/fonts.ts` — which self-hosts the font files at build time (no
     external network round-trip) and injects them as CSS variables
     (`--font-mono`, `--font-cinzel`, `--font-hud`, `--font-display`)
     applied to `<html>` in `app/layout.tsx`. Every literal font-family
     reference in `styles/globals.css` (37 occurrences), `tailwind.config.ts`
     (`font-mono`/`font-hud`/`font-display` utility classes, used in 24+
     component files), and one inline style in `TokenBalanceWidget.tsx` was
     updated to reference the new CSS variables instead — otherwise the
     self-hosted fonts would load but never actually get applied. Weights
     kept identical to what was requested before (Share Tech Mono: 400;
     Cinzel: 500,700; Rajdhani: 300–700; Orbitron: 400,700,900) — no visual
     change, purely a loading-mechanism fix.
  2. **Unused JavaScript on `/game` — partially fixed.** `GameFlowManager.tsx`
     was statically importing every game screen (Leaderboard, RewardsScreen,
     SeasonPassScreen, MarketplaceScreen, UsernameSetup, and
     DungeonGameWrapper — which wraps the 808-line DungeonGame.tsx canvas
     engine) even though only one screen renders at a time based on
     `phase` state. All 6 are now `next/dynamic` with `ssr:false` and a
     lightweight themed loading fallback. Measured locally (font-fetch
     stubbed to work around this sandbox's network allowlist — see caveat
     below): `/game` First Load JS dropped from **336 kB → 314 kB**, own
     page chunk from 142 kB → 120 kB.
     **Important caveat found this session: the PSI run was against the
     ROOT page (`/`), not `/game`.** This code-split fix only helps
     `/game` — it made zero difference to root's 240 kB First Load JS in
     local testing, since the landing page never imports GameFlowManager.
     The actual dominant contributor to root's "unused JS" looks to be
     wagmi/viem code (~350 KB raw / one of the largest chunks) pulled in by
     `Web3Providers` wrapping *every* route in `app/layout.tsx`, including
     pages that don't need wallet code on first paint (`/`, `/terms`,
     `/privacy`, `/docs`). **Deliberately NOT touched this session** — this
     is a wallet-flow change (MiniPay's silent-connect-on-load requirement
     makes this fragile) and was explicitly out of scope. Flagged here as
     the highest-value follow-up for a future session, once the risk can be
     properly tested against a live MiniPay environment.
  3. **Unused CSS (~17 KiB) — investigated, not fixed this session.** Found
     the actual source: a ~280-line block in `styles/globals.css` scoped
     under `.ns-game-root` (the dungeon canvas engine's UI, already
     commented in the file as "scoped ... so they never leak into the
     landing page" — but it still ships in the same global stylesheet to
     every route since Tailwind's purge only touches `@tailwind` utility
     classes, not hand-written CSS in the same file). Splitting this into
     a separate stylesheet loaded only by the game route looked
     straightforward at first, but `.ns-confirm-overlay`/`.ns-settings-*`
     rules in that same section are also used by `NewGameConfirmModal`,
     which renders on the very first `/game` screen (not behind the new
     dynamic imports) — so a naive split risks breaking those without a
     real browser to visually verify against. Left alone this session;
     flagged as a follow-up once there's a way to check the rendered result
     against actual PSI/browser, not just a build log.
  4. **Legacy JavaScript / no modern-bundle targeting (~12 KiB) — fixed.**
     Added a `browserslist` field to `package.json` (evergreen
     Chrome/Android Chrome/Firefox/Safari/iOS Safari only), so Next.js
     ships modern JS without transpiling/polyfilling for legacy browsers
     MiniPay's Android WebView users will never hit.
  5. **Raw `<img>` tags — checked, left alone.** `MarketplaceScreen.tsx`
     and `RewardsScreen.tsx` have small pixel-art sprite icons where
     `next/image`'s automatic re-encoding risks messing with
     `image-rendering:pixelated`, for very little payload gain, and both
     are inside `/game` (not what PSI measured). `DungeonGame.tsx`'s
     `<img id="itemZoomIcon">` has its `src` set imperatively by the
     vanilla-JS engine in `/public/game-engine/*.js`, not by React state —
     this one is **not safely portable** to `next/image` at all without
     touching game engine logic, which is out of scope.
  - **Sandbox caveat**: this session's build verification ran in a
    container whose network allowlist doesn't include
    `fonts.googleapis.com`/`fonts.gstatic.com`, so `next build` can't
    complete the `next/font` fetch step locally here — confirmed via
    `curl` (403 `host_not_allowed`). Code correctness was verified with
    `tsc --noEmit` (0 errors) instead, and the code-splitting measurement
    above used a temporary local stub of `lib/fonts.ts` (not shipped in
    the delivered files) just to get past that one build step. Vercel's
    build environment has normal internet access, so `next build` will
    complete normally there — but this means **the actual post-fix PSI
    score still needs to be measured for real** after deploying to a
    preview URL. Regression-check Accessibility/Best Practices/SEO (all
    100 before this session) on that same run.
- **✅ CURRENT — PageSpeed, `https://playnullstate.xyz`, mobile, 2026-07-27
  22:46–22:50 WIB.** Run by Fa on pagespeed.web.dev; Moto G Power emulated,
  slow-4G throttling, Lighthouse 13.4.0, HeadlessChromium 149. **This is the
  score to attach to the MiniPay submission** — it is the URL being submitted.

  | | Perf | A11y | Best Practices | SEO | Agentic |
  |---|---|---|---|---|---|
  | `/` | **99** | 100 | 100 | 92 | 2/2 |
  | `/game` | **89** | 95 | 96 | 100 | 2/2 |

  | metric | `/` | `/game` |
  |---|---|---|
  | First Contentful Paint | 0.9 s | 1.1 s |
  | Largest Contentful Paint | 1.8 s | 2.7 s |
  | Total Blocking Time | 40 ms | 120 ms |
  | Cumulative Layout Shift | 0 | 0 |
  | Speed Index | 3.1 s | 6.8 s |

  Against the last reading (83 on the old domain, 2026-07-14) the landing page
  is now 99 and comfortably in Google's green band. `/game` at 89 is one point
  under. No field data yet ("Tidak Ada Data") — the origin has too few real
  users for CrUX, which is what `lib/webVitals.ts` exists to work around.

  - **Fixed in response to this run**: the LCP image on `/game`
    (`/worldmap/map-bg.webp`) had no `fetchPriority`, which Lighthouse called
    out directly — the request was discoverable in the initial document but
    competing at default priority. And two rail badges failed WCAG AA contrast:
    amber `#ffcf4d` on `#7a5a1f` was 4.32:1 against the 4.5:1 needed at 8px,
    white on `#ff5a6a` was 3.03:1. Both deepened (7.82:1 and 5.43:1) with the
    badge colours still recognisable.
  - **Known and not acted on**, with the reason:
    - *Oversized images, ~36 KiB* — `map-bg.webp` is served at 1024×1536 and
      displayed at 960×1440 on the emulated device; the logo 680×680 vs
      577×577. The "displayed" size is per-device: a 3× phone wants more pixels
      than the emulator asked for, so shrinking the source trades sharpness on
      real hardware for 36 KiB on a benchmark. Not obviously worth it on the
      game's main art.
    - *Render-blocking CSS, ~490 ms* — `/game` → CSS → CSS, a two-hop chain
      ending at 1133 ms. This is the cost of the dungeon-CSS split (PERF-10)
      and is worth revisiting with a preload, not by undoing the split.
    - *Legacy JavaScript, ~12 KiB* — polyfills for `Array.prototype.at/flat/
      flatMap`, `Object.fromEntries/hasOwn`, `String.trimStart/trimEnd`. A
      modern `browserslist` drops them, but the floor that removes `Object.hasOwn`
      is Safari/iOS 15.4 (March 2022), and getting that wrong is a white screen
      rather than a slow page. 12 KiB is not worth deciding unilaterally.
    - *Unused JavaScript, ~106 KiB* — three chunks. Real, but it is a
      code-splitting project rather than a switch.
  - **Open question**: SEO on `/` is 92 where `/game` is 100 and the old
    reading was 100. Checked from the served HTML and ruled out: every `<a>`
    has an `href` (9 of 9), meta description present, viewport correct, title
    present. The remaining candidates are layout-dependent (tap-target spacing,
    legible font sizes) and cannot be confirmed without the report's SEO
    section.
- **⚠ SUPERSEDED — the score below was measured against a URL that no longer
  serves the app.** On 2026-07-27 the site moved to its own domain,
  `https://playnullstate.xyz`; `nullstate-ten.vercel.app` now only `307`s
  there. Kept as history, under the current reading above.
  - Both automated routes were tried from the container on 2026-07-27 and
    neither works: the public PageSpeed API returns HTTP 429 (the shared
    anonymous project's daily quota is exhausted, no API key configured), and a
    local Lighthouse run cannot load the page — Chromium gets
    `ERR_CONNECTION_RESET` reaching the live host, with or without the egress
    proxy, while `curl` to the same URL succeeds. Environment limit, not a
    fault in the site. Re-runs have to happen on pagespeed.web.dev.
  - What *could* be measured here, live against the new domain on 2026-07-27,
    for whatever it is worth as a regression check — **transfer weight of the
    resources referenced by the initial HTML**, compressed, as actually served:

    | page | requests | over the wire | breakdown |
    |---|---|---|---|
    | `/` | 22 | **0.46 MB** | webp 177KB · js 172KB · woff2 87KB · css 11KB |
    | `/game` | 31 | **0.63 MB** | webp 291KB · js 269KB · woff2 42KB · css 14KB |

    Against MiniPay's 2 MB footprint guidance that is ~32% of the budget on the
    heavier of the two. Note this counts only what the initial HTML references
    — lazily-imported chunks and sprites the game engine fetches at runtime are
    not in it, so it is a first-paint weight and not a session total.
  - Server response on the new domain, same run: `/` 200 in 2.2s, `/game` 200
    in 0.7s, `/stats` 200 in 1.1s, `/terms` 200 in 0.3s (cold vs warm cache
    explains most of the spread; these are single samples through a proxy, so
    treat them as smoke-test evidence that the routes are up, not as timings).
- **PageSpeed score (recorded 2026-07-14, session v57 — corrected with actual
  screenshots from Fa's run): Performance 83, Accessibility 100, Best
  Practices 100, SEO 100, Agentic Crawling 2/2.** Mobile, run against
  `https://nullstate-ten.vercel.app`. (An earlier "86" mentioned in this
  session's chat was Fa's rough recollection before checking the actual
  report — 83 is the real number, correcting the record here.)
  MiniPay's submission doc doesn't state a numeric pass/fail threshold —
  it just says "High performance is a prerequisite for listing" and asks
  you to attach the score. 83 is in Google's "needs improvement" band
  (50–89; 90+ is "good"/green), and Accessibility/Best Practices/SEO are
  already a clean sweep at 100, so Performance is the one category worth
  a look if there's time before submitting.
  - Metrics: FCP 2.6s, LCP 3.6s, TBT 0ms (green), CLS 0 (green), Speed
    Index 5.2s.
  - Top flagged opportunities (highest impact first): render-blocking
    requests (~1,160ms potential saving), unused JavaScript (~96 KiB),
    unused CSS (~17 KiB), legacy JavaScript / no modern-bundle targeting
    (~12 KiB).
  - TBT and CLS are already perfect, so this isn't a jank/stability
    problem — it's specifically initial-paint/load-weight: what loads
    before first paint and how much JS/CSS ships that isn't used on that
    first screen. Typical fixes for this stack (Next.js + Google Fonts +
    Firebase SDK) would be: code-splitting/lazy-loading anything not
    needed for the landing screen, checking whether the full Firebase SDK
    is being imported where only a subset is used, and deferring
    non-critical CSS/fonts. Not urgent for this submission, but worth a
    follow-up punch-list item since "83" leaves easy room to clear 90+
    later.
- **Firebase domains**: NullState uses Firebase Firestore (`lib/firebase.ts`) and Firebase Admin
  SDK (`firebase-admin` via server API routes). The specific Google API hostnames contacted
  depend on the Firebase project region and services active. The domains listed above cover all
  Firebase services referenced in the codebase.
- **Celo Sepolia**: The wagmi `celoSepolia` chain is registered in `lib/Web3Providers.tsx` for
  testnet support. Its transport is left as the default public RPC
  (`forno.celo-sepolia.celo-testnet.org`). This domain is only contacted when a user's wallet
  is connected to the testnet.
- **Twitter**: Twitter API calls are server-side only (Next.js API route) and require a
  `TWITTER_BEARER_TOKEN` — they are guarded by try/catch; the feature degrades gracefully if
  not configured.
- **WalletConnect**: WalletConnect infrastructure (e.g. `relay.walletconnect.com`) was
  **removed** in a previous PR (A1/A3). NullState now uses the `injected()` connector only
  (MiniPay's in-app browser injects the wallet). No WalletConnect relays are contacted.
- **Contract verification (2026-07-13)**: Owner (Yurk) confirmed all 4 deployed contracts
  (NullState.sol, PassSBTv3, NullStateRewardV2, TreasureVaultV2) are verified on Celoscan
  (green checkmark). Sample transaction links for each user-facing contract method
  (`register()`, `mintFreePass()`, `mintPaidPass()`, marketplace ERC-20 `transfer()`) still
  need to be collected for the MiniPay submission form — not done yet.
- **Contract verification re-confirmed (2026-07-23)**: Owner re-confirmed all deployed
  contracts (including the current reward contract, NullStateRewardV3, and TreasureVaultV2)
  remain verified on Celoscan. Still outstanding for the submission form: collect one sample
  Celoscan transaction link per user-facing method (owner task — needs live tx hashes).
