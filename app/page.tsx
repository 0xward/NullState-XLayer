'use client'

import Navbar from '@/components/ui/Navbar'
import HeroSection from '@/components/landing/HeroSection'

export default function Home() {
  return (
    <>
      {/* Custom cursor removed (Susanne & Dan: cursor disappears on desktop).
          The native OS cursor is more reliable across navigation than a JS
          cursor that hides the real one — keep the real one everywhere. */}

      {/* The data-grid and film-noise layers that used to sit here are gone.
          The hero now paints the game's own world map edge to edge, so they had
          nothing to show through — and a glowing coordinate grid is exactly the
          fintech-dashboard cue the landing was being mistaken for. A flat dark
          base is all that is needed behind the hero. */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#050b08' }} />

      {/* Navbar */}
      <Navbar />

      {/* Main content — just the hero, fills the viewport, no scroll */}
      <main className="h-[100dvh] overflow-hidden">
        <HeroSection />
      </main>
    </>
  )
}
