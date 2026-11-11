'use client'

// ─── The three sign-in marks, in one place ───────────────────────────────────
//
// Lifted out of SignInScreen when the Privy gate started needing the same three
// buttons. Two copies of the Google mark is two chances for one of them to be
// quietly recoloured or resized until the two screens no longer look like the
// same product — and Google's brand guidelines are specific enough that a drift
// here is a compliance problem, not a taste one.
//
// Inline SVG rather than files: a strict CSP blocks external images, and these
// must never cost a request on a screen whose whole job is to appear instantly.

/**
 * Google's mark. It has to be the real four-colour G — a monochrome or
 * recoloured version is off-guideline, and players recognise the actual one at
 * a glance, which is the entire point of putting it here.
 */
export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

export function MailMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M3 6.5 12 13l9-6.5" />
    </svg>
  )
}

export function WalletMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" />
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <circle cx="16.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
