// apps/web/hooks/useWorkspace.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@kangaroo-post/shared-types";
import { fetchWorkspace } from "../lib/api/workspaces";

type UseWorkspaceResult = {
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useWorkspace(workspaceId: string | null): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // ✅ workspaceId が無いときも「loading を false に戻す」(ここが重要)
    if (!workspaceId) {
      setWorkspace(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchWorkspace(workspaceId);
      setWorkspace(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load workspace";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    workspace,
    loading,
    error,
    reload: load,
  };
}
