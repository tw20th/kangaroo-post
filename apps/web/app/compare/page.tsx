// apps/web/app/compare/page.tsx
import TypeIntro from "@/components/Compare/TypeIntro";
import TypeSelector from "@/components/Compare/TypeSelector";
import ServiceCards from "@/components/Compare/ServiceCards";
import Recommendation from "@/components/Compare/Recommendation";
import Tables from "@/components/Compare/Tables";

export const revalidate = 60;

export default function RentalComparePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-16 pt-10">
      {/* ① タイトル＋3タイプざっくり紹介（ほぼ読む必要なし） */}
      <TypeIntro />

      {/* ② タイプ診断（2ステップのボタンだけ） */}
      <TypeSelector />

      {/* ③ タイプ別のサービスカード（カードだけ眺めればOK） */}
      <ServiceCards />

      {/* ④ もう少しちゃんと比べたい人だけ読むテーブル（detailsで隠す） */}
      <Tables />

      {/* ⑤ 最後のひと押し・シーン別のおすすめまとめ */}
      <Recommendation />
    </main>
  );
}
