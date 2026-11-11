'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface SaveConfirmModalProps {
  open: boolean
  canSave: boolean
  onSaveAndExit: () => Promise<void>
  onExitWithoutSaving: () => void
  onCancel: () => void
}

export default function SaveConfirmModal({
  open,
  canSave,
  onSaveAndExit,
  onExitWithoutSaving,
  onCancel,
}: SaveConfirmModalProps) {
  const [saving, setSaving] = useState(false)
  // See SettingsModal: portalled to document.body, so it waits for mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!open || !mounted) return null

  const handleSaveAndExit = async () => {
    setSaving(true)
    await onSaveAndExit()
    setSaving(false)
  }

  // Portalled to document.body for the same reason as SettingsModal: this is
  // a viewport-fixed dialog rendered inside .ns-game-root, whose `* { padding:0 }`
  // reset ties with these rules on specificity and wins on bundle order.
  return createPortal(
    <div className="ns-confirm-overlay" role="dialog" aria-label="Save progress">
      <div className="ns-confirm-box">
        <div className="ns-confirm-title">Save Progress?</div>
        <p className="ns-confirm-text">
          {canSave
            ? "Save your current floor and inventory before you go? You'll be able to continue from this exact bunker next time."
            : "You're not inside a bunker right now, so there's nothing to save."}
        </p>
        <div className="ns-confirm-btns">
          {canSave && (
            <button className="ns-confirm-btn primary" onClick={handleSaveAndExit} disabled={saving}>
              {saving ? 'Saving…' : 'Save & Exit'}
            </button>
          )}
          <button className="ns-confirm-btn" onClick={onExitWithoutSaving} disabled={saving}>
            Exit Without Saving
          </button>
          <button className="ns-confirm-btn ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
