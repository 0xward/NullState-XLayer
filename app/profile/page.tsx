import Navbar from '@/components/ui/Navbar'
import PlayerProfileCard from '@/components/game/PlayerProfileCard'

export const metadata = {
  title: 'NullState Profile',
  description: 'Player stats, inventory, and season progression for NullState.',
}

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <main className="relative z-[2] mx-auto max-w-4xl px-6 pb-16 pt-28">
        <PlayerProfileCard />
      </main>
    </>
  )
}
