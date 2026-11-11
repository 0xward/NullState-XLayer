'use client'

import { getMarketplaceItem } from '@/lib/constants/marketplace'

interface WelcomeGiftModalProps {
  weaponId: string | null
  hours: number
  onClose: () => void
}

/**
 * Shown once, to a player who arrived through someone's referral link, the
 * moment their welcome weapon is granted.
 *
 * This modal is the whole point of the invitee-side reward. A grant the player
 * never notices changes nothing: they still arrive, see that the person who
 * invited them collects a weapon and a skin while they get an empty inventory,
 * and leave. The reward has to be *announced*, at the moment it lands.
 *
 * Rendered from GameFlowManager only when /api/referrals returned a `welcome`
 * object, which the server sets only on the first successful bind — so it
 * cannot reappear on later page loads.
 *
 * Reuses the .ns-confirm-* styles rather than introducing its own: those are in
 * game.css, which the world map already loads, so this costs no extra CSS on a
 * screen we spent a performance programme shrinking.
 */
export default function WelcomeGiftModal({ weaponId, hours, onClose }: WelcomeGiftModalProps) {
  if (!weaponId) return null

  const item = getMarketplaceItem(weaponId) as
    | { name?: string; sprite?: string; effect?: { atkBonus?: number } }
    | undefined

  const name = item?.name ?? 'a weapon'
  // Hours read badly past a day — "48 hours" is a number to convert, "2 days"
  // is a fact.
  const duration = hours >= 24 ? `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}` : `${hours} hours`

  return (
    <div className="ns-confirm-overlay" role="dialog" aria-label="Welcome gift">
      <div className="ns-confirm-box">
        <div className="ns-confirm-title">A gift from your friend</div>

        {item?.sprite && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 14px' }}>
            {/* Plain img, not next/image: this is a pixel-art sprite and the
                optimizer's smoothing would soften exactly the edges that make
                it read as pixel art. */}
            <img
              src={item.sprite}
              alt={name}
              width={96}
              height={96}
              style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 14px rgba(0,255,136,.35))' }}
            />
          </div>
        )}

        <p className="ns-confirm-text">
          You came in through someone&apos;s invite, so the <strong>{name}</strong> is yours to
          use for <strong>{duration}</strong>
          {item?.effect?.atkBonus ? <> — +{item.effect.atkBonus} ATK</> : null}.
          {' '}
          The clock only starts when you equip it, so there&apos;s no rush.
        </p>

        <div className="ns-confirm-btns">
          <button className="ns-confirm-btn primary" onClick={onClose}>
            Take it
          </button>
        </div>
      </div>
    </div>
  )
}
