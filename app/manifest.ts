import type { MetadataRoute } from 'next'

// PWA / web-app manifest (served at /manifest.webmanifest via Next's
// file-based metadata). Gives the game a name, icons and standalone display
// when added to a home screen or opened as a MiniPay mini-app. Icons reuse
// the existing app art: /icon-192.png (downscaled from the 512) and the
// original /icon-512.png. purpose:'any' only — the source icons are not
// padded for maskable, so a maskable purpose would crop the artwork.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NULL_STATE // Web3 RPG on Celo',
    short_name: 'NULL_STATE',
    description:
      'A real-time dungeon crawler on Celo. Crack the vault, earn real USDT — playable inside MiniPay.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#0a0e0c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
