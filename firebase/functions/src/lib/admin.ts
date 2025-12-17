// firebase/functions/src/lib/admin.ts
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { https } from "firebase-functions/v1";

if (!getApps().length) {
  initializeApp();
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();

/** Authorization: Bearer <ID_TOKEN> から uid を取得（必須） */
export async function requireUid(req: https.Request): Promise<string> {
  const header = req.get("Authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error("missing_authorization");
  }

  const idToken = match[1];
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}
