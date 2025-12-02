// apps/web/app/admin/companies/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company, CompanyUrl, CompanyUrlType } from "@/types/company";
import {
  fetchCompanies,
  createCompany,
  updateCompany,
} from "@/lib/firebase/companies";

const emptyCompany = (): Company => ({
  id: "",
  displayName: "",
  brandName: "",
  officialUrl: "",
  logoUrl: "",
  groupType: "manufacturer",
  listed: true,
  notes: "",
  urls: [],
});

const urlTypeOptions: { value: CompanyUrlType; label: string }[] = [
  { value: "top", label: "トップ" },
  { value: "pricing", label: "料金" },
  { value: "plans", label: "プラン" },
  { value: "faq", label: "よくある質問" },
  { value: "terms", label: "利用規約" },
  { value: "guide", label: "ガイド" },
  { value: "other", label: "その他" },
];

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Company>(emptyCompany());
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      try {
        const list = await fetchCompanies();
        setCompanies(list);
      } catch (err) {
        console.error(err);
        setMessage("企業一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const isNew = useMemo(() => selectedId === null, [selectedId]);

  const handleSelectCompany = (company: Company) => {
    setSelectedId(company.id);
    setForm(company);
    setMessage("");
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyCompany());
    setMessage("");
  };

  const handleChange = <K extends keyof Company>(key: K, value: Company[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleUrlChange = (index: number, next: Partial<CompanyUrl>) => {
    setForm((prev) => {
      const urls = [...prev.urls];
      const current = urls[index];
      const merged: CompanyUrl = {
        ...current,
        ...next,
      };
      urls[index] = merged;
      return { ...prev, urls };
    });
  };

  const handleAddUrl = () => {
    setForm((prev) => ({
      ...prev,
      urls: [
        ...prev.urls,
        {
          id: `url-${Date.now()}`,
          type: "top",
          label: "",
          url: "",
        },
      ],
    }));
  };

  const handleRemoveUrl = (index: number) => {
    setForm((prev) => {
      const urls = [...prev.urls];
      urls.splice(index, 1);
      return { ...prev, urls };
    });
  };

  const handleSubmit = async () => {
    if (!form.id || !form.displayName || !form.officialUrl) {
      setMessage("companyId・会社名・公式URLは必須です");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      if (isNew) {
        await createCompany(form);
        setMessage("企業を作成しました");
      } else {
        await updateCompany(form);
        setMessage("企業を更新しました");
      }

      const list = await fetchCompanies();
      setCompanies(list);
      if (isNew) {
        setSelectedId(form.id);
      }
    } catch (err) {
      console.error(err);
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">企業マスタ管理</h1>

      {message && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)]">
        {/* 一覧 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium">登録済み企業</h2>
            <button
              type="button"
              onClick={handleNew}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              新規作成
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">読み込み中です…</p>
          ) : companies.length === 0 ? (
            <p className="text-sm text-slate-500">
              まだ企業が登録されていません。
            </p>
          ) : (
            <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">会社名</th>
                    <th className="px-3 py-2 font-medium">ブランド名</th>
                    <th className="px-3 py-2 font-medium">グループ</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr
                      key={c.id}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                        selectedId === c.id ? "bg-slate-100" : ""
                      }`}
                      onClick={() => handleSelectCompany(c)}
                    >
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {c.id}
                      </td>
                      <td className="px-3 py-2">{c.displayName}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {c.brandName}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {c.groupType ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 編集フォーム */}
        <section className="rounded-md border border-slate-200 bg-white px-4 py-4">
          <h2 className="mb-4 text-lg font-medium">
            {isNew
              ? "新規企業の登録"
              : `企業の編集: ${form.displayName || form.id}`}
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block font-medium">
                companyId（英数字・スラッグ）
              </label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => handleChange("id", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="例: shobundo, panasonic-rental"
                disabled={!isNew}
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">会社名（必須）</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => handleChange("displayName", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">ブランド名</label>
              <input
                type="text"
                value={form.brandName ?? ""}
                onChange={(e) => handleChange("brandName", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="サービス名など（任意）"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">
                公式サイトURL（必須）
              </label>
              <input
                type="url"
                value={form.officialUrl}
                onChange={(e) => handleChange("officialUrl", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">ロゴURL</label>
              <input
                type="url"
                value={form.logoUrl ?? ""}
                onChange={(e) => handleChange("logoUrl", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="任意"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium">グループ種別</label>
                <select
                  value={form.groupType ?? "manufacturer"}
                  onChange={(e) =>
                    handleChange(
                      "groupType",
                      e.target.value as Company["groupType"]
                    )
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="manufacturer">メーカー</option>
                  <option value="retailer">販売店 / 代理店</option>
                  <option value="platform">プラットフォーム</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="listed"
                  type="checkbox"
                  checked={form.listed ?? false}
                  onChange={(e) => handleChange("listed", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="listed" className="text-sm">
                  上場企業フラグ
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium">メモ</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  公式URLセット（料金・FAQなど）
                </span>
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                >
                  ＋ 行を追加
                </button>
              </div>

              {form.urls.length === 0 ? (
                <p className="text-xs text-slate-500">
                  必要に応じて「＋ 行を追加」から登録してください。
                </p>
              ) : (
                <div className="space-y-2">
                  {form.urls.map((u, index) => (
                    <div
                      key={u.id}
                      className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <select
                        value={u.type}
                        onChange={(e) =>
                          handleUrlChange(index, {
                            type: e.target.value as CompanyUrl["type"],
                          })
                        }
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {urlTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={u.label}
                          onChange={(e) =>
                            handleUrlChange(index, { label: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                          placeholder="ラベル（例: 料金ページ）"
                        />
                        <input
                          type="url"
                          value={u.url}
                          onChange={(e) =>
                            handleUrlChange(index, { url: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                          placeholder="https://..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUrl(index)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {saving ? "保存中..." : isNew ? "企業を作成" : "企業を更新"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
