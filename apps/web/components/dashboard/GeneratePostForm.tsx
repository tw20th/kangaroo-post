// apps/web/components/dashboard/GeneratePostForm.tsx
"use client";

import { useState } from "react";

export default function GeneratePostForm() {
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResultMessage(null);

    if (!title.trim()) {
      setResultMessage("テーマやタイトルを一言だけでも入力してください。");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        slug?: string;
        title?: string;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setResultMessage(
          json.error ??
            "生成に失敗しました。少し時間をおいてもう一度お試しください。"
        );
        return;
      }

      setResultMessage(
        `「${json.title}」の下書きを作成しました。（slug: ${json.slug}）`
      );
      setTitle("");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">記事のテーマ / タイトル</span>
        <p className="text-[11px] text-gray-500">
          「いま書きたいこと」を一文だけ入れても大丈夫です。あとはこちらで下書きを用意します。
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
          生成された記事は
          <span className="font-semibold">「下書き」</span>
          として保存されます。公開前に、必要に応じて手直ししてください。
        </p>
      </div>

      {resultMessage && (
        <p className="text-xs text-gray-700">{resultMessage}</p>
      )}
    </form>
  );
}
