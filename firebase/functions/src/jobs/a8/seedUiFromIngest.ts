// firebase/functions/src/jobs/a8/seedUiFromIngest.ts
import * as functions from "firebase-functions/v1";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

type Offer = {
  vendor?: string;
  siteIds?: string[];
  archived?: boolean;
  priceMonthly?: number | null; // 旧フィールド互換
  minTermMonths?: number | null; // 旧フィールド互換
  extras?: any;
};

type UiBlock = {
  priceLabel?: string;
  minTermLabel?: string;
  isPriceDynamic?: boolean;
  shipping?: string;
  payment?: string;
  warranty?: string;
  faq?: string[];
};

function yen(n?: number | null) {
  return typeof n === "number" && isFinite(n) ? `¥${n.toLocaleString()}` : "";
}

function pick<T>(v: T | undefined, fb: T | undefined): T | undefined {
  return v !== undefined && v !== null ? (v as T) : fb;
}

function buildUiFromExtras(o: Offer): UiBlock {
  const ex = o.extras || {};
  const pricing = ex.pricing || {};
  const minTerm = ex.minTerm || {};
  // 直下の shipping/payment/warranty も見る
  const shipping = { ...(ex.shipping || {}), ...((o as any).shipping || {}) };
  const payment = { ...(ex.payment || {}), ...((o as any).payment || {}) };
  const warranty = { ...(ex.warranty || {}), ...((o as any).warranty || {}) };

  // price/minTerm（旧フィールドもフォールバック）
  const monthlyFrom = pricing.monthlyPriceFrom ?? o.priceMonthly ?? undefined;
  const minMonths = minTerm.monthlyMonths ?? o.minTermMonths ?? undefined;

  const priceLabel =
    typeof monthlyFrom === "number" ? `月額 ${yen(monthlyFrom)}〜` : undefined;

  const minTermLabel =
    typeof minMonths === "number" ? `最低 ${minMonths}ヶ月〜` : undefined;

  // shipping
  const shipParts: string[] = [];
  if (shipping.roundTripFree === true) {
    const exText =
      shipping.exceptions &&
      typeof shipping.exceptions === "object" &&
      Object.keys(shipping.exceptions).length
        ? `（北海道+${yen(shipping.exceptions["北海道"])}／沖縄+${yen(
            shipping.exceptions["沖縄県"]
          )} など）`
        : "";
    shipParts.push(`往復送料無料${exText}`.replace(/\s+/g, ""));
  }
  if (shipping.carrier) shipParts.push(`${shipping.carrier}配送`);
  const returns: string[] = [];
  if (shipping.returnLabelIncluded) returns.push("返送伝票同梱");
  const rm = Array.isArray(ex.returnMethods ?? shipping.returnMethods)
    ? ex.returnMethods ?? shipping.returnMethods
    : [];
  if (rm.length) returns.push(rm.join("・"));
  const packNote =
    ex.packagingNote ?? shipping.packagingNote
      ? `。${ex.packagingNote ?? shipping.packagingNote}`
      : "";
  // policy があれば最優先
  const shippingPolicyText =
    typeof shipping.policy === "string" && shipping.policy.trim()
      ? shipping.policy.trim()
      : undefined;
  const shippingText =
    shippingPolicyText ??
    (shipParts.length || returns.length
      ? `${shipParts.join("、")}。${returns.join("／")}${packNote}`.replace(
          /。[／。]+$/g,
          "。"
        )
      : undefined);

  // payment
  const brands = Array.isArray(payment.cardBrands)
    ? payment.cardBrands.join("/")
    : undefined;
  const threeDS = payment.threeDSecure === true ? "3Dセキュア必須" : undefined;
  const payMethods = Array.isArray(payment.methods)
    ? payment.methods.join("・")
    : undefined;
  const paymentText = [
    payMethods ? `支払い: ${payMethods}` : undefined,
    brands ? `対応ブランド: ${brands}` : undefined,
    threeDS,
  ]
    .filter(Boolean)
    .join("。");

  // warranty
  const caps: string[] = [];
  if (typeof warranty.repairCapYen === "number")
    caps.push(`修理上限 ${yen(warranty.repairCapYen)}`);
  if (typeof warranty.lostTheftMax === "string")
    caps.push(`紛失・盗難は ${warranty.lostTheftMax} 上限`);
  const wNotes = Array.isArray(warranty.notes)
    ? warranty.notes.join("／")
    : undefined;
  const warrantyText = [caps.join("、") || undefined, wNotes]
    .filter(Boolean)
    .join("。");

  // faq（hintをそのまま使う。無ければ簡易FAQ）
  const faqHints: string[] = Array.isArray(ex.faqHints)
    ? ex.faqHints
    : Array.isArray(ex.rentalPolicy?.short?.notes)
    ? ex.rentalPolicy.short.notes
    : [];
  const faq =
    faqHints.length > 0
      ? faqHints.slice(0, 5)
      : [
          "延長は自動延長・日割り加算（対象外あり）",
          "返送は同梱の着払い伝票でOK。箱・緩衝材は保管して再利用",
          "月額は更新日前日までに解約、更新日正午までに返送",
        ];

  return {
    priceLabel,
    minTermLabel,
    isPriceDynamic: pick(pricing.priceIsDynamic, ex.ui?.isPriceDynamic) ?? true,
    shipping: shippingText || undefined,
    payment: paymentText || undefined,
    warranty: warrantyText || undefined,
    faq,
  };
}

