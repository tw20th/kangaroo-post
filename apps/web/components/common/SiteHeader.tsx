import Link from "next/link";
import { getSiteEntry } from "@/lib/site-server";

export default function SiteHeader() {
  const s = getSiteEntry(); // サーバー専用OK
  const siteName = s.displayName;

  return (
    <header className="container-kariraku pt-6 pb-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand-600" />
          <span className="font-semibold tracking-tight">{siteName}</span>
        </Link>

        <nav className="text-sm">
          <ul className="flex items-center gap-5">
            <li>
              <Link href="/offers" className="hover:underline">
                家電レンタル
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:underline">
                ブログ
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
