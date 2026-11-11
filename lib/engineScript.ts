'use client'

// ─── Where the engine's <script>s come from ──────────────────────────────────
// One owner for the URL policy, because there are two loaders: DungeonGame
// pulls in all fourteen files to start a run, and MusicController pulls in
// audio.js on its own for the ambient bed. They used to build their own URLs
// and disagreed — DungeonGame appended `?v=<build>` and MusicController did
// not, so the "is this script already on the page?" check never matched and
// audio.js could be fetched and executed twice.
//
// In production the minified copies from scripts/minify-game-engine.js are
// served (537KB -> 203KB across the engine). In development the readable
// sources are, so a stack trace still points at a line you can find.
//
// If a minified file is missing — the build step skipped a file, or someone
// deployed without running it — the load falls back to the source path rather
// than failing. Speed is worth optimising for; correctness is not worth
// gambling on a build artefact being present.

const BUILD_TAG =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  'dev'

const USE_MIN = process.env.NODE_ENV === 'production'

export function engineUrl(name: string, minified = USE_MIN): string {
  return `/game-engine/${minified ? 'min/' : ''}${name}?v=${BUILD_TAG}`
}

const injected = new Map<string, Promise<void>>()

function inject(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-ns-engine="${src}"]`)
    if (existing) {
      if (existing.dataset.nsLoaded === '1') return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = src
    // Order matters: assets.js must have run before entities.js reads it.
    // async=false on a dynamically inserted script preserves insertion order.
    s.async = false
    s.dataset.nsEngine = src
    s.onload = () => { s.dataset.nsLoaded = '1'; resolve() }
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(s)
  })
}

/** Loads one engine file, once, falling back to the unminified copy. */
export function loadEngineScript(name: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const key = name
  const cached = injected.get(key)
  if (cached) return cached

  const attempt = inject(engineUrl(name)).catch((err) => {
    if (!USE_MIN) throw err
    console.warn(`[engine] ${name}: minified copy unavailable, using the source file`)
    return inject(engineUrl(name, false))
  })

  injected.set(key, attempt)
  return attempt
}
