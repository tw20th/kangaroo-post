// firebase/functions/src/lib/keywords/pickSiteKeyword.ts
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getSiteConfig } from "../sites/siteConfig.js";

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

  source?: "keywordPools" | "painRules" | "rentalTypes";
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

  /**
   * keywordPools の poolKey で絞り込みたいときに使う。
   * 例: "service_living" / ["service_living", "service_common"] など。
   * 先頭一致で判定 (poolKey.startsWith(prefix))
   */
  poolKeyPrefix?: string | string[];
}

export interface PickKeywordResult {
  docId: string;
  keyword: string;
  intent: IntentId;
  raw: SiteKeyword;
}

/** siteConfig から painGroups だけ使う簡易型 */
interface SiteConfigLite {
  painGroups?: Record<string, string[]>;
}

/** 内部的に Firestore を取得（必要なら外から db を渡す版を作ってもOK） */
function getDb(): Firestore {
  return getFirestore();
}

/* ===== データ量を判定するための閾値 ===== */

// 「そこそこデータあるね」とみなす境界（フェーズB開始の目安）
const ENOUGH_IMPRESSIONS = 50;
const ENOUGH_CLICKS = 5;

// 「かなり育ってるね」とみなす境界（フェーズCの主力候補）
const MATURE_IMPRESSIONS = 300;
const MATURE_CLICKS = 20;

function hasEnoughData(k: SiteKeyword): boolean {
  return k.impressions >= ENOUGH_IMPRESSIONS || k.clicks >= ENOUGH_CLICKS;
}

function isMature(k: SiteKeyword): boolean {
  return k.impressions >= MATURE_IMPRESSIONS || k.clicks >= MATURE_CLICKS;
}

/** usedCount を正規化した内部用型 */
interface NormalizedKeyword {
  id: string;
  data: SiteKeyword & { usedCount: number };
}

/** lastUsedAt で avoidHours を考慮したフィルタ */
function filterByAvoid(
  items: NormalizedKeyword[],
  now: number,
  avoidMs: number
): NormalizedKeyword[] {
  const fresh = items.filter((item) => {
    const last = item.data.lastUsedAt;
    if (!last) return true;
    return now - last > avoidMs;
  });
  return fresh.length > 0 ? fresh : items;
}

/**
 * 「探索寄り」(usedCount ローテ＋ランダム) で1件選ぶ
 */
function pickExploration(
  pool: NormalizedKeyword[],
  now: number,
  avoidMs: number
): NormalizedKeyword | null {
  if (pool.length === 0) return null;

  // usedCount の最小値
  const minUsed = pool.reduce<number>((min, item) => {
    return item.data.usedCount < min ? item.data.usedCount : min;
  }, pool[0].data.usedCount);

  // min〜min+1 のものを候補に（ローテーション）
  const rotationMax = minUsed + 1;
  const rotationCandidates = pool.filter(
    (item) => item.data.usedCount <= rotationMax
  );
  const rotationPool =
    rotationCandidates.length > 0 ? rotationCandidates : pool;

  // avoidHours で間引き
  const finalPool = filterByAvoid(rotationPool, now, avoidMs);
  if (finalPool.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * finalPool.length);
  return finalPool[randomIndex] ?? null;
}

/**
 * 「実績寄り」(score重視＋少しランダム) で1件選ぶ
 */
function pickExploitation(
  pool: NormalizedKeyword[],
  now: number,
  avoidMs: number
): NormalizedKeyword | null {
  if (pool.length === 0) return null;

  // avoidHours で間引き
  const freshPool = filterByAvoid(pool, now, avoidMs);
  if (freshPool.length === 0) return null;

  // score の高い順にソート
  const sorted = [...freshPool].sort((a, b) => b.data.score - a.data.score);

  // 上位N件の中からランダム（完全固定を避ける）
  const TOP_N = Math.min(5, sorted.length);
  const top = sorted.slice(0, TOP_N);

  const randomIndex = Math.floor(Math.random() * top.length);
  return top[randomIndex] ?? null;
}

/**
 * フェーズ判定（A/B/C）込みで、与えられたプールから1件選ぶ共通関数
 */
