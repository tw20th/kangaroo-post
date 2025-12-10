// apps/web/app/public/privacy/page.tsx
export const metadata = {
  title: "プライバシーポリシー | カンガルーポスト",
};

export default function Page() {
  return (
    <main className="container-kariraku py-10 space-y-6">
      <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
      <p className="text-sm opacity-80">
        当サイト「カンガルーポスト」は、アクセス解析ツールやアフィリエイトプログラム等を利用する場合があります。
        取得する情報・利用目的・第三者提供・Cookie等の取り扱いについては、後日あらためて本ページに詳細を記載いたします。
      </p>
      {/* ここに実体文を後で追記でOK */}
    </main>
  );
}
