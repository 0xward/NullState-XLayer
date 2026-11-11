// Firebase Auth, kept in its own module ON PURPOSE.
//
// lib/firebase.ts is imported by usernameService, guestMigration, the session
// service and more — all of which sit on /game's first-load path. Adding
// getAuth() there would pull the whole Auth SDK into the initial chunk for every
// player, including the ones inside MiniPay who will never see a sign-in screen
// at all. firebase/auth is a separate entry point from firebase/firestore, so
// keeping it in a separate module keeps it a separate chunk.
//
// Nothing may import this eagerly. The sign-in screen reaches it through a
// dynamic import(), which is what keeps it off the critical path.

import { getApps, initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** Same app instance lib/firebase.ts uses — getApps() dedupes across modules. */
function app() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
}

export function authInstance(): Auth {
  return getAuth(app())
}

/** True when the project has enough config to attempt a sign-in at all. */
export function isAuthConfigured(): boolean {
  return !!firebaseConfig.apiKey && !!firebaseConfig.authDomain
}

// ─── Google ──────────────────────────────────────────────────────────────────

/**
 * Popup first, redirect as a fallback.
 *
 * A popup keeps the player on the page, which matters here because the page is
 * mid-game-flow. But mobile browsers block popups that are not judged to be
 * user-initiated, and some in-app browsers refuse them outright. Rather than
 * guess which, try the popup and fall back on the two errors that specifically
 * mean "this browser will not open one".
 */
export async function signInWithGoogle(): Promise<User | null> {
  const auth = authInstance()
  const provider = new GoogleAuthProvider()
  try {
    const res = await signInWithPopup(auth, provider)
    return res.user
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      // Breadcrumb for the return trip. getRedirectResult() has to be called to
      // find out whether a redirect happened, and calling it unconditionally
      // would mean import()ing the Auth SDK on every single page load — for a
      // path almost nobody takes. This flag lets the caller ask cheaply first.
      try { sessionStorage.setItem('ns-signin-redirecting', '1') } catch { /* ignore */ }
      await signInWithRedirect(auth, provider)
      return null // the page navigates away; resumeRedirectSignIn picks it up
    }
    throw err
  }
}

/** Call on load: completes a sign-in that went the redirect route. */
export async function resumeRedirectSignIn(): Promise<User | null> {
  try {
    const res = await getRedirectResult(authInstance())
    return res?.user ?? null
  } catch {
    return null
  }
}

// ─── Email link (passwordless) ───────────────────────────────────────────────
// No passwords, deliberately. A password means a reset flow, a strength meter
// and somewhere to get it wrong, for a game account whose only job is to make
// progress follow you. A link in the inbox does the same work with none of it.

const PENDING_EMAIL_KEY = 'nullstate-signin-email'

export async function sendEmailSignInLink(email: string, returnUrl: string): Promise<void> {
  await sendSignInLinkToEmail(authInstance(), email, {
    url: returnUrl,
    handleCodeInApp: true,
  })
  // Firebase needs the address again when the link is opened, and the link may
  // well be opened in a different tab. localStorage is where it survives that.
  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, email)
  } catch {
    /* the completion step asks for it again if this failed */
  }
}

export function isEmailLinkCallback(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return isSignInWithEmailLink(authInstance(), window.location.href)
  } catch {
    return false
  }
}

/**
 * Completes an email-link sign-in. `fallbackEmail` covers the case where the
 * link is opened on a different device from the one that requested it, so
 * nothing is in localStorage and the player has to retype the address.
 */
export async function completeEmailSignIn(fallbackEmail?: string): Promise<User | null> {
  let email: string | null = fallbackEmail ?? null
  if (!email) {
    try {
      email = window.localStorage.getItem(PENDING_EMAIL_KEY)
    } catch {
      email = null
    }
  }
  if (!email) return null

  const res = await signInWithEmailLink(authInstance(), email, window.location.href)
  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY)
  } catch {
    /* ignore */
  }
  return res.user
}

// ─── Sign out ────────────────────────────────────────────────────────────────

export async function signOutAccount(): Promise<void> {
  await signOut(authInstance())
}

export type { User }
