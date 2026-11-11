'use client'

import { useCallback, useState } from 'react'
import { migrateGuestProgress, getStoredGuestId } from '@/lib/guestMigration'
import {
  deriveAuthAddress, storeAuthIdentity, clearAuthIdentity,
  rememberSignInSkipped,
} from '@/lib/authIdentity'

// ─── Account actions, in one place ───────────────────────────────────────────
// These started life inside GameFlowManager, which was fine while the sign-in
// screen was the only thing that used them. It is not: Settings needs the same
// three actions, on both surfaces (the world map's SettingsScreen and the
// in-run SettingsModal), because a player who skipped the prompt had no way
// back and a player who signed in had no way out.
//
// Three copies of "derive the address, migrate the guest, store the identity"
// is three chances to get the ORDER wrong, and the order is the part that
// matters — see adopt() below. So it lives here and the screens call it.
//
// firebase/auth is still only reached through import(), so importing this hook
// costs nothing until somebody actually presses a button.

export function useAccountActions(onProfileChanged?: () => void | Promise<void>) {
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)

  /**
   * Turns a signed-in Firebase user into the address everything else is keyed
   * by, and carries any guest progress across to it.
   *
   * Order matters: migrate BEFORE storing the identity. migrateGuestProgress
   * reads the stored guest id and moves its documents onto the address given,
   * then clears it. If the identity were stored first, useWallet() would start
   * returning the account address on the next render and the guest's run would
   * be stranded under an id nothing points at any more.
   */
  const adopt = useCallback(async (uid: string, label?: string | null) => {
    const authAddress = await deriveAuthAddress(uid)
    if (getStoredGuestId()) await migrateGuestProgress(authAddress)
    storeAuthIdentity(uid, authAddress, label)
    // Signing in is also the clearest possible "yes" to a prompt they may have
    // declined before. Leaving the skip flag set would mean a player who signed
    // in from Settings, then signed out, never sees the prompt again.
    await onProfileChanged?.()
  }, [onProfileChanged])

  const signInGoogle = useCallback(async () => {
    const { signInWithGoogle } = await import('@/lib/firebaseAuth')
    const user = await signInWithGoogle()
    // null means the popup was blocked and we redirected instead; the page is
    // navigating away and the redirect handler picks it up on the way back.
    if (user) await adopt(user.uid, user.email ?? user.displayName)
  }, [adopt])

  const signInEmail = useCallback(async (email: string) => {
    const { sendEmailSignInLink } = await import('@/lib/firebaseAuth')
    await sendEmailSignInLink(email, window.location.href)
    setEmailSentTo(email)
  }, [])

  /**
   * Signs out and drops the derived address, which returns useWallet() to the
   * guest id.
   *
   * It does NOT delete anything. The account's progress stays in Firestore
   * under its address and comes straight back on the next sign-in — signing
   * out of a game is "stop using this account here", never "throw my save
   * away". A player who wants deletion has to ask, which /privacy says.
   */
  const signOut = useCallback(async () => {
    const { signOutAccount } = await import('@/lib/firebaseAuth')
    await signOutAccount()
    clearAuthIdentity()
    await onProfileChanged?.()
  }, [onProfileChanged])

  return {
    emailSentTo,
    clearEmailSent: useCallback(() => setEmailSentTo(null), []),
    adopt,
    signInGoogle,
    signInEmail,
    signOut,
    rememberSkipped: rememberSignInSkipped,
  }
}
