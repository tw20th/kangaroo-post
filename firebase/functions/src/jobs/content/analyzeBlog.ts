// firebase/functions/src/jobs/content/analyzeBlog.ts
import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { analyzeSeo } from "../../lib/seo/analyzeSeo.js"; // ← alias = analyzeMarkdown

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

type SeoChecks = Record<string, boolean | number>;

// 当日0:00 JST の epoch(ms)
function startOfTodayJST(): number {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  jst.setHours(0, 0, 0, 0);
  return jst.getTime();
}

/**
 * 本文から内部リンク / CTA / テーブルなどの簡易メトリクスを抽出
 */
function extractContentMetrics(markdown: string): {
  internalLinkCount: number;
  ctaCount: number;
  hasTableDetected: boolean;
} {
  // 相対パスの Markdown リンクを「内部リンク」とみなす
  const internalLinkRegex = /\[[^\]]+]\((\/[^)]+)\)/g;
  let internalLinkCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (internalLinkRegex.exec(markdown)) {
    internalLinkCount += 1;
  }

  // A8系を想定した「公式サイトを見る」系 CTA 文言を検知
  const ctaRegex =
    /\[[^\]]*(公式サイト|詳細を見る|詳しく見る|申し込|チェック|レンタルする|資料請求)[^\]]*]\([^)]+?\)/g;
  const ctaMatches = markdown.match(ctaRegex);
  const ctaCount = ctaMatches ? ctaMatches.length : 0;

  // Markdownテーブルっぽい行があるか
  // 例:
  // | 見出しA | 見出しB |
  // | ------ | ------ |
  const hasTableDetected =
    /\n\|[^|\n]+\|[^|\n]*\n\|[ :\-|]+\|/m.test(markdown) ||
    /\n\|[^|\n]+\|[^|\n]*\n\|[^|\n]*-+[^|\n]*\|/m.test(markdown);

  return {
    internalLinkCount,
    ctaCount,
    hasTableDetected,
  };
}

function suggestionsFromChecks(checks: SeoChecks, type?: string): string[] {
  const s: string[] = [];

  const bool = (key: string): boolean =>
    typeof checks[key] === "boolean" ? (checks[key] as boolean) : false;
  const num = (key: string): number =>
    typeof checks[key] === "number" ? (checks[key] as number) : 0;

  if (!bool("hasHeadings")) {
    s.push("H2/H3の見出しを追加して構造化");
  }
  if (!bool("hasList")) {
    s.push("箇条書きで要点を整理");
  }

  const internalLinkCount = num("internalLinkCount");
  if (internalLinkCount === 0) {
    s.push("本文中に関連記事への内部リンクを1〜2個追加");
  } else if (internalLinkCount === 1) {
    s.push("内部リンクをもう1つ増やして回遊性を高める");
  }
  if (!bool("hasInternalLinks")) {
    s.push("関連記事への内部リンクを追加");
  }

  const ctaCount = num("ctaCount");
  if (ctaCount === 0) {
    s.push("本文の中盤〜終盤に公式サイトへのCTAリンクを1つ追加");
  }

  if (!bool("hasFAQ")) {
    s.push("FAQを3問追加");
  }

  // テーブルは比較記事なら強め、その他はゆるめに
  const hasTable = bool("hasTable");
  if (!hasTable) {
    if (type === "compare") {
      s.push("主要な3社の比較表（料金・期間・サポート）を追加");
    } else {
      s.push("読み手が比較しやすいように簡単な表を追加");
    }
  }

  // 既存の hasCTA フラグも尊重（analyzeSeo 側で使っている前提）
  if (!bool("hasCTA")) {
    s.push("本文中に自然な形でCTAリンクを追加");
  }

  return s.slice(0, 8);
}

/** 夜 20:00 … 当日作成記事を自動分析し、blogs.analysisHistory に追記 */
export const scheduledAnalyzeBlogsNight = functions
  .region(REGION)
  // OpenAIは使わないローカル分析なので secrets 不要
  .runWith({})
  .pubsub.schedule("0 20 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const since = startOfTodayJST();
    const snap = await db
      .collection("blogs")
      .where("createdAt", ">=", since)
      .get();

    if (snap.empty) return { analyzed: 0 };

    let analyzed = 0;
    for (const d of snap.docs) {
      const data = d.data() as {
        title?: string;
        content?: string;
        type?: string;
      };
      const title = String(data.title || "");
      const content = String(data.content || "");
      const articleType = data.type ? String(data.type) : undefined;

      const markdown = `# ${title}\n\n${content}`;

      // Markdownベースの軽量スコアリング
      const seo = analyzeSeo(markdown);

      // 追加で、内部リンク/CTA/テーブルを自前で検知して checks を補強
      const metrics = extractContentMetrics(markdown);
      const baseChecks = (seo.checks || {}) as SeoChecks;

      const hasInternalLinksBase = baseChecks["hasInternalLinks"];
      const hasTableBase = baseChecks["hasTable"];

      const checks: SeoChecks = {
        ...baseChecks,
        // 既存フラグを尊重しつつ、自前検知で補強
        hasInternalLinks:
          (typeof hasInternalLinksBase === "boolean"
            ? hasInternalLinksBase
            : false) || metrics.internalLinkCount > 0,
        hasTable:
          (typeof hasTableBase === "boolean" ? hasTableBase : false) ||
          metrics.hasTableDetected,
        internalLinkCount: metrics.internalLinkCount,
        ctaCount: metrics.ctaCount,
      };

      const entryCreatedAt = Date.now();
      const suggestions = suggestionsFromChecks(checks, articleType);

      const entry = {
        score: Number(seo.total ?? 0),
        checks,
        suggestions,
        titleSuggestion: null as string | null,
        outlineSuggestion: null as string | null,
        createdAt: entryCreatedAt,
        source: "auto-night" as const,
      };

      const before = d.get("analysisHistory") as unknown;
      const histArray = Array.isArray(before) ? (before as unknown[]) : [];
      const hist = histArray.concat([entry]);
      // 履歴は直近50件まで（必要なら値は調整）
      const limited = hist.slice(-50);

      await d.ref.set(
        {
          // 履歴を上書き（arrayUnion は去重不可＆順序管理できないためここは set で統一）
          analysisHistory: limited,
          // 参照用の最新スコア
          latestScore: entry.score,
          lastAnalyzedAt: entry.createdAt,
          updatedAt: entry.createdAt,
        },
        { merge: true }
      );
      analyzed += 1;
    }
    return { analyzed };
  });
