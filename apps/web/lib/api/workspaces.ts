// apps/web/lib/api/workspaces.ts
import type { Workspace } from "@kangaroo-post/shared-types";

type ApiOk<T> = { ok: true; workspace: T };
type ApiNg = { ok: false; error?: string };

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();

  // ✅ body が空なら「成功だけした」とみなす（APIが204/空bodyで返る場合）
  if (!text) {
    return null as T;
  }

  const json = JSON.parse(text) as ApiOk<T> | ApiNg;

  if (!res.ok || !("ok" in json) || json.ok === false) {
    const msg =
      (json as ApiNg).error ?? `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return (json as ApiOk<T>).workspace;
}

/** 自分の workspace（なければ null） */
export async function fetchMyWorkspaceApi(): Promise<Workspace | null> {
  const res = await fetch("/api/workspaces", { method: "GET" });
  return handle<Workspace | null>(res);
}

/** id 指定で取得 */
export async function fetchWorkspace(id: string): Promise<Workspace | null> {
  const res = await fetch(`/api/workspaces?id=${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return handle<Workspace | null>(res);
}

/** 新規 or 既存に upsert（POST で統一） */
export async function upsertWorkspaceApi(payload: {
  siteName: string;
  topUrl: string;
  blogSectionLabel?: string;
  blogSectionSlug: string;
  widgetEnabled?: boolean;
  widgetLimit?: number;
  industry?: string;
  keywordPreferences?: string;
  wpUrl?: string;
  wpUser?: string;
  wpAppPassword?: string;
}): Promise<Workspace> {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handle<Workspace>(res);
}

/** id 指定で部分更新（PATCH） */
export async function patchWorkspaceApi(
  id: string,
  payload: Partial<{
    siteName: string;
    topUrl: string;
    blogSectionLabel?: string;
    blogSectionSlug: string;
    widgetEnabled?: boolean;
    widgetLimit?: number;
    industry?: string;
    keywordPreferences?: string;
    wpUrl?: string;
    wpUser?: string;
    wpAppPassword?: string;
  }>
): Promise<Workspace> {
  const res = await fetch(`/api/workspaces?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handle<Workspace>(res);
}
