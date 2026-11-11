'use client'

/**
 * WagmiIsland.tsx — everything that needs wagmi/viem, and nothing else.
 *
 * This file is the ONLY module that imports wagmi at the top level, which is
 * what lets webpack put wagmi + viem (350KB raw, the largest chunk on /game and
 * mostly unused at first paint) behind a dynamic import. Anything added here is
 * added to that deferred chunk; anything that imports this file eagerly undoes
 * the split.
 *
 * It renders no children. WagmiWalletIsland publishes account state into the
 * bridge (lib/walletBridge.tsx) and the app reads it from there, so this whole
 * subtree can appear a second after the map without remounting anything.
 */

import {
  WagmiProvider, createConfig, http,
  useAccount, usePublicClient, useWalletClient, useBalance, useSwitchChain, useConnect, useDisconnect,
} from 'wagmi'
import { xLayerChain, xLayerTestnetChain, xlayerTransport, XLAYER_CHAIN_ID, DEFAULT_XLAYER_TESTNET_RPC } from '@/lib/xlayerRpc'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { encodeFunctionData } from 'viem'
import { USDC_ADDRESS, ERC20_ABI } from './contract-abi'
import { getUserFriendlyError, WalletFriendlyError } from './errorUtils'
import { useWalletPublish, type WalletBridgeValue } from './walletBridge'
import { NULLSTATE_ADDRESS } from './WalletProvider'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, parseTokenAmount, MarketplaceTokenSymbol } from './constants/tokens'

// ─── Wagmi config ─────────────────────────────────────────────────────────────
// No manual connect button anywhere in the UI — connection is silent on load.
// Only the injected connector is registered.

const config = createConfig({
  chains:    [xLayerChain, xLayerTestnetChain],
  connectors: [injected()],
  transports: {
    // Was hardcoded to the public URL while lib/web3-client.ts read
    // NEXT_PUBLIC_XLAYER_RPC, so moving off the default moved the server and
    // left every player's browser behind — the half that actually generates
    // the per-player load.
    [xLayerChain.id]: xlayerTransport(),
    [xLayerTestnetChain.id]: http(DEFAULT_XLAYER_TESTNET_RPC),
  },
})

// Registers this config as wagmi's default `Config` generic app-wide, so
// `useWalletClient()`/`useSendTransaction()`/`writeContract()` etc. resolve
// to X Layer's chain type.
// https://wagmi.sh/react/typescript#registering-config
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

// One instance, stable across renders.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000 },
  },
})

export default function WagmiIsland() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WagmiWalletIsland />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

// ─── The wagmi island ────────────────────────────────────────────────────────
// Renders NOTHING. It calls the wagmi hooks and publishes the result into the
// bridge, so it can be mounted late — beside the app rather than around it —
// without a single component below it unmounting when it arrives.
// Must be a child of WagmiProvider, which is what the default export above is for.

