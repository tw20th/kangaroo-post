// apps/web/components/common/SiteFooter.tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-gray-600">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="mb-2 font-semibold">運営について</div>
            <p className="opacity-80">
              カンガルーポストは、サイト更新が苦手な人のために記事づくりをそっと肩代わりするサービスです。AIによる自動生成と、人のチェックを組み合わせて、やさしい文章で記事を増やしていきます。
            </p>
          </div>
          <div>
            <div className="mb-2 font-semibold">サイトポリシー</div>
            <ul className="space-y-1">
              <li>
                <Link href="/policy/ads" className="underline">
                  広告掲載について
                </Link>
              </li>
              <li>
                <Link href="/public/privacy" className="underline">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href="/public/disclaimer" className="underline">
                  免責事項
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-2 font-semibold">お問い合わせ</div>
            <p className="opacity-80">
              ご意見・修正のご依頼は、今後設置予定のお問い合わせフォームからお送りいただけるよう準備中です。
            </p>
          </div>
        </div>
        <div className="mt-6 text-xs opacity-60">
          © {new Date().getFullYear()} Kangaroo Post
        </div>
      </div>
    </footer>
  );
}
