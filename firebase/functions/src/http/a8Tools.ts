import * as functions from "firebase-functions/v1";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/** 1) A8 JSON を Firestore に同期（ファイル -> offers） */
export const a8_syncFromFiles = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const mod = await import("../scripts/tools/syncA8FromFiles.js");
      const fn = (mod as any).syncA8FromFiles || (mod as any).default;
      if (typeof fn !== "function")
        throw new Error("syncA8FromFiles not found");

      // クエリから受け取り（デフォルト dir は ingest/a8）
      const site = String(req.query.site || "");
      const dir = String(req.query.dir || "ingest/a8");
      const dryRun =
        String(req.query.dryRun ?? req.query["dry-run"] ?? "") === "true";
      const archiveMissing =
        String(
          req.query.archiveMissing ?? req.query["archive-missing"] ?? ""
        ) === "true";

      if (!site) {
        res.status(400).json({ ok: false, error: "site is required" });
        return;
      }

      const result = await fn({ site, dir, dryRun, archiveMissing });
      res.status(200).json({ ok: true, result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

/** 2) raw -> offers 正規化（ピュア関数を呼ぶ） */
export const a8_normalizeOffers = functions
  .region(REGION)
  .https.onRequest(async (_req, res) => {
    try {
      const mod = await import("../jobs/a8/normalizeA8Offers.js");
      const fn = (mod as any).normalizeA8Offers || (mod as any).default;
      if (typeof fn !== "function")
        throw new Error("normalizeA8Offers not found");

      const siteId = String(_req.query.siteId || "");
      const result = await fn({ siteId });
      res.status(200).json({ ok: true, result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

/** 3) 1件のオファーからブログ生成（既存ロジックをこのファイルで定義） */
export const a8_generateBlogFromOffer = functions
  .region(REGION)
  .runWith({
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 180, // ★ 60s → 180s
    memory: "512MB", // ★ 省メモリモデルでも512MBあると安定
  })
  .https.onRequest(async (req, res) => {
    try {
      const offerId = String(req.query.offerId || "");
      const siteId = String(
        req.query.siteId || process.env.FOCUS_SITE_ID || ""
      );
      const keyword = String(req.query.keyword || ""); // ← 既に追加済みのはず

      if (!offerId || !siteId) {
        res
          .status(400)
          .json({ ok: false, error: "offerId and siteId are required" });
        return;
      }

      const mod = await import("../jobs/content/generateBlogFromOffer.js");
      const fn = (mod as any).generateBlogFromOffer || (mod as any).default;
      if (typeof fn !== "function")
        throw new Error("generateBlogFromOffer not found");

      const result = await fn({
        offerId,
        siteId,
        keyword,
        publish: true,
        dryRun: false,
      });

      res.status(200).json({ ok: true, result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });
