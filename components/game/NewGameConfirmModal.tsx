'use client'

interface NewGameConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onContinue: (() => void) | null
  onCancel: () => void
}

/**
 * NewGameConfirmModal
 *
 * Shown from GameFlowManager when the player taps "New Game" on the Main
 * Menu AND a saved bunker session already exists for their wallet.
 *
 * v72 rework (user finding #2): the old version had only Confirm/Cancel and
 * `await`-ed clearGameSession inside the modal, so after tapping the button
 * both options froze on "Starting…" until Firestore answered — on a slow
 * connection that read as "the popup forces me to wait / I can't choose".
 * Now the modal is a pure CHOICE — three instant options, nothing async:
 *   • Start New Run  — erase the save and begin fresh
 *   • Continue Saved Run — jump back into the existing save instead
 *   • Cancel — back to the menu, save untouched
 * The actual save clearing happens fire-and-forget in GameFlowManager AFTER
 * the choice, so the UI never blocks on the network.
 */
export default function NewGameConfirmModal({
  open,
  onConfirm,
  onContinue,
  onCancel,
}: NewGameConfirmModalProps) {
  if (!open) return null

  return (
    <div className="ns-confirm-overlay" role="dialog" aria-label="Start new game">
      <div className="ns-confirm-box">
        <div className="ns-confirm-title">New Game?</div>
        <p className="ns-confirm-text">
          You have progress in play. Choosing <strong>New Game</strong> starts over from
          scratch — level, floor, food, loot, Golden Key and Paper all reset, and you drop
          back to the surface before Bunker 1. Your Gear, skins, Points, crafting, Season
          Pass and referrals are kept.
        </p>
        <div className="ns-confirm-btns">
          {onContinue && (
            <button className="ns-confirm-btn primary" onClick={onContinue}>
              Continue Progress
            </button>
          )}
          <button className="ns-confirm-btn ghost" onClick={onConfirm}>
            New Game
          </button>
          <button className="ns-confirm-btn ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
