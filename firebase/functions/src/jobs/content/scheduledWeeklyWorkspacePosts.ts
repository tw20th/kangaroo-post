import * as functions from "firebase-functions/v1";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";

const REGION = "asia-northeast1";
const db = getFirestore();

/** YYYY-Www 形式 */
function getWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export const scheduledWeeklyWorkspacePosts = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 11 * * 1") // 月曜 11:00 JST
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    const scheduleKey = getWeekKey();
    const now = Timestamp.now();

    const wsSnap = await db
      .collection("workspaces")
      .where("status", "==", "active")
      .where("widgetEnabled", "==", true)
      .get();

    if (wsSnap.empty) {
      return { skipped: "no_workspaces" };
    }

    for (const wsDoc of wsSnap.docs) {
      const ws = wsDoc.data() as any;
      const workspaceId = wsDoc.id;

      // 軽量スキップ
      if (ws.autoPostLastScheduleKey === scheduleKey) continue;

      // 堅牢スキップ
      const exists = await db
        .collection("posts")
        .where("workspaceId", "==", workspaceId)
        .where("scheduleKey", "==", scheduleKey)
        .limit(1)
        .get();

      if (!exists.empty) continue;

      try {
        const result = await generateBlogContent({
          siteId: ws.siteId,
          siteName: ws.siteName ?? "サイト",
          persona: "サイト更新が苦手な人",
          pain: "更新が続かない",
          product: { name: "カンガルーポスト", asin: "internal" },
          templateName: "blogTemplate_discover.txt",
        });

        const slug = `auto-${workspaceId}-${scheduleKey}`;

        await db.collection("posts").doc(slug).set({
          slug,
          siteId: ws.siteId,
          workspaceId,
          ownerUserId: ws.ownerUserId,
          title: result.title,
          content: result.content,
          tags: result.tags,
          status: "published",
          type: "normal",
          generatedBy: "scheduler",
          scheduleKey,
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
        });

        await wsDoc.ref.set(
          {
            autoPostLastScheduleKey: scheduleKey,
            autoPostLastRunAt: now,
            autoPostLastError: null,
          },
          { merge: true }
        );
      } catch (err) {
        await wsDoc.ref.set(
          {
            autoPostLastError:
              err instanceof Error ? err.message : "unknown_error",
            autoPostLastRunAt: now,
          },
          { merge: true }
        );
      }
    }

    return { ok: true, scheduleKey };
  });
