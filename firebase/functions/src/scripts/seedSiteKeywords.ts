// firebase/functions/src/scripts/seedSiteKeywords.ts
import fs from "fs";
import path from "path";
import { getApps, initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/* ========= Types ========= */

// ★ Discover を追加
export type IntentId = "service" | "compare" | "guide" | "discover";

// レンタルタイプ：3タイプ分け
type RentalType = "living" | "gadget" | "trial";

interface KeywordPools {
  [poolKey: string]: string[];
}

interface PainRule {
  id: string;
  label: string;
  keywords: string[];
  personas?: string[];
}

interface SiteJson {
  siteId: string;
  keywordPools?: KeywordPools;
  painRules?: PainRule[];

  // ★ 3タイプ用キーワード
  rentalTypeKeywords?: {
    living?: string[];
    gadget?: string[];
    trial?: string[];
  };

  // ★ テーマキーワード → painRule.id[] のマッピング（pattern B）
  painGroups?: Record<string, string[]>;
}

interface SiteKeywordDoc {
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
  source?: "keywordPools" | "painRules" | "rentalTypes";
  poolKey?: string | null;
  painRuleId?: string | null;
  lastBlogSlug?: string | null;

  // ★ どのタイプ向けキーワードか
  rentalType?: RentalType | null;
}

/* ========= Firebase init ========= */

function ensureFirestore(): Firestore {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? "kangaroo-post";

    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        projectId,
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // .env に "...\n..." 形式で入っている想定
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      // 最低限 projectId だけでも指定して初期化
      initializeApp({ projectId });
    }

    // eslint-disable-next-line no-console
    console.log(
      "[seedSiteKeywords] initialized projectId=",
      getApp().options.projectId
    );
  }

  return getFirestore();
}

/* ========= Helpers ========= */

function resolveSitesDir(): string {
  // 常に firebase/functions を CWD とみなして /sites にする
  return path.resolve(process.cwd(), "sites");
}

