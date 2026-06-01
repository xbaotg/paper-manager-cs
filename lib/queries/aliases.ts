import "server-only";
import { getDb } from "../sqlite";

export function listAliases(): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT raw_name, lecturer_id FROM author_aliases")
    .all() as { raw_name: string; lecturer_id: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.raw_name] = r.lecturer_id;
  return out;
}

export function setAlias(rawName: string, lecturerId: number): void {
  getDb()
    .prepare(
      "INSERT INTO author_aliases (raw_name, lecturer_id) VALUES (?, ?) " +
        "ON CONFLICT(raw_name) DO UPDATE SET lecturer_id = excluded.lecturer_id"
    )
    .run(rawName, lecturerId);
}
