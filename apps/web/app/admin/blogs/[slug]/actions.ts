// apps/web/app/admin/blogs/[slug]/actions.ts
"use server";

import "@/lib/firebase/server-init";
import { getFirestore } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import type { BlogStatus } from "@/types/blog";

export async function updateBlogStatus(slug: string, status: BlogStatus) {
  const db = getFirestore();

  await db.collection("blogs").doc(slug).set(
    {
      status,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  // 公開側 & 管理画面のキャッシュを更新
  revalidatePath("/blog");
  revalidatePath(`/blogs/${slug}`);
  revalidatePath(`/admin/blogs/${slug}`);
}
