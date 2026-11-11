/**
 * webVitals.ts — report real-user load speed to PostHog.
 *
 * WHY THIS EXISTS
 * MiniPay's listing review grades load speed on the **75th percentile of real
 * users**, not on a PageSpeed run. Those are different numbers measuring
 * different things: PageSpeed is one simulated device on one simulated network,
 * while the p75 is what most of your actual audience experiences — including
 * the slower half. A game aimed at budget Android phones in Africa and
 * Southeast Asia can score well in the lab and still be painful in the hand,
 * and until now we had no way to know which of those we were.
 *
 * WHY NOT posthog-js
 * The official snippet is `posthog.init(..., { capture_performance: { web_vitals:
 * true } })`, which pulls in the whole PostHog SDK — tens of KB on a page we
 * spent an entire performance programme shrinking. Measuring load speed by
 * making the page slower is self-defeating.
 *
 * So this sends the metrics itself: `web-vitals` (~2KB, the same library
 * PostHog uses internally) plus a `fetch` to PostHog's public capture endpoint.
 * The event name and property names match what posthog-js emits EXACTLY, so
 * PostHog's built-in Web Vitals dashboard and the standard HogQL p75 query work
 * against it with no changes — this is a lighter transport for the same data,
 * not a private format.
 *
 * What it does NOT give you, being deliberately narrow: pageviews, autocapture,
 * session recording, funnels. If you later want product analytics, install
 * posthog-js and delete this file — do not run both, or every metric is counted
 * twice.
 *
 * SETUP
 * Set NEXT_PUBLIC_POSTHOG_KEY (project key, e.g. `phc_…`) in the environment.
 * Optionally NEXT_PUBLIC_POSTHOG_HOST if the project is not on US cloud.
 * With no key this module does nothing at all: it never imports web-vitals,
 * never opens a connection, and costs one `if` at startup. That is the state it
 * ships in, so nothing changes until a key is actually configured.
 */

type Metric = { name: string; value: number; rating: string; id: string }

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

const DISTINCT_ID_STORAGE = 'ns-ph-did'

// A stable per-browser id so PostHog can tell repeat visits apart. Anonymous
// and random — it is not the wallet address and never touches one. If
// localStorage is unavailable (private mode, blocked storage) we fall back to a
// per-session id rather than failing: a slightly inflated user count is a much
// smaller problem than losing the measurement.
function distinctId(): string {
  try {
    const existing = localStorage.getItem(DISTINCT_ID_STORAGE)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(DISTINCT_ID_STORAGE, fresh)
    return fresh
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Start collecting. Safe to call more than once — the second call returns
 * immediately, so a remount cannot double-report.
 */
let started = false

export function reportWebVitals(): void {
  if (started || !KEY || typeof window === 'undefined') return
  started = true

  const collected: Record<string, number> = {}
  const ratings: Record<string, string> = {}
  let sent = false

  const send = () => {
    // At most one event per pageview, and nothing at all if no metric arrived
    // (e.g. the tab was closed within the first few hundred ms).
    if (sent || !Object.keys(collected).length) return
    sent = true

    const properties: Record<string, unknown> = {
      distinct_id: distinctId(),
      $current_url: window.location.href,
      $pathname: window.location.pathname,
      // Which surface the sample came from. /game is the Mini App itself and
      // the landing page is a different animal entirely — averaging them
      // together would hide exactly the problem we are looking for.
      $host: window.location.host,
    }
    for (const [name, value] of Object.entries(collected)) {
      properties[`$web_vitals_${name}_value`] = value
      properties[`$web_vitals_${name}_rating`] = ratings[name]
    }

    const body = JSON.stringify({
      api_key: KEY,
      event: '$web_vitals',
      properties,
      timestamp: new Date().toISOString(),
    })

    // keepalive lets the request outlive the page — these metrics are finalised
    // exactly when the user is leaving, which is the one moment a normal fetch
    // gets cancelled. sendBeacon would also survive, but it cannot set a JSON
    // content-type on every browser, and PostHog needs one.
    try {
      void fetch(`${HOST}/e/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        // Telemetry must never carry our cookies to a third party.
        credentials: 'omit',
        // NOT mode:'no-cors' — that restricts Content-Type to form/text and
        // would strip the application/json header PostHog needs to parse the
        // body. PostHog's capture endpoint is built for browsers and returns
        // proper CORS headers, so a normal request is both correct and allowed.
      }).catch(() => {})
    } catch {
      /* measurement must never break the page */
    }
  }

  // web-vitals is imported lazily so its bytes are only fetched when a key is
  // configured — with no key it is never part of any loaded chunk.
  import('web-vitals')
    .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const record = (m: Metric) => {
        collected[m.name] = m.value
        ratings[m.name] = m.rating
      }
      onLCP(record)
      onINP(record)
      onCLS(record)
      onFCP(record)
      onTTFB(record)

      // CLS and INP are only final once the page is going away, so that is when
      // we flush. `pagehide` rather than `unload` because `unload` breaks the
      // back/forward cache; `visibilitychange` catches the mobile case of
      // switching apps, which on Android is how most sessions actually end.
      addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') send()
      })
      addEventListener('pagehide', send)
    })
    .catch(() => {
      /* offline or chunk failed — no metrics this pageview, no error either */
    })
}
