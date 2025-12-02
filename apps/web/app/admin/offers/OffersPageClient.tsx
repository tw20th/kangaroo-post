// apps/web/app/admin/offers/OffersPageClient.tsx
"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import type {
  A8Offer,
  A8OfferInput,
  OfferPlacement,
  OfferCreativeType,
} from "@/lib/firebase/offers";
import {
  fetchOffersBySite,
  createOffer,
  updateOffer,
} from "@/lib/firebase/offers";

type Props = {
  siteId: string;
  siteName: string;
};

type Message =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

function createEmptyForm(siteId: string): A8OfferInput {
  return {
    siteId,
    companyId: "",
    label: "",
    creativeType: "text",
    placement: "blog-body",
    htmlRaw: "",
    linkUrl: "",
    imageUrl: "",
    width: null,
    height: null,
    isActive: true,
    notes: "",
  };
}

const placementOptions: { value: OfferPlacement; label: string }[] = [
  { value: "company-card", label: "企業カード内" },
  { value: "blog-body", label: "記事本文中" },
  { value: "blog-footer", label: "記事末尾CTA" },
];

const creativeTypeOptions: { value: OfferCreativeType; label: string }[] = [
  { value: "text", label: "テキストリンク" },
  { value: "banner", label: "バナー画像" },
];

