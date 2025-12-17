// apps/web/components/dashboard/BlogEditorForm.tsx
"use client";

import { useMemo, useState } from "react";

type Props = {
  slug: string;
  initialTitle: string;
  initialContent: string;
  initialStatus: "draft" | "published" | string;
};

type ApiResponse =
  | { ok: true; post: { title?: string; content?: string; status?: string } }
  | { ok: false; error?: string };

type PublishResponse =
  | { ok: true; status: string; workspaceId: string }
  | { ok: false; error?: string };

type WpPublishResponse =
  | {
      ok: true;
      wpPostId: number | null;
      wpLink: string | null;
      wpStatus: string | null;
    }
  | { ok: false; error?: string };

function pickErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "error" in json) {
    const e = (json as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return fallback;
}

export default function BlogEditorForm({
  slug,
  initialTitle,
  initialContent,
  initialStatus,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<string>(initialStatus);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [wpPublishing, setWpPublishing] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const [wpLink, setWpLink] = useState<string | null>(null);
  const [wpPostId, setWpPostId] = useState<number | null>(null);
  const [wpStatus, setWpStatus] = useState<string | null>(null);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!title.trim()) return false;
    return true;
  }, [saving, title]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/posts?slug=${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          status: status === "published" ? "published" : "draft",
        }),
      });

      const json = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || !json || json.ok === false) {
        throw new Error(
          pickErrorMessage(json, `Request failed with status ${res.status}`)
        );
      }

      setTitle(json.post.title ?? title);
      setContent(json.post.content ?? content);
      setStatus(json.post.status ?? status);

      setMessage("保存しました。");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存に失敗しました";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      const json = (await res
        .json()
        .catch(() => null)) as PublishResponse | null;

      if (!res.ok || !json || json.ok === false) {
        throw new Error(
          pickErrorMessage(json, `Request failed with status ${res.status}`)
        );
      }

      setStatus("published");
      setMessage("公開しました。相手サイト側の埋め込み表示にも反映されます。");

      setEmbedUrl(`/embed/${encodeURIComponent(json.workspaceId)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "公開に失敗しました";
      setError(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function publishToWp() {
    setWpPublishing(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/wp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      const json = (await res
        .json()
        .catch(() => null)) as WpPublishResponse | null;

      if (!res.ok || !json || json.ok === false) {
        throw new Error(
          pickErrorMessage(json, `Request failed with status ${res.status}`)
        );
      }

      setWpLink(json.wpLink ?? null);
      setWpPostId(json.wpPostId ?? null);
      setWpStatus(json.wpStatus ?? null);

      setMessage("WordPressに投稿しました。");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "WordPress投稿に失敗しました";
      setError(msg); // ✅ 失敗理由をそのまま出す
    } finally {
      setWpPublishing(false);
    }
  }

  const iframeCode = embedUrl
    ? `<iframe src="${embedUrl}" style="width:100%;border:0;" loading="lazy"></iframe>`
    : null;

  return (
    <section className="space-y-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">編集</h2>
        <p className="text-xs text-gray-600">
          タイトルと本文を直して「保存」できます。公開はワンクリックでもOKです。
        </p>
      </header>

      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-3">
        <label className="flex flex-col gap-1 text-xs">
          タイトル
          <input
            className="rounded-lg border px-2 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトル"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          ステータス
          <select
            className="rounded-lg border px-2 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">下書き（draft）</option>
            <option value="published">公開（published）</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          本文（Markdown）
          <textarea
            className="min-h-[260px] rounded-lg border px-2 py-2 text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="本文"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {saving ? "保存中..." : "保存"}
          </button>

          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing || saving || !title.trim()}
            className="rounded-full border border-emerald-600 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing ? "公開中..." : "公開する"}
          </button>

          {/* ✅ WP投稿ボタン（新規） */}
          <button
            type="button"
            onClick={() => void publishToWp()}
            disabled={wpPublishing || saving || !title.trim()}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            title="WordPressへ自動投稿"
          >
            {wpPublishing ? "WP投稿中..." : "WPへ投稿"}
          </button>
        </div>

        {/* ✅ WP投稿結果表示（新規） */}
        {(wpLink || wpPostId || wpStatus) && (
          <div className="space-y-1 rounded-xl border bg-white p-3 text-xs">
            <div className="font-semibold">WordPress 投稿結果</div>
            {wpStatus && <div>status: {wpStatus}</div>}
            {typeof wpPostId === "number" && <div>postId: {wpPostId}</div>}
            {wpLink && (
              <a
                className="text-emerald-700 underline"
                href={wpLink}
                target="_blank"
                rel="noreferrer"
              >
                {wpLink}
              </a>
            )}
          </div>
        )}

        {embedUrl && (
          <div className="space-y-1 rounded-xl border bg-white p-3 text-xs">
            <div className="font-semibold">埋め込みページ</div>
            <a className="text-emerald-700 underline" href={embedUrl}>
              {embedUrl}
            </a>

            {iframeCode && (
              <>
                <div className="mt-2 font-semibold">
                  埋め込みコード（iframe）
                </div>
                <textarea
                  readOnly
                  className="w-full rounded-lg border px-2 py-2 font-mono text-[11px]"
                  rows={3}
                  value={iframeCode}
                />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
