import * as functions from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const trackClick = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }

    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      /**
       * 互換維持：
       *  - { asin } があれば products/{asin}.views を +1
       * 拡張：
       *  - { slug, type: "view" | "cta" } で blogs/{slug}.metrics を +1
       */
      const { asin } = body as { asin?: string };
      const { slug, type } = body as {
        slug?: string;
        type?: "view" | "cta";
      };

      const db = getFirestore();

      // 1) 旧仕様（製品クリック計測）
      if (asin) {
        await db
          .collection("products")
          .doc(String(asin))
          .set({ views: FieldValue.increment(1) }, { merge: true });

        res.status(204).end();
        return;
      }

      // 2) 新仕様（ブログ計測）
      if (slug && (type === "view" || type === "cta")) {
        const field =
          type === "view" ? "metrics.views" : "metrics.outboundClicks";
        await db
          .collection("blogs")
          .doc(String(slug))
          .set(
            {
              metrics: {
                // ここはネストマージなので、個別にインクリメント
                [field.split(".")[1]]: FieldValue.increment(1),
              } as any,
              updatedAt: Date.now(),
            },
            { merge: true }
          );

        res.status(204).end();
        return;
      }

      // 3) どちらでもないリクエスト
      res.status(400).send("bad request");
    } catch (e) {
      console.error(e);
      res.status(500).send("error");
    }
  });