function mergeUi(base: any, incoming: UiBlock, force: boolean): UiBlock {
  if (force) return { ...(base || {}), ...incoming };
  return {
    ...(base || {}),
    priceLabel: base?.priceLabel ?? incoming.priceLabel,
    minTermLabel: base?.minTermLabel ?? incoming.minTermLabel,
    isPriceDynamic: base?.isPriceDynamic ?? incoming.isPriceDynamic ?? true,
    shipping: base?.shipping ?? incoming.shipping,
    payment: base?.payment ?? incoming.payment,
    warranty: base?.warranty ?? incoming.warranty,
    faq:
      (Array.isArray(base?.faq) && base.faq.length ? base.faq : undefined) ??
      incoming.faq,
  };
}

export const a8_seedUiFromIngest = functions
  .region("asia-northeast1")
  .https.onRequest(
    async (req: functions.https.Request, res: functions.Response) => {
      try {
        const db = getFirestore();

        const vendor = (req.query.vendor as string) || "geo-arekore";
        const siteId = (req.query.siteId as string) || "kariraku";

        // limit
        const rawLimit = (req.query.limit ?? "") as string;
        const parsed = Number.isFinite(+rawLimit)
          ? +rawLimit
          : parseInt(String(rawLimit), 10);
        const limit = Math.max(
          1,
          Math.min(2000, Number.isFinite(parsed) ? parsed : 1000)
        );

        const force = req.query.force === "1";
        const dryRun = req.query.dryRun === "1";

        // 対象 offers を取得
        const q: FirebaseFirestore.Query = db
          .collection("offers")
          .where("vendorId", "==", vendor)
          .where("status", "==", "active")
          // .where("siteIds", "array-contains", siteId) // 現行スキーマに無いなら外す
          .limit(limit);

        const snap = await q.get();

        let scanned = 0;
        let patched = 0;
        let ops = 0;
        let batch = db.batch();

        for (const doc of snap.docs) {
          scanned++;
          const o = doc.data() as Offer;
          const beforeExtras = o.extras || {};
          const beforeUi = beforeExtras.ui || {};

          // JSON（extras）から UI を自動生成
          const generated = buildUiFromExtras(o);
          const mergedUi = mergeUi(beforeUi, generated, force);

          const changed = JSON.stringify(beforeUi) !== JSON.stringify(mergedUi);
          if (!changed) continue;

          if (!dryRun) {
            batch.set(
              doc.ref,
              {
                extras: {
                  ...(beforeExtras || {}),
                  ui: mergedUi,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                updatedAt: Date.now(),
              },
              { merge: true }
            );
            ops++;
          }
          patched++;

          if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }

        if (!dryRun && ops > 0) await batch.commit();

        res.json({
          ok: true,
          vendor,
          siteId,
          limit,
          force,
          dryRun,
          scanned,
          patched,
        });
      } catch (e: any) {
        console.error(e);
        res.status(500).json({ ok: false, error: String(e?.message || e) });
      }
    }
  );
