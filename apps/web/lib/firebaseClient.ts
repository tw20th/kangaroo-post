// apps/web/lib/firebaseClient.ts
"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID!,
};

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
const authEmulatorHost =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getClientApp(): FirebaseApp {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApp();
}

export function getClientAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const auth = getAuth(getClientApp());

  // ✅ 端末リロードでも currentUser を維持（これ大事）
  void setPersistence(auth, browserLocalPersistence);

  // ✅ Emulator接続（複数回呼ぶと警告出るので try/catch）
  if (useEmulator) {
    try {
      const host = authEmulatorHost.replace(/^https?:\/\//, "");
      connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
    } catch {
      // ignore
    }
  }

  cachedAuth = auth;
  return auth;
}

export function getClientDb(): Firestore {
  if (cachedDb) return cachedDb;

  const db = getFirestore(getClientApp());

  if (useEmulator) {
    try {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch {
      // ignore
    }
  }

  cachedDb = db;
  return db;
}
