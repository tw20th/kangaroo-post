// apps/web/app/admin/pain-stats/page.tsx
import { getServerSiteId } from "@/lib/site-server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

type PainMetrics = {
  views: number;
  viewCtr: number;
  compareClicks: number;
  compareCtr: number;
  ctaClicks: number;
  ctaCtr: number;
  score: number;
};

type PainStatsDoc = {
  siteId: string;
  date: string;
  pains: Record<string, PainMetrics>;
};

function formatPercent(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "-";
  return value.toString();
}

export default async function PainStatsPage() {
  const siteId = getServerSiteId();
  const db = adminDb();

  // 最新の日付の painStats を1件だけ取得
  const snap = await db
    .collection("painStats")
    .where("siteId", "==", siteId)
    .orderBy("date", "desc")
    .limit(1)
    .get();

  if (snap.empty) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold mb-4">悩み別パフォーマンス</h1>
        <p className="text-sm text-gray-600">
          まだ集計されたデータがありません。ブログのビューと compare
          クリックが溜まると、ここに表示されます。
        </p>
      </main>
    );
  }

  const doc = snap.docs[0];
  const data = doc.data() as PainStatsDoc;
  const { date, pains } = data;

  const rows = Object.entries(pains ?? {}).map(([painId, metrics]) => ({
    painId,
    ...metrics,
  }));

  // スコアの高い順に並べ替え
  rows.sort((a, b) => b.score - a.score);

  const maxScore =
    rows.length > 0 ? Math.max(...rows.map((r) => r.score || 0), 1) : 1;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">悩み別パフォーマンス</h1>
      <p className="text-sm text-gray-600">
        siteId: <code className="px-1 rounded bg-gray-100">{siteId}</code> ／
        日付: <span>{date}</span>
      </p>

      <section className="mt-6 rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">painId ごとの集計</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-600">
            pains の中にまだデータがありません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left">painId</th>
                  <th className="px-3 py-2 text-right">ビュー数</th>
                  <th className="px-3 py-2 text-right">compare クリック</th>
                  <th className="px-3 py-2 text-right">compare CTR</th>
                  <th className="px-3 py-2 text-right">CTA クリック</th>
                  <th className="px-3 py-2 text-right">CTA CTR</th>
                  <th className="px-3 py-2 text-right w-64">
                    スコア（簡易グラフ）
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const scoreRatio =
                    maxScore > 0 ? Math.max(0, row.score / maxScore) : 0;
                  const barWidth = `${Math.round(scoreRatio * 100)}%`;

                  return (
                    <tr key={row.painId} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs sm:text-sm">
                        {row.painId}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNumber(row.views)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNumber(row.compareClicks)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatPercent(row.compareCtr)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNumber(row.ctaClicks)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatPercent(row.ctaCtr)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: barWidth }}
                            />
                          </div>
                          <span className="w-16 text-right tabular-nums text-xs sm:text-sm">
                            {row.score.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          スコアは「ビュー・compare クリック・CTA
          クリック」を重み付けした簡易指標です。値が大きいほど、その
          painId（悩みキーワード）が今日よく反応しているイメージです。
        </p>
      </section>
    </main>
  );
}