function pickPhaseAware(
  pool: NormalizedKeyword[],
  now: number,
  avoidMs: number
): NormalizedKeyword | null {
  if (pool.length === 0) return null;

  const enoughData = pool.filter((i) => hasEnoughData(i.data));
  const matureData = pool.filter((i) => isMature(i.data));

  const total = pool.length;
  const enoughRatio = total > 0 ? enoughData.length / total : 0;

  // フェーズA判定：ほとんどデータがない
  const isPhaseA = enoughRatio < 0.5 && matureData.length < 3;

  // フェーズC判定：かなり育っている（主力候補が複数）
  const isPhaseC = matureData.length >= 3;

  // フェーズB：AでもCでもない中間ゾーン
  const isPhaseB = !isPhaseA && !isPhaseC;

  // --- フェーズA：探索集中（今まで通り） ---
  if (isPhaseA) {
    return pickExploration(pool, now, avoidMs);
  }

  // 探索対象：まだ enoughData になっていないキーワードたち
  const explorePool = pool.filter((i) => !hasEnoughData(i.data)) || pool;

  // 実績対象：
  // フェーズCなら「mature」、Bなら「enough以上すべて」
  const exploitPool: NormalizedKeyword[] = ((): NormalizedKeyword[] => {
    if (isPhaseC && matureData.length > 0) {
      return matureData;
    }
    if (enoughData.length > 0) {
      return enoughData;
    }
    return pool;
  })();

  // --- フェーズB：50 / 50 くらいで選ぶ ---
  if (isPhaseB) {
    const useExploit = Math.random() < 0.5; // 50%

    if (useExploit && exploitPool.length > 0) {
      const chosen = pickExploitation(exploitPool, now, avoidMs);
      if (chosen) {
        return chosen;
      }
    }

    // exploitation で決まらなかった or explore を選んだ場合
    return pickExploration(explorePool, now, avoidMs);
  }

  // --- フェーズC：実績重視 80% + 探索 20% ---
  const useExploit = Math.random() < 0.8; // 80%

  if (useExploit && exploitPool.length > 0) {
    const chosen = pickExploitation(exploitPool, now, avoidMs);
    if (chosen) {
      return chosen;
    }
  }

  // 探索枠 or exploitation で決まらなかった場合
  return pickExploration(explorePool, now, avoidMs);
}

/**
 * siteKeywords から「次に使うキーワード」を1件選ぶ
 *
 * データ量に応じて内部でフェーズを自動切り替え：
 *
 * - フェーズA（探索集中）:
 *   ⇒ まだほとんどのキーワードが ENOUGH_IMPRESSIONS/CLICKS 未満
 *   ⇒ usedCount ローテ＋ランダム
 *
 * - フェーズB（ハイブリッド）:
 *   ⇒ ENOUGH データありのキーワードが全体の 50%以上だが、
 *      MATURE キーワードはまだ少ない
 *   ⇒ 実績ありグループ : 探索グループ ≒ 50 : 50
 *
 * - フェーズC（実績重視＋探索少し）:
 *   ⇒ MATURE キーワードが 3件以上
 *   ⇒ 実績ありグループ : 探索グループ ≒ 80 : 20
 *
 * ＋ guide intent のときは、
 *   「テーマ(keywordPools) → painGroups にひもづく painRules」 の2段階で選ぶ。
 */
