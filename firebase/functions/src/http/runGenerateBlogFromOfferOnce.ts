// firebase/functions/src/http/runGenerateBlogFromOfferOnce.ts
import * as functions from "firebase-functions";
import { logger } from "firebase-functions/v2";
import { generateBlogFromOffer } from "../jobs/content/generateBlogFromOffer.js";

const REGION = "asia-northeast1";

/**
 * 単発で「企業記事（service）」を 1 本生成する HTTP トリガー
 *
 * 例:
 * curl "https://asia-northeast1-<project>.cloudfunctions.net/runGenerateBlogFromOfferOnce?site=kariraku&offer=s00000003161003:kasite"
 */
export const runGenerateBlogFromOfferOnce = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    const site = (req.query.site || req.query.siteId) as string | undefined;
    const offer = (req.query.offer || req.query.offerId) as string | undefined;
    const dryRun =
      req.query.dryRun === "1" ||
      req.query.dryRun === "true" ||
      req.query.dryRun === "yes";

    if (!site || !offer) {
      res.status(400).json({
        ok: false,
        error: "missing site / offer. usage: ?site=kariraku&offer=s0000...",
      });
      return;
    }

    try {
      logger.info("[runGenerateBlogFromOfferOnce] start", {
        site,
        offer,
        dryRun,
      });

      const result = await generateBlogFromOffer({
        siteId: site,
        offerId: offer,
        dryRun,
      });

      logger.info("[runGenerateBlogFromOfferOnce] done", {
        site,
        offer,
        result,
      });

      res.status(200).json({ ok: true, result });
    } catch (e) {
      logger.error("[runGenerateBlogFromOfferOnce] error", e);
      res
        .status(500)
        .json({ ok: false, error: (e as Error)?.message ?? "unknown error" });
    }
  });
