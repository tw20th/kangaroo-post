// apps/web/lib/firebase/offers.ts

import type { Firestore } from "firebase/firestore";
import { getDb, numOrTsToNumber, getFs } from "@/lib/firebase";

/* ========= Types ========= */

/** A8 クリエイティブの種別 */
export type OfferCreativeType = "text" | "banner";

/** どこに貼るリンクか（用途） */
export type OfferPlacement =
  | "company-card" // 企業カード内
  | "blog-body" // 記事本文中
  | "blog-footer"; // 記事末尾 CTA

/** Firestore 上の offers ドキュメントをアプリ側で扱う形 */
export interface A8Offer {
  id: string; // = doc.id

  siteId: string;
  companyId: string | null;

  label: string; // 管理用ラベル（例: 本文テキストリンク）
  creativeType: OfferCreativeType;
  placement: OfferPlacement;

  /** A8 管理画面からコピペした生の HTML */
  htmlRaw: string;

  /** 使いやすい形にしたリンク情報（任意） */
  linkUrl?: string | null;
  imageUrl?: string | null;
  width?: number | null;
  height?: number | null;

  isActive: boolean;
  notes?: string;

  createdAt: number;
  updatedAt: number;
}

/** 新規作成・更新で使う入力型（id / createdAt / updatedAt は除く） */
export type A8OfferInput = Omit<A8Offer, "id" | "createdAt" | "updatedAt">;

/* ========= Firestore refs ========= */

const COLLECTION_NAME = "offers";

function offersCollectionRef(db: Firestore) {
  const { collection } = getFs();
  return collection(db, COLLECTION_NAME);
}

/* ========= Helpers ========= */

/**
 * サイト単位でオファー一覧を取得
 * - admin の一覧表示用
 */
export async function fetchOffersBySite(siteId: string): Promise<A8Offer[]> {
  const db = getDb();
  if (!db) return [];

  const { query, where, orderBy, getDocs } = getFs();

  const q = query(
    offersCollectionRef(db),
    where("siteId", "==", siteId),
    orderBy("label", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;

    const offer = {
      id: d.id,
      siteId: String(data.siteId ?? ""),
      companyId: typeof data.companyId === "string" ? data.companyId : null,

      label: String(data.label ?? ""),
      creativeType: (data.creativeType as OfferCreativeType) ?? "text",
      placement: (data.placement as OfferPlacement) ?? "blog-body",

      htmlRaw: String(data.htmlRaw ?? ""),

      linkUrl:
        typeof data.linkUrl === "string" ? (data.linkUrl as string) : null,
      imageUrl:
        typeof data.imageUrl === "string" ? (data.imageUrl as string) : null,
      width: typeof data.width === "number" ? (data.width as number) : null,
      height: typeof data.height === "number" ? (data.height as number) : null,

      isActive:
        typeof data.isActive === "boolean" ? (data.isActive as boolean) : true,
      notes:
        typeof data.notes === "string" ? (data.notes as string) : undefined,

      createdAt: numOrTsToNumber(data.createdAt),
      updatedAt: numOrTsToNumber(data.updatedAt),
    } satisfies A8Offer;

    return offer;
  });
}

/**
 * 新規オファーの作成
 */
export async function createOffer(input: A8OfferInput): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const { addDoc, serverTimestamp } = getFs();

  const now = serverTimestamp();

  const docRef = await addDoc(offersCollectionRef(db), {
    ...input,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

/**
 * 既存オファーの更新
 */
export async function updateOffer(
  id: string,
  input: Partial<A8OfferInput>
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { doc, updateDoc, serverTimestamp } = getFs();

  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, {
    ...input,
    updatedAt: serverTimestamp(),
  });
}
