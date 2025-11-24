// apps/web/lib/pain-helpers.ts
import { decodePainRules, type PainRuleLite } from "@/lib/pain-rules";

export async function loadPainRules(siteId: string): Promise<PainRuleLite[]> {
  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY;

  // env が入ってないときは静かに何もしない
  if (!projectId || !apiKey) return [];

  try {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sites/${encodeURIComponent(
        siteId
      )}`
    );
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      console.warn("[pain] loadPainRules non-ok", res.status, url.toString());
      return [];
    }

    const json = (await res.json()) as
      | { fields?: Record<string, unknown> }
      | undefined;
    const fields = json?.fields as Record<string, unknown> | undefined;
    return decodePainRules(fields) ?? [];
  } catch (e) {
    console.error("[pain] loadPainRules fetch failed", e);
    // ここで必ず空配列返すようにして、/blog ページが落ちないようにする
    return [];
  }
}
