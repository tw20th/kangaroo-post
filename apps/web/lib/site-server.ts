// apps/web/lib/site-server.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { coerceSiteId, siteCatalog, type SiteEntry } from "./site-catalog";

/** リクエスト外でも落ちない安全版 */
export function getServerSiteId(): string {
  let ck: string | undefined;
  let host: string | null | undefined;

  try {
    ck = cookies().get("siteId")?.value?.trim();
  } catch {
    // outside request scope
  }
  try {
    host = headers().get("host");
  } catch {
    // outside request scope
  }

  const def =
    process.env.NEXT_PUBLIC_SITE_ID ||
    process.env.DEFAULT_SITE_ID ||
    "chairscope";

  return coerceSiteId(ck, host ?? undefined, def);
}

/** 現在のサイト設定（安全フォールバック付） */
export function getSiteEntry(): SiteEntry {
  const siteId = getServerSiteId();
  const entry = siteCatalog.sites.find((s) => s.siteId === siteId);
  if (entry) return entry;

  if (process.env.NODE_ENV !== "production") {
    console.warn("[site] Unknown siteId:", siteId, "-> fallback to first");
  }
  return siteCatalog.sites[0]!;
}
