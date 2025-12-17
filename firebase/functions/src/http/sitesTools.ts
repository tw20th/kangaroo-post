import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { promises as fs } from "fs";
import path from "path";

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/** /sites/*.json を Firestore /sites/{siteId} に upsert */
export const sites_syncFromFiles = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const dir = String(req.query.dir || "sites"); // 例: firebase/functions/sites
      const base = path.resolve(process.cwd(), dir);
      const files = (await fs.readdir(base)).filter((f) => f.endsWith(".json"));
      if (!files.length) {
        res.status(200).json({ ok: true, processed: 0, files: [] });
        return;
      }

      const now = Date.now();
      let processed = 0;
      const listed: string[] = [];

      for (const f of files) {
        const full = path.join(base, f);
        const raw = await fs.readFile(full, "utf8");
        const json = JSON.parse(raw || "{}");
        const siteId = String(json.siteId || path.basename(f, ".json")).trim();
        if (!siteId) continue;

        await db
          .collection("sites")
          .doc(siteId)
          .set({ ...json, updatedAt: now, createdAt: now }, { merge: true });

        listed.push(`${siteId}<-${f}`);
        processed++;
      }

      res.status(200).json({ ok: true, processed, files: listed });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });
