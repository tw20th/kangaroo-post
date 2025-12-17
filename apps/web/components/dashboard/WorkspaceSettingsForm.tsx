// apps/web/components/dashboard/WorkspaceSettingsForm.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Workspace } from "@kangaroo-post/shared-types";
import { useWorkspace } from "@/hooks/useWorkspace";
import { upsertWorkspaceApi, fetchMyWorkspaceApi } from "@/lib/api/workspaces";

type Props = {
  initialWorkspaceId: string | null;
};

type FormState = {
  siteName: string;
  topUrl: string;
  blogSectionLabel: string;
  blogSectionSlug: string;
  widgetEnabled: boolean;
  widgetLimit: number;
  industry: string;
  keywordPreferences: string;
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string; // 入力専用（読み戻さない）
};

const defaultFormState: FormState = {
  siteName: "",
  topUrl: "",
  blogSectionLabel: "ブログ",
  blogSectionSlug: "blog",
  widgetEnabled: true,
  widgetLimit: 3,
  industry: "",
  keywordPreferences: "",
  wpUrl: "",
  wpUser: "",
  wpAppPassword: "",
};

function workspaceToFormState(workspace: Workspace | null): FormState {
  if (!workspace) return defaultFormState;

  return {
    siteName: workspace.siteName ?? "",
    topUrl: workspace.topUrl ?? "",
    blogSectionLabel: workspace.blogSectionLabel ?? "ブログ",
    blogSectionSlug: workspace.blogSectionSlug ?? "blog",
    widgetEnabled: workspace.widgetEnabled ?? true,
    widgetLimit: workspace.widgetLimit ?? 3,
    industry: workspace.industry ?? "",
    keywordPreferences: workspace.keywordPreferences ?? "",
    wpUrl: (workspace as unknown as { wpUrl?: string }).wpUrl ?? "",
    wpUser: (workspace as unknown as { wpUser?: string }).wpUser ?? "",
    // ✅ パスワードは絶対に読み戻さない
    wpAppPassword: "",
  };
}

function extractId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id === "string" && v.id.length > 0) return v.id;
  const ws = v.workspace;
  if (ws && typeof ws === "object") {
    const wsv = ws as Record<string, unknown>;
    if (typeof wsv.id === "string" && wsv.id.length > 0) return wsv.id;
  }
  return null;
}

function readWpPasswordSet(workspace: Workspace | null): boolean {
  if (!workspace) return false;
  const raw = workspace as unknown as Record<string, unknown>;
  return raw.wpAppPasswordSet === true;
}

