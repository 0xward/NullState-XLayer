import { NextResponse } from 'next/server'

/**
 * GET /api/webvitals — real-user load speed, read back out of PostHog.
 *
 * The browser reports Core Web Vitals to PostHog (lib/webVitals.ts). This route
 * asks PostHog for the p75 of those samples so /stats can show what actual
 * players experience, which is the number MiniPay's listing review grades — not
 * a PageSpeed run on a fast machine.
 *
 * WHY p75 AND NOT AN AVERAGE
 * Google grades Core Web Vitals at the 75th percentile, and for good reason: an
 * average is dragged down by the fast half and hides the slow half. The players
 * most likely to quit are exactly the ones an average conceals.
 *
 * WHY THIS IS A SEPARATE ROUTE FROM /api/stats
 * /api/stats reads Firebase and returns 503 when that is unavailable. Folding a
 * third-party HTTP call into it would mean a PostHog outage takes the whole
 * stats page down with it. Here, a failure costs one card.
 *
 * KEY HANDLING
 * This uses the PERSONAL API key (`phx_`), which can read everything in the
 * account. It must never reach the browser, so it is read from a NON-public env
 * var and the query runs server-side; the page only ever receives the five
 * aggregate numbers below.
 *
 * SETUP (all optional — unset means the card simply does not render)
 *   POSTHOG_PERSONAL_API_KEY   personal API key, `phx_…`
 *                              PostHog → Settings → Account → Personal API keys
 *                              → Create. Scope it to **read** on Query only.
 *   POSTHOG_PROJECT_ID         the number in the PostHog URL:
 *                              us.posthog.com/project/<THIS>/…
 *   POSTHOG_HOST               only if not on US cloud (e.g. https://eu.i.posthog.com)
 */

// The upstream call must not be cached by the route handler itself; freshness
// is controlled by the Cache-Control header below so the edge does the caching.
export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 7

// Google's Core Web Vitals thresholds (p75). LCP/INP/FCP in ms, CLS unitless.
// Returned to the client so the page and this route can never disagree about
// what counts as "good".
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
} as const

const QUERY = `
SELECT
  quantile(0.75)(toFloat(properties.$web_vitals_LCP_value)) AS lcp,
  quantile(0.75)(toFloat(properties.$web_vitals_INP_value)) AS inp,
  quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)) AS cls,
  quantile(0.75)(toFloat(properties.$web_vitals_FCP_value)) AS fcp,
  count() AS samples
FROM events
WHERE event = '$web_vitals' AND timestamp >= now() - interval ${WINDOW_DAYS} day
`

const num = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v) : (v as number)
  return typeof x === 'number' && isFinite(x) ? x : null
}

export async function GET() {
  const key = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const host = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com'

  // Not configured is a normal state, not an error — /stats just omits the
  // card. Returning 200 keeps that distinguishable from a real failure.
  if (!key || !projectId) {
    return NextResponse.json(
      { configured: false },
      { headers: { 'Cache-Control': 's-maxage=300' } },
    )
  }

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: QUERY } }),
      // Don't let a slow upstream hold the page's request open indefinitely.
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      // Surface the status but never the body — an auth failure response can
      // echo back request details we would rather not put on a public page.
      return NextResponse.json(
        { configured: true, error: `PostHog returned ${res.status}` },
        { status: 200, headers: { 'Cache-Control': 's-maxage=60' } },
      )
    }

    const json = await res.json()
    const row = json?.results?.[0]
    if (!Array.isArray(row)) {
      return NextResponse.json(
        { configured: true, error: 'Unexpected response shape' },
        { status: 200, headers: { 'Cache-Control': 's-maxage=60' } },
      )
    }

    const [lcp, inp, cls, fcp, samples] = row

    return NextResponse.json(
      {
        configured: true,
        windowDays: WINDOW_DAYS,
        // Below roughly this many samples a p75 swings wildly on one slow
        // phone. The page uses it to caption the numbers honestly rather than
        // hiding them.
        lowConfidence: (num(samples) ?? 0) < 30,
        samples: num(samples) ?? 0,
        lcp: num(lcp),
        inp: num(inp),
        cls: num(cls),
        fcp: num(fcp),
        thresholds: THRESHOLDS,
      },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    )
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'Query failed' },
      { status: 200, headers: { 'Cache-Control': 's-maxage=60' } },
    )
  }
}
