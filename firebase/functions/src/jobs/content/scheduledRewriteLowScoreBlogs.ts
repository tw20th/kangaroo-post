// firebase/functions/src/jobs/content/scheduledRewriteLowScoreBlogs.ts
import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { stripPlaceholders } from "../../utils/markdown.js";
import { analyzeSeo } from "../../lib/seo/analyzeSeo.js";
import { pickBestKeywordForSite } from "../../lib/keywords/pickSiteKeyword.js";
import type { IntentId } from "../../lib/keywords/pickSiteKeyword.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

// リライト候補のしきい値（必要に応じて環境変数で調整）
const MIN_VIEWS = Number(process.env.REWRITE_MIN_VIEWS ?? 20);
const MAX_CTR = Number(process.env.REWRITE_MAX_CTR ?? 0.02); // 2%
const MIN_AVG_TIME = Number(process.env.REWRITE_MIN_AVG ?? 30); // 秒
const MIN_SCORE = Number(process.env.REWRITE_MIN_SCORE ?? 65); // 最新スコアがこれ未満なら候補

type Metrics = {
  views?: number;
  outboundClicks?: number;
  avgReadTimeSec?: number;
};

type AnalysisEntry = {
  score: number;
  checks?: Record<string, boolean | number>;
  suggestions: string[];
  titleSuggestion: string | null;
  outlineSuggestion: string | null;
  createdAt: number;
  source: string;
};

/**
 * analyzeBlog.ts と同じルールで「次にやると良いこと」を文章化
 */
function suggestionsFromChecks(
  checks: Record<string, boolean | number>
): string[] {
  const s: string[] = [];
  if (!checks.hasHeadings) s.push("H2/H3の見出しを追加して構造化");
  if (!checks.hasList) s.push("箇条書きで要点を整理");
  if (!checks.hasInternalLinks) s.push("関連記事への内部リンクを追加");
  if (!checks.hasFAQ) s.push("FAQを3問追加");
  if (!checks.hasCTA) s.push("CTAリンクを本文中に追加");
  if (!checks.hasTable) s.push("比較表（表組み）を追加");
  return s.slice(0, 8);
}

/**
 * Markdown から H2/H3 を拾って、アウトライン文としてまとめる
 * → 「AIが作った見出し案」として UI に出す用
 */
function extractOutlineFromContent(content: string): string | null {
  const lines = content.split("\n");
  const headings: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      headings.push(line.replace(/^##\s*/, "").trim());
    } else if (line.startsWith("### ")) {
      headings.push("  - " + line.replace(/^###\s*/, "").trim());
    }
  }

  if (headings.length === 0) {
    return null;
  }

  return headings.join("\n");
}

export const scheduledRewriteLowScoreBlogs = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 23 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    // 直近7日から候補抽出
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snap = await db
      .collection("blogs")
      .where("createdAt", "<=", Date.now())
      .where("createdAt", ">=", sevenDaysAgo)
      .limit(200)
      .get();

    let candidate: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null =
      null;

    for (const d of snap.docs) {
      const metrics = (d.get("metrics") || {}) as Metrics;
      const views = Number(metrics.views ?? 0);
      const clicks = Number(metrics.outboundClicks ?? 0);
      const ctr = views > 0 ? clicks / views : 0;
      const avg = Number(metrics.avgReadTimeSec ?? 0);

      const latestScore = Number(d.get("latestScore") ?? 0);

      // “一定以上見られているのに成果が弱い/読まれていない/スコアが低い”を優先
      const weakByBehavior =
        views >= MIN_VIEWS && (ctr <= MAX_CTR || avg <= MIN_AVG_TIME);
      const weakByScore = latestScore > 0 && latestScore < MIN_SCORE;

      if (weakByBehavior || weakByScore) {
        candidate = d;
        break;
      }
    }

    if (!candidate) {
      return { rewritten: 0, reason: "no-candidate" };
    }

    const data = candidate.data() as {
      siteId?: string;
      type?: string;
      title?: string;
      content?: string;
      tags?: string[];
      offerId?: string | null;
    };

    const siteId = String(data.siteId || "");
    const articleType = String(data.type || "");
    const title = String(data.title || "");
    const tags = Array.isArray(data.tags) ? data.tags : [];

    // 🔹 rewrite 用の intent を articleType からマップ
    const intent: IntentId =
      articleType === "guide" ||
      articleType === "compare" ||
      articleType === "service"
        ? (articleType as IntentId)
        : "service";

    // 🔹 自動最適化された keyword を取得
    const picked = await pickBestKeywordForSite({
      siteId,
      intent,
      avoidHours: 24,
    });

    const keyword = picked?.keyword ?? title;

    // 既存テンプレを使って中身を刷新（keyword を product.name にも反映）
    const out = await generateBlogContent({
      siteId,
      siteName: "Kariraku（カリラク）",
      product: {
        name: keyword,
        asin: (data.offerId as string | null) ?? "",
        tags,
      },
      persona: "家電を借りるか迷っている人",
      pain: "料金比較・設置/回収・短期だけ使いたい",
      templateName: "blogTemplate_kariraku_service.txt",
      vars: {
        // テンプレ側で primaryKeyword 的に使いたければここで利用可能
        primaryKeyword: keyword,
      },
    });

    const rewritten = stripPlaceholders(out.content || "");
    const afterTitle = out.title || title;
    const afterContent = rewritten || String(data.content || "");

    // 🔹 リライト後の記事を再分析（AIが作ったタイトル/見出しをそのまま評価）
    const seoAfter = analyzeSeo(`# ${afterTitle}\n\n${afterContent}`);
    const afterScore = Number(seoAfter.total ?? 0);
    const checks = seoAfter.checks || {};
    const suggestions = suggestionsFromChecks(checks);
    const outlineSuggestion = extractOutlineFromContent(afterContent);

    const historyEntry: AnalysisEntry = {
      score: afterScore,
      checks,
      suggestions,
      titleSuggestion: afterTitle || null,
      outlineSuggestion,
      createdAt: Date.now(),
      source: "auto-rewrite",
    };

    const before = candidate.get("analysisHistory") as
      | AnalysisEntry[]
      | undefined;
    const hist = Array.isArray(before) ? before : [];
    const limited = hist.concat([historyEntry]).slice(-50);

    await candidate.ref.set(
      {
        title: afterTitle,
        content: afterContent,
        summary: out.excerpt || null,
        tags: out.tags && out.tags.length ? out.tags : tags,
        latestScore: afterScore,
        lastAnalyzedAt: historyEntry.createdAt,
        updatedAt: historyEntry.createdAt,
        analysisHistory: limited,
        // どのキーワードでリライトしたかも残しておくと後から便利
        primaryKeyword: keyword,
        primaryKeywordDocId: picked?.docId ?? null,
      },
      { merge: true }
    );

    return {
      rewritten: 1,
      slug: candidate.id,
      afterScore,
      keyword,
      intent,
    };
  });
