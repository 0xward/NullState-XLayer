/**
 * One place that decides this app's public URL.
 *
 * WHY THIS EXISTS
 * The production URL was written out by hand in five places — the metadata base
 * in app/layout.tsx, app/robots.ts, app/sitemap.ts, the server-side attribution
 * hostname, and the stats URL in the treasury CLI. Moving to a real domain, as
 * the Celo review asked for, meant finding all five and getting all five right.
 * The RPC endpoint had exactly this shape and exactly one of its six copies was
 * wrong for months.
 *
 * CONFIGURE
 *   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
 * With or without a trailing slash; it is stripped. Unset keeps the Vercel
 * subdomain, which is what ships until a domain is connected.
 */

const FALLBACK = 'https://nullstate-ten.vercel.app'

/** Canonical origin, no trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK).replace(/\/+$/, '')

/**
 * Hostname only — what the Celo attribution SDK hashes into an app code.
 * Parsed rather than sliced so a value with a path or a port cannot silently
 * produce a hostname that includes them, which would yield a different code
 * from the one the browser derives.
 */
export const SITE_HOSTNAME = (() => {
  try {
    return new URL(SITE_URL).hostname
  } catch {
    return new URL(FALLBACK).hostname
  }
})()
