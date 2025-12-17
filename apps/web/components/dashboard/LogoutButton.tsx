"use client";

import { logout } from "@/lib/auth/client";

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => logout()}
      className="rounded-full border px-3 py-2 text-xs font-semibold shadow-sm"
    >
      ログアウト
    </button>
  );
}
