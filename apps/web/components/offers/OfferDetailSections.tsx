/* eslint-disable @next/next/no-img-element */
type UiBlock = {
  priceLabel?: string;
  minTermLabel?: string;
  isPriceDynamic?: boolean;
  shippingNote?: string;
  paymentNote?: string;
  warrantyNote?: string;
  faqBullets?: string[]; // 箇条書き
};

export default function OfferDetailSections({ ui }: { ui?: UiBlock }) {
  if (!ui) return null;

  return (
    <section className="space-y-6">
      {(ui.priceLabel || ui.minTermLabel) && (
        <div className="card bg-white p-4 text-sm">
          {ui.priceLabel && (
            <div className="mb-1">
              <span className="font-medium">{ui.priceLabel}</span>
              {ui.isPriceDynamic && (
                <span className="ml-1 text-xs text-gray-500">
                  （目安・最新は公式）
                </span>
              )}
            </div>
          )}
          {ui.minTermLabel && (
            <div className="text-xs text-gray-600">{ui.minTermLabel}</div>
          )}
        </div>
      )}

      {ui.shippingNote && (
        <div className="card bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">配送・返送</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {ui.shippingNote}
          </p>
        </div>
      )}

      {ui.paymentNote && (
        <div className="card bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">支払い方法</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {ui.paymentNote}
          </p>
        </div>
      )}

      {ui.warrantyNote && (
        <div className="card bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">保証について</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {ui.warrantyNote}
          </p>
        </div>
      )}

      {ui.faqBullets?.length ? (
        <div className="card bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">よくある質問</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {ui.faqBullets.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
