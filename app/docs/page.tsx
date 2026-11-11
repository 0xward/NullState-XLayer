import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

const TOC = [
  { id: 'overview',  label: 'Overview' },
  { id: 'mechanics', label: 'Game Mechanics' },
  { id: 'vault',     label: 'Golden Key & Vault Quest' },
  { id: 'rewards',   label: 'Rewards & Season Pass' },
  { id: 'chain',     label: 'Chain & Wallet' },
  { id: 'roadmap',   label: 'Roadmap' },
  { id: 'faq',       label: 'FAQ' },
]

export const metadata = {
  title: 'Docs — NULL_STATE',
  description: 'Documentation for NULL_STATE, a real-time dungeon crawler on Celo.',
}

export default function DocsPage() {
  return (
    <>
      <Navbar />

      <main className="relative z-[2] max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16 border-b border-[rgba(0,255,136,0.15)] pb-10">
          <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
            // DOCUMENTATION
          </div>
          <h1
            className="font-display font-bold text-null-white mb-4"
            style={{ fontSize: 'clamp(32px, 6vw, 52px)', lineHeight: 1.1 }}
          >
            NULL_STATE
          </h1>
          <p className="text-null-muted text-base leading-relaxed max-w-[560px]">
            A real-time dungeon crawler on the Celo blockchain, built for MiniPay.
            This page covers how the game works, what carries real value, and
            what to expect as a player.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-16">
          <div className="font-mono text-[10px] tracking-[3px] text-null-muted uppercase mb-3">
            Contents
          </div>
          <ul className="flex flex-col gap-2 font-mono text-sm">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <Link
                  href={`#${item.id}`}
                  className="text-null-green hover:text-null-acid transition-colors no-underline"
                >
                  {String(i + 1).padStart(2, '0')}. {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Overview */}
        <section id="overview" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Overview
          </h2>
          <div className="pl-4 flex flex-col gap-4 text-[15px] leading-relaxed text-null-muted">
            <p>
              NULL_STATE is a top-down, real-time dungeon crawler. Take up the
              Knight&apos;s armor and descend through
              procedurally generated bunkers — fighting enemies, looting
              containers, and gearing up along the way. Your wallet address is
              your player identity; there is no separate account or sign-up.
            </p>
            <p>
              Most of the run — movement, combat, and looting — happens
              instantly and off-chain, so there is no network fee or wallet prompt
              for every hit. What settles on Celo are the things that carry
              real value: your Season Pass, Vault Quest rewards, and Marketplace
              purchases.
            </p>
            <p>
              Death is softened, not final: dying drops you back on the floor
              you died on with full HP, rather than sending you back to the
              start. Loot you haven&apos;t burned carries over across bunkers
              until you spend it.
            </p>
          </div>
        </section>

        {/* Game Mechanics */}
        <section id="mechanics" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Game Mechanics
          </h2>
          <div className="pl-4 flex flex-col gap-6 text-[15px] leading-relaxed text-null-muted">
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                The Knight
              </h3>
              <p>
                You play as the Knight — an armored melee crawler with a
                steel-slash attack. Your power and look come from the gear you
                equip (weapons, armor, and cosmetic outfits), not from a class
                choice.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Bunkers & The Lift
              </h3>
              <p>
                Bunkers are procedurally generated, grid-aligned floors
                connected by corridors and doors. Rooms you haven&apos;t
                entered stay dark until you walk through the door (fog of
                war). Clear every hostile on a floor to unlock The Lift, which
                lets you push to the next floor or revisit any floor you&apos;ve
                already cleared.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Loot & Containers
              </h3>
              <p>
                Opening a container rolls a handful of items straight into
                your inventory — no floor drops. Items come in five
                rarities (Common through Legendary); higher rarities are
                rarer and worth more when burned.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Armory Trial
              </h3>
              <p>
                Clearing Act 1 unlocks a one-time Armory Trial: pick any 2
                premium weapons in the Marketplace and use them free for 48
                hours each. A weapon&apos;s clock only starts the first time
                you equip it — until then it waits in your inventory. When a
                trial expires the weapon returns to the shop, ready to buy if
                you miss it.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                NULL_STRIKE
              </h3>
              <p>
                A powerful ultimate attack you can trigger against tough
                enemies or when your HP runs critically low. It&apos;s free —
                no wallet transaction required — and gated only by a short
                cooldown, so its real cost is timing.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Death & Respawn
              </h3>
              <p>
                Reaching zero HP drops you back on the same floor with full
                HP — progress on floors you&apos;ve already cleared is kept.
                Unburned loot stays in your inventory across the whole run.
              </p>
            </div>
          </div>
        </section>

        {/* Golden Key & Vault Quest */}
        <section id="vault" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Golden Key & Vault Quest
          </h2>
          <div className="pl-4 flex flex-col gap-4 text-[15px] leading-relaxed text-null-muted">
            <p>
              While looting, certain containers have a chance to drop a
              Golden Key or a Code Paper — each capped at one per wallet per
              week. Neither can be burned.
            </p>
            <p>
              Bring both to the sealed Vault door and enter the 4-digit code
              from your Code Paper. You get 3 attempts per week; a correct
              code pays out real USDT to your wallet. The code resets every
              Monday at 00:00 UTC, along with your weekly Golden Key and
              Paper allowance.
            </p>
          </div>
        </section>

        {/* Rewards & Season Pass */}
        <section id="rewards" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Rewards & Season Pass
          </h2>
          <div className="pl-4 flex flex-col gap-4 text-[15px] leading-relaxed text-null-muted">
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Burning Items
              </h3>
              <p>
                Burning permanently removes an item from your inventory and
                instantly credits NullState Point — an off-chain, in-game
                currency (not real money, not withdrawable). Spend it on
                lower-priced Marketplace gear via the Swap button; pricier
                items still require real USDM, USDC, or USDT.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Season Pass
              </h3>
              <p>
                A Season Pass is a non-transferable (Soulbound) NFT. Holding
                one grants the exclusive Warden outfit, daily perks (bonus
                energy runs or Glitch Shards, claimable once per day), and
                eligibility for the seasonal top-3 leaderboard bonus. Its
                price is payable in USDM, USDC, or USDT.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Leaderboard
              </h3>
              <p>
                Each season (monthly), players are ranked by experience
                earned in their runs. The top 3 Season-Pass holders at
                season end split a real USDT prize pool; rankings
                reset for the new season.
              </p>
            </div>
          </div>
        </section>

        {/* Chain & Wallet */}
        <section id="chain" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Chain & Wallet
          </h2>
          <div className="pl-4 flex flex-col gap-4 text-[15px] leading-relaxed text-null-muted">
            <p>
              NULL_STATE runs on Celo mainnet. Real-money actions — the
              Season Pass, Vault Quest payouts, and Marketplace purchases —
              settle as normal Celo transactions. Inventory and run progress
              are stored off-chain for instant, gasless play; NULL_STRIKE is
              free and never touches the chain.
            </p>
            <ul className="flex flex-col gap-2 font-mono text-sm">
              <li>
                <span className="text-null-green">Network</span> — Celo Mainnet
                (chain ID 42220)
              </li>
              <li>
                <span className="text-null-green">Wallet support</span> — MiniPay
                (auto-connects) and the MetaMask browser extension. WalletConnect,
                Rainbow, and Coinbase Wallet are not integrated.
              </li>
              <li>
                <span className="text-null-green">Tokens</span> — USDM (Mento
                Dollar), USDC, and USDT for Marketplace &amp; Pass; rewards paid in USDT
              </li>
              <li>
                <span className="text-null-green">License</span> — MIT, source
                available on GitHub
              </li>
            </ul>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Roadmap
          </h2>
          <div className="pl-4 flex flex-col gap-6 text-[15px] leading-relaxed text-null-muted">
            {[
              {
                phase: 'Phase 01 — Genesis',
                status: 'Live',
                items: [
                  'Real-time dungeon engine',
                  'MiniPay native wallet',
                  'Marketplace (USDM / USDC / USDT)',
                  'Golden Key & Treasure Vault Quest',
                  'Season Pass system',
                  'Monthly leaderboard',
                ],
              },
              {
                phase: 'Phase 02 — Expansion',
                status: 'Planned',
                items: [
                  'New bunkers & zones',
                  'On-chain leaderboard snapshots',
                  'Referral rewards',
                  'Discord community',
                ],
              },
              {
                phase: 'Phase 03 — Protocol Wars',
                status: 'Planned',
                items: [
                  'Multiplayer improvements',
                  'PvP arena mode',
                  'Deeper Marketplace economy',
                ],
              },
              {
                phase: 'Phase 04 — Null Protocol',
                status: 'Exploratory',
                items: [
                  'Full world persistence',
                  'Cross-chain bridges',
                  'Tournament seasons',
                ],
              },
            ].map((p) => (
              <div key={p.phase}>
                <div className="flex items-baseline gap-3 mb-2">
                  <h3 className="text-null-white font-mono text-sm tracking-[1px]">
                    {p.phase}
                  </h3>
                  <span className="font-mono text-[10px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.3)] px-2 py-0.5">
                    {p.status}
                  </span>
                </div>
                <ul className="list-none flex flex-col gap-1">
                  {p.items.map((item) => (
                    <li key={item} className="pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-null-green">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-8 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            FAQ
          </h2>
          <div className="pl-4 flex flex-col gap-6 text-[15px] leading-relaxed text-null-muted">
            {[
              {
                q: 'What does it cost to play?',
                a: 'Playing, looting, and NULL_STRIKE are all free. A Season Pass (paid in USDM/USDC/USDT) adds the exclusive Warden outfit, daily perks, and top-3 season bonus eligibility, and the Marketplace sells gear for USDM, USDC, or USDT — but nothing is required to play and earn.',
              },
              {
                q: 'What happens when my character dies?',
                a: 'You respawn on the same floor with full HP — not back at floor 1. Unburned loot stays in your inventory, and lifetime stats are preserved.',
              },
              {
                q: 'What is the Golden Key and the Vault Quest?',
                a: 'The Golden Key and a Code Paper occasionally drop while looting, capped at one of each per wallet per week. Bring both to the Vault door and enter the weekly 4-digit code (3 attempts) for a real USDT reward.',
              },
              {
                q: 'Is the code open source?',
                a: 'Yes. The smart contracts and frontend are MIT licensed and available on GitHub.',
              },
              {
                q: 'Are the smart contracts audited?',
                a: 'The contracts have not undergone a formal third-party audit. Play with amounts you are comfortable risking, as with any early-stage on-chain application.',
              },
              {
                q: 'Which wallets are supported?',
                a: 'MiniPay is supported natively. The MetaMask browser extension also works. WalletConnect, Rainbow, and Coinbase Wallet are not currently integrated.',
              },
            ].map((item) => (
              <div key={item.q}>
                <h3 className="text-null-white font-mono text-sm mb-1.5">{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Back to launch */}
        <div className="pt-10 border-t border-[rgba(0,255,136,0.15)] flex justify-center">
          <a
            href="/game"
            className="font-mono text-[12px] tracking-[2px] uppercase text-null-bg bg-null-green px-8 py-3.5 inline-flex items-center gap-2 transition-all duration-200 no-underline hover:bg-null-acid"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
          >
            Launch Game
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
