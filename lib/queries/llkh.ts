import "server-only";
import { getDb } from "../sqlite";
import { normalizeLlkh, type LlkhProfile } from "../llkh";

// Read a lecturer's saved LLKH blob, normalized to a complete profile (defaults
// when the row doesn't exist yet).
export function getLlkh(lecturerId: number): LlkhProfile {
  const row = getDb()
    .prepare("SELECT data_json FROM lecturer_llkh WHERE lecturer_id = ?")
    .get(lecturerId) as { data_json: string } | undefined;
  if (!row) return normalizeLlkh({});
  try {
    return normalizeLlkh(JSON.parse(row.data_json));
  } catch {
    return normalizeLlkh({});
  }
}

// Upsert the blob. The profile is normalized first so we never persist an
// out-of-shape object.
export function saveLlkh(lecturerId: number, profile: LlkhProfile): void {
  const json = JSON.stringify(normalizeLlkh(profile));
  getDb()
    .prepare(
      `INSERT INTO lecturer_llkh (lecturer_id, data_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(lecturer_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`
    )
    .run(lecturerId, json);
}
