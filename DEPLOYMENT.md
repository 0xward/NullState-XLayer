# NullState Deployment Guide

## 1. Prerequisites
- Vercel project linked to this repository
- Firebase Realtime Database created
- Service account JSON for Firebase Admin SDK
- Contract addresses deployed on Celo mainnet

## 2. Required Environment Variables
Set these in Vercel Project Settings → Environment Variables:

- `NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_TREASURE_VAULT_ADDRESS`
- `NEXT_PUBLIC_CELO_RPC`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT`
- `BACKEND_PRIVATE_KEY`
- `CELO_RPC_URL`

## 3. Build and Verify Locally
```bash
npm install
npm run lint
npm run build
```

## 4. Firebase Verification
- Confirm `vaultCodes`, `vaultAttempts`, `vaultCompleted`, `leaderboards`, and `playerProfiles` paths exist.
- Confirm write access for backend service account.

## 5. Deploy
```bash
vercel --prod
```

## 6. Post-Deploy Checks
- `GET /api/vault/status`
- `POST /api/vault/submit`
- `GET /api/leaderboard`
- `GET /api/player/profile`
- Confirm `/game`, `/leaderboard`, `/profile` render correctly.
