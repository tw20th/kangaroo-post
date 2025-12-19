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
 * Admin SDK を Emulator に向ける
 * - Admin SDK は connectFirestoreEmulator() が使えないので env で切り替える
 * - initializeApp より前に env を確定させるのが重要
 */
const useEmulator =
  process.env.USE_FIREBASE_EMULATOR === "true" ||
  process.env.NODE_ENV === "development";

if (useEmulator) {
  // Auth emulator
  const authHost =
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (authHost) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost.replace(
      /^https?:\/\//,
      ""
    );
  }

  // Firestore emulator（これが無いのが今回の原因）
  const fsHost =
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
  if (fsHost) {
    process.env.FIRESTORE_EMULATOR_HOST = fsHost.replace(/^https?:\/\//, "");
  }

  // project 保険（任意だけど入れておくと安定）
  process.env.GCLOUD_PROJECT ||= "kangaroo-post";
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
