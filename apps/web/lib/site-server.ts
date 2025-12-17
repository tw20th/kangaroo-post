//apps/web/lib/site-server.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { coerceSiteId, siteCatalog, type SiteEntry } from "./site-catalog";

/** リクエスト外でも落ちない安全版 */
export function getServerSiteId(): string {
  let headerSiteId: string | undefined;
  let ck: string | undefined;
  let host: string | undefined;

  try {
    headerSiteId = headers().get("x-site-id")?.trim() || undefined;
  } catch {}

  try {
    ck = cookies().get("siteId")?.value?.trim();
  } catch {}

  try {
    host = headers().get("host") || undefined;
  } catch {}

  const def =
    process.env.NEXT_PUBLIC_SITE_ID ||
    process.env.DEFAULT_SITE_ID ||
    "kariraku";

  // ✅ middleware と同じ優先順に寄せる：header > host > cookie > default
  // middleware は host を cookie より優先しているので合わせる
  return coerceSiteId(headerSiteId ?? host ?? ck, host, def);
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
