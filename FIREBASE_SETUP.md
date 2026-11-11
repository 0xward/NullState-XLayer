# Firebase Setup Guide

## Prerequisites

- Firebase project created (https://console.firebase.google.com)
- Node.js 16+ installed
- Admin SDK credentials

## 1. Install Firebase

```bash
npm install firebase-admin firebase
```

## 2. Initialize Firebase Admin SDK

```typescript
// backend/firebase.ts
import * as admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY!);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

export const db = admin.database();
export const auth = admin.auth();
```

## 3. Database Structure Setup

```typescript
// backend/setup/initializeDatabase.ts
export async function initializeDatabase() {
  const db = admin.database();
  
  // Create root nodes
  await db.ref('games').set(null);
  await db.ref('vaultCodes').set(null);
  await db.ref('leaderboards').set(null);
  await db.ref('burnRecords').set(null);
  await db.ref('playerProfiles').set(null);
  
  console.log('Database structure initialized');
}
```

## 4. Security Rules

In Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "games": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "vaultCodes": {
      ".read": true,
      ".write": "root.child('backends').child(auth.uid).val() === true"
    },
    "leaderboards": {
      ".read": true,
      ".write": "root.child('backends').child(auth.uid).val() === true"
    }
  }
}
```

## 5. Backup & Restore

```bash
# Export database
gcloud firestore export gs://my-bucket/backup-$(date +%s)

# Import from backup
gcloud firestore import gs://my-bucket/backup-123456
```

---

For production, enable backups in Firebase Console settings.
