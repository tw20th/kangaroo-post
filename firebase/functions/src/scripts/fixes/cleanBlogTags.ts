/* eslint-disable no-console */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/* ===== CLI options =====
   --site chairscope   ← siteIdで絞り込み
   --dryRun            ← 書き込みせず差分だけ表示
*/
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);
const SITE = typeof args.site === "string" ? args.site : undefined;
const DRY_RUN = !!args.dryRun;

// --- normalize/sanitize ---
function normalizeTagText(s: string): string {
  return String(s || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[「」『』“”"']/g, " ")
    .replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF\s-]/g, " ")
    .replace(/[-\s]+/g, " ")
    .trim();
}
function sanitizeTagsInline(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const parts = String(raw ?? "")
      .replace(/[:;|/,\t]+/g, " ")
      .split(" ");
    for (const p of parts) {
      const t = normalizeTagText(p);
      if (!t) continue;
      if (t.length < 2) continue;
      if (/^[A-Za-z0-9]{1,3}$/.test(t)) continue; // ID断片など
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t.length > 40 ? t.slice(0, 40) : t);
    }
  }
  return out.slice(0, 8);
}
// フォールバック（タイトル・サマリから素直に作る）
function fallbackTags(title?: string, summary?: string): string[] {
  const src = `${title ?? ""} ${summary ?? ""}`.replace(/[「」"']/g, " ");
  const bag = new Set<string>();
  const push = (t: string) => {
    const n = normalizeTagText(t);
    if (n && n.length >= 2) bag.add(n);
  };
  if (src) push(src);
  // 日本語サイトの汎用タグを薄く
  bag.add("レンタル");
  bag.add("口コミ");
  bag.add("評判");
  return Array.from(bag).slice(0, 5);
}

(async () => {
  try {
    if (getApps().length === 0) initializeApp();
    const db = getFirestore();

    let q = db.collection("blogs").where("visibility", "==", "public");
    if (SITE) q = q.where("siteId", "==", SITE);

    const snap = await q.get();
    console.log(`[scan] blogs: ${snap.size}${SITE ? ` (siteId=${SITE})` : ""}`);

    let processed = 0;
    let writes = 0;
    const batchSize = 300;

    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const batch = db.batch();

      for (const d of chunk) {
        const data = d.data();
        const orig: string[] = Array.isArray(data.tags) ? data.tags : [];
        const cleaned = sanitizeTagsInline(orig);

        const finalTags =
          cleaned.length > 0
            ? cleaned
            : fallbackTags(
                String(data.title ?? ""),
                String(data.summary ?? "")
              );

        if (JSON.stringify(orig) === JSON.stringify(finalTags)) continue;

        if (DRY_RUN) {
          console.log(
            `[dryrun] ${d.id}\n  before: ${JSON.stringify(
              orig
            )}\n  after : ${JSON.stringify(finalTags)}`
          );
        } else {
          batch.update(d.ref, { tags: finalTags, updatedAt: Date.now() });
          writes++;
        }
      }

      if (!DRY_RUN) await batch.commit();
      processed += chunk.length;
      console.log(
        `[progress] processed=${processed}/${snap.size} writes=${writes}`
      );
    }

    console.log(
      `[done] processed=${processed} writes=${writes}${
        DRY_RUN ? " (dryRun)" : ""
      }`
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
