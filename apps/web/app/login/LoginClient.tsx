// apps/web/app/login/LoginClient.tsx
"use client";

import { useState } from "react";
import { loginWithGoogle } from "@/lib/auth/client";

export default function LoginClient() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    // eslint-disable-next-line no-console
    console.log("[login] click");

    setError(null);
    setBusy(true);

    try {
      await loginWithGoogle();
      // eslint-disable-next-line no-console
      console.log("[login] success -> redirect");
      window.location.href = "/dashboard";
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[login] failed", e);
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">ログイン</h1>

      <button
        onClick={handleLogin}
        disabled={busy}
        className="mt-6 rounded-full bg-emerald-600 px-6 py-3 text-white disabled:opacity-60"
      >
        {busy ? "ログイン中..." : "Googleでログイン"}
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
