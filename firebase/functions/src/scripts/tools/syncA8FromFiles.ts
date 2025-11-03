// firebase/functions/src/scripts/tools/syncA8FromFiles.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../../lib/infra/db.js"; // ← ここを getFirestore ではなく単一化された db に
// getFirestore の import は削除

// ---- types ----
type Creative = {
  materialId: string;
  type: "text" | "banner";
  label?: string;
  size?: string;
  href: string;
  imgSrc?: string;
};

type InFile = {
  program: { programId?: string; advertiser: string; category?: string[] };
  offer: {
    id?: string;
    title: string;
    description?: string;
    price?: number;
    planType?: "product" | "subscription" | "trial";
    landingUrl: string;
    affiliateUrl?: string;
    images?: string[];
    badges?: string[];
    tags?: string[];
    siteIds?: string[];
    extras?: Record<string, unknown>;
    creatives?: Creative[];
  };
};

type SyncA8Options = {
  site: string;
  dir?: string; // default: ingest/a8
  dryRun?: boolean;
  archiveMissing?: boolean;
};

// ---- utils ----
const hash = (s: string) =>
  crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);
const now = () => Date.now();

/**
 * Cloud Functions 本番は /workspace への書き込み不可（EROFS）。
 * /tmp は書き込み可なので、状態ファイルは /tmp に置く。
 * 環境変数 A8_SYNC_STATE があればそれを優先。
 */
const STATE_FILE = path.resolve(
  process.env.A8_SYNC_STATE || "/tmp/.a8-sync-state.json"
);

type State = { files: Record<string, string> };

function loadState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { files: {} };
  }
}
function saveState(st: State) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2), "utf-8");
  } catch (e) {
    // 本番で稀に /tmp が無いケースに備えて noop（/tmp は基本存在）
    console.error(`[syncA8] Failed to save state:`, e);
  }
}

function ensureUrl(u?: string) {
  if (!u || !/^https?:\/\//.test(u)) throw new Error(`Invalid URL: ${u}`);
  return u;
}
function toNumberOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ---- core ----
async function upsert(siteId: string, data: InFile, dryRun: boolean) {
  const t = now();

  const fileSiteIds =
    Array.isArray(data.offer.siteIds) && data.offer.siteIds.length
      ? (data.offer.siteIds as string[])
      : [siteId];

  const programId =
    data.program.programId ??
    `p_${hash(`${data.program.advertiser}:${data.offer.title}`)}`;

  const dedupeKey = `${programId}:${ensureUrl(data.offer.landingUrl)}`;
  const offerId = data.offer.id ?? `${programId}:${hash(dedupeKey)}`;

  const programDoc = {
    programId,
    advertiser: data.program.advertiser,
    category: data.program.category ?? ["家電", "レンタル", "サブスク"],
    approval: "approved",
    siteIds: Array.from(new Set([...fileSiteIds, siteId])),
    siteIdPrimary: siteId,
    updatedAt: t,
    createdAt: t,
  };

  const price = toNumberOrUndef(data.offer.price);
  const offerDoc: Record<string, unknown> = {
    id: offerId,
    programId,
    title: data.offer.title,
    description: data.offer.description ?? "",
    planType: data.offer.planType ?? "subscription",
    landingUrl: ensureUrl(data.offer.landingUrl),
    affiliateUrl: ensureUrl(data.offer.affiliateUrl ?? data.offer.landingUrl),
    images: data.offer.images ?? [],
    badges: data.offer.badges ?? [],
    tags: data.offer.tags ?? [],
    dedupeKey,
    siteIds: Array.from(new Set([...fileSiteIds, siteId])),
    siteIdPrimary: siteId,
    priority: 1,
    status: "active",
    archived: false,
    creatives: data.offer.creatives ?? [],
    extras: data.offer.extras ?? {},
    updatedAt: t,
    createdAt: t,
  };
  if (price !== undefined) offerDoc.price = price;

  if (dryRun) return { programId, offerId, dryRun: true };

  await db
    .collection("programs")
    .doc(programId)
    .set(programDoc, { merge: true });
  await db.collection("offers").doc(offerId).set(offerDoc, { merge: true });
  return { programId, offerId };
}

/** Cloud Functions から呼べる同期関数 */
export async function syncA8FromFiles(opts: SyncA8Options) {
  const siteId = opts.site;
  const dir = path.resolve(opts.dir ?? "ingest/a8");
  const dryRun = !!opts.dryRun;
  const archiveMissing = !!opts.archiveMissing;

  // Firestore へ undefined を書かない保険（db.ts で一度だけ設定済み）
  // ここで settings() を再度呼ばないこと！ ← 二重初期化の原因になる

  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
    : [];

  const state = loadState();
  const seenOfferIds = new Set<string>();

  let processed = 0;

  for (const f of files) {
    const p = path.join(dir, f);
    const raw = fs.readFileSync(p, "utf-8");
    const h = hash(raw);

    if (state.files[p] === h) continue;

    const data = JSON.parse(raw) as InFile;

    const pid =
      data.program.programId ??
      `p_${hash(`${data.program.advertiser}:${data.offer.title}`)}`;
    const oid =
      data.offer.id ?? `${pid}:${hash(`${pid}:${data.offer.landingUrl}`)}`;
    seenOfferIds.add(oid);

    await upsert(siteId, data, dryRun);
    state.files[p] = h;
    processed++;
  }

  let archived = 0;
  if (archiveMissing && !dryRun) {
    const snap = await db
      .collection("offers")
      .where("siteIds", "array-contains", siteId)
      .get();

    for (const doc of snap.docs) {
      const o = doc.data() as { id?: string; archived?: boolean };
      if (o?.id && !seenOfferIds.has(o.id) && !o.archived) {
        await doc.ref.set(
          { archived: true, updatedAt: now() },
          { merge: true }
        );
        archived++;
      }
    }
  }

  if (!dryRun) saveState(state);

  return { processed, archived, files: files.length, dryRun };
}

/* ===== CLI 実行サポート（任意） =====
   node dist/scripts/tools/syncA8FromFiles.js --site=a8 --dir=ingest/a8 --archive-missing
*/
if (process.argv[1] && /syncA8FromFiles\.(ts|js)$/.test(process.argv[1])) {
  (async () => {
    const args = new URLSearchParams(process.argv.slice(2).join("&"));
    const site = String(args.get("site") || "");
    const dir = args.get("dir") || undefined;
    const dryRun =
      args.get("dry-run") === "true" || args.get("dryRun") === "true";
    const archiveMissing =
      args.get("archive-missing") === "true" ||
      args.get("archiveMissing") === "true";

    if (!site) {
      console.error("--site is required");
      process.exit(1);
    }
    const result = await syncA8FromFiles({ site, dir, dryRun, archiveMissing });
    console.log(result);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
