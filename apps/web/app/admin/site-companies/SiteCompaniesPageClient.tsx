// apps/web/app/admin/site-companies/SiteCompaniesPageClient.tsx
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  fetchCompanyProfile,
  saveCompanyProfile,
} from "@/lib/firebase/companyProfiles";

type Company = {
  id: string; // companyId (tomizawa など)
  displayName: string; // 株式会社トミザワ など
};

type CompanyProfileForm = {
  vertical: string;
  targetUsers: string;
  strengths: string;
  weaknesses: string;
  shippingSpeed: string;
  areas: string;
  cancellationPolicy: string;
  importantNotes: string;
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

// API から返ってくる AI の提案（文字列版）
type AiProfileSuggestion = {
  vertical?: string;
  targetUsers?: string;
  strengths?: string;
  weaknesses?: string;
  shippingSpeed?: string;
  areas?: string;
  cancellationPolicy?: string;
  importantNotes?: string;
};

type Props = {
  siteId: string;
  siteName: string;
};

const EMPTY_FORM: CompanyProfileForm = {
  vertical: "",
  targetUsers: "",
  strengths: "",
  weaknesses: "",
  shippingSpeed: "",
  areas: "",
  cancellationPolicy: "",
  importantNotes: "",
};

function linesToArray(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function arrayToLines(values?: string[]): string {
  if (!values || values.length === 0) return "";
  return values.join("\n");
}

export default function SiteCompaniesPageClient({ siteId, siteName }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [form, setForm] = useState<CompanyProfileForm>(EMPTY_FORM);

  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  /* ========== 企業一覧の取得 ========== */
  const loadCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const res = await fetch("/api/admin/companies");
      if (!res.ok) {
        throw new Error(`Failed to fetch companies: ${res.status}`);
      }
      const data = (await res.json()) as { companies: Company[] };
      setCompanies(data.companies);
      setMessage(null);
    } catch (err) {
      console.error("[SiteCompanies] loadCompanies error", err);
      setMessage({
        type: "error",
        text: "企業一覧の取得に失敗しました。",
      });
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  /* ========== 企業選択時にプロフィール読み込み ========== */
  const loadProfile = useCallback(
    async (companyId: string) => {
      if (!companyId) {
        setForm(EMPTY_FORM);
        return;
      }

      try {
        setLoadingProfile(true);
        const profile = await fetchCompanyProfile(siteId, companyId);
        if (!profile) {
          // まだプロフィールが無い場合は空のフォーム
          setForm({
            ...EMPTY_FORM,
            vertical: "rental",
          });
          return;
        }

        setForm({
          vertical: profile.vertical ?? "",
          targetUsers: arrayToLines(profile.targetUsers),
          strengths: arrayToLines(profile.strengths),
          weaknesses: arrayToLines(profile.weaknesses),
          shippingSpeed: profile.shippingSpeed ?? "",
          areas: profile.areas ?? "",
          cancellationPolicy: profile.cancellationPolicy ?? "",
          importantNotes: arrayToLines(profile.importantNotes),
        });
      } catch (err) {
        console.error("[SiteCompanies] loadProfile error", err);
        setMessage({
          type: "error",
          text: "プロフィールの取得に失敗しました。",
        });
      } finally {
        setLoadingProfile(false);
      }
    },
    [siteId]
  );

  const handleCompanyChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const companyId = e.target.value;
    setSelectedCompanyId(companyId);
    setMessage(null);
    await loadProfile(companyId);
  };

  /* ========== フォーム入力ハンドラ ========== */
  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  /* ========== 保存 ========== */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedCompanyId) return;

    try {
      setSaving(true);

      const profile = {
        id: selectedCompanyId,
        siteId,
        companyId: selectedCompanyId,
        vertical: form.vertical || "rental",
        targetUsers: linesToArray(form.targetUsers),
        strengths: linesToArray(form.strengths),
        weaknesses: linesToArray(form.weaknesses),
        shippingSpeed: form.shippingSpeed || undefined,
        areas: form.areas || undefined,
        cancellationPolicy: form.cancellationPolicy || undefined,
        importantNotes: linesToArray(form.importantNotes),
      };

      await saveCompanyProfile(profile);

      setMessage({
        type: "success",
        text: "プロフィールを保存しました。",
      });
    } catch (err) {
      console.error("[SiteCompanies] saveProfile error", err);
      setMessage({
        type: "error",
        text: "プロフィールの保存に失敗しました。",
      });
    } finally {
      setSaving(false);
    }
  }

  /* ========== AI 下書き提案 ========== */
  async function handleSuggestByAi() {
    if (!selectedCompanyId) return;

    try {
      setSuggesting(true);
      setMessage(null);

      const company = companies.find((c) => c.id === selectedCompanyId);
      const companyName = company?.displayName ?? selectedCompanyId;

      const res = await fetch("/api/admin/site-companies/ai", {
        // ← ここだけ変更
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          companyName,
          vertical: form.vertical || "rental",
          targetUsers: form.targetUsers,
          strengths: form.strengths,
          weaknesses: form.weaknesses,
          shippingSpeed: form.shippingSpeed,
          areas: form.areas,
          cancellationPolicy: form.cancellationPolicy,
          importantNotes: form.importantNotes,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`);
      }

      const data = (await res.json()) as { suggestion: AiProfileSuggestion };

      setForm((prev) => ({
        ...prev,
        vertical: data.suggestion.vertical ?? prev.vertical,
        targetUsers: data.suggestion.targetUsers ?? prev.targetUsers,
        strengths: data.suggestion.strengths ?? prev.strengths,
        weaknesses: data.suggestion.weaknesses ?? prev.weaknesses,
        shippingSpeed: data.suggestion.shippingSpeed ?? prev.shippingSpeed,
        areas: data.suggestion.areas ?? prev.areas,
        cancellationPolicy:
          data.suggestion.cancellationPolicy ?? prev.cancellationPolicy,
        importantNotes: data.suggestion.importantNotes ?? prev.importantNotes,
      }));

      setMessage({
        type: "success",
        text: "AI が下書きを提案しました。内容を確認して保存してください。",
      });
    } catch (err) {
      console.error("[SiteCompanies] suggestByAi error", err);
      setMessage({
        type: "error",
        text: "AI 下書きの取得に失敗しました。",
      });
    } finally {
      setSuggesting(false);
    }
  }

  /* ========== JSX ========== */
  return (
    <div className="container-kariraku py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          サイト別企業プロフィール
        </h1>
        <p className="text-sm text-slate-600">
          左側で企業を選ぶと、このサイト向けのプロフィールを編集できます。
        </p>
      </header>

      {message && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">企業を選択</label>
          <select
            className="w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={selectedCompanyId}
            onChange={handleCompanyChange}
            disabled={loadingCompanies}
          >
            <option value="">企業を選んでください</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            企業マスタ（/admin/companies）で登録済みの企業から選びます。
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">
            プロフィール編集：{" "}
            {selectedCompanyId
              ? companies.find((c) => c.id === selectedCompanyId)
                  ?.displayName ?? selectedCompanyId
              : "—"}
          </h2>
          <button
            type="button"
            onClick={handleSuggestByAi}
            disabled={!selectedCompanyId || suggesting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {suggesting ? "AI が下書き中…" : "AI に下書きを提案してもらう"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                ジャンル（vertical）
              </label>
              <input
                name="vertical"
                value={form.vertical}
                onChange={handleInputChange}
                placeholder="rental など"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                配送スピード（shippingSpeed）
              </label>
              <input
                name="shippingSpeed"
                value={form.shippingSpeed}
                onChange={handleInputChange}
                placeholder="例: 最短2〜3営業日で発送"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">対応エリア（areas）</label>
              <input
                name="areas"
                value={form.areas}
                onChange={handleInputChange}
                placeholder="例: 本州・四国（一部地域除く）"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                解約・途中解約のルール（cancellationPolicy）
              </label>
              <input
                name="cancellationPolicy"
                value={form.cancellationPolicy}
                onChange={handleInputChange}
                placeholder="例: 最低利用期間〇ヶ月 など"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                おすすめしたい人（targetUsers）
              </label>
              <textarea
                name="targetUsers"
                value={form.targetUsers}
                onChange={handleInputChange}
                rows={4}
                placeholder="1行につき1パターンで入力してください。"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">強み（strengths）</label>
              <textarea
                name="strengths"
                value={form.strengths}
                onChange={handleInputChange}
                rows={4}
                placeholder="1行につき1つの強みを入力"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                注意点・弱み（weaknesses）
              </label>
              <textarea
                name="weaknesses"
                value={form.weaknesses}
                onChange={handleInputChange}
                rows={4}
                placeholder="1行につき1つの注意点を入力"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                特に伝えておきたいこと（importantNotes）
              </label>
              <textarea
                name="importantNotes"
                value={form.importantNotes}
                onChange={handleInputChange}
                rows={4}
                placeholder="公式サイトでよくある質問も含めて書いておく など"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!selectedCompanyId || saving || loadingProfile}
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "保存中…" : "プロフィールを保存する"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