export default function WorkspaceSettingsForm({ initialWorkspaceId }: Props) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    initialWorkspaceId
  );

  const [meLoading, setMeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const didResolveMe = useRef(false);

  useEffect(() => {
    setWorkspaceId(initialWorkspaceId);
  }, [initialWorkspaceId]);

  const { workspace, loading, error, reload } = useWorkspace(workspaceId);
  const [form, setForm] = useState<FormState>(() => workspaceToFormState(null));

  const wpPasswordSet = readWpPasswordSet(workspace);

  useEffect(() => {
    if (workspaceId) return;
    if (didResolveMe.current) return;

    didResolveMe.current = true;

    let cancelled = false;

    (async () => {
      try {
        setMeLoading(true);
        const me = await fetchMyWorkspaceApi();
        if (cancelled) return;

        const meId = extractId(me);
        if (meId) setWorkspaceId(meId);
      } catch {
        // 未作成は静かに
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspace) return;
    setForm(workspaceToFormState(workspace));
  }, [workspace]);

  const isBusy = useMemo(() => saving || loading, [saving, loading]);

  const handleChange =
    <K extends keyof FormState>(key: K) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>
    ) => {
      const value = event.target.value;

      setForm((prev) => {
        if (key === "widgetLimit") {
          const num = Number(value);
          return {
            ...prev,
            widgetLimit: Number.isNaN(num) ? prev.widgetLimit : num,
          };
        }
        return { ...prev, [key]: value } as FormState;
      });
    };

  const handleCheckboxChange =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setForm((prev) => ({ ...prev, [key]: checked } as FormState));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavedMessage(null);
    setLocalError(null);

    // ✅ 空文字は送らない（不要上書きを避ける）
    const wpAppPassword = form.wpAppPassword.trim();
    const payload = {
      siteName: form.siteName,
      topUrl: form.topUrl,
      blogSectionLabel: form.blogSectionLabel || undefined,
      blogSectionSlug: form.blogSectionSlug,
      widgetEnabled: form.widgetEnabled,
      widgetLimit: form.widgetLimit,
      industry: form.industry || undefined,
      keywordPreferences: form.keywordPreferences || undefined,
      wpUrl: form.wpUrl || undefined,
      wpUser: form.wpUser || undefined,
      // ✅ 入力がある時だけ送る（暗号化はサーバー側）
      wpAppPassword: wpAppPassword.length > 0 ? wpAppPassword : undefined,
    };

    try {
      setSaving(true);

      const result = await upsertWorkspaceApi(payload);
      const newId = extractId(result);
      if (newId) setWorkspaceId(newId);

      setSavedMessage("設定を保存しました。");

      // ✅ pwは保存したら入力欄を空に戻す
      setForm((prev) => ({ ...prev, wpAppPassword: "" }));

      if (workspaceId) {
        await reload();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存に失敗しました。";
      setLocalError(msg);
    } finally {
      setSaving(false);
    }
  };

  const displayId = workspaceId;

  return (
    <section className="space-y-3 rounded-2xl border bg-white/80 p-4 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">サイト設定（Workspace）</h2>
        <p className="text-xs text-gray-600">
          ここで入力した内容にもとづいて、記事のリンク先や埋め込みウィジェットを生成します。
        </p>
        {meLoading && (
          <p className="text-xs text-gray-500">
            Workspace を確認中です…（はじめての方はこのまま保存で作成できます）
          </p>
        )}
      </header>

      {(error || localError) && (
        <p className="text-xs text-red-600">
          {localError || error || "エラーが発生しました"}
        </p>
      )}

      {savedMessage && (
        <p className="text-xs text-emerald-700">{savedMessage}</p>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* 基本情報 */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">基本情報</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              サイト名
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.siteName}
                onChange={handleChange("siteName")}
                placeholder="例）カンガルーポスト公式ブログ"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              サイトのトップURL
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.topUrl}
                onChange={handleChange("topUrl")}
                placeholder="https://example.com"
                required
              />
            </label>
          </div>
        </div>

        {/* ブログ表示設定 */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">
            ブログ表示の設定
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              サイト上でのラベル
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.blogSectionLabel}
                onChange={handleChange("blogSectionLabel")}
                placeholder="例）ブログ / お知らせ"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              ブログのスラッグ
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.blogSectionSlug}
                onChange={handleChange("blogSectionSlug")}
                placeholder="例）blog"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={form.widgetEnabled}
                onChange={handleCheckboxChange("widgetEnabled")}
              />
              サイトに埋め込みウィジェットを表示する
            </label>
            <label className="flex items-center gap-2">
              <span>表示件数</span>
              <input
                type="number"
                min={1}
                max={20}
                className="w-16 rounded-lg border px-2 py-1 text-sm"
                value={form.widgetLimit}
                onChange={handleChange("widgetLimit")}
              />
            </label>
          </div>
        </div>

        {/* 補足情報 */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">
            サイトの雰囲気・キーワード
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              業種・ジャンル
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.industry}
                onChange={handleChange("industry")}
                placeholder="例）住宅リフォーム / コーチング など"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              好きなキーワード（任意）
              <textarea
                className="min-h-[60px] rounded-lg border px-2 py-1 text-sm"
                value={form.keywordPreferences}
                onChange={handleChange("keywordPreferences")}
                placeholder="例）やさしい / 初心者向け / 無理しない など"
              />
            </label>
          </div>
        </div>

        {/* WordPress 連携 */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">
            WordPress 連携（あとででもOK）
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              WordPress の URL
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.wpUrl}
                onChange={handleChange("wpUrl")}
                placeholder="https://example.com"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              ユーザー名
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.wpUser}
                onChange={handleChange("wpUser")}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Application Password
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                value={form.wpAppPassword}
                onChange={handleChange("wpAppPassword")}
                placeholder={
                  wpPasswordSet
                    ? "保存済み（変更する場合は再入力）"
                    : "未設定（必要になったら入力）"
                }
              />
              <span className="text-[11px] text-gray-500">
                {wpPasswordSet
                  ? "※保存済みです。表示はしません。変更したい時だけ入力してください。"
                  : "※まだ設定していません（後でOK）"}
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            {displayId
              ? `Workspace ID: ${displayId}`
              : "まだ Workspace は作成されていません。保存すると新しく作成されます。"}
          </div>
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {saving ? "保存中..." : "設定を保存する"}
          </button>
        </div>
      </form>
    </section>
  );
}
