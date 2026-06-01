import "server-only";
import type BetterSqlite3 from "better-sqlite3";

// Ordered, idempotent schema migrations for EXISTING databases.
//
// Fresh installs get the final shape directly from SCHEMA_SQL (lib/schema.ts).
// Migrations bring older/production databases (the mounted Docker volume) up to
// that same shape. Every migration MUST be a no-op when already applied — both
// via the `schema_migrations` ledger AND via its own internal guards — so the
// two code paths (fresh vs upgraded) converge on identical structures.
//
// Most migrations run inside a transaction. A `manual` migration manages its own
// transaction boundaries (needed when toggling `PRAGMA foreign_keys`, which
// SQLite forbids inside a transaction); such migrations must be internally
// guarded so that a crash before the ledger insert cannot corrupt a re-run.

interface Migration {
  id: string;
  /** When true, the runner does not wrap `up` in a transaction. */
  manual?: boolean;
  up: (db: BetterSqlite3.Database) => void;
}

/** Add a column only if it is not already present. SQLite `ADD COLUMN` allows
 *  only constant/NULL defaults, which every caller here respects. */
export function addColumnIfMissing(
  db: BetterSqlite3.Database,
  table: string,
  column: string,
  /** Full column definition incl. name, e.g. `"academic_rank TEXT NOT NULL DEFAULT 'ThS'"`. */
  columnDef: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
}

/** True if the stored DDL for `table` contains `needle` (used to guard table rebuilds). */
export function tableSqlIncludes(
  db: BetterSqlite3.Database,
  table: string,
  needle: string
): boolean {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { sql: string } | undefined;
  return !!row && row.sql.includes(needle);
}

