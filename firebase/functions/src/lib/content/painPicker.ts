// firebase/functions/src/lib/content/painPicker.ts
import painTopicsRaw from "./painTopics_kariraku.json" with { type: "json" };

export type PainTopic = {
  id: string;
  topic: string;
  persona: string;
  pain: string;
  compareUrl: string;
  enabled?: boolean; // JSON に無い場合もあるので optional
};

const painTopics = painTopicsRaw as PainTopic[];

export function pickRandomPainTopicForSite(
  siteId: string,
  excludeIds: string[] = []
): PainTopic | null {
  if (siteId !== "kariraku") {
    return null;
  }

  const all = painTopics.filter((t) => t.enabled !== false);

  if (all.length === 0) return null;

  const candidates = all.filter((t) => !excludeIds.includes(t.id));
  const pool = candidates.length > 0 ? candidates : all;

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
