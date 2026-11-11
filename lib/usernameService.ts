import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import { usernameSchema, walletAddressSchema } from './validation'
import { generateAutoUsername } from './guestIdentity'

export interface UsernameRecord {
  walletAddress: string
  username: string
  isAutoAssigned: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Get username for a wallet address
 * If user never set username, returns null (not auto-assigned yet)
 */
export async function getUsername(walletAddress: string): Promise<string | null> {
  try {
    const docRef = doc(db, 'usernames', walletAddress.toLowerCase())
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data().username
    }
    return null
  } catch (err) {
    console.error('[v0] Failed to get username:', err)
    return null
  }
}

/**
 * Generate auto-assigned username from wallet address
 * Format: Player_1234 (last 4 characters of wallet, uppercased)
 *
 * The implementation moved to lib/guestIdentity.ts so the API route and the
 * first-paint seed can share it instead of hand-syncing copies. Re-exported
 * here because this is where callers already look for it.
 */
export { generateAutoUsername }

/**
 * Set username for a wallet (create or update)
 * Returns the stored username
 */
export async function setUsername(
  walletAddress: string,
  username: string,
  isAutoAssigned: boolean = false
): Promise<string> {
  try {
    const normalizedAddr = walletAddressSchema.parse(walletAddress).toLowerCase()
    const normalizedUsername = usernameSchema.parse(username)

    // Check if username is already taken (by someone else)
    const q = query(
      collection(db, 'usernames'),
      where('username', '==', normalizedUsername)
    )
    const existing = await getDocs(q)

    if (!existing.empty) {
      const existingRecord = existing.docs[0].data() as UsernameRecord
      if (existingRecord.walletAddress !== normalizedAddr) {
        throw new Error('Username already taken')
      }
    }

    const now = Date.now()
    const record: UsernameRecord = {
      walletAddress: normalizedAddr,
      username: normalizedUsername,
      isAutoAssigned,
      createdAt: now,
      updatedAt: now,
    }

    await setDoc(doc(db, 'usernames', normalizedAddr), record)
    return normalizedUsername
  } catch (err) {
    console.error('[v0] Failed to set username:', err)
    throw err
  }
}

/**
 * Get or create username for a wallet
 * If user already has custom username: return it
 * If user is new: create auto-assigned username
 * If legacy player (no username in Firebase): create auto-assigned username
 */
export async function getOrCreateUsername(walletAddress: string): Promise<{
  username: string
  isAutoAssigned: boolean
}> {
  try {
    const existing = await getUsername(walletAddress)

    if (existing) {
      return { username: existing, isAutoAssigned: false }
    }

    // Create auto-assigned username
    const autoUsername = generateAutoUsername(walletAddress)
    await setUsername(walletAddress, autoUsername, true)

    return { username: autoUsername, isAutoAssigned: true }
  } catch (err) {
    console.error('[v0] Failed to get or create username:', err)
    const fallback = generateAutoUsername(walletAddress)
    return { username: fallback, isAutoAssigned: true }
  }
}

/**
 * Check if username is available (not taken by others)
 */
export async function isUsernameAvailable(
  username: string,
  excludeWallet?: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'usernames'),
      where('username', '==', username.trim())
    )
    const existing = await getDocs(q)

    if (existing.empty) return true

    if (excludeWallet) {
      const existingRecord = existing.docs[0].data() as UsernameRecord
      return existingRecord.walletAddress === excludeWallet.toLowerCase()
    }

    return false
  } catch (err) {
    console.error('[v0] Failed to check username availability:', err)
    return false
  }
}
