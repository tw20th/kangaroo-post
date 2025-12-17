import * as functions from "firebase-functions/v1";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

/**
 * ブログ単位の CTR をざっくり確認するためのデバッグ用 HTTP 関数
 *
 * GET /debugBlogCtr?siteId=kariraku&slug=xxx
 *
 * 返り値:
 * {
 *   ok: true,
 *   siteId,
 *   slug,
 *   views: number,
 *   cta: number,
 *   ctr: number | null,
 *   breakdown: { [where: string]: number }
 * }
 */
export const debugBlogCtr = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    try {
      const siteId = String(req.query.siteId || "").trim();
      const slug = String(req.query.slug || "").trim();

      if (!siteId || !slug) {
        res.status(400).json({
          ok: false,
          error: "siteId and slug are required",
        });
        return;
      }

      const clicksRef = db
        .collection("tracks")
        .doc(siteId)
        .collection("clicks");

      const snap = await clicksRef
        .where("type", "==", "blog")
        .where("blogSlug", "==", slug)
        .get();

      let views = 0;
      let cta = 0;
      const breakdown: Record<string, number> = {};

      snap.forEach((doc) => {
        const data = doc.data() as {
          where?: string | null;
        };
        const where = data.where || "unknown";

        breakdown[where] = (breakdown[where] ?? 0) + 1;

        if (where === "view") {
          views += 1;
        } else if (where.startsWith("cta")) {
          cta += 1;
        }
      });

      const ctr = views > 0 ? cta / views : null;

      res.json({
        ok: true,
        siteId,
        slug,
        views,
        cta,
        ctr,
        breakdown,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });
