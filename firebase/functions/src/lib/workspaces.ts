// firebase/functions/src/lib/workspaces.ts
import { db } from "./infra/db.js";

import type { Workspace } from "@kangaroo-post/shared-types";
import { WorkspaceSchema } from "@kangaroo-post/shared-schemas";

const COLLECTION = "workspaces";

export type WorkspaceCreateInput = {
  ownerUserId: string;
  siteName: string;
  topUrl: string;
  blogSectionLabel?: string;
  blogSectionSlug: string; // ✅ 追加
  widgetEnabled?: boolean;
  widgetLimit?: number;
  industry?: string;
  keywordPreferences?: string;

  // ✅ 追加（Web側フォームにある）
  wpUrl?: string;
  wpUser?: string;
  wpAppPassword?: string;
};

export type WorkspaceUpdateInput = Partial<WorkspaceCreateInput>;

/** Firestoreのスナップショット → Workspace に変換 */
const fromDoc = (
  snap: FirebaseFirestore.DocumentSnapshot
): Workspace | null => {
  if (!snap.exists) return null;

  const raw = snap.data() ?? {};

  // zodでバリデーション＆デフォルト適用
  const parsed = WorkspaceSchema.parse(raw);

  const nowCreatedAt = parsed.createdAt ?? Date.now();

  return {
    id: snap.id,
    ownerUserId: parsed.ownerUserId,
    siteName: parsed.siteName,
    topUrl: parsed.topUrl,

    blogSectionLabel: parsed.blogSectionLabel,
    blogSectionSlug: parsed.blogSectionSlug, // ★ これを追加

    widgetEnabled: parsed.widgetEnabled,
    widgetLimit: parsed.widgetLimit,
    industry: parsed.industry,
    keywordPreferences: parsed.keywordPreferences,
    status: parsed.status,
    createdAt: nowCreatedAt,
    updatedAt: parsed.updatedAt ?? nowCreatedAt,
  };
};

/** 1件取得 */
export const getWorkspaceById = async (
  id: string
): Promise<Workspace | null> => {
  const snap = await db.collection(COLLECTION).doc(id).get();
  return fromDoc(snap);
};

/** 新規作成（docIdは自動採番） */
export const createWorkspace = async (
  input: WorkspaceCreateInput
): Promise<Workspace> => {
  const now = Date.now();

  // createdAt/updatedAt を埋めてからschemaに通す
  const toSave = WorkspaceSchema.parse({
    ...input,
    createdAt: now,
    updatedAt: now,
  });

  const docRef = await db.collection(COLLECTION).add(toSave);
  const snap = await docRef.get();
  const workspace = fromDoc(snap);

  if (!workspace) {
    throw new Error("failed to create workspace");
  }

  return workspace;
};

/** 更新（存在前提・merge） */
export const updateWorkspace = async (
  id: string,
  input: WorkspaceUpdateInput
): Promise<Workspace> => {
  const now = Date.now();

  // 既存データを取得
  const existingSnap = await db.collection(COLLECTION).doc(id).get();
  if (!existingSnap.exists) {
    throw new Error(`workspace not found: ${id}`);
  }

  const existing = WorkspaceSchema.parse(existingSnap.data() ?? {});

  const toSave = WorkspaceSchema.parse({
    ...existing,
    ...input,
    updatedAt: now,
    createdAt: existing.createdAt ?? now,
  });

  await db.collection(COLLECTION).doc(id).set(toSave, { merge: true });

  const snap = await db.collection(COLLECTION).doc(id).get();
  const workspace = fromDoc(snap);

  if (!workspace) {
    throw new Error("failed to update workspace");
  }

  return workspace;
};
/** ownerUserId から最新の workspace を1件取得 */
export const getMyWorkspaceByOwnerUid = async (
  ownerUid: string
): Promise<Workspace | null> => {
  const snap = await db
    .collection(COLLECTION)
    .where("ownerUserId", "==", ownerUid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  const doc = snap.docs[0];
  if (!doc) return null;

  return fromDoc(doc) as Workspace | null;
};

export const getWorkspaceByOwnerUserId = async (
  ownerUserId: string
): Promise<Workspace | null> => {
  const snap = await db
    .collection(COLLECTION)
    .where("ownerUserId", "==", ownerUserId)
    .limit(1)
    .get();

  const doc = snap.docs[0];
  if (!doc) return null;
  return fromDoc(doc);
};
