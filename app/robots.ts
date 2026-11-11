import type { MetadataRoute } from 'next'

import { SITE_URL as siteUrl } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
