import * as functions from "firebase-functions/v1";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/**
 * painId のクリックを加算する
 * 例:
 *   /trackPainClick?painId=year-end-cooking&siteId=kariraku
 */
export const trackPainClick = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const painId = req.query.painId as string | undefined;
      const siteId = (req.query.siteId as string | undefined) || "default";

      if (!painId) {
        res.status(400).json({ error: "missing painId" });
        return;
      }

      const db = getFirestore();

      const docPath = `stats/clicks_pain_${painId}/${siteId}`;
      const ref = db.doc(docPath);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists ? snap.get("count") || 0 : 0;
        tx.set(
          ref,
          {
            count: prev + 1,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      });

      res.status(200).json({ ok: true, painId, siteId });
    } catch (err) {
      console.error("[trackPainClick] error", err);
      res.status(500).json({ error: "internal error" });
    }
  });
