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
        setResultMessage(json.error ?? "生成に失敗しました。");
        return;
      }

      setResultMessage(
        `「${json.title}」の下書きを作成しました。（slug: ${json.slug}）`
      );
      setTitle("");
    } catch (err) {
      console.error(err);
      setResultMessage("通信エラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">記事のテーマ / タイトル</span>
        <textarea
          className="w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          rows={3}
          placeholder="例：『更新が続かないときに、ムリなく記事を増やすコツ』 など"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <button
        type="submit"
        className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
      >
        {isLoading ? "生成中です…" : "記事を自動生成する"}
      </button>

      {resultMessage && (
        <p className="text-xs text-gray-600">{resultMessage}</p>
      )}
    </form>
  );
}
