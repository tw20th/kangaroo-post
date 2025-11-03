// apps/web/app/offers/page.tsx
import { getServerSiteId, getSiteEntry } from "@/lib/site-server";
import { notFound } from "next/navigation";
import OfferGallery from "@/components/offers/OfferGallery";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const siteId = getServerSiteId();
  const s = getSiteEntry();
  if (s.features?.offers === false) notFound(); // or redirect("/products")
  return <OfferGallery siteId={siteId} variant="hero" limit={24} />;
}
