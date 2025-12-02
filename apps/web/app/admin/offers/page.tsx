// apps/web/app/admin/offers/page.tsx
import SiteOffersPageClient from "./OffersPageClient";
import { getSiteEntry } from "@/lib/site-server";

export const dynamic = "force-dynamic";

export default function SiteOffersPage() {
  const site = getSiteEntry(); // kariraku / hadasmooth など

  return (
    <SiteOffersPageClient siteId={site.siteId} siteName={site.displayName} />
  );
}
