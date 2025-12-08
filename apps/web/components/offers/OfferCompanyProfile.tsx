// apps/web/components/offers/OfferCompanyProfile.tsx
/* eslint-disable @next/next/no-img-element */

export type OfferProfile = {
  targetUsers?: string[];
  strengths?: string[];
  weaknesses?: string[];
  importantNotes?: string[];
};

type Props = {
  profile?: OfferProfile;
};

export default function OfferCompanyProfile({ profile }: Props) {
  if (!profile) return null;

  const {
    targetUsers = [],
    strengths = [],
    weaknesses = [],
    importantNotes = [],
  } = profile;

  const hasContent =
    targetUsers.length > 0 ||
    strengths.length > 0 ||
    weaknesses.length > 0 ||
    importantNotes.length > 0;

  if (!hasContent) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">
        運営会社の特徴・事前に知っておきたいこと
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {targetUsers.length > 0 ? (
          <div className="card bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold">特におすすめの人</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {targetUsers.map((t: string) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {strengths.length > 0 ? (
          <div className="card bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold">サービスの強み</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {strengths.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {weaknesses.length > 0 ? (
          <div className="card bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold">
              気をつけておきたいポイント
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {weaknesses.map((w: string) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {importantNotes.length > 0 ? (
          <div className="card bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold">
              申し込み前にチェックしておきたいこと
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {importantNotes.map((n: string) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
