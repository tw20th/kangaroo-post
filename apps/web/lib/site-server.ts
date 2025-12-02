import "server-only";
import { cookies, headers } from "next/headers";
import { coerceSiteId, siteCatalog, type SiteEntry } from "./site-catalog";

/** リクエスト外でも落ちない安全版 */
export function getServerSiteId(): string {
  let headerSiteId: string | undefined;
  let ck: string | undefined;
  let host: string | undefined;

  try {
    // middleware でセットした x-site-id を最優先で使う
    headerSiteId = headers().get("x-site-id")?.trim() || undefined;
  } catch {
    // outside request scope
  }

  try {
    ck = cookies().get("siteId")?.value?.trim();
  } catch {
    // outside request scope
  }

  try {
    host = headers().get("host") || undefined;
  } catch {
    // outside request scope
  }

  // デフォルトは middleware 側と揃えて kariraku に統一
  const def =
    process.env.NEXT_PUBLIC_SITE_ID ||
    process.env.DEFAULT_SITE_ID ||
    "kariraku";

  // x-site-id があればそれを最優先で解釈
  if (headerSiteId) {
    return coerceSiteId(headerSiteId, host, def);
  }

  // なければ cookie / host / def から判定
  return coerceSiteId(ck, host, def);
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
