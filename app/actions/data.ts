"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import { exportAllTables, importAllTables, type ImportResult } from "@/lib/backup";
import { logAction, listLogFiles, readLogFile, type LogFileInfo } from "@/lib/logger";

// Full data backup as a JSON string + a suggested filename. Manager-only. NOTE:
// the dump includes the users table (password hashes) so it is a complete,
// restore-capable backup — keep the file private.
export async function exportDataAction(): Promise<{ filename: string; json: string }> {
  await requireManager();
  const now = new Date();
  const env = exportAllTables(now.toISOString());
  const total = Object.values(env.tables).reduce((s, rows) => s + rows.length, 0);
  await logAction("data.export", { rows: total });
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return { filename: `paper-manager-backup-${stamp}.json`, json: JSON.stringify(env, null, 2) };
}

// Restore from an uploaded backup JSON. DESTRUCTIVE: each table present in the
// file is fully replaced. Manager-only.
export async function importDataAction(json: string): Promise<ImportResult> {
  await requireManager();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Tệp không phải JSON hợp lệ." };
  }
  const result = importAllTables(parsed);
  if (result.ok) {
    const total = Object.values(result.counts ?? {}).reduce((s, n) => s + n, 0);
    await logAction("data.import", { rows: total, tables: Object.keys(result.counts ?? {}).length });
    // Restored data touches every route's derived state.
    revalidatePath("/", "layout");
  } else {
    await logAction("data.import_failed", { error: result.error });
  }
  return result;
}

// Log-file management for the admin view.
export async function listLogsAction(): Promise<LogFileInfo[]> {
  await requireManager();
  return listLogFiles();
}

export async function downloadLogAction(name: string): Promise<{ ok: boolean; content?: string; error?: string }> {
  await requireManager();
  const content = readLogFile(name);
  if (content == null) return { ok: false, error: "Không đọc được tệp log." };
  return { ok: true, content };
}
