import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { stripPlaceholders } from "../../utils/markdown.js";
import { analyzeSeo } from "../../lib/seo/analyzeSeo.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

// リライト候補の下限（しきい値は後で環境変数に出してOK）
const MIN_VIEWS = Number(process.env.REWRITE_MIN_VIEWS ?? 20);
const MAX_CTR = Number(process.env.REWRITE_MAX_CTR ?? 0.02); // 2%
const MIN_AVG_TIME = Number(process.env.REWRITE_MIN_AVG ?? 30); // 秒

export const scheduledRewriteLowScoreBlogs = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 23 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    // 直近7日程度で1本だけ候補抽出（views, ctr, avgReadTimeSec）
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snap = await db
      .collection("blogs")
      .where("createdAt", "<=", Date.now())
      .where("createdAt", ">=", sevenDaysAgo)
      .limit(100)
      .get();

    let candidate: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null =
      null;

    for (const d of snap.docs) {
      const m = (d.get("metrics") || {}) as {
        views?: number;
        outboundClicks?: number;
        avgReadTimeSec?: number;
      };
      const views = Number(m.views ?? 0);
      const clicks = Number(m.outboundClicks ?? 0);
      const ctr = views > 0 ? clicks / views : 0;
      const avg = Number(m.avgReadTimeSec ?? 0);

      // “一定以上見られているのに成果が弱い”を優先
      if (views >= MIN_VIEWS && (ctr <= MAX_CTR || avg <= MIN_AVG_TIME)) {
        candidate = d;
        break;
      }
    }

    if (!candidate) return { rewritten: 0, reason: "no-candidate" };

    const data = candidate.data() as {
      siteId?: string;
      title?: string;
      content?: string;
      tags?: string[];
      offerId?: string | null;
    };
    const siteId = String(data.siteId || "");
    const title = String(data.title || "");
    const content = String(data.content || "");
    const tags = Array.isArray(data.tags) ? data.tags : [];

    // テンプレは既存の Kariraku サービス記事を再利用（タイトル・導入・見出しを刷新）
    const out = await generateBlogContent({
      siteId,
      siteName: "Kariraku（カリラク）",
      product: { name: title, asin: (data.offerId as string) || "", tags },
      persona: "家電を借りるか迷っている人",
      pain: "料金比較・設置/回収・短期だけ使いたい",
      templateName: "blogTemplate_kariraku_service.txt",
      vars: {},
    });

    const rewritten = stripPlaceholders(out.content || "");
    const afterScore = analyzeSeo(
      `# ${out.title || title}\n\n${rewritten || content}`
    ).total;

    await candidate.ref.set(
      {
        // “リライト版”として本文とタイトルだけ置き換え（必要に応じて別スラッグ運用も可）
        title: out.title || title,
        content: rewritten || content,
        summary: out.excerpt || null,
        tags: out.tags && out.tags.length ? out.tags : tags,
        updatedAt: Date.now(),
        // 履歴追記（Before/After比較用）
        analysisHistory: (candidate.get("analysisHistory") || []).concat([
          {
            score: Number(afterScore ?? 0),
            suggestions: [] as string[],
            createdAt: Date.now(),
            source: "auto-rewrite",
          },
        ]),
      },
      { merge: true }
    );

    return { rewritten: 1, slug: candidate.id };
  });
