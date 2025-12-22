// apps/web/components/dashboard/GeneratePostForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type GeneratePostResponse = {
  ok?: boolean;
  slug?: string;
  title?: string;
  editUrl?: string;
  embedUrl?: string;
  error?: string;
};

type Props = {
  workspaceId: string;
  mode?: "test" | "normal";
  seed?: string; // ✅ 追加（Server から渡してもOK）
};

function pickErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "error" in json) {
    const e = (json as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return fallback;
}

function clampSeed(s: string): string {
  // ✅ 事故防止：長すぎるseedは切る（必要なければ数字だけ調整 or 削除OK）
  return s.slice(0, 200);
}

export default function GeneratePostForm({
  workspaceId,
  mode = "normal",
  seed,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ seed の取得元を一本化
  // - props.seed があればそれを優先
  // - なければ URL の ?seed=... を拾う
  const seedFromUrl = useMemo(() => {
    const s = searchParams?.get("seed");
    return typeof s === "string" ? s : "";
  }, [searchParams]);

  const initialSeed = useMemo(() => {
    const s = (
      typeof seed === "string" && seed.length > 0 ? seed : seedFromUrl
    ).trim();
    return s ? clampSeed(s) : "";
  }, [seed, seedFromUrl]);

  const [title, setTitle] = useState<string>("");

  // ✅ seed 初期値セット & 使い終わったらURLから seed を消す（体験の肝）
  useEffect(() => {
    if (!initialSeed) return;

    setTitle((prev) => {
      // すでに何か入力されてたら上書きしない（安全）
      if (prev && prev.trim().length > 0) return prev;
      return initialSeed;
    });

    // props.seed で渡されてる場合はURLにseedがない可能性もあるので、
    // URLに seed が存在する時だけ消す
    const hasSeedInUrl = Boolean(searchParams?.get("seed"));
    if (hasSeedInUrl) {
      // ✅ クエリだけ消す（入力は残る）
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeed, router, pathname]);

  const [isLoading, setIsLoading] = useState(false);

  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editUrl, setEditUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResultMessage(null);
    setError(null);
    setEditUrl(null);

    const trimmed = title.trim();
    if (!trimmed) {
      setError("テーマを一言だけでも入力してみてください。");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, workspaceId }),
      });

      const json = (await res
        .json()
        .catch(() => null)) as GeneratePostResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(
          pickErrorMessage(
            json,
            "生成に失敗しました。少し時間をおいてもう一度お試しください。"
          )
        );
      }

      const createdTitle =
        typeof json.title === "string" ? json.title : "下書き";

      setResultMessage(
        mode === "test"
          ? `テスト記事「${createdTitle}」を作りました。編集してみましょう。`
          : `「${createdTitle}」の下書きを作成しました。`
      );

      setEditUrl(typeof json.editUrl === "string" ? json.editUrl : null);
      setTitle("");

      // ✅ Server Componentの一覧再取得
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "通信エラーが発生しました。";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const disabled = isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          {mode === "test" ? "テスト記事のテーマ" : "記事のテーマ / タイトル"}
        </span>
        <p className="text-[11px] text-gray-500">
          {mode === "test"
            ? "一文だけでOKです。まずは1本作って、編集画面を見てみましょう。"
            : "「いま書きたいこと」を一文だけでも大丈夫です。あとは下書きを用意します。"}
        </p>

        <textarea
          className="w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          rows={3}
          placeholder={
            mode === "test"
              ? "例：更新が続かないときに、ムリなく記事を増やすコツ"
              : "例：更新が続かないときに、ムリなく記事を増やすコツ について書きたい"
          }
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
          {isLoading
            ? "下書きを作成しています…"
            : mode === "test"
            ? "テスト記事を作る"
            : "下書きを自動生成する"}
        </button>

        <p>
          生成された記事は <span className="font-semibold">「下書き」</span>{" "}
          として保存されます。公開前に必要に応じて手直ししてください。
        </p>
      </div>

      {resultMessage && (
        <p className="text-xs text-emerald-700">{resultMessage}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {editUrl && (
        <div className="space-y-2 rounded-xl border bg-white p-3 text-xs">
          <a
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            href={editUrl}
          >
            編集画面を開く
          </a>
          <p className="text-[11px] text-gray-500">
            ※ 次に「公開する」を押すと、サイトに表示できるようになります。
          </p>
        </div>
      )}
    </form>
  );
}