export async function pickBestKeywordForSite(
  options: PickKeywordOptions
): Promise<PickKeywordResult | null> {
  const db = getDb();
  const {
    siteId,
    intent,
    avoidHours = 24,
    excludeDocIds = [],
    poolKeyPrefix,
  } = options;

  const snap = await db
    .collection("siteKeywords")
    .where("siteId", "==", siteId)
    .where("intent", "==", intent)
    .where("status", "==", "active")
    .get();

  if (snap.empty) {
    return null;
  }

  const rawItems = snap.docs
    .map((d) => {
      const data = d.data() as SiteKeyword;
      return { id: d.id, data };
    })
    .filter((item) => !excludeDocIds.includes(item.id));

  if (rawItems.length === 0) {
    return null;
  }

  // poolKeyPrefix があれば poolKey でフィルタ（なければ全件）
  let baseItems = rawItems;
  if (poolKeyPrefix) {
    const prefixes = Array.isArray(poolKeyPrefix)
      ? poolKeyPrefix
      : [poolKeyPrefix];

    const lowered = prefixes.map((p) => p.toLowerCase());
    const filtered = rawItems.filter((item) => {
      const key = (item.data.poolKey ?? "").toLowerCase();
      if (!key) return false;
      return lowered.some((p) => key.startsWith(p));
    });

    if (filtered.length > 0) {
      baseItems = filtered;
    }
  }

  if (baseItems.length === 0) {
    return null;
  }

  // usedCount 正規化
  const all: NormalizedKeyword[] = baseItems.map((item) => {
    const usedCount =
      typeof item.data.usedCount === "number" &&
      Number.isFinite(item.data.usedCount)
        ? item.data.usedCount
        : 0;
    return {
      id: item.id,
      data: { ...item.data, usedCount },
    };
  });

  const now = Date.now();
  const avoidMs = avoidHours * 60 * 60 * 1000;

  /* =========================================================
     guide intent 専用：テーマ(keywordPools) → painRules の2段階選択
     ========================================================= */
  if (intent === "guide") {
    // 1) siteConfig から painGroups を取得
    let painGroups: Record<string, string[]> = {};
    try {
      const cfgRaw = await getSiteConfig(siteId);
      const cfg = cfgRaw as SiteConfigLite | null;
      painGroups = cfg?.painGroups ?? {};
    } catch {
      // siteConfig 読み込み失敗時は painGroups なし扱い → 後続で通常ロジックにフォールバック
      painGroups = {};
    }

    const themeKeys = Object.keys(painGroups);
    if (themeKeys.length > 0) {
      // keywordPools 由来のテーマ候補（source === "keywordPools"）
      const themeItems = all.filter(
        (item) =>
          item.data.source === "keywordPools" &&
          themeKeys.includes(item.data.keyword)
      );

      if (themeItems.length > 0) {
        const chosenTheme = pickPhaseAware(themeItems, now, avoidMs);

        if (chosenTheme) {
          const themeKeyword = chosenTheme.data.keyword;
          const mappedPainIds = painGroups[themeKeyword] ?? [];

          // 2) テーマにひもづく painRuleId を持つキーワードから選ぶ
          const painItems = all.filter(
            (item) =>
              item.data.source === "painRules" &&
              mappedPainIds.includes(item.data.painRuleId ?? "")
          );

          if (painItems.length > 0) {
            const chosenPain = pickPhaseAware(painItems, now, avoidMs);
            if (chosenPain) {
              return {
                docId: chosenPain.id,
                keyword: chosenPain.data.keyword,
                intent: chosenPain.data.intent,
                raw: chosenPain.data,
              };
            }
          }

          // painRules がまだ仕込めていないテーマのときは、
          // ひとまずテーマキーワードで記事を書く（従来動作に近いフォールバック）
          return {
            docId: chosenTheme.id,
            keyword: chosenTheme.data.keyword,
            intent: chosenTheme.data.intent,
            raw: chosenTheme.data,
          };
        }
      }
    }
    // painGroups が無い / テーマ候補が無い場合は、下の共通ロジックにフォールバック
  }
  /* =========================================================
     discover intent 専用：テーマ(keywordPools) → painGroups の2段階選択
     ========================================================= */
  if (intent === "discover") {
    let painGroups: Record<string, string[]> = {};
    try {
      const cfgRaw = await getSiteConfig(siteId);
      const cfg = cfgRaw as SiteConfigLite | null;
      painGroups = cfg?.painGroups ?? {};
    } catch {
      painGroups = {};
    }

    const themeKeys = Object.keys(painGroups);
    if (themeKeys.length > 0) {
      const themeItems = all.filter(
        (item) =>
          item.data.source === "keywordPools" &&
          themeKeys.includes(item.data.keyword)
      );

      if (themeItems.length > 0) {
        const chosenTheme = pickPhaseAware(themeItems, now, avoidMs);

        if (chosenTheme) {
          const themeKeyword = chosenTheme.data.keyword;
          const mappedPainIds = painGroups[themeKeyword] ?? [];

          const painItems = all.filter(
            (item) =>
              item.data.source === "painRules" &&
              mappedPainIds.includes(item.data.painRuleId ?? "")
          );

          if (painItems.length > 0) {
            const chosenPain = pickPhaseAware(painItems, now, avoidMs);
            if (chosenPain) {
              return {
                docId: chosenPain.id,
                keyword: chosenPain.data.keyword,
                intent: chosenPain.data.intent,
                raw: chosenPain.data,
              };
            }
          }

          return {
            docId: chosenTheme.id,
            keyword: chosenTheme.data.keyword,
            intent: chosenTheme.data.intent,
            raw: chosenTheme.data,
          };
        }
      }
    }
  }

  /* =========================================================
     それ以外の intent（service / compare / discover）や
     painGroups が使えなかった場合は、従来通り all から選ぶ
     ========================================================= */
  const chosen = pickPhaseAware(all, now, avoidMs);
  if (!chosen) {
    return null;
  }

  return {
    docId: chosen.id,
    keyword: chosen.data.keyword,
    intent: chosen.data.intent,
    raw: chosen.data,
  };
}
