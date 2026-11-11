'use client'

import { useEffect } from 'react'
import { reportWebVitals } from '@/lib/webVitals'

/**
 * Mounts the real-user speed measurement. Renders nothing.
 *
 * Deliberately started from an effect rather than at module scope: effects run
 * after hydration, so nothing here competes with first paint. An instrument
 * that slows down the thing it measures is worse than no instrument.
 *
 * With no NEXT_PUBLIC_POSTHOG_KEY configured, reportWebVitals() returns on its
 * first line and the web-vitals chunk is never fetched — so this component is
 * free until the day a key exists.
 */
export default function WebVitals() {
  useEffect(() => {
    reportWebVitals()
  }, [])

  return null
}
