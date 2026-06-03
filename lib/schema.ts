// SQLite schema for the KPI system. Idempotent — safe to run on every boot.
// Tables for all phases are declared up-front (CREATE TABLE IF NOT EXISTS) so a
// fresh install gets the final shape directly. EXISTING databases are brought to
// this same shape by the migration runner in lib/migrate.ts (column adds + the
// users role-CHECK rebuild). Keep the two in sync: anything added here that
// alters an existing table must have a matching, guarded migration.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Sub-department (bộ môn): KHMT, TTNT, ĐPT, ... Declared before the tables that
-- reference it so fresh installs satisfy the FK at first write.
CREATE TABLE IF NOT EXISTS bo_mon (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT NOT NULL UNIQUE,
  name_vi   TEXT NOT NULL,
  name_en   TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lecturers (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  title         TEXT NOT NULL,
  department    TEXT NOT NULL,
  phone         TEXT,
  academic_rank TEXT NOT NULL DEFAULT 'ThS',          -- PGS.TS | TS | NCS | ThS | CN (normalized for KPI logic)
  bo_mon_id     INTEGER REFERENCES bo_mon(id) ON DELETE SET NULL,
  avatar_url    TEXT                                    -- profile photo URL; NULL -> UI shows initials
);

CREATE TABLE IF NOT EXISTS papers (
  id                       INTEGER PRIMARY KEY,
  title                    TEXT NOT NULL,
  year                     INTEGER NOT NULL,
  pub_month                INTEGER,                       -- nullable; refines academic-year attribution when known
  venue_code               TEXT NOT NULL DEFAULT '',
  authors                  TEXT NOT NULL DEFAULT '',
  doi                      TEXT,
  url                      TEXT,
  abstract                 TEXT,
  credited_lecturer_id     INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,  -- single-credit rule: one paper -> one person
  is_first_author          INTEGER NOT NULL DEFAULT 0,
  is_corresponding_author  INTEGER NOT NULL DEFAULT 0,
  scopus_index_status      TEXT NOT NULL DEFAULT 'unknown', -- unknown | accepted | indexed
  scopus_index_year        INTEGER,                         -- counting year for Scopus KPIs (NOT publication year)
  quartile                 TEXT,                            -- Q1..Q4 snapshot at index time; NULL -> fall back to venue rank
  submission_status        TEXT NOT NULL DEFAULT 'submitted' -- submitted | under_review | rebuttal | accepted | denied | published
);

CREATE TABLE IF NOT EXISTS paper_lecturers (
  paper_id    INTEGER NOT NULL REFERENCES papers(id)    ON DELETE CASCADE,
  lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, lecturer_id)
);
CREATE INDEX IF NOT EXISTS idx_paper_lecturers_lecturer ON paper_lecturers(lecturer_id);

CREATE TABLE IF NOT EXISTS author_aliases (
  raw_name    TEXT PRIMARY KEY,
  lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('manager','lecturer','head')),
  lecturer_id   INTEGER UNIQUE REFERENCES lecturers(id) ON DELETE SET NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  bo_mon_id     INTEGER REFERENCES bo_mon(id) ON DELETE SET NULL,  -- scope for the 'head' (Trưởng bộ môn) role
  is_admin      INTEGER NOT NULL DEFAULT 0   -- elevated grant: a 'lecturer' with admin access who can switch admin/user view
);

CREATE TABLE IF NOT EXISTS venues (
  id             INTEGER PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name_en        TEXT NOT NULL DEFAULT '',
  name_vi        TEXT NOT NULL DEFAULT '',
  type           INTEGER NOT NULL DEFAULT 1,
  rank           TEXT NOT NULL DEFAULT '',
  scopus_indexed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kpi_periods (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL UNIQUE,          -- "2024-2025"
  start_year INTEGER NOT NULL,
  end_year   INTEGER NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kpi_indicators (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT NOT NULL UNIQUE,           -- 'paper_count' | 'scopus_paper_count' | 'q1_count' | 'phd_count'
  name_vi   TEXT NOT NULL,
  unit      TEXT NOT NULL,                  -- 'bài' | 'người'
  agg       TEXT NOT NULL,                  -- 'count' | 'scopus_count' | 'q1_count' | 'phd_count'
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kpi_targets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id    INTEGER NOT NULL REFERENCES kpi_periods(id)    ON DELETE CASCADE,
  indicator_id INTEGER NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
  lecturer_id  INTEGER NOT NULL REFERENCES lecturers(id)      ON DELETE CASCADE,
  target_value REAL NOT NULL,
  note         TEXT,
  set_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (period_id, indicator_id, lecturer_id)
);

-- Faculty- and bộ-môn-level targets (e.g. Khoa: 55 Scopus/yr, 17 Q1/yr, PhD
-- milestones). bo_mon_id = 0 is the sentinel for the whole faculty (a real
-- per-bộ-môn row uses that bộ môn's id). Sentinel keeps UNIQUE working, since
-- SQLite treats NULLs as distinct.
CREATE TABLE IF NOT EXISTS kpi_faculty_targets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id    INTEGER NOT NULL REFERENCES kpi_periods(id)    ON DELETE CASCADE,
  indicator_id INTEGER NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
  bo_mon_id    INTEGER NOT NULL DEFAULT 0,    -- 0 = whole faculty
  target_value REAL NOT NULL,
  note         TEXT,
  set_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (period_id, indicator_id, bo_mon_id)
);

-- PhD-roadmap tracking for non-PhD staff (one row per tracked lecturer).
CREATE TABLE IF NOT EXISTS faculty_development (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  lecturer_id    INTEGER NOT NULL UNIQUE REFERENCES lecturers(id) ON DELETE CASCADE,
  current_degree TEXT NOT NULL,                       -- NCS | ThS | CN
  target_degree  TEXT NOT NULL DEFAULT 'TS',
  expected_year  INTEGER,                             -- expected PhD completion
  mentor_id      INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,  -- assigned PGS.TS/TS
  status         TEXT NOT NULL DEFAULT 'planned',     -- planned | in_progress | completed | paused
  notes          TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Quarterly development progress snapshots.
CREATE TABLE IF NOT EXISTS development_progress (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  development_id INTEGER NOT NULL REFERENCES faculty_development(id) ON DELETE CASCADE,
  year           INTEGER NOT NULL,
  quarter        INTEGER NOT NULL,                    -- 1..4
  note           TEXT NOT NULL DEFAULT '',
  status         TEXT,                                -- snapshot status that quarter
  recorded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (development_id, year, quarter)
);
`;
