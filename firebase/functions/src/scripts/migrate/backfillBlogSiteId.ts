import * as functions from "firebase-functions/v1";
import type { Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";

const REGION = "asia-northeast1";
const db = getFirestore();

export const runBackfillBlogSiteId = functions
  .region(REGION)
  .runWith({ secrets: ["ADMIN_TASK_SECRET"] })
  .https.onRequest(async (req: Request, res: Response) => {
    const key = String(req.query.key || "");
    if (key !== process.env.ADMIN_TASK_SECRET) {
      res.status(401).send("unauthorized");
      return;
    }
    const limit = Number(req.query.limit ?? 500);

    // 修正対象: siteId が欠損 or "affiscope" になっている記事
    const snap = await db
      .collection("blogs")
      .where("status", "in", ["draft", "published"])
      .limit(limit)
      .get();

    let scanned = 0,
      patched = 0,
      skipped = 0,
      notFound = 0;

    for (const doc of snap.docs) {
      scanned++;
      const b = doc.data() as any;
      const current = b.siteId as string | undefined;
      const asin = b.relatedAsin as string | undefined;

      // 対象条件（必要ならここに current === "affiscope" を残す）
      if (!asin || !current || current === "affiscope") {
        if (!asin) {
          skipped++;
          continue;
        }

        const pDoc = await db.collection("products").doc(asin).get();
        if (!pDoc.exists) {
          notFound++;
          continue;
        }
        const p = pDoc.data() as any;
        const correct = p.siteId as string | undefined;
        if (!correct || correct === current) {
          skipped++;
          continue;
        }

        await doc.ref.set(
          { siteId: correct, updatedAt: Date.now() },
          { merge: true }
        );
        console.log(`patched blogs/${doc.id}: ${current} -> ${correct}`);
        patched++;
      } else {
        skipped++;
      }
    }

    res.json({ scanned, patched, skipped, notFound });
  });
