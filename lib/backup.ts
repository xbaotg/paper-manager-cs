import "server-only";
import { getDb } from "./sqlite";

// Full-database backup / restore as a single JSON envelope. Every application
// table is dumped row-for-row and can be restored verbatim. Restore is a
// destructive REPLACE (the whole table is cleared first), run in one transaction
// with foreign keys temporarily disabled so insertion order doesn't matter.

// All application tables, in parent→child order (used for deterministic output;
// restore disables FK checks so the order isn't load-bearing).
const TABLES = [
  "meta",
  "bo_mon",
  "lecturers",
  "papers",
  "paper_lecturers",
  "author_aliases",
  "users",
  "venues",
  "kpi_periods",
  "kpi_indicators",
  "kpi_targets",
  "kpi_faculty_targets",
  "faculty_development",
  "development_progress",
  "lecturer_llkh",
] as const;

const TABLE_SET = new Set<string>(TABLES);

export const BACKUP_VERSION = 1;

export interface BackupEnvelope {
  app: "paper-manager-cs";
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

// Dump every table to a plain object. exportedAt is supplied by the caller (no
// Date in pure helpers elsewhere — but this is a server action path, so a passed
// timestamp keeps it deterministic/testable).
export function exportAllTables(exportedAt: string): BackupEnvelope {
  const db = getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    tables[t] = db.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
  }
  return { app: "paper-manager-cs", version: BACKUP_VERSION, exportedAt, tables };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  counts?: Record<string, number>;
}

// Restore from an envelope. Validates the shape, then in a single transaction
// (FK checks off) clears and re-inserts every recognised table that is present.
// Unknown tables in the payload are ignored; tables absent from the payload are
// left untouched.
export function importAllTables(raw: unknown): ImportResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Tệp không hợp lệ." };
  const env = raw as Partial<BackupEnvelope>;
  if (env.app !== "paper-manager-cs" || !env.tables || typeof env.tables !== "object") {
    return { ok: false, error: "Tệp sao lưu không đúng định dạng (thiếu app/tables)." };
  }

  const db = getDb();
  const counts: Record<string, number> = {};

  // Only operate on recognised tables that carry an array of rows.
  const incoming = Object.entries(env.tables).filter(
    ([name, rows]) => TABLE_SET.has(name) && Array.isArray(rows)
  ) as [string, Record<string, unknown>[]][];

  if (incoming.length === 0) return { ok: false, error: "Không có bảng dữ liệu hợp lệ nào trong tệp." };

  const run = db.transaction(() => {
    // Clear children→parents (reverse of declaration order) to be safe even with
    // FK off, then refill.
    for (const t of [...TABLES].reverse()) {
      if (env.tables![t]) db.prepare(`DELETE FROM ${t}`).run();
    }
    for (const [table, rows] of incoming) {
      let n = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => "?").join(", ");
        const colList = cols.map((c) => `"${c}"`).join(", ");
        db.prepare(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`).run(
          ...cols.map((c) => normalizeValue(row[c]))
        );
        n++;
      }
      counts[table] = n;
    }
  });

  const hadFk = db.pragma("foreign_keys", { simple: true });
  try {
    db.pragma("foreign_keys = OFF");
    run();
    return { ok: true, counts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lỗi khi nhập dữ liệu." };
  } finally {
    if (hadFk) db.pragma("foreign_keys = ON");
  }
}

// better-sqlite3 only binds null/number/bigint/string/Buffer. Coerce booleans
// (SQLite stores them as 0/1) and stringify any stray objects/arrays.
function normalizeValue(v: unknown): null | number | string | bigint | Buffer {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "string") return v;
  if (Buffer.isBuffer(v)) return v;
  return JSON.stringify(v);
}
