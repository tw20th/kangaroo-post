// apps/web/app/admin/site-companies/page.tsx
import { getSiteEntry } from "@/lib/site-server";
import SiteCompaniesPageClient from "./SiteCompaniesPageClient";

export default function SiteCompaniesPage() {
  const site = getSiteEntry(); // 現在のサイト (kariraku / hadasmooth など)

  return (
    <SiteCompaniesPageClient
      siteId={site.siteId} // ← ここを site.id から site.siteId に
      siteName={site.displayName}
    />
  );
}
