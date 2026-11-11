import Web3Providers from '@/lib/Web3Providers'
import '../../styles/game.css'

// ─── No preconnects here, on purpose ─────────────────────────────────────────
// There were two — firestore.googleapis.com and the X Layer RPC — added to save
// the DNS + TCP + TLS that PageSpeed measured at 300ms and 310ms. PageSpeed's
// verdict on both afterwards was "Preconnect not used. Check that you are using
// the crossorigin attribute properly": the anonymous connections they opened
// were not the ones either client went on to use, so they cost a socket each
// and saved nothing.
//
// Rather than guess at the right crossorigin mode, the reason to preconnect is
// gone in both cases:
//   · Firestore is no longer on the critical path at all. The player's name now
//     comes from /api/player/identity, same-origin, on the connection the page
//     itself is already using (see lib/useContractPlayer.ts).
//   · The X Layer RPC is only reached after wagmi mounts on idle, which is well
//     after the map has painted — nothing waiting on it is being waited for.

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
    </Web3Providers>
  )
}
