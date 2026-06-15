import "server-only";
import type BetterSqlite3 from "better-sqlite3";
import { backfillLecturerAvatars } from "./lecturer-avatars";

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

/** Drop a column only if it is still present (SQLite 3.35+ `DROP COLUMN`).
 *  No-op when the column was never added or has already been dropped. */
export function dropColumnIfExists(
  db: BetterSqlite3.Database,
  table: string,
  column: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
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

  // --- Admin grant for lecturers (promote-to-admin + admin/user view switch). ---
  // A lecturer keeps role='lecturer' (and their self-view / KPI) but gains admin
  // access via this flag; capability = role='manager' OR is_admin=1.
  {
    id: "0008_users_is_admin",
    up: (db) => {
      addColumnIfMissing(db, "users", "is_admin", "is_admin INTEGER NOT NULL DEFAULT 0");
    },
  },

  // --- Lecturer profile photos. ---
  // Adds lecturers.avatar_url and backfills it with portrait URLs scraped from
  // the faculty directory (https://cs.uit.edu.vn/portfolio-teaches/), matched to
  // each lecturer by their @uit.edu.vn email (stable across machines). Only fills
  // rows whose avatar is still empty, so a manual override or a re-run never
  // clobbers an existing photo. Lecturers absent from the directory keep NULL and
  // the UI falls back to initials.
  {
    id: "0009_lecturer_avatars",
    up: (db) => {
      addColumnIfMissing(db, "lecturers", "avatar_url", "avatar_url TEXT");
      const AVATARS: [string, string][] = [
        ["chinhnt@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00502-267x400.jpg"],
        ["diemntn@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2022/12/DiemNTN-267x400.jpg"],
        ["dungmt@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00295-267x400.jpg"],
        ["duyld@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2022/12/DuyLD-267x400.jpg"],
        ["duyvnl@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00341-267x400.jpg"],
        ["hangdv@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00419-267x400.jpg"],
        ["hiennd@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2022/12/LD_00303-267x400.jpg"],
        ["hoangln@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00323-267x400.jpg"],
        ["khangtd@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00384-267x400.jpg"],
        ["khiemltt@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00392-267x400.jpg"],
        ["kietnt@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00361-267x400.jpg"],
        ["thangcpd@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00310-267x400.jpg"],
        ["thanhnd@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2022/12/LD_00508-267x400.jpg"],
        ["thuonghtt@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00412-267x400.jpg"],
        ["thuyentd@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00372-267x400.jpg"],
        ["tiendv@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2023/02/LD_00354-267x400.jpg"],
        ["truonganpn@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2022/12/AnPNT-267x400.jpg"],
        ["uyenptt@uit.edu.vn", "https://cs.uit.edu.vn/wp-content/uploads/2022/12/UyenPTT-267x400.jpg"],
      ];
      const stmt = db.prepare(
        "UPDATE lecturers SET avatar_url = ? WHERE lower(email) = ? AND (avatar_url IS NULL OR avatar_url = '')"
      );
      for (const [email, url] of AVATARS) stmt.run(url, email.toLowerCase());
    },
  },

  // --- Re-backfill avatars with name fallback. ---
  // 0009 matched on email only, so production lecturers whose stored email
  // differs from the scraped directory kept a NULL avatar — and 0009, once
  // ledgered, never re-runs. This fills any still-empty avatar by email OR a
  // diacritic-insensitive name match (shared logic in lib/lecturer-avatars.ts).
  // Non-destructive: existing photos are left untouched.
  {
    id: "0010_lecturer_avatars_namematch",
    up: (db) => {
      addColumnIfMissing(db, "lecturers", "avatar_url", "avatar_url TEXT");
      backfillLecturerAvatars(db);
    },
  },

  // --- Drop the per-paper Scopus index fields. ---
  // Scopus is now derived from the venue (venues.scopusIndexed) and a paper
  // counts toward the KPI once its submission is accepted, attributed by
  // conference year — so the per-paper scopus_index_status / scopus_index_year
  // columns are obsolete. submission_status was already backfilled from them
  // (0006), so acceptance information is preserved before they are removed.
  {
    id: "0011_drop_scopus_index_columns",
    up: (db) => {
      dropColumnIfExists(db, "papers", "scopus_index_status");
      dropColumnIfExists(db, "papers", "scopus_index_year");
    },
  },

  // --- Auto-credit single-author papers. ---
  // A paper with exactly one internal author has no attribution ambiguity, so
  // credit them automatically instead of nagging the manager. Backfills existing
  // uncredited single-author papers; new/edited papers get this from
  // normalizeCredited (lib/queries/papers.ts).
  {
    id: "0012_autocredit_single_author",
    up: (db) => {
      db.exec(`
        UPDATE papers SET credited_lecturer_id = (
          SELECT pl.lecturer_id FROM paper_lecturers pl WHERE pl.paper_id = papers.id
        )
        WHERE credited_lecturer_id IS NULL
          AND (SELECT COUNT(*) FROM paper_lecturers pl2 WHERE pl2.paper_id = papers.id) = 1
      `);
    },
  },

  // --- Per-lecturer "exclude from KPI" flag. ---
  // When set, the lecturer still appears everywhere but is dropped from every
  // aggregate statistic (faculty rollup, dashboard, reports, leaderboards).
  {
    id: "0013_lecturer_excluded_from_kpi",
    up: (db) => {
      addColumnIfMissing(db, "lecturers", "excluded_from_kpi", "excluded_from_kpi INTEGER NOT NULL DEFAULT 0");
    },
  },

  // --- Ordered author↔lecturer links. ---
  // Persist the per-author internal links the add/import forms already produce, so
  // editing a paper rebuilds the exact same list instead of re-guessing it from
  // the flat authors string + the (orderless) paper_lecturers set.
  {
    id: "0014_papers_authors_json",
    up: (db) => {
      addColumnIfMissing(db, "papers", "authors_json", "authors_json TEXT NOT NULL DEFAULT ''");
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
