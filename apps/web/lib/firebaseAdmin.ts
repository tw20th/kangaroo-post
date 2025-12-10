// apps/web/lib/firebaseAdmin.ts
import {
  getApps,
  initializeApp,
  cert,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

// 環境変数チェック（必要ならあとでゆるめてもOK）
if (!projectId || !clientEmail || !rawPrivateKey) {
  throw new Error(
    "Missing Firebase admin credentials (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)"
  );
}

// GitHub Actions や .env で `\n` になっているのを復元
const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

const serviceAccount: ServiceAccount = {
  projectId,
  clientEmail,
  privateKey,
};

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

export const adminDb = getFirestore(app);

// ★ Next.js 側から使えるように FieldValue も export
export { FieldValue };
