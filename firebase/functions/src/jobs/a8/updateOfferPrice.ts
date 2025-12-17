// firebase/functions/src/jobs/a8/updateOfferPrice.ts
import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";

/**
 * 価格だけ手動更新する簡易エンドポイント（v1）
 * 例:
 *  /a8_updateOfferPrice?offerId=s00000023591001:geo-arekore&monthlyPriceFrom=5490
 *  /a8_updateOfferPrice?offerId=xxx&shortBaseDays=4&shortBasePriceFrom=6490
 *
 * 返却: { ok: true, offerId, patch }
 */
export const a8_updateOfferPrice = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    try {
      const { offerId, monthlyPriceFrom, shortBaseDays, shortBasePriceFrom } =
        req.query as Record<string, string>;

      if (!offerId) {
        res.status(400).json({ ok: false, error: "offerId required" });
        return;
      }

      const db = getFirestore();
      const ref = db.collection("offers").doc(offerId);

      const patch: Record<string, unknown> = {
        updatedAt: Date.now(),
        "extras.pricing.priceLastChecked": Date.now(),
      };

      // 月額の目安（数値）
      if (monthlyPriceFrom && !Number.isNaN(Number(monthlyPriceFrom))) {
        patch["priceMonthly"] = Number(monthlyPriceFrom);
        patch["extras.ui.priceLabel"] = `月額 ${Number(
          monthlyPriceFrom
        ).toLocaleString()}円〜`;
        patch["extras.ui.isPriceDynamic"] = true;
      }

      // 短期の基準（例: 4泊5日 6,490円〜）
      if (
        shortBaseDays &&
        !Number.isNaN(Number(shortBaseDays)) &&
        shortBasePriceFrom &&
        !Number.isNaN(Number(shortBasePriceFrom))
      ) {
        const d = Number(shortBaseDays);
        const p = Number(shortBasePriceFrom);
        patch["extras.pricing.shortBaseDays"] = d;
        patch["extras.pricing.shortBasePriceFrom"] = p;
        patch["extras.ui.priceLabel"] = `${d}日基準 ${p.toLocaleString()}円〜`;
        patch["extras.ui.isPriceDynamic"] = true;
      }

      await ref.set(patch, { merge: true });

      res.json({ ok: true, offerId, patch });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
      return;
    }
  });
