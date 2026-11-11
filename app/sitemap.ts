import type { MetadataRoute } from 'next'

import { SITE_URL as siteUrl } from '@/lib/siteUrl'

const routes = ['/', '/docs', '/game', '/terms', '/privacy']

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }))
}
