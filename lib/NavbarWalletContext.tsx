'use client'

/**
 * NavbarWalletContext — a pure React context (no wagmi hooks) that provides
 * just enough wallet status for the Navbar to display.
 *
 * Root layout provides safe defaults (disconnected state).
 * WalletExtrasProvider (inside WagmiProvider) overrides with real values.
 *
 * This separation means Navbar renders safely on public routes (/, /terms,
 * /privacy, /docs) where WagmiProvider is NOT loaded, while still showing
 * live wallet status on /game and /profile where WagmiProvider IS present.
 */

import { createContext, useContext } from 'react'

export interface NavbarWalletState {
  isConnected: boolean
  address: string | null
  isMiniPay: boolean
  error: string | null
  addCashUrl: string | null
}

export const NavbarWalletContext = createContext<NavbarWalletState>({
  isConnected: false,
  address: null,
  isMiniPay: false,
  error: null,
  addCashUrl: null,
})

export function useNavbarWallet(): NavbarWalletState {
  return useContext(NavbarWalletContext)
}