export default function SiteOffersPageClient({ siteId, siteName }: Props) {
  const [offers, setOffers] = useState<A8Offer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<Message>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<A8OfferInput>(() => createEmptyForm(siteId));

  // siteId が切り替わったらフォームもリセット
  useEffect(() => {
    setForm(createEmptyForm(siteId));
    setEditingId(null);
  }, [siteId]);

  const title = useMemo(() => `A8オファー管理（${siteName}）`, [siteName]);

  async function loadOffers() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchOffersBySite(siteId);
      setOffers(data);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "オファー一覧の取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOffers();
  }, [siteId]);

  function handleChange<K extends keyof A8OfferInput>(
    key: K,
    value: A8OfferInput[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleNumberChange(key: "width" | "height", value: string) {
    const num = value === "" ? null : Number(value);
    handleChange(key, Number.isNaN(num) ? null : num);
  }

  function handleSelectOffer(offer: A8Offer) {
    setEditingId(offer.id);
    setForm({
      siteId: offer.siteId,
      companyId: offer.companyId ?? "",
      label: offer.label,
      creativeType: offer.creativeType,
      placement: offer.placement,
      htmlRaw: offer.htmlRaw,
      linkUrl: offer.linkUrl ?? "",
      imageUrl: offer.imageUrl ?? "",
      width: offer.width ?? null,
      height: offer.height ?? null,
      isActive: offer.isActive,
      notes: offer.notes ?? "",
    });
    setMessage(null);
  }

  function handleNew() {
    setEditingId(null);
    setForm(createEmptyForm(siteId));
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: A8OfferInput = {
        ...form,
        siteId,
      };

      if (!payload.label.trim()) {
        setMessage({ type: "error", text: "ラベルは必須です" });
        setSaving(false);
        return;
      }

      if (!payload.htmlRaw.trim()) {
        setMessage({ type: "error", text: "A8のHTMLを貼り付けてください" });
        setSaving(false);
        return;
      }

      if (editingId) {
        await updateOffer(editingId, payload);
        setMessage({ type: "success", text: "オファーを更新しました" });
      } else {
        const id = await createOffer(payload);
        if (!id) {
          setMessage({ type: "error", text: "オファー作成に失敗しました" });
          setSaving(false);
          return;
        }
        setMessage({ type: "success", text: "オファーを作成しました" });
        setEditingId(id);
      }

      await loadOffers();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  const editingLabel = editingId ? `オファー編集` : `新規オファー作成`;

  return (
    <main className="container-kariraku py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-gray-600">
          A8管理画面のHTMLを貼り付けて、このサイトで使うテキストリンク・バナーを管理します。
        </p>
      </header>

      {message && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            message.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 左：一覧 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">登録済みオファー</h2>
            <button
              type="button"
              onClick={handleNew}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              新規作成
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">読み込み中です…</p>
          ) : offers.length === 0 ? (
            <p className="text-sm text-gray-500">
              まだオファーが登録されていません。
            </p>
          ) : (
            <div className="rounded-md border border-gray-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">ラベル</th>
                    <th className="px-3 py-2 font-medium">企業ID</th>
                    <th className="px-3 py-2 font-medium">配置</th>
                    <th className="px-3 py-2 font-medium">種別</th>
                    <th className="px-3 py-2 font-medium text-center">有効</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr
                      key={offer.id}
                      className={`cursor-pointer border-b last:border-b-0 hover:bg-slate-50 ${
                        editingId === offer.id ? "bg-slate-50" : ""
                      }`}
                      onClick={() => handleSelectOffer(offer)}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-gray-900">
                          {offer.label || "(ラベルなし)"}
                        </div>
                        <div className="text-xs text-gray-500">{offer.id}</div>
                      </td>
                      <td className="px-3 py-2 align-top text-sm text-gray-700">
                        {offer.companyId || "-"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-700">
                        {
                          placementOptions.find(
                            (p) => p.value === offer.placement
                          )?.label
                        }
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-700">
                        {
                          creativeTypeOptions.find(
                            (c) => c.value === offer.creativeType
                          )?.label
                        }
                      </td>
                      <td className="px-3 py-2 align-top text-center text-xs">
                        {offer.isActive ? "✓" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500">
            企業ID は「企業マスタ管理（/admin/companies）」で設定した{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">companyId</code>
            を入力してください。
          </p>
        </section>

        {/* 右：編集フォーム */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">{editingLabel}</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  ラベル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={form.label}
                  onChange={(e) => handleChange("label", e.target.value)}
                  placeholder="例: 本文テキストリンク（メイン）"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  企業ID（任意）
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={form.companyId ?? ""}
                  onChange={(e) => handleChange("companyId", e.target.value)}
                  placeholder="例: tomizawa"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  配置（placement）
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={form.placement}
                  onChange={(e) =>
                    handleChange("placement", e.target.value as OfferPlacement)
                  }
                >
                  {placementOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  種別（creativeType）
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={form.creativeType}
                  onChange={(e) =>
                    handleChange(
                      "creativeType",
                      e.target.value as OfferCreativeType
                    )
                  }
                >
                  {creativeTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    checked={form.isActive}
                    onChange={(e) => handleChange("isActive", e.target.checked)}
                  />
                  有効（isActive）
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                A8 管理画面の HTML <span className="text-red-500">*</span>
              </label>
              <textarea
                className="h-40 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={form.htmlRaw}
                onChange={(e) => handleChange("htmlRaw", e.target.value)}
                placeholder='<a href="https://px.a8.net/...">...</a>'
              />
              <p className="text-xs text-gray-500">
                A8の「通常の広告リンク」をそのまま貼り付けてください。あとで解析ロジックを追加して、URLや画像も自動抽出できるようにします。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    リンクURL（任意）
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={form.linkUrl ?? ""}
                    onChange={(e) => handleChange("linkUrl", e.target.value)}
                    placeholder="https://px.a8.net/..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    画像URL（バナー用・任意）
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={form.imageUrl ?? ""}
                    onChange={(e) => handleChange("imageUrl", e.target.value)}
                    placeholder="https://www◯◯.a8.net/..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      幅（px・任意）
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={form.width ?? ""}
                      onChange={(e) =>
                        handleNumberChange("width", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      高さ（px・任意）
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={form.height ?? ""}
                      onChange={(e) =>
                        handleNumberChange("height", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    メモ（任意）
                  </label>
                  <textarea
                    className="h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={form.notes ?? ""}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="例: 企業カード用 / 会社比較記事のフッター用 など"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
              >
                {saving ? "保存中…" : "プロフィールを保存"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
