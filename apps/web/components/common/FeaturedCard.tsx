// apps/web/components/common/FeaturedCard.tsx
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

type FeaturedCardProps = {
  href: string;
  title: string;
  description?: string;
  label?: string; // 「この記事もおすすめ」などの小ラベル
  imageUrl?: string;
  imageAlt?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * ゆずは世界観用の「やさしいおすすめカード」
 * - A1-2: 周りより少しだけ明るい
 * - 角丸大きめ
 * - 影は控えめ
 * - hover 時に ほんの少しだけ 浮く
 */
export default function FeaturedCard({
  href,
  title,
  description,
  label,
  imageUrl,
  imageAlt,
  children,
  className,
}: FeaturedCardProps) {
  return (
    <Link
      href={href}
      className={[
        // ベース
        "group block rounded-2xl border border-black/5 bg-surface-featured shadow-sm",
        // 動き
        "transition-transform transition-shadow duration-150 ease-out",
        "hover:-translate-y-0.5 hover:shadow-md",
        // レイアウト
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex gap-4 p-4 sm:p-5">
        {imageUrl && (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-surface-soft">
            <Image
              src={imageUrl}
              alt={imageAlt ?? title}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {label && (
            <div className="mb-1 inline-flex items-center rounded-full bg-black/5 px-2 py-0.5 text-xs text-neutral-500">
              {label}
            </div>
          )}

          <h3 className="line-clamp-2 text-sm font-semibold tracking-tight text-neutral-900">
            {title}
          </h3>

          {description && (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
              {description}
            </p>
          )}

          {children && (
            <div className="mt-2 text-xs text-neutral-600">{children}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