export function WagmiWalletIsland() {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const publicClient  = usePublicClient({ chainId: XLAYER_CHAIN_ID })
  const { data: walletClient } = useWalletClient({ chainId: XLAYER_CHAIN_ID })
  const { data: balanceData }  = useBalance({ address, chainId: XLAYER_CHAIN_ID })

  const [error, setError] = useState<string | null>(null)
  const [insufficientFunds, setInsufficientFunds] = useState(false)

  // Connection is silent on load: no "connect wallet" button anywhere in the
  // UI, and any injected wallet (MetaMask, OKX, or another in-app browser)
  // connects automatically. The player never has to ask to play.
  const { connect, connectors } = useConnect()
  useEffect(() => {
    if (isConnected) return
    const injectedConnector = connectors.find(c => c.id === 'injected') ?? connectors[0]
    if (injectedConnector) connect({ connector: injectedConnector, chainId: XLAYER_CHAIN_ID })
  }, [isConnected, connect, connectors])

  // ── AND ONTO X LAYER, IMMEDIATELY ────────────────────────────────────────
  //
  // OWNER, testing in the OKX in-app browser: *"posisi auto connect tapi gabisa
  // mint pass dan buy ada tulisan 'wallet not connected'."* The wallet was
  // connected. It was on OKX's own default chain.
  //
  // That is fatal rather than cosmetic, because of one line inside wagmi
  // (getConnectorClient.js):
  //
  //     if (assertChainId && connectorChainId !== chainId)
  //       throw new ConnectorChainMismatchError(...)
  //
  // useWalletClient({chainId: XLAYER}) therefore resolves to undefined on any
  // other chain, every payment hits its `!walletClient` guard, and the player
  // is told their wallet is not connected. `switchToXLayer` already existed for
  // exactly this — plumbed through the bridge and never called from anywhere.
  //
  // Owner's decision: *"itu bener2 autoconnect dan autoswitch jaringan ke
  // X Layer dr awal login dengan wallet."* So the switch is requested the moment
  // a connection lands on the wrong chain, not deferred to the first purchase.
  //
  // Attempted ONCE per chain the wallet lands on. A player who declines is not
  // asked again on every render — that is a popup loop, and it is worse than
  // the bug. They get the banner and its button instead, and moving the wallet
  // to another chain arms one fresh attempt.
  const askedFor = useRef<number | null>(null)
  const onWrongChain = isConnected && !!chain && chain.id !== XLAYER_CHAIN_ID
  useEffect(() => {
    if (!onWrongChain || !chain) return
    if (askedFor.current === chain.id) return
    askedFor.current = chain.id
    try { switchChain({ chainId: XLAYER_CHAIN_ID }) } catch { /* declined or unsupported */ }
  }, [onWrongChain, chain, switchChain])

  const nativeBalance = balanceData
    ? (Number(balanceData.value) / 10 ** balanceData.decimals).toFixed(2)
    : '0.00'

  // ── Send transaction helper ───────────────────────────────────────────────

  // "Wallet not connected" was a lie on every wrong-chain failure, and it sent
  // the owner looking for a connection problem that did not exist. One helper,
  // so all three payment paths tell the same truth.
  const assertReady = useCallback(() => {
    if (onWrongChain) {
      throw new Error('Wrong network — NullState runs on X Layer. Switch your wallet to X Layer and try again.')
    }
    if (!walletClient || !address) throw new Error('Wallet not connected')
  }, [onWrongChain, walletClient, address])

  const sendTx = useCallback(
    async (data: `0x${string}`, value?: bigint): Promise<string> => {
      assertReady()
      if (!walletClient || !address) throw new Error('Wallet not connected')
      setError(null)
      setInsufficientFunds(false)
      try {
        // Gas is paid in OKB, the native token — there is no fee-token
        // abstraction on X Layer, so the wallet must hold a little OKB.
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   xLayerChain,
          to:      NULLSTATE_ADDRESS,
          data,
          value:   value ?? BigInt(0),
          // Let the wallet estimate gas — safer than hardcoding
          // gas is omitted intentionally so the RPC estimates it
        })
        return hash
      } catch (e: unknown) {
        const friendlyError = getUserFriendlyError(e)
        setError(friendlyError.message)
        setInsufficientFunds(friendlyError.insufficientFunds)
        throw new WalletFriendlyError(friendlyError, e)
      }
    },
    [walletClient, publicClient, address, assertReady]
  )

  // ── Contract write functions ──────────────────────────────────────────────
  // NOTE (removed 2026-07-12): this file used to also export `registerPlayer`,
  // `respawnPlayer`, `executeAction`, and `attackRaid` — thin wrappers around
  // NullState.sol's register()/respawn()/executeAction()/attackRaidBoss().
  // None of them were ever called by any component: the live registration
  // flow goes through `useContractPlayer.ts`'s own `registerPlayer` (a
  // separate, still-used implementation), NULL_STRIKE goes through
  // `payStableFee()` below, and the raid-boss/respawn mechanics they supported
  // were already gone from the game. Removed as confirmed-dead code, not
  // touching the live paths (registerPlayer in useContractPlayer.ts,
  // payStableFee, buyMarketplaceItem below).

  // Plain ERC20 USDC transfer() — used for the NULL_STRIKE fee. Sends
  // directly to `toAddress` (the reward contract), NOT through NullState.sol.
  const payStableFee = useCallback(
    async (amountWei: bigint, toAddress: `0x${string}`): Promise<string> => {
      assertReady()
      if (!walletClient || !address) throw new Error('Wallet not connected')
      if (typeof amountWei !== 'bigint' || amountWei <= BigInt(0)) {
        throw new Error('Invalid stablecoin fee amount')
      }
      setError(null)
      setInsufficientFunds(false)
      const data = encodeFunctionData({
        abi:          ERC20_ABI,
        functionName: 'transfer',
        args:         [toAddress, amountWei],
      })
      try {
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   xLayerChain,
          to:      USDC_ADDRESS,
          data,
          value:   BigInt(0),
        })
        return hash
      } catch (e: unknown) {
        const friendlyError = getUserFriendlyError(e)
        setError(friendlyError.message)
        setInsufficientFunds(friendlyError.insufficientFunds)
        throw new WalletFriendlyError(friendlyError, e)
      }
    },
    [walletClient, publicClient, address, assertReady]
  )

  // ── Generic treasury payment ─────────────────────────────────────────────
  // Sends `priceUsd` of the chosen stablecoin (1:1 USD) to the treasury as a
  // plain ERC20 transfer(). Returns the tx hash; a backend route then
  // verifies it on-chain before granting whatever it unlocks. Originally
  // written for Marketplace item purchases (offchain ownership in Firebase)
  // — reused as-is for PassSBTv2 minting (v2.1, this session), since it's
  // already fully generic: it doesn't know or care what the payment is for,
  // only that `priceUsd` gets sent to TREASURY_WALLET in `token`. Exported
  // under both names below so each call site reads clearly.
  const payToTreasury = useCallback(
    async (priceUsd: number, token: MarketplaceTokenSymbol): Promise<string> => {
      assertReady()
      if (!walletClient || !address) throw new Error('Wallet not connected')
      const cfg = MARKETPLACE_TOKENS[token]
      if (!cfg) throw new Error('Unsupported token')
      const amountWei = parseTokenAmount(String(priceUsd), token)
      if (amountWei <= BigInt(0)) throw new Error('Invalid price')
      setError(null)
      setInsufficientFunds(false)
      const data = encodeFunctionData({
        abi:          ERC20_ABI, // ERC20 transfer(address,uint256) — same for both tokens
        functionName: 'transfer',
        args:         [TREASURY_WALLET as `0x${string}`, amountWei],
      })
      try {
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   xLayerChain,
          to:      cfg.address as `0x${string}`,
          data,
          value:   BigInt(0),
        })
        return hash
      } catch (e: unknown) {
        const friendlyError = getUserFriendlyError(e)
        setError(friendlyError.message)
        setInsufficientFunds(friendlyError.insufficientFunds)
        throw new WalletFriendlyError(friendlyError, e)
      }
    },
    [walletClient, address, assertReady]
  )

  // NOTE (removed 2026-07-12): `attackRaid`, `readPlayer`, and `readRaid`
  // were also dead code — same as the write functions removed above. None
  // had any caller anywhere in components/ or app/, so all three (plus the
  // registerPlayer/respawnPlayer/executeAction removed above) were deleted
  // together as one cleanup pass. Only `payStableFee` and `buyMarketplaceItem`
  // remain as this provider's live on-chain write paths.

  const connectWallet = useCallback(async () => {
    const target = connectors.find(c => c.id === 'injected') ?? connectors[0]
    if (target) connect({ connector: target, chainId: XLAYER_CHAIN_ID })
  }, [connect, connectors])

  // The async variant, because the button in WrongNetworkBar shows a pending
  // state and the fire-and-forget `switchChain` resolves instantly whether the
  // wallet agreed or not — a spinner that means nothing. A decline is not an
  // app error: the bar simply stays up, which is already the honest report.
  const switchToXLayer = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: XLAYER_CHAIN_ID })
      setError(null)
    } catch {
      // Wallets that cannot switch (some in-app browsers pin their chain) end
      // up here. Saying so beats a button that silently does nothing.
      setError('Could not switch automatically — please choose X Layer in your wallet app.')
    }
  }, [switchChainAsync])

  const value: WalletBridgeValue = useMemo(() => ({
    ready: true,
    address: address ?? null,
    isConnected,
    chainId: chain?.id ?? null,
    wrongNetwork: onWrongChain,
    nativeBalance,
    error,
    insufficientFunds,
    publicClient: (publicClient ?? null) as WalletBridgeValue['publicClient'],
    walletClient: (walletClient ?? null) as WalletBridgeValue['walletClient'],
    connect: connectWallet,
    disconnect,
    switchToXLayer,
    payStableFee,
    payToTreasury,
  }), [address, isConnected, chain?.id, onWrongChain, nativeBalance, error, insufficientFunds,
       publicClient, walletClient, connectWallet, disconnect, switchToXLayer, payStableFee, payToTreasury])

  const publish = useWalletPublish()
  useEffect(() => { publish(value) }, [publish, value])

  return null
}
