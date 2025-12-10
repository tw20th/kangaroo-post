// apps/web/app/public/disclaimer/page.tsx
export const dynamic = "force-dynamic";

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-4">
      <h1 className="mb-2 text-2xl font-bold">免責事項</h1>

      <p className="text-sm leading-relaxed">
        カンガルーポスト（以下、「当サイト」）で提供する記事・コンテンツは、AIによる自動生成および人の手による編集を組み合わせて作成しています。内容の正確性・有用性・最新性の確保に努めておりますが、その完全性を保証するものではありません。
      </p>

      <p className="text-sm leading-relaxed">
        当サイトの情報をもとに行った行動や意思決定については、利用者ご自身の判断と責任において行っていただきますようお願いいたします。当サイトおよび運営者は、それにより生じたいかなる損失・損害についても一切の責任を負いかねます。
      </p>

      <p className="text-sm leading-relaxed">
        記事内で紹介するサービス・商品・キャンペーン情報・価格等は、掲載時点の情報であり、予告なく変更される場合があります。最新の内容については、必ず各サービス提供元・公式サイトにてご確認ください。
      </p>

      <p className="text-sm leading-relaxed">
        当サイトの一部のリンクはアフィリエイトリンクを含む場合があります。リンク先で提供されるサービス・商品に関するお問い合わせやトラブルについては、直接各事業者様へご連絡ください。当サイトでは、外部サイトの内容や提供サービスについての責任を負いません。
      </p>
    </main>
  );
}
