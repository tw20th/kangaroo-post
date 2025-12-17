"use client";

import { useState } from "react";
import { fetchMyWorkspaceApi } from "@/lib/api/workspaces";
import type { Workspace } from "@kangaroo-post/shared-types";

export default function DebugWorkspaceFetch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="space-y-2 rounded-2xl border bg-white/70 p-4 shadow-sm">
      <div className="text-sm font-semibold">Debug: Workspace</div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            setResult(null);

            try {
              const ws = await fetchMyWorkspaceApi();
              setResult(ws);
              // ここも見たいはず
              // eslint-disable-next-line no-console
              console.log("fetchMyWorkspaceApi =>", ws);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "unknown error";
              setError(msg);
              // eslint-disable-next-line no-console
              console.error("fetchMyWorkspaceApi error:", e);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "fetching..." : "fetchMyWorkspaceApi()"}
        </button>

        <span className="text-xs text-gray-500">
          ※ DevTools の Console も見てね
        </span>
      </div>

      {error && <div className="text-xs text-red-600">error: {error}</div>}

      <pre className="max-h-56 overflow-auto rounded-xl bg-gray-50 p-3 text-xs">
        {result === null ? "result: null" : JSON.stringify(result, null, 2)}
      </pre>
    </section>
  );
}
