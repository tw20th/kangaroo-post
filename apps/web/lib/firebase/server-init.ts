// apps/web/lib/firebase/server-init.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";

// すでに初期化済みなら何もしない
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // .env では改行が \n になっている前提
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ここで getFirestore() してもいいけど、
// 今回は「初期化だけ」なので export は不要でもOK。
// 必要なら↓を生やしてもいいです。
// export const dbAdmin = getFirestore();
