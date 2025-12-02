// firebase/functions/src/lib/keywords/pickBestKeywordForSite.ts
import { getFirestore, Firestore } from "firebase-admin/firestore";

export type IntentId = "service" | "compare" | "guide" | "discover";

export type SiteKeywordDoc = {
  siteId: string;
  keyword: string;
  intent: IntentId;
  status: "active" | "paused";

  usedCount: number;
  lastUsedAt: number | null;

  impressions: number;
  clicks: number;
  ctr: number;
  score: number;

  createdAt: number;
  updatedAt: number;

  // メタ（任意）
  source?: "keywordPools" | "painRules";
  poolKey?: string | null;
  painRuleId?: string | null;
  lastBlogSlug?: string | null;
};

export type SiteKeywordWithId = SiteKeywordDoc & { id: string };

const db: Firestore = getFirestore();

/**
 * サイトごと・intent ごとに「次に使うキーワード」を1つ選ぶ。
 *
 * - まず score の高いもの + usedCount の少ないものを優先
 * - まだ score が付いていない初期状態では、単純に usedCount が少ないものを返す
 */
export async function pickBestKeywordForSite(params: {
  siteId: string;
  intent: IntentId;
}): Promise<SiteKeywordWithId | null> {
  const { siteId, intent } = params;

  // 1) score ベース（将来は GSC 同期でここが効いてくる）
  const snapByScore = await db
    .collection("siteKeywords")
    .where("siteId", "==", siteId)
    .where("intent", "==", intent)
    .where("status", "==", "active")
    .orderBy("score", "desc")
    .orderBy("usedCount", "asc")
    .limit(1)
    .get();

  if (!snapByScore.empty) {
    const doc = snapByScore.docs[0];
    const data = doc.data() as SiteKeywordDoc;
    return { id: doc.id, ...data };
  }

  // 2) score がまだ無い場合のフォールバック：usedCount が少ないもの
  const snapByUsed = await db
    .collection("siteKeywords")
    .where("siteId", "==", siteId)
    .where("intent", "==", intent)
    .where("status", "==", "active")
    .orderBy("usedCount", "asc")
    .limit(1)
    .get();

  if (snapByUsed.empty) {
    return null;
  }

  const doc = snapByUsed.docs[0];
  const data = doc.data() as SiteKeywordDoc;
  return { id: doc.id, ...data };
}
