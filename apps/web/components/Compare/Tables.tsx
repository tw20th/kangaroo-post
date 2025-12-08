// apps/web/components/Compare/Tables.tsx
const tableClass =
  "w-full border-collapse text-xs md:text-sm [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2";

export default function Tables() {
  return (
    <section id="tables" className="space-y-4">
      <details className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          もう少しちゃんと比べたい人向け：タイプ別のざっくり比較表
        </summary>
        <p className="mt-2 text-xs text-slate-600 md:text-sm">
          ここは「もう少し条件を見比べたい」ときだけ開けばOKです。
          数値はあくまで目安なので、最新の条件は必ず各公式サイトでご確認ください。
        </p>

        <div className="mt-4 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-emerald-700">
              🏠 生活まるごとレンタル（かして／ラクリアーズ／Happy）
            </h3>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>サービス名</th>
                    <th>得意なシーン</th>
                    <th>最低利用期間の目安</th>
                    <th>特徴の一言</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>かして！どっとこむ</td>
                    <td>引っ越し・単身赴任〜ファミリーまで</td>
                    <td>30日〜（セット／単品）</td>
                    <td>
                      家電＋家具セットが豊富。全国配送＆設置込みで「とりあえず生活を整えたい」方向き。
                    </td>
                  </tr>
                  <tr>
                    <td>ラクリアーズ</td>
                    <td>新品で長めに使いたいとき</td>
                    <td>12ヶ月〜 など</td>
                    <td>
                      すべて新品＆サブスクに近い形。長く使う前提で「新品だけでそろえたい」方向け。
                    </td>
                  </tr>
                  <tr>
                    <td>Happy!レンタル</td>
                    <td>一人暮らし・短期の仮住まい</td>
                    <td>数ヶ月〜1年程度</td>
                    <td>
                      必要なものだけピンポイントで借りやすい。一人暮らし向けにちょうどよいセット感。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-sky-700">
              📷 ガジェット短期レンタル（ゲオ／DMM／Rentry）
            </h3>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>サービス名</th>
                    <th>ジャンル</th>
                    <th>最低利用期間の目安</th>
                    <th>返却方法</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>ゲオあれこれレンタル</td>
                    <td>カメラ・双眼鏡・PC・生活家電など幅広い</td>
                    <td>2泊3日〜 / 月額1ヶ月〜</td>
                    <td>コンビニ返却OK・往復送料込み（一部地域除く）</td>
                  </tr>
                  <tr>
                    <td>DMMいろいろレンタル</td>
                    <td>家電・カメラ・ベビー用品・ファッションなど</td>
                    <td>2日〜 など</td>
                    <td>宅配返却・往復送料無料の商品多数</td>
                  </tr>
                  <tr>
                    <td>Rentry</td>
                    <td>カメラ・レンズ・撮影アクセサリー特化</td>
                    <td>3泊4日〜 など</td>
                    <td>宅配返却・クリーニング込み</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-amber-700">
              ✨ 買う前に試せるレンタル（ゲオの買えるレンタル／Bistro）
            </h3>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>サービス名</th>
                    <th>お試しできる主な商品</th>
                    <th>特徴</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>ゲオ（買えるレンタル）</td>
                    <td>スマホ・PC・カメラ・家電など</td>
                    <td>
                      レンタル後にそのまま購入すると、支払ったレンタル料の一部が差し引かれる仕組み。
                    </td>
                  </tr>
                  <tr>
                    <td>パナソニック Bistro</td>
                    <td>高機能オーブンレンジ</td>
                    <td>
                      メーカー公式の定額利用。料理をしながら、サイズ感や使い勝手をじっくり確認できる。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
