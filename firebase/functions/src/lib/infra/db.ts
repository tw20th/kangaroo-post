// firebase/functions/src/lib/infra/db.ts

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Firestore, Settings } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ✅ ここを kangaroo-post 用に
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID || // .env から読めるように
  "kangaroo-post"; // 最後のデフォルトも kangaroo-post に

const BUCKET =
  process.env.STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;

if (getApps().length === 0) {
  initializeApp({
    projectId: PROJECT_ID,
    storageBucket: BUCKET,
  });
}

// Firestore シングルトン
declare global {
  // eslint-disable-next-line no-var
  var __A8AFFILIATE_DB__: Firestore | undefined;
}

export const db: Firestore =
  globalThis.__A8AFFILIATE_DB__ ??
  (globalThis.__A8AFFILIATE_DB__ = getFirestore());

// ここで一度だけ設定（他所で settings() を呼ばない）
const settings: Settings = { ignoreUndefinedProperties: true };
db.settings(settings);

// Storage（必要なところから import して使う）
export const bucket = () => getStorage().bucket();
