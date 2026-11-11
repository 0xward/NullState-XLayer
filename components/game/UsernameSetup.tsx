'use client'

import { useState } from 'react'

interface UsernameSetupProps {
  onUsernameSet: (username: string) => void
  onCancel: () => void
  isLoading?: boolean
}

export default function UsernameSetup({
  onUsernameSet,
  onCancel,
  isLoading = false,
}: UsernameSetupProps) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const trimmed = username.trim()

    // Validation
    if (!trimmed) {
      setError('Username cannot be empty')
      return
    }
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (trimmed.length > 32) {
      setError('Username must be 32 characters or less')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Username can only contain letters, numbers, underscore, hyphen')
      return
    }

    setError('')
    onUsernameSet(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSubmit()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.95)] p-6">
      {/* Glow orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,136,0.1) 0%, rgba(0,170,255,0.03) 40%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Title */}
        <div className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-6">
          // CREATE CHARACTER
        </div>

        <h2 className="font-display font-black text-null-white mb-2" style={{ fontSize: '44px' }}>
          SET USERNAME
        </h2>

        <p className="text-null-muted text-sm mb-8 leading-relaxed">
          Choose the name other players will see on the leaderboard.
        </p>

        {/* Input */}
        <div className="mb-6">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter your username"
            maxLength={32}
            disabled={isLoading}
            className="w-full font-mono text-sm bg-[rgba(0,255,136,0.05)] border-2 border-[rgba(0,255,136,0.3)] text-null-green placeholder-null-muted px-4 py-3 focus:outline-none focus:border-null-green transition-colors"
            style={{
              clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
            }}
          />
          <p className="text-null-muted font-mono text-[10px] mt-2 tracking-[1px]">
            {username.length}/32
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-[rgba(255,59,48,0.2)] border border-[rgba(255,59,48,0.5)] text-null-red font-mono text-xs">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !username.trim()}
            className="w-full font-mono text-sm tracking-[2px] uppercase text-null-bg bg-null-green px-6 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'var(--null-acid)'
                el.style.boxShadow = '0 0 20px rgba(0,255,136,0.5)'
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--null-green)'
              el.style.boxShadow = 'none'
            }}
          >
            {isLoading ? '// REGISTERING...' : '✓ CONFIRM'}
          </button>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full font-mono text-sm tracking-[2px] uppercase text-null-muted border border-[rgba(0,255,136,0.3)] px-6 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[rgba(0,255,136,0.05)]"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}
          >
            ✕ CANCEL
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 pt-6 border-t border-[rgba(0,255,136,0.2)]">
          <p className="font-mono text-[10px] text-null-muted leading-relaxed tracking-[1px]">
            Saved to your NULL_STATE account — not written to the blockchain.
            <br />
            Other players can see it. You can change it any time in Settings.
          </p>
        </div>
      </div>
    </div>
  )
}
