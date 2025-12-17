// apps/web/lib/auth/client.ts
"use client";

import { getClientAuth } from "@/lib/firebaseClient";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { signOut } from "firebase/auth";

export async function loginWithGoogle(): Promise<void> {
  console.log("[auth] start");

  const auth = getClientAuth();
  const provider = new GoogleAuthProvider();

  console.log("[auth] popup start");
  const result = await signInWithPopup(auth, provider);

  console.log("[auth] signed in", result.user.uid);
  const idToken = await result.user.getIdToken();

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const text = await res.text();
  console.log("[auth] session response", res.status, text);

  if (!res.ok) throw new Error(`session failed: ${res.status}`);
}
export async function logout(): Promise<void> {
  const auth = getClientAuth();

  // Firebase側を落とす
  await signOut(auth);

  // サーバー側 cookie も落とす
  await fetch("/api/auth/logout", { method: "POST" });

  // 画面遷移
  window.location.href = "/login";
}
