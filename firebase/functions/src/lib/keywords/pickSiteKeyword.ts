// firebase/functions/src/lib/keywords/pickSiteKeyword.ts
import { getFirestore, Firestore } from "firebase-admin/firestore";

export type IntentId = "service" | "compare" | "guide" | "discover";

export type SiteKeywordStatus = "active" | "paused";

export interface SiteKeyword {
  siteId: string;
  keyword: string;
  intent: IntentId;
  status: SiteKeywordStatus;

  usedCount: number;
  lastUsedAt: number | null;

  impressions: number;
  clicks: number;
  ctr: number;
  score: number;

  createdAt: number;
  updatedAt: number;

  source?: "keywordPools" | "painRules";
  poolKey?: string | null;
  painRuleId?: string | null;
  lastBlogSlug?: string | null;
}

export interface PickKeywordOptions {
  siteId: string;
  intent: IntentId;
  /**
   * 直近この時間以内に使ったキーワードはできるだけ避ける（時間）
   * デフォルト: 24時間
   */
  avoidHours?: number;
  /**
   * 明示的に除外したい docId（失敗リトライ時など）
   */
  excludeDocIds?: string[];
}

export interface PickKeywordResult {
  docId: string;
  keyword: string;
  intent: IntentId;
  raw: SiteKeyword;
}

/** 内部的に Firestore を取得（必要なら外から db を渡す版を作ってもOK） */
function getDb(): Firestore {
  return getFirestore();
}

/**
 * siteKeywords から「次に使うキーワード」を1件選ぶ
 * - status === "active"
 * - siteId / intent 一致
 * - score の高い順に候補をとり、最近使ってなさそうなものを優先
 */
export async function pickBestKeywordForSite(
  options: PickKeywordOptions
): Promise<PickKeywordResult | null> {
  const db = getDb();
  const { siteId, intent, avoidHours = 24, excludeDocIds = [] } = options;

  const snap = await db
    .collection("siteKeywords")
    .where("siteId", "==", siteId)
    .where("intent", "==", intent)
    .where("status", "==", "active")
    .orderBy("score", "desc")
    .limit(20)
    .get();

  if (snap.empty) {
    return null;
  }

  const now = Date.now();
  const avoidMs = avoidHours * 60 * 60 * 1000;

  const candidates = snap.docs
    .map((d) => {
      const data = d.data() as SiteKeyword;
      return { id: d.id, data };
    })
    .filter((item) => !excludeDocIds.includes(item.id));

  if (candidates.length === 0) return null;

  // 1. なるべく「最近使っていない」ものを優先
  const freshFirst = candidates.filter((item) => {
    const last = item.data.lastUsedAt;
    if (!last) return true;
    return now - last > avoidMs;
  });

  const chosen = freshFirst.length > 0 ? freshFirst[0] : candidates[0]; // 全部最近なら一番スコア高いもの

  return {
    docId: chosen.id,
    keyword: chosen.data.keyword,
    intent: chosen.data.intent,
    raw: chosen.data,
  };
}
