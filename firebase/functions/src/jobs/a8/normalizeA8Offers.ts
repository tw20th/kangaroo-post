import { getFirestore } from "firebase-admin/firestore";

type Options = {
  siteId?: string; // ← 追加：HTTP側から受ける
};

function decideSitesByTitle(title: string): string[] {
  const t = (title || "").toLowerCase();
  const sites: string[] = [];
  if (/(冷蔵|洗濯|レンタル|サブスク)/.test(t)) sites.push("homeease");
  return sites.length ? sites : ["homeease"];
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
    };

    // --- siteIds 決定 ---
    const siteIds = new Set<string>(Array.isArray(o.siteIds) ? o.siteIds : []);
    if (opts.siteId) {
      siteIds.add(opts.siteId); // 明示指定を最優先
    } else {
      for (const s of decideSitesByTitle(o.title ?? "")) siteIds.add(s);
    }

    // --- affiliateUrl フォールバック（text → banner の順） ---
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

    const patch = {
      siteIds: Array.from(siteIds),
      affiliateUrl: affiliateUrl || null,
      archived: o.archived ?? false,
      updatedAt: o.updatedAt ?? Date.now(),
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
