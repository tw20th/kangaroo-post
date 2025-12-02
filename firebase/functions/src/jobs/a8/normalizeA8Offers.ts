// firebase/functions/src/jobs/a8/normalizeA8Offers.ts
import { getFirestore } from "firebase-admin/firestore";

type Options = { siteId?: string };

// タイトルからデフォルトsiteIds決定（未指定時の保険）
function decideSitesByTitle(title: string): string[] {
  const t = (title || "").toLowerCase();
  const sites: string[] = [];
  if (/(冷蔵|洗濯|レンタル|サブスク)/.test(t)) sites.push("homeease");
  return sites.length ? sites : ["homeease"];
}

/* ---- 派生フィールド（UI表示用） ---- */
function buildPriceLabel(o: any): string | null {
  const p = o?.extras?.pricing;
  if (!p) return null;

  // 月額 or 短期のどちらか（両対応なら月額を優先）
  if (
    (p.plan === "monthly" || p.plan === "both") &&
    typeof p.monthlyPriceFrom === "number"
  ) {
    return `月額 ${p.monthlyPriceFrom.toLocaleString()}円〜`;
  }

  if (
    (p.plan === "short" || p.plan === "both" || p.plan === "rental") &&
    typeof p?.shortBase?.priceFrom === "number"
  ) {
    const d = Number(p?.shortBase?.days ?? 2);
    return `${d}泊${d + 1}日 ${p.shortBase.priceFrom.toLocaleString()}円〜`;
  }

  return null;
}

function buildMinTermLabel(o: any): string | null {
  const m = o?.extras?.minTerm || {};
  const a: string[] = [];

  if (typeof m.shortDays === "number") {
    a.push(`短期 ${m.shortDays}泊${m.shortDays + 1}日〜`);
  }

  if (typeof m.monthlyMonths === "number") {
    a.push(`月額 ${m.monthlyMonths}ヶ月〜`);
  }

  return a.join(" / ") || null;
}

/** 比較ハイライト → highlightLabel 派生 */
function buildHighlightLabel(o: any): string | null {
  // すでに highlightLabel があればそれを優先
  const direct = o?.highlightLabel ?? o?.ui?.highlightLabel;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  // ingest JSON の extras.ui.compareHighlight から生成
  const fromExtras = o?.extras?.ui?.compareHighlight;
  if (typeof fromExtras === "string" && fromExtras.trim()) {
    return fromExtras.trim();
  }

  return null;
}

export async function normalizeA8Offers(opts: Options = {}) {
  const db = getFirestore();
  const snap = await db.collection("offers").get();

  let updated = 0;
  let scanned = 0;
  let batch = db.batch();

  for (const doc of snap.docs) {
    scanned++;

    const o = doc.data() as {
      title?: string;
      siteIds?: string[];
      creatives?: Array<
        | { type: "text"; href: string }
        | { type: "banner"; href: string; imgSrc?: string }
      >;
      affiliateUrl?: string;
      archived?: boolean;
      updatedAt?: number;
      extras?: any; // ここに pricing / shipping / payment / warranty などが入る
      ui?: any;
      highlightLabel?: string | null;
    };

    /* --- siteIds --- */
    const originalSiteIds = Array.isArray(o.siteIds) ? o.siteIds : [];
    const siteIds = new Set<string>(originalSiteIds);

    if (opts.siteId) {
      // 呼び出し時に siteId を明示された場合はそれを追加
      siteIds.add(opts.siteId);
    } else if (siteIds.size === 0) {
      // JSON 側で siteIds が空 or 未設定のときだけタイトルから推論
      for (const s of decideSitesByTitle(o.title ?? "")) {
        siteIds.add(s);
      }
    }
    // 既に JSON に書いてある siteIds（例: ["kariraku"]）はそのまま尊重される

    /* --- affiliateUrl フォールバック（text → banner） --- */
    let affiliateUrl = o.affiliateUrl || "";
    if (!affiliateUrl && Array.isArray(o.creatives)) {
      const text = o.creatives.find((c: any) => c?.type === "text") as
        | { href: string }
        | undefined;
      const banner = o.creatives.find((c: any) => c?.type === "banner") as
        | { href: string }
        | undefined;
      affiliateUrl = text?.href || banner?.href || "";
    }

    /* --- UI派生 --- */
    const priceLabel = buildPriceLabel(o);
    const minTermLabel = buildMinTermLabel(o);
    const isPriceDynamic = !!o?.extras?.pricing?.priceIsDynamic;
    const highlightLabel = buildHighlightLabel(o);

    const patch = {
      siteIds: Array.from(siteIds),
      affiliateUrl: affiliateUrl || null,
      archived: o.archived ?? false,
      updatedAt: Date.now(),

      // ルートにも持たせておくとクエリしやすいので追加
      highlightLabel: highlightLabel ?? null,

      ui: {
        ...(o.ui || {}),
        priceLabel: priceLabel ?? null,
        minTermLabel: minTermLabel ?? null,
        isPriceDynamic,
        // UI 用にも重ねて保存
        highlightLabel: highlightLabel ?? null,
      },
    };

    batch.set(doc.ref, patch, { merge: true });
    updated++;

    if (updated % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  return { scanned, updated };
}
