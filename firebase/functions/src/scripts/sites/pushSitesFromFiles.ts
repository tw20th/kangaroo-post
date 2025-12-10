// firebase/functions/src/scripts/sites/pushSitesFromFiles.ts
import { getApps, initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

function initDb() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? "kangaroo-post";

    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        projectId,
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      initializeApp({ projectId });
    }

    // eslint-disable-next-line no-console
    console.log(
      "[pushSitesFromFiles] initialized projectId=",
      getApp().options.projectId
    );
  }

  return getFirestore();
}

const db = initDb();

type SiteFile = {
  siteId: string;
  displayName?: string;
  domain?: string;
  features?: { blogs?: boolean; ranking?: boolean };
  tagRules?: unknown[];
  painRules?: unknown[];
  productRules?: unknown;
  discovery?: unknown;
  rakutenKeywords?: string[];
  rakutenCategoryMap?: Record<string, string>;
  defaultCategoryId?: string;

  // ★ 追加：サイトごとの世界観＆テンプレ
  profile?: {
    tone?: string;
    audienceNote?: string;
    discoverNote?: string;
  };
  blogTemplates?: {
    service?: string;
    compare?: string;
    guide?: string;
    discover?: string;
    [k: string]: string | undefined;
  };
};

async function main() {
  const SITES_DIR = path.resolve(process.cwd(), "sites");
  const files = fs.readdirSync(SITES_DIR).filter((f) => f.endsWith(".json"));
  let writes = 0;

  for (const f of files) {
    const json = JSON.parse(
      fs.readFileSync(path.join(SITES_DIR, f), "utf-8")
    ) as SiteFile;

    if (!json.siteId) continue;
    const docId = json.siteId;

    // Firestore に必要なフィールドだけ投影
    const payload = {
      siteId: json.siteId,
      displayName: json.displayName ?? null,
      domain: json.domain ?? null,
      features: json.features ?? {},
      tagRules: json.tagRules ?? [],
      painRules: json.painRules ?? [],
      productRules: json.productRules ?? {},
      discovery: json.discovery ?? {},
      rakutenKeywords: Array.isArray(json.rakutenKeywords)
        ? json.rakutenKeywords
        : [],
      rakutenCategoryMap: json.rakutenCategoryMap ?? {},
      defaultCategoryId: json.defaultCategoryId ?? null,

      // ★ 追加分
      profile: json.profile ?? null,
      blogTemplates: json.blogTemplates ?? {},

      updatedAt: Date.now(),
      createdAt: Date.now(),
    };

    await db.collection("sites").doc(docId).set(payload, { merge: true });
    // eslint-disable-next-line no-console
    console.log(`upsert sites/${docId}`);
    writes++;
  }

  // eslint-disable-next-line no-console
  console.log(`done. updated ${writes} site docs.`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
