/**
 * Firebase Admin SDK initialization for backend scripts and API routes.
 *
 * This file uses the Admin SDK (firebase-admin) — do NOT import it in
 * client-side code. For client-side Firebase, use lib/firebase.ts instead.
 *
 * IMPORTANT: firebase-admin v12+ (we're on v14) dropped the old namespaced
 * API (`admin.credential.cert(...)`, `admin.database()`, `admin.auth()`).
 * `require('firebase-admin')` now only exposes a small top-level surface
 * (initializeApp, cert, getApps, ...) — the rest lives in subpath modules
 * (`firebase-admin/app`, `firebase-admin/database`, `firebase-admin/auth`).
 * Using the old namespaced calls silently resolves to `undefined` and
 * throws "Cannot read properties of undefined (reading 'cert')" the moment
 * FIREBASE_SERVICE_ACCOUNT is actually set (it never got that far while the
 * env var was empty, which is why this stayed hidden).
 *
 * Required environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — JSON string of the service account key
 *                               (store only in GitHub Secrets / Vercel env, never commit)
 *   FIREBASE_DATABASE_URL     — Realtime Database URL
 *                               e.g. https://nullstate-35b2e-default-rtdb.asia-southeast1.firebasedatabase.app
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import type { Firestore } from 'firebase-admin/firestore'

function initAdmin(): App | null {
  const existing = getApps()
  if (existing.length > 0) return existing[0]

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountEnv) {
    console.warn('[firebase-config] FIREBASE_SERVICE_ACCOUNT not set — Firebase Admin disabled')
    return null
  }

  let serviceAccount: object
  try {
    serviceAccount = JSON.parse(serviceAccountEnv)
  } catch {
    console.error('[firebase-config] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON')
    return null
  }

  try {
    return initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      // NOTE: this project's Realtime Database lives in the asia-southeast1
      // region (regional RTDB instances get a *.<region>.firebasedatabase.app
      // host, NOT the legacy default-region *.firebaseio.com host). If
      // FIREBASE_DATABASE_URL isn't set in the environment, falling back to
      // the legacy-style host here would point the Admin SDK at a database
      // that doesn't exist for this project — every read/write then hangs
      // until the request times out, which Vercel surfaces as a raw
      // platform-level 500 (not JSON), instead of a normal caught error.
      // Always set FIREBASE_DATABASE_URL explicitly in production; this
      // fallback exists only so local/dev usage fails the same documented
      // way rather than silently pointing at the wrong host.
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ??
        'https://nullstate-35b2e-default-rtdb.asia-southeast1.firebasedatabase.app',
    })
  } catch (err) {
    console.error('[firebase-config] Failed to initialize Firebase Admin app:', err)
    return null
  }
}

const adminApp = initAdmin()

/** Firebase Admin Realtime Database instance (or null if unconfigured) */
export function getAdminDb(): ReturnType<typeof getDatabase> | null {
  if (!adminApp) return null
  try {
    return getDatabase(adminApp)
  } catch (err) {
    console.error('[firebase-config] getDatabase() failed — check FIREBASE_DATABASE_URL:', err)
    return null
  }
}

/**
 * Firebase Admin Firestore instance (or null if unconfigured).
 *
 * Added for /api/player/identity. The player's name is the world map's largest
 * painted element, and reading it with the CLIENT Firestore SDK meant the map
 * could not finish painting until that SDK had booted and completed a
 * WebChannel handshake with firestore.googleapis.com — PageSpeed measured
 * 7,450ms of render delay on exactly that element. Reading the same two
 * documents here, server-side, turns it into one same-origin fetch on a
 * connection the browser already has open.
 *
 */
export function getAdminFirestore(): Firestore | null {
  if (!adminApp) return null
  try {
    // Required lazily, not imported at the top. Every API route in the project
    // imports this module for getAdminDb(); a top-level import here puts
    // @google-cloud/firestore's load on the critical path of all of them, and
    // the note below is this file's own record of what that costs when a
    // subpath turns out to be unloadable in the serverless runtime — it took
    // out routes that never touched the package. Inside the function, a
    // failure can only reach the one caller that asked for Firestore.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getFirestore } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore')
    return getFirestore(adminApp)
  } catch (err) {
    console.error('[firebase-config] getFirestore() failed:', err)
    return null
  }
}

// NOTE: getAdminAuth()/firebase-admin/auth was intentionally removed.
// No API route in this project uses Firebase Admin Auth (only
// getAdminDb() / Realtime Database is used). Importing
// 'firebase-admin/auth' pulls in jwks-rsa -> jose (an ESM-only package),
// which Next.js bundles into the serverless function even though it's
// never called. At runtime on Vercel's CJS function runtime, that
// produces a hard crash BEFORE our try/catch can run:
//   Error [ERR_REQUIRE_ESM]: require() of ES Module .../jose/dist/webapi/index.js
//   from .../jwks-rsa/src/utils.js not supported.
// This is why /api/player/profile and /api/burn/record returned raw
// HTML/platform error pages ("Unexpected token '<'") instead of JSON —
// the function crashed entirely, not just the handler logic.
// If Admin Auth is ever actually needed again, re-add the import behind
// serverExternalPackages in next.config.js (see below) so it's required
// at runtime instead of bundled by webpack.

export default adminApp
