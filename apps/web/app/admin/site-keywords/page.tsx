// apps/web/app/admin/site-keywords/page.tsx

/* apps/web/app/admin/site-keywords/page.tsx */

import { adminDb } from "@/lib/firebaseAdmin";
import SiteKeywordsPage from "./SiteKeywordsPageClient";

type IntentId = "service" | "compare" | "guide";

type SiteKeyword = {
  id: string;
  siteId: string;
  keyword: string;
  intent: IntentId;
  status: "active" | "paused";
  usedCount: number;
  lastUsedAt: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  score: number;
  poolKey?: string | null;
  painRuleId?: string | null;
  lastBlogSlug?: string | null;
  createdAt: number;
  updatedAt: number;
};

export default async function Page() {
  const db = adminDb();

  const snap = await db
    .collection("siteKeywords")
    .where("siteId", "==", "kariraku")
    .orderBy("intent")
    .get();

  const items: SiteKeyword[] = snap.docs.map((doc) => {
    const data = doc.data() as Omit<SiteKeyword, "id">;

    return {
      id: doc.id,
      ...data,
    };
  });

  return <SiteKeywordsPage initialItems={items} />;
}