function readSiteJson(siteId: string): SiteJson {
  const sitesDir = resolveSitesDir();
  const filePath = path.join(sitesDir, `${siteId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`site json not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as SiteJson;

  if (!parsed.siteId) {
    parsed.siteId = siteId;
  }

  return parsed;
}

function slugifyKeyword(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return "keyword";
  // 全角スペースも含めて区切りを - に
  return trimmed
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** keywordPools のキーから intent を推測 */
function mapPoolKeyToIntent(poolKey: string): IntentId {
  const key = poolKey.toLowerCase();

  // ★ Discover 系（discover, discovery など）
  if (key === "discover" || key === "discovery" || key.includes("discover")) {
    return "discover";
  }

  // 比較系
  if (key === "comparison" || key === "compare" || key.includes("compare")) {
    return "compare";
  }

  // ガイド／悩み系
  if (key === "guide" || key === "daily" || key.includes("guide")) {
    return "guide";
  }

  // 企業紹介・サービス紹介系
  if (
    key === "service" ||
    key.includes("service") ||
    key.includes("brand") ||
    key.includes("offer")
  ) {
    return "service";
  }

  // デフォルトは service（企業紹介）
  return "service";
}

/** painRules 由来の intent は基本 guide で固定 */
function intentForPainRule(): IntentId {
  return "guide";
}

/* ========= Upsert logic ========= */

async function upsertSiteKeyword(
  db: Firestore,
  data: {
    siteId: string;
    keyword: string;
    intent: IntentId;
    source: "keywordPools" | "painRules" | "rentalTypes";
    poolKey?: string | null;
    painRuleId?: string | null;
    rentalType?: RentalType | null;
  }
): Promise<void> {
  const { siteId, keyword, intent, source, poolKey, painRuleId, rentalType } =
    data;
  const now = Date.now();

  const keywordSlug = slugifyKeyword(keyword);
  const docId = `${siteId}__${intent}__${keywordSlug}`;

  const ref = db.collection("siteKeywords").doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    const existing = snap.data() as Partial<SiteKeywordDoc>;

    const update: Partial<SiteKeywordDoc> = {
      siteId,
      keyword,
      intent,
      status: existing.status ?? "active",
      source,
      poolKey: poolKey ?? existing.poolKey ?? null,
      painRuleId: painRuleId ?? existing.painRuleId ?? null,
      rentalType: rentalType ?? existing.rentalType ?? null,
      updatedAt: now,
    };

    await ref.set(update, { merge: true });
    // eslint-disable-next-line no-console
    console.log(
      `[siteKeywords] updated ${docId} (${source}${
        poolKey ? `:${poolKey}` : ""
      })`
    );
    return;
  }

  const doc: SiteKeywordDoc = {
    siteId,
    keyword,
    intent,
    status: "active",
    usedCount: 0,
    lastUsedAt: null,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    score: 0,
    createdAt: now,
    updatedAt: now,
    source,
    poolKey: poolKey ?? null,
    painRuleId: painRuleId ?? null,
    lastBlogSlug: null,
    rentalType: rentalType ?? null,
  };

  await ref.set(doc, { merge: false });
  // eslint-disable-next-line no-console
  console.log(
    `[siteKeywords] created ${docId} (${source}${poolKey ? `:${poolKey}` : ""})`
  );
}

/* ========= Main seeding ========= */

export async function seedSiteKeywords(siteId: string): Promise<void> {
  const db = ensureFirestore();
  const siteJson = readSiteJson(siteId);

  const keywordPools = siteJson.keywordPools ?? {};
  const painRules = siteJson.painRules ?? [];
  const rentalTypeKeywords = siteJson.rentalTypeKeywords ?? {};

  // eslint-disable-next-line no-console
  console.log(
    `[seedSiteKeywords] start for siteId=${siteId} (pools=${
      Object.keys(keywordPools).length
    }, painRules=${painRules.length}, rentalTypes=${
      Object.keys(rentalTypeKeywords).length
    })`
  );

  // 1) keywordPools から投入
  for (const [poolKey, keywords] of Object.entries(keywordPools)) {
    const intent = mapPoolKeyToIntent(poolKey);

    for (const kw of keywords) {
      const keyword = kw.trim();
      if (!keyword) continue;

      // eslint-disable-next-line no-await-in-loop
      await upsertSiteKeyword(db, {
        siteId,
        keyword,
        intent,
        source: "keywordPools",
        poolKey,
        painRuleId: null,
        rentalType: null,
      });
    }
  }

  // 2) painRules から投入（＝基本 guide intent）
  for (const rule of painRules) {
    const intent = intentForPainRule();
    const keywords = rule.keywords ?? [];

    for (const kw of keywords) {
      const keyword = kw.trim();
      if (!keyword) continue;

      // eslint-disable-next-line no-await-in-loop
      await upsertSiteKeyword(db, {
        siteId,
        keyword,
        intent,
        source: "painRules",
        poolKey: null,
        painRuleId: rule.id,
        rentalType: null,
      });
    }
  }

  // 3) rentalTypeKeywords から投入（intent はひとまず service としておく）
  const entries: [RentalType, string[] | undefined][] = [
    ["living", rentalTypeKeywords.living],
    ["gadget", rentalTypeKeywords.gadget],
    ["trial", rentalTypeKeywords.trial],
  ];

  for (const [rentalType, keywords] of entries) {
    if (!keywords || keywords.length === 0) continue;

    const intent: IntentId = "service";

    for (const kw of keywords) {
      const keyword = kw.trim();
      if (!keyword) continue;

      // eslint-disable-next-line no-await-in-loop
      await upsertSiteKeyword(db, {
        siteId,
        keyword,
        intent,
        source: "rentalTypes",
        poolKey: `rentalType:${rentalType}`,
        painRuleId: null,
        rentalType,
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("[seedSiteKeywords] done");
}

/* ========= CLI entry ========= */

// ts-node などで直接実行されたとき用
async function runFromCli(): Promise<void> {
  const [, , siteIdArg] = process.argv;
  const siteId = siteIdArg || "kariraku";

  try {
    await seedSiteKeywords(siteId);
    // eslint-disable-next-line no-console
    console.log(`[seedSiteKeywords] success for siteId=${siteId}`);
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[seedSiteKeywords] error", err);
    process.exit(1);
  }
}

// 単純に「ファイル名に seedSiteKeywords を含むとき」は CLI 実行とみなす
if (process.argv[1] && process.argv[1].includes("seedSiteKeywords")) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runFromCli();
}
