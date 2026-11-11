import Web3Providers from '@/lib/Web3Providers'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
    </Web3Providers>
  )
}