// The migration registry. Entries are appended as features land; never edit or
// reorder a shipped id.
const MIGRATIONS: Migration[] = [
  // --- Phase 1: org structure + head role ---
  {
    id: "0001_lecturers_org",
    up: (db) => {
      addColumnIfMissing(db, "lecturers", "academic_rank", "academic_rank TEXT NOT NULL DEFAULT 'ThS'");
      addColumnIfMissing(db, "lecturers", "bo_mon_id", "bo_mon_id INTEGER REFERENCES bo_mon(id) ON DELETE SET NULL");
    },
  },
  {
    // Widen users.role CHECK to include 'head' and add users.bo_mon_id. SQLite
    // cannot ALTER a CHECK, so rebuild the table. `manual` because the FK
    // toggle cannot run inside a transaction. Guarded: skip once 'head' is
    // present (fresh installs already have it from SCHEMA_SQL).
    id: "0002_users_role_head",
    manual: true,
    up: (db) => {
      if (tableSqlIncludes(db, "users", "'head'")) return;
      db.pragma("foreign_keys = OFF");
      try {
        const tx = db.transaction(() => {
          db.exec(`
            CREATE TABLE users_new (
              id            INTEGER PRIMARY KEY AUTOINCREMENT,
              username      TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role          TEXT NOT NULL CHECK (role IN ('manager','lecturer','head')),
              lecturer_id   INTEGER UNIQUE REFERENCES lecturers(id) ON DELETE SET NULL,
              is_active     INTEGER NOT NULL DEFAULT 1,
              created_at    TEXT NOT NULL DEFAULT (datetime('now')),
              bo_mon_id     INTEGER REFERENCES bo_mon(id) ON DELETE SET NULL
            );
            INSERT INTO users_new (id, username, password_hash, role, lecturer_id, is_active, created_at)
              SELECT id, username, password_hash, role, lecturer_id, is_active, created_at FROM users;
            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
          `);
          const problems = db.pragma("foreign_key_check") as unknown[];
          if (problems.length > 0) {
            throw new Error(`foreign_key_check failed during users rebuild: ${JSON.stringify(problems)}`);
          }
        });
        tx();
      } finally {
        db.pragma("foreign_keys = ON");
      }
    },
  },
  {
    // One-time backfill of academic_rank from the existing free-form title.
    // Runs once (ledger-tracked); on a fresh DB the lecturers table is still
    // empty here (seed runs after migrations), so this is a no-op there and the
    // seed path sets academic_rank itself.
    id: "0003_backfill_lecturer_rank",
    up: (db) => {
      db.exec(`
        UPDATE lecturers SET academic_rank = CASE
          WHEN title IN ('GS.TS','PGS.TS') THEN 'PGS.TS'
          WHEN title = 'TS' THEN 'TS'
          WHEN title = 'CN' THEN 'CN'
          ELSE 'ThS'
        END
      `);
    },
  },

  // --- Phase 2: single-credit publications ---
  {
    id: "0004_papers_credit",
    up: (db) => {
      addColumnIfMissing(db, "papers", "credited_lecturer_id", "credited_lecturer_id INTEGER REFERENCES lecturers(id) ON DELETE SET NULL");
      addColumnIfMissing(db, "papers", "is_first_author", "is_first_author INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "papers", "is_corresponding_author", "is_corresponding_author INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "papers", "scopus_index_status", "scopus_index_status TEXT NOT NULL DEFAULT 'unknown'");
      addColumnIfMissing(db, "papers", "scopus_index_year", "scopus_index_year INTEGER");
      addColumnIfMissing(db, "papers", "quartile", "quartile TEXT");
    },
  },
  {
    // One-time backfill. Credited author defaults to the lowest linked
    // lecturer_id (a guess; managers correct via the "needs credit" list).
    // Scopus status is optimistically set to 'indexed' (index year = pub year)
    // for papers whose venue is Scopus-indexed, so KPIs aren't all zero on day
    // one — flagged as an assumption to verify.
    id: "0005_backfill_paper_credit",
    up: (db) => {
      db.exec(`
        UPDATE papers SET credited_lecturer_id = (
          SELECT MIN(pl.lecturer_id) FROM paper_lecturers pl WHERE pl.paper_id = papers.id
        ) WHERE credited_lecturer_id IS NULL
      `);
      db.exec(`
        UPDATE papers SET scopus_index_status = 'indexed', scopus_index_year = year
        WHERE scopus_index_status = 'unknown'
          AND venue_code IN (SELECT code FROM venues WHERE scopus_indexed = 1)
      `);
    },
  },

  // --- Submission pipeline status (Asks: status workflow + stats) ---
  {
    id: "0006_papers_submission_status",
    up: (db) => {
      addColumnIfMissing(
        db,
        "papers",
        "submission_status",
        "submission_status TEXT NOT NULL DEFAULT 'submitted'"
      );
      // Backfill from the Scopus index state: indexed → published; accepted →
      // accepted; otherwise leave the new default 'submitted'.
      db.exec(`UPDATE papers SET submission_status = 'published' WHERE scopus_index_status = 'indexed'`);
      db.exec(`UPDATE papers SET submission_status = 'accepted' WHERE scopus_index_status = 'accepted'`);
    },
  },

  // --- Drop deprecated 'paper_points' (Điểm công bố / Impact) indicator. ---
  // The indicator was removed from the UI; cascade clears any per-lecturer and
  // faculty targets that referenced it so the dropped row leaves no orphans.
  {
    id: "0007_drop_paper_points_indicator",
    up: (db) => {
      db.exec(`DELETE FROM kpi_indicators WHERE code = 'paper_points'`);
    },
  },
];

export function runMigrations(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((r) => r.id)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;

    if (m.manual) {
      // The migration owns its transaction control. The ledger insert is not
      // atomic with the change, so `up` must be internally guarded/idempotent.
      m.up(db);
      db.prepare("INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)").run(m.id);
    } else {
      const tx = db.transaction(() => {
        m.up(db);
        db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(m.id);
      });
      tx();
    }
  }
}
