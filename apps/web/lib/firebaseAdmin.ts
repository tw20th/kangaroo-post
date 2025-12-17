// apps/web/lib/firebaseAdmin.ts
import {
  getApps,
  initializeApp,
  cert,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * ✅ Next.js(API) 側の Admin SDK も Auth Emulator を見る
 * - firebase/functions/.env には書けない（firebase-tools 予約）
 * - でも apps/web 側の Node なら OK
 *
 * NOTE:
 *   Auth Emulator は "127.0.0.1:9099" の形式（プロトコルなし）を想定
 */
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
if (useEmulator) {
  const host = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (host) {
    // "http://127.0.0.1:9099" みたいなのが来ても耐える
    process.env.FIREBASE_AUTH_EMULATOR_HOST = host.replace(/^https?:\/\//, "");
  }
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !rawPrivateKey) {
  throw new Error(
    "Missing Firebase admin credentials (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)"
  );
}

const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey };

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export { FieldValue };
