import Web3Providers from '@/lib/Web3Providers'
import '../../styles/game.css'

// ─── No preconnects here, on purpose ─────────────────────────────────────────
// There were two — firestore.googleapis.com and forno.celo.org — added to save
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
//   · The Celo RPC is only reached after wagmi mounts on idle, which is well
//     after the map has painted — nothing waiting on it is being waited for.
// ─── The veil: 0.5s of world map that should not have been there ────────────
//
// OWNER: *"terus kejar yg 0.5 detik itu."*
//
// Outside MiniPay the map was visible under the gate for about half a second,
// and no amount of React could fix it: the map is in the PRERENDERED HTML, so
// it paints before a single line of JavaScript has run. That is deliberate and
// worth keeping — it is what /game's LCP optimisation buys, and MiniPay players
// (who never see the gate) get the whole benefit.
//
// So the fix is the only thing that can run earlier than React: an inline
// script in the document itself. If the gate is going to appear, it marks the
// document before the first paint and CSS hides the home screen. If it is not,
// it does nothing at all and the map paints exactly as it does today.
//
// It marks <html> rather than appending an overlay, and that is not a style
// preference — the overlay version was written and measured first. Next's
// hydration reconciles the children of <body> and threw the node away at 261ms,
// long before the gate was ready to cover anything, so the map was on screen
// from 323ms to 882ms. An attribute React never rendered is not part of that
// reconciliation and survives.
//
// ── THIS IS A THIRD COPY OF THE MINIPAY RULE, AND THAT WAS A DECISION ───────
//
// The rule already lives in shouldOfferSignIn() and in privyGateFlag. Copying
// it again is a real cost, accepted because the copy is ONE-WAY: every branch
// below can only decide "do not veil". A drift between the copies costs a
// non-MiniPay player half a second of map — never the reverse, and MiniPay
// cannot be reached by it at all.
//
// The dead-man's timer matters as much as the conditions: if React never
// arrives — a chunk 404, a JS error — the sheet lifts by itself after 3s rather
// than leaving somebody staring at a black screen forever.
const GATE_VEIL = `(function(){try{
  if(window.ethereum&&window.ethereum.isMiniPay)return;
  var q=null;try{q=new URLSearchParams(location.search).get('privy')}catch(e){}
  if(q==='0')return;
  if(!__APP_ID__)return;
  if(q!=='1'&&__ENV_ON__!=='1')return;
  if(localStorage.getItem('nullstate-auth-address'))return;
  if(localStorage.getItem('nullstate-signin-skipped')==='1')return;
  var h=document.documentElement;
  h.setAttribute('data-ns-gate','1');
  setTimeout(function(){h.removeAttribute('data-ns-gate')},3000);
}catch(e){}})();`

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const veil = GATE_VEIL
    .replace('__APP_ID__', JSON.stringify(process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''))
    .replace('__ENV_ON__', JSON.stringify(process.env.NEXT_PUBLIC_PRIVY_GATE || ''))
  return (
    <Web3Providers>
      {/* Before {children}, so it runs before the map markup is even parsed. */}
      <script dangerouslySetInnerHTML={{ __html: veil }} />
      {children}
    </Web3Providers>
  )
}
