import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import { fontVariables } from '@/lib/fonts'
import SplashScreen from '@/components/ui/SplashScreen'
import WebVitals from '@/components/common/WebVitals'

// ─── NOTE: Web3Providers moved to per-route nested layouts ───────────────────
// app/game/layout.tsx and app/profile/layout.tsx wrap those routes with
// Web3Providers so the wagmi/viem bundle is NOT loaded on public routes
// (/, /terms, /privacy, /docs) — PageSpeed optimization (MiniPay requirement).

// One source, lib/siteUrl.ts — this was one of five hand-written copies, and
// the Celo review asking for a real domain is exactly the moment that costs
// something. Needed here so relative OpenGraph/Twitter image paths resolve to
// absolute URLs.
import { SITE_URL } from '@/lib/siteUrl'

// Next 14: themeColor + viewport live in their own `viewport` export (not in
// `metadata`). Zoom is intentionally left enabled — this layout is global, so
// locking it would hurt readability on /docs, /terms and /privacy; the game
// canvas manages its own touch input.
export const viewport: Viewport = {
  themeColor: '#0a0e0c',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'NULL_STATE // Web3 RPG on Celo',
  description: 'A real-time dungeon crawler on Celo. Descend the Forsaken Depths, unleash free NULL_STRIKEs, and survive. Permadeath is softened — die and respawn on the same floor. Earn real USDT rewards, playable right inside MiniPay.',
  keywords: ['Celo', 'Web3', 'RPG', 'MiniPay', 'blockchain game'],
  authors: [{ name: '0xward' }],
  manifest: '/manifest.webmanifest',
  // NOTE: icons are handled by Next's file conventions, not here — the
  // app/icon.png convention overrides any metadata.icons block, so the
  // favicon comes from app/icon.png and the apple-touch-icon from
  // app/apple-icon.png (both auto-emitted). Don't re-add an `icons` field.
  openGraph: {
    title: 'NULL_STATE // Web3 RPG on Celo',
    description: 'A real-time dungeon crawler on Celo. Play free, loot free — NULL_STRIKE is free too. Earn real USDT rewards on MiniPay.',
    type: 'website',
    url: SITE_URL,
    siteName: 'NULL_STATE',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'NULL_STATE — crack the vault, earn real USDT on MiniPay' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NULL_STATE // Web3 RPG on Celo',
    description: 'A real-time dungeon crawler on Celo. Descend the depths. Face The Gatekeeper.',
    images: ['/og-image.png'],
  },
  verification: {
    other: {
      'talentapp:project_verification': [
        'afcf1b34fdffc7dd7f199babb0c96d47f7dce7a63ef2fd61f45d47f5555aeb40c507603b1712082bdeaba31933f7593ed50e2a9d201d6a61c4d70992663a6737',
      ],
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head>
        <meta name="color-scheme" content="dark" />
        {/* NO PRECONNECTS HERE — this has been tried and measured, twice.
            See the long note in app/game/layout.tsx: preconnects to
            firestore.googleapis.com and forno.celo.org were added once before
            for the same reason PageSpeed keeps suggesting them, and PageSpeed's
            own verdict afterwards was "Preconnect not used. Check that you are
            using the crossorigin attribute properly" — the anonymous sockets
            they opened were not the ones either client went on to use.

            It was then re-added here in #186 with crossOrigin="" — the very
            anonymous mode that had already failed — because this file does not
            mention the earlier finding and the route layout that does was never
            opened. Reverted. A global hint was also the wrong scope: it made
            every route, including a landing page that never touches Firestore,
            open a socket it had no use for.

            PageSpeed still reports ~300ms here, so the opportunity may well be
            real. But it needs the right crossorigin mode proven by measurement,
            not guessed at a third time. If someone picks this up: Firestore's
            WebChannel is what to match, and a PSI run has to confirm the hint
            is actually used before this ships. */}
        {/* Pre-paint flash guard for the splash on a second full-page load
            (Launch Game → /game): if this session already saw the splash, hide
            #ns-splash-root before first paint. READ-ONLY — the SplashScreen
            component owns setting the flag, so there's no race that would skip
            the very first show. Route-level suppression (Terms/Privacy/Docs)
            lives in the component itself. */}
        <style>{`html.ns-splash-seen #ns-splash-root{display:none!important}`}</style>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('ns-splash-seen')==='1'){document.documentElement.classList.add('ns-splash-seen')}}catch(e){}",
          }}
        />
        {/* Structured data. Search engines cannot tell from HTML alone that this
            page is a free game rather than an article about one, so a text
            crawler has to guess — and it guesses from a landing page whose
            content is mostly styled fragments. This states it outright, which
            is what makes a result eligible for Google's app rich results.

            `price: 0` is the literal truth and worth being precise about: the
            game is free to play, and the only things that cost money are
            optional cosmetics inside it. Claiming otherwise in structured data
            is the kind of mismatch that gets rich results revoked. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'VideoGame',
              name: 'NULL_STATE',
              url: SITE_URL,
              description:
                'A real-time pixel dungeon crawler on Celo. Descend the Forsaken Depths, survive permadeath, and earn real USDT rewards — playable free inside MiniPay.',
              image: `${SITE_URL}/og-image.png`,
              applicationCategory: 'GameApplication',
              genre: ['Role-playing game', 'Dungeon crawler'],
              operatingSystem: 'Web, Android (MiniPay)',
              gamePlatform: ['Web browser', 'MiniPay'],
              playMode: 'SinglePlayer',
              author: { '@type': 'Organization', name: '1892 Studio' },
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-null-bg text-null-white antialiased">
        {/* Boot splash — deep-black logo screen + 2.5s loading bar shown on
            open, then fades to reveal the page. Client component; renders over
            {children}, which loads normally behind it. */}
        <SplashScreen />
        {/* Real-user load speed → PostHog. MiniPay grades the p75 of actual
            users, not a PageSpeed run, and we had no way to see that number.
            Inert until NEXT_PUBLIC_POSTHOG_KEY is set. */}
        <WebVitals />
        {/*
          Web3Providers adalah 'use client' component yang membungkus:
          WagmiProvider → QueryClientProvider → RainbowKitProvider → WalletProvider
          Dipisah ke file sendiri agar layout.tsx ini tetap bisa jadi Server Component.
        */}
        {children}
      </body>
    </html>
  )
}
