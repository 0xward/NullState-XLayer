'use client'

import { useState, useEffect } from 'react'
import { maskAddress } from '@/lib/addressMask'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useNavbarWallet } from '@/lib/NavbarWalletContext'

const logoJitter = {
  animate: {
    x:      [0, -1, 0,  1,  0,  0],
    y:      [0,  0, 1,  0, -1,  0],
    rotate: [0,  0, 0.3, 0, 0,  0],
    transition: {
      duration: 0.6, repeat: Infinity, repeatDelay: 4.0,
      ease: 'steps(1)', times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

const centerFloat = {
  animate: {
    y: [0, 0, -2, -2, 0, 0, -1, -1, 0, 0],
    transition: {
      duration: 2.4, repeat: Infinity, ease: 'steps(1)',
      times: [0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.7, 0.82, 0.92, 1],
    },
  },
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const wallet = useNavbarWallet()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // STATS is last and deliberately outside the /docs run above: the other five
  // are anchors into one page, this one is a page of its own with live
  // numbers — players, purchases, rewards actually paid. Burying the only
  // page that proves the reward loop is real, behind no link at all, was the
  // odd part.
  const navLinks = [
    { href: '/docs#overview', label: 'ABOUT'    },
    { href: '/docs#mechanics', label: 'GAMEPLAY' },
    { href: '/docs#chain',    label: 'CHAIN'    },
    { href: '/docs#roadmap', label: 'ROADMAP'  },
    { href: '/docs#faq',     label: 'FAQ'      },
    { href: '/stats',        label: 'STATS'    },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-4 flex items-center justify-between border-b transition-all duration-300 ${
      scrolled ? 'border-[rgba(0,255,136,0.2)] nav-blur' : 'border-[rgba(0,255,136,0.05)] bg-transparent'
    }`}>

      {/* Logo — stepped jitter makes it feel alive */}
      <motion.div variants={logoJitter} animate="animate">
        <Link href="/" className="font-display text-lg font-black text-null-green tracking-[4px] glow-green no-underline">
          NULL<span className="text-null-red">_</span>STATE
          <span className="font-mono text-xs text-null-muted tracking-wider ml-2">// v1.0.0</span>
        </Link>
      </motion.div>

      {/* Center status.
          This used to read "CELO_MAINNET :: BLOCK #28,441,902", ticking up
          beside a live-looking pulse dot. It was FAKE — the number was
          hardcoded and incremented by Math.random() every five seconds; it
          never touched an RPC. Two separate problems with that: a fabricated
          on-chain readout presented as live data is not something a project
          asking for a Celo listing should ship, and a scrolling block height is
          the single strongest "this is a trading dashboard" cue on a page whose
          job is to say "this is a pixel dungeon crawler".
          Replaced with something true and on-message. The chain is still named
          — it just isn't pretending to measure it. */}
      <motion.div
        className="hidden md:flex items-center gap-2 font-mono text-[11px] text-null-muted"
        variants={centerFloat}
        animate="animate"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-null-green" />
        <span>FREE TO PLAY :: NO WALLET NEEDED TO START</span>
      </motion.div>

      {/* Desktop nav + wallet */}
      <div className="hidden md:flex items-center gap-6">
        <ul className="flex gap-7 list-none">
          {navLinks.map(link => (
            <li key={link.href}>
              <a href={link.href}
                className="font-mono text-[11px] text-null-muted hover:text-null-green tracking-[2px] uppercase transition-colors duration-200 no-underline">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {wallet.isConnected ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 font-mono text-[11px] border border-[rgba(0,255,136,0.3)] px-4 py-2 text-null-green">
              <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
              <span>{maskAddress(wallet.address)}</span>
              {wallet.isMiniPay && <span className="text-[8px] text-null-muted ml-1">MiniPay</span>}
            </div>
            {wallet.error && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-null-amber">
                <span>{wallet.error}</span>
                {wallet.addCashUrl && (
                  <a href={wallet.addCashUrl} className="text-null-green no-underline underline-offset-2 hover:underline">
                    Deposit
                  </a>
                )}
              </div>
            )}
          </div>
        ) : wallet.error ? (
          <div className="flex items-center gap-2 text-[10px] font-mono text-null-red">
            <span>{wallet.error}</span>
            {wallet.addCashUrl && (
              <a href={wallet.addCashUrl} className="text-null-green no-underline underline-offset-2 hover:underline">
                Deposit
              </a>
            )}
          </div>
        ) : null}

        <a href="/game"
          className="font-mono text-[11px] tracking-[2px] text-null-green border border-null-green px-5 py-2 uppercase clip-button-sm hover:bg-null-green hover:text-null-bg transition-all duration-200 no-underline">
          PLAY NOW
        </a>
      </div>

      {/* Mobile hamburger */}
      <button className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 px-2 py-2 font-mono text-null-green text-xs tracking-widest"
        onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? '[ CLOSE ]' : '[ MENU ]'}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 nav-blur border-b border-[rgba(0,255,136,0.15)] py-6 px-6 flex flex-col gap-4 md:hidden">
          {navLinks.map(link => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              className="font-mono text-[12px] text-null-muted hover:text-null-green tracking-[2px] uppercase transition-colors no-underline">
              {link.label}
            </a>
          ))}
          {wallet.isConnected ? (
            <div className="flex flex-col gap-1">
              <div className="font-mono text-[11px] text-null-green border border-[rgba(0,255,136,0.3)] px-4 py-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
                <span>{maskAddress(wallet.address)}</span>
              </div>
              {wallet.error && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-null-amber">
                  <span>{wallet.error}</span>
                  {wallet.addCashUrl && (
                    <a href={wallet.addCashUrl} className="text-null-green no-underline underline-offset-2 hover:underline">
                      Deposit
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : wallet.error ? (
            <div className="flex items-center gap-2 text-[10px] font-mono text-null-red">
              <span>{wallet.error}</span>
              {wallet.addCashUrl && (
                <a href={wallet.addCashUrl} className="text-null-green no-underline underline-offset-2 hover:underline">
                  Deposit
                </a>
              )}
            </div>
          ) : null}
          <a href="/game" onClick={() => setMenuOpen(false)}
            className="font-mono text-[11px] tracking-[2px] text-null-green border border-null-green px-4 py-2 uppercase clip-button-sm text-center hover:bg-null-green hover:text-null-bg transition-all no-underline mt-2">
            PLAY NOW
          </a>
        </div>
      )}
    </nav>
  )
}
