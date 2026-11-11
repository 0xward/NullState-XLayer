'use client'

export default function Footer() {
  const links = [
    { href: 'https://x.com/nullstate_id', label: 'TWITTER' },
    { href: 'https://t.me/nullstate_id', label: 'SUPPORT' },
    { href: 'https://github.com', label: 'GITHUB' },
    { href: '/docs', label: 'DOCS' },
    { href: '/stats', label: 'STATS' },
    { href: '/terms', label: 'TERMS' },
    { href: '/privacy', label: 'PRIVACY' },
  ]

  return (
    <footer className="relative z-[2] border-t border-[rgba(0,255,136,0.08)] px-6 md:px-10 py-8">
      {/* World ticker */}
      <div className="border-b border-[rgba(0,255,136,0.06)] mb-6 pb-4 ticker-wrap overflow-hidden">
        <div className="ticker-inner font-mono text-[9px] text-null-muted tracking-[3px] uppercase">
          {Array(3).fill(
            '// NULLSTATE LIVE :: BLOCK #28,441,902 :: 247 PLAYERS ACTIVE :: NULL_STRIKE: FREE :: NEXT DROP: 47H :: NETWORK FEE: $0.001 :: BUILT ON CELO :: MINIPAY NATIVE :: REAL-TIME DUNGEON CRAWLER :: '
          ).join('')}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 flex-wrap">
        <div className="font-display font-black text-[13px] text-null-muted tracking-[4px]">
          NULL_STATE // v1.0.0
        </div>

        <ul className="flex gap-6 list-none flex-wrap justify-center">
          {links.map(link => (
            <li key={link.label}>
              <a
                href={link.href}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center min-h-11 px-2 font-mono text-[10px] tracking-[2px] text-null-muted hover:text-null-green transition-colors duration-200 uppercase no-underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="font-mono text-[10px] tracking-wider" style={{ color: 'rgba(42,74,53,0.6)' }}>
          © 2025 NULLSTATE :: Operated by 1892 Studio :: BUILT ON CELO
        </div>
      </div>

      <div className="mt-6 text-center font-mono text-[9px] tracking-[3px]" style={{ color: 'rgba(42,74,53,0.4)' }}>
        BUILT ON CELO :: MINIPAY PROOF OF SHIP :: REAL-TIME DUNGEON CRAWLER
      </div>
    </footer>
  )
}
