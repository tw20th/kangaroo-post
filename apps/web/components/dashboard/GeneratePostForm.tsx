"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMyWorkspaceApi } from "@/lib/api/workspaces";

type GeneratePostResponse = {
  ok?: boolean;
  slug?: string;
  title?: string;
  editUrl?: string;
  embedUrl?: string;
  error?: string;
};

export default function GeneratePostForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await fetchMyWorkspaceApi();
        const carrier = me as unknown as { id?: unknown };
        const id = typeof carrier?.id === "string" ? carrier.id : null;

        if (!cancelled) setWorkspaceId(id);
      } catch {
        if (!cancelled) setWorkspaceId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResultMessage(null);
    setEditUrl(null);
    setEmbedUrl(null);

    if (!title.trim()) {
      setResultMessage("テーマやタイトルを一言だけでも入力してください。");
      return;
    }

    if (!workspaceId) {
      setResultMessage("先に「サイト設定（Workspace）」を保存してください。");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, workspaceId }),
      });

      const json = (await res
        .json()
        .catch(() => null)) as GeneratePostResponse | null;

      if (!res.ok || !json?.ok) {
        setResultMessage(
          json?.error ??
            "生成に失敗しました。少し時間をおいてもう一度お試しください。"
        );
        return;
      }

      setResultMessage(`「${json.title}」の下書きを作成しました。`);
      setEditUrl(json.editUrl ?? null);
      setEmbedUrl(json.embedUrl ?? null);
      setTitle("");

      // ✅ ここが追加：Server Component の一覧を再取得させる
      router.refresh();
    } catch (err) {
      console.error(err);
      setResultMessage(
        "通信エラーが発生しました。ネットワーク環境をご確認ください。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  const disabled = isLoading;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const embedCode = embedUrl
    ? `<iframe src="${appUrl}${embedUrl}" style="width:100%;border:0;" loading="lazy"></iframe>`
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* 以下そのまま */}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">記事のテーマ / タイトル</span>
        <p className="text-[11px] text-gray-500">
          「いま書きたいこと」を一文だけでも大丈夫です。あとはこちらで下書きを用意します。
        </p>
        <textarea
          className="w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          rows={3}
          placeholder="例：更新が続かないときに、ムリなく記事を増やすコツ について書きたい"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
      </label>

      <div className="flex flex-col gap-2 text-xs text-gray-600">
        <button
          type="submit"
          className="inline-flex items-center self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
        >
          {isLoading ? "下書きを作成しています…" : "下書きを自動生成する"}
        </button>
        <p>
          生成された記事は <span className="font-semibold">「下書き」</span>{" "}
          として保存されます。 公開前に、必要に応じて手直ししてください。
        </p>
      </div>

      {resultMessage && (
        <p className="text-xs text-gray-700">{resultMessage}</p>
      )}

      {(editUrl || embedUrl) && (
        <div className="space-y-2 rounded-xl border bg-white p-3 text-xs">
          {editUrl && (
            <p>
              編集URL：{" "}
              <a className="text-emerald-700 underline" href={editUrl}>
                {editUrl}
              </a>
            </p>
          )}

          {embedUrl && (
            <>
              <p>
                埋め込みページ：{" "}
                <a className="text-emerald-700 underline" href={embedUrl}>
                  {embedUrl}
                </a>
              </p>

              {embedCode && (
                <div className="space-y-1">
                  <div className="font-semibold">埋め込みコード（iframe）</div>
                  <textarea
                    readOnly
                    className="w-full rounded-lg border px-2 py-2 font-mono text-[11px]"
                    rows={3}
                    value={embedCode}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}
