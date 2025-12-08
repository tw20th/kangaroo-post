// apps/web/components/offers/OfferCard.tsx
import Link from "next/link";
import Image from "next/image";
import type { OfferRow } from "@/lib/queries-offers";
import { labelForCompanyType, getThemeThumbnail } from "@/lib/offers-ui";

type Props = {
  offer: OfferRow;
};

export default function OfferCard({ offer }: Props) {
  const name =
    offer.displayName && offer.displayName.trim().length > 0
      ? offer.displayName.trim()
      : "サービス名未設定";

  const companyType = offer.profile?.companyType ?? null;
  const companyTypeLabel = labelForCompanyType(companyType);
  const thumbnail = getThemeThumbnail(companyType);
  const shortCopy = offer.profile?.shortCopy ?? "";
  const priceLabel = offer.profile?.priceLabel ?? "";
  const minTermLabel = offer.profile?.minTermLabel ?? "";
  const detailHref = `/offers/${offer.id}`;
  return (
    <li>
      <article className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-soft transition hover:shadow-softHover">
        {/* サムネ */}
        <div className="relative w-full overflow-hidden">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={thumbnail}
              alt={`${companyTypeLabel}のイメージ`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/10" />
          </div>
        </div>

        {/* テキスト */}
        <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
          <div className="mb-1 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800">
            {companyTypeLabel}
          </div>

          <h2 className="line-clamp-2 text-sm font-semibold tracking-tight text-gray-900">
            {name}
          </h2>

          {shortCopy && (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-700">
              {shortCopy}
            </p>
          )}

          {(priceLabel || minTermLabel) && (
            <p className="mt-2 text-[11px] text-gray-600">
              {priceLabel}
              {priceLabel && minTermLabel ? " ／ " : ""}
              {minTermLabel}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px]">
            <Link
              href={detailHref}
              className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              サービスの詳細を見る
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}
