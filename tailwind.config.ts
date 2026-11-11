import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-mono)', 'monospace'],
        hud: ['var(--font-hud)', 'sans-serif'],
        display: ['var(--font-display)', 'monospace'],
        cinzel: ['var(--font-cinzel)', 'serif'],
      },
      colors: {
        'null-bg': '#020a06',
        'null-surface': '#040f08',
        'null-green': '#00ff88',
        'null-green-dim': '#00cc6a',
        'null-green-dark': '#004422',
        'null-acid': '#a8ff3e',
        'null-red': '#ff2244',
        'null-amber': '#ffaa00',
        'null-blue': '#00aaff',
        'null-white': '#d4ffe8',
        // Bumped from #2a4a35 (~1.4:1 on --null-bg — unreadable, failed WCAG)
        // to a readable ~5:1 tone while keeping the same desaturated-green hue.
        // Fixes low-contrast body/subtitle copy on /docs, /terms, /privacy.
        'null-muted': '#a0c9b4',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'scan-h': 'scanH 3s linear infinite',
        'rotate-cw': 'rotateCW 20s linear infinite',
        'glitch1': 'glitch1 4s 2s infinite',
        'glitch2': 'glitch2 4s 2.1s infinite',
        'float': 'float 6s ease-in-out infinite',
        'orb-pulse': 'orbPulse 4s ease-in-out infinite',
        'fadeUp': 'fadeUp 0.6s forwards',
        'blink': 'blink 1s step-end infinite',
        'scroll-down': 'scrollDown 2s ease-in-out infinite',
        'ticker': 'ticker 20s linear infinite',
      },
      keyframes: {
        scanH: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        rotateCW: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        orbPulse: {
          '0%, 100%': { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.6' },
          '50%': { transform: 'translate(-50%,-50%) scale(1.1)', opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scrollDown: {
          '0%': { transform: 'scaleY(1)', transformOrigin: 'top' },
          '50%': { transform: 'scaleY(0.3)', transformOrigin: 'bottom' },
          '100%': { transform: 'scaleY(1)', transformOrigin: 'top' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        glitch1: {
          '0%, 94%, 100%': { opacity: '0', transform: 'translateX(0)' },
          '95%': { opacity: '1', transform: 'translateX(-4px)' },
          '97%': { opacity: '1', transform: 'translateX(4px)' },
          '99%': { opacity: '0' },
        },
        glitch2: {
          '0%, 94%, 100%': { opacity: '0', transform: 'translateX(0)' },
          '95%': { opacity: '1', transform: 'translateX(4px)' },
          '97%': { opacity: '1', transform: 'translateX(-4px)' },
          '99%': { opacity: '0' },
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)",
        'scanlines': "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      },
    },
  },
  plugins: [],
}
export default config
