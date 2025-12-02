// apps/web/components/admin/AnalysisHistoryPanel.tsx
"use client";

import { useMemo, useState } from "react";
import type { BlogAdminView, BlogAnalysisEntry } from "@/types/blog";

type Props = {
  blog: BlogAdminView;
};

/**
 * history の i 番目と、ひとつ前の i-1 番目をセットにして
 * 「Before → After」として扱うための型
 */
type HistoryPair = {
  index: number;
  current: BlogAnalysisEntry;
  prevTitle: string;
  prevOutline: string | null;
  beforeScore: number | null;
  afterScore: number;
};

function formatDateTimeJst(ms: number): string {
  if (!ms) return "-";
  const d = new Date(ms);
  // 表示だけ JST に寄せる（実際のタイムゾーンは好みで）
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/**
 * analysisHistory から「Before/After 比較用」の配列を生成
 * - 0番目のエントリは「Before が無い」ので、ブログの元タイトルを Before として扱う
 * - それ以降は「ひとつ前の titleSuggestion / outlineSuggestion」を Before として扱う
 */
function buildPairs(
  blogTitle: string,
  history: BlogAnalysisEntry[]
): HistoryPair[] {
  if (history.length === 0) return [];

  const pairs: HistoryPair[] = [];

  history.forEach((entry, index) => {
    const prevEntry = index > 0 ? history[index - 1] : null;

    const prevTitle =
      (prevEntry?.titleSuggestion && prevEntry.titleSuggestion.trim()) ||
      blogTitle;

    const prevOutline =
      prevEntry?.outlineSuggestion && prevEntry.outlineSuggestion.trim()
        ? prevEntry.outlineSuggestion
        : null;

    const beforeScore =
      prevEntry && typeof prevEntry.score === "number"
        ? Number(prevEntry.score)
        : null;

    pairs.push({
      index,
      current: entry,
      prevTitle,
      prevOutline,
      beforeScore,
      afterScore: Number(entry.score),
    });
  });

  return pairs;
}

export function AnalysisHistoryPanel({ blog }: Props) {
  const pairs = useMemo(
    () => buildPairs(blog.title, blog.analysisHistory),
    [blog.title, blog.analysisHistory]
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    pairs.length ? pairs.length - 1 : null
  );

  if (!pairs.length) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        このブログには analysisHistory がまだありません。
      </div>
    );
  }

  const selected =
    selectedIndex !== null
      ? pairs.find((p) => p.index === selectedIndex) ?? pairs[pairs.length - 1]
      : pairs[pairs.length - 1];

  return (
    <div className="space-y-6">
      {/* ヘッダ */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            分析履歴（タイトル / 見出し Before → After）
          </h2>
          <p className="text-xs text-gray-500">
            analysisHistory の titleSuggestion / outlineSuggestion を
            ステップごとに比較表示します。
          </p>
        </div>

        {/* 履歴セレクタ */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">履歴を選択:</span>
          <select
            className="rounded-md border px-2 py-1 text-xs"
            value={selected.index}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {pairs.map((p) => (
              <option key={p.index} value={p.index}>
                #{p.index + 1} / {formatDateTimeJst(p.current.createdAt)} (
                {p.current.source})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* スコア Before / After */}
      <div className="grid gap-4 rounded-xl border bg-white p-4 text-xs md:grid-cols-3">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-gray-500">
            選択中の履歴
          </div>
          <div className="text-sm font-semibold">
            #{selected.index + 1} /{" "}
            {formatDateTimeJst(selected.current.createdAt)}
          </div>
          <div className="text-[11px] text-gray-500">
            source: <span className="font-mono">{selected.current.source}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-gray-500">
            スコア Before → After
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-mono text-gray-500">
              {selected.beforeScore ?? "-"}
            </span>
            <span className="text-[10px] text-gray-400">→</span>
            <span className="font-mono text-emerald-600">
              {selected.afterScore}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-gray-500">
            改善ポイント（suggestions）
          </div>
          {selected.current.suggestions &&
          selected.current.suggestions.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {selected.current.suggestions.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] text-gray-400">なし</div>
          )}
        </div>
      </div>

      {/* タイトル Before / After */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-xs font-semibold text-gray-500">
            タイトル Before
          </div>
          <div className="text-sm font-medium leading-relaxed">
            {selected.prevTitle}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-xs font-semibold text-gray-500">
            タイトル After（titleSuggestion）
          </div>
          <div className="text-sm font-medium leading-relaxed">
            {selected.current.titleSuggestion || blog.title}
          </div>
        </div>
      </div>

      {/* 見出し（アウトライン） Before / After */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-xs font-semibold text-gray-500">
            見出し Before
          </div>
          {selected.prevOutline ? (
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800">
              {selected.prevOutline}
            </pre>
          ) : (
            <div className="text-[11px] text-gray-400">
              ひとつ前の履歴に outlineSuggestion がありません。
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-2 text-xs font-semibold text-gray-500">
            見出し After（outlineSuggestion）
          </div>
          {selected.current.outlineSuggestion ? (
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-900">
              {selected.current.outlineSuggestion}
            </pre>
          ) : (
            <div className="text-[11px] text-gray-400">
              この履歴には outlineSuggestion がありません。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
