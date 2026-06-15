import "server-only";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type BetterSqlite3 from "better-sqlite3";
import { SAMPLE_LECTURERS, SAMPLE_PAPERS, academicRankFromTitle, type Lecturer, type Paper } from "./data";
import { VENUES } from "./venues";
import { dedupeAuthorLinks, type AuthorLink } from "./author-match";

const SEED_FLAG = "seeded_core_v1";

// KPI indicators that are implemented now. The registry is extensible (new rows
// + a new `agg` arm in lib/kpi.ts) without schema changes.
const DEFAULT_INDICATORS = [
  { code: "paper_count", name_vi: "Số bài báo", unit: "bài", agg: "count" },
  { code: "scopus_paper_count", name_vi: "Số bài Scopus", unit: "bài", agg: "scopus_count" },
  { code: "q1_count", name_vi: "Số bài Q1", unit: "bài", agg: "q1_count" },
  { code: "phd_count", name_vi: "Số giảng viên trình độ Tiến sĩ", unit: "người", agg: "phd_count" },
];

// Default bộ môn (sub-departments) of Khoa KHMT. KHMT is the fallback unit that
// existing lecturers are backfilled into; managers add/rename via the UI.
const DEFAULT_BO_MON = [
  { code: "KHMT", name_vi: "Khoa học Máy tính", name_en: "Computer Science" },
  { code: "TTNT", name_vi: "Trí tuệ Nhân tạo", name_en: "Artificial Intelligence" },
  { code: "ĐPT", name_vi: "Đa phương tiện", name_en: "Multimedia" },
];

// One-time seed/migration. Idempotent via the meta flag.
export function seedDatabase(db: BetterSqlite3.Database) {
  // Reference data that must also reach already-seeded (production) databases.
  // Idempotent (INSERT OR IGNORE by unique code), so it runs on every boot —
  // it cannot live behind SEED_FLAG, which early-returns on existing volumes.
  seedBoMon(db);
  seedIndicators(db);
  backfillLecturerBoMon(db);

  const done = db.prepare("SELECT value FROM meta WHERE key = ?").get(SEED_FLAG);
  if (!done) {
    const tx = db.transaction(() => {
      seedCoreData(db);
      seedVenues(db);
      db.prepare("INSERT INTO meta (key, value) VALUES (?, datetime('now'))").run(SEED_FLAG);
    });
    tx();
  }

  // One-time data fixes that must also reach already-seeded (production) volumes,
  // AFTER the core data is present. Each self-guards via its own meta flag, so it
  // runs exactly once and never clobbers later user edits.
  restoreOverwrittenAuthorNames(db);
  publishLegacySubmittedPapers(db);
  dedupePaperAuthors(db);
}

// An earlier author-reconstruction bug, when editing a paper, left the byline name
// ("Tien Do") as an external author AND appended the matched lecturer's full name
// ("Đỗ Văn Tiến") as a separate internal chip — a visible duplicate once saved.
// Collapse those twins once for every paper whose stored authors_json contains one.
const AUTHOR_DEDUP_FLAG = "author_dups_cleaned_v1";

function dedupePaperAuthors(db: BetterSqlite3.Database) {
  const done = db.prepare("SELECT value FROM meta WHERE key = ?").get(AUTHOR_DEDUP_FLAG);
  if (done) return;
  const rows = db
    .prepare("SELECT id, authors_json FROM papers WHERE authors_json IS NOT NULL AND authors_json != ''")
    .all() as { id: number; authors_json: string }[];
  const upd = db.prepare("UPDATE papers SET authors = ?, authors_json = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.authors_json);
      } catch {
        continue;
      }
      if (!Array.isArray(parsed) || parsed.length === 0) continue;
      const links: AuthorLink[] = parsed
        .map((a) => ({
          name: String((a as { name?: unknown })?.name ?? "").trim(),
          lecturerId:
            (a as { lecturerId?: unknown })?.lecturerId != null
              ? Number((a as { lecturerId: unknown }).lecturerId)
              : null,
        }))
        .filter((a) => a.name);
      const deduped = dedupeAuthorLinks(links);
      if (deduped.length < links.length) {
        const authors = deduped.map((a) => a.name.trim()).filter(Boolean).join(", ");
        upd.run(authors, JSON.stringify(deduped), r.id);
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES (?, datetime('now'))").run(AUTHOR_DEDUP_FLAG);
  });
  tx();
}

// The legacy JSON catalog predates the submission pipeline, so imported papers
// land at the column default 'submitted'. They are in fact published work — and
// since only accepted/published papers are public (see getDatabase), leaving the
// catalog as 'submitted' would hide it entirely from public/non-admin viewers.
// Promote every paper still 'submitted' to 'published' exactly once. Genuine
// in-progress submissions added AFTER this runs keep their status and stay
// private as intended.
const LEGACY_PUBLISHED_FLAG = "legacy_submitted_published_v1";

function publishLegacySubmittedPapers(db: BetterSqlite3.Database) {
  const done = db.prepare("SELECT value FROM meta WHERE key = ?").get(LEGACY_PUBLISHED_FLAG);
  if (done) return;
  const tx = db.transaction(() => {
    db.prepare("UPDATE papers SET submission_status = 'published' WHERE submission_status = 'submitted'").run();
    db.prepare("INSERT INTO meta (key, value) VALUES (?, datetime('now'))").run(LEGACY_PUBLISHED_FLAG);
  });
  tx();
}

// Past BibTeX/OpenAlex imports overwrote a matched author's name in the stored
// author string with the lecturer's "Học hàm. Tên" (e.g. "ThS. Đỗ Văn Tiến"),
// losing the name as written in the paper. Restore the originals (provided by
// the Khoa) one time. Matches any academic-title prefix so it works regardless
// of the title used at import time; runs once via AUTHOR_FIX_FLAG.
const AUTHOR_FIX_FLAG = "author_names_restored_v1";
const AUTHOR_TITLE_RE = /^(GS\.TS|PGS\.TS|TS|ThS|NCS|CN|CĐ|TC|CL|KS)\.\s*/;
const AUTHOR_NAME_FIXES: Record<string, string> = {
  "Ngô Đức Thành": "Thanh Duc Ngo",
  "Đỗ Văn Tiến": "Tien Do",
  "Mai Tiến Dũng": "Tien-Dung Mai",
  "Lê Trần Trọng Khiêm": "Khiem Le",
  "Trần Doãn Thuyên": "Thuyen Tran",
  "Lương Ngọc Hoàng": "Ngoc Hoang Luong",
};

function restoreOverwrittenAuthorNames(db: BetterSqlite3.Database) {
  const done = db.prepare("SELECT value FROM meta WHERE key = ?").get(AUTHOR_FIX_FLAG);
  if (done) return;

  const rows = db.prepare("SELECT id, authors FROM papers").all() as { id: number; authors: string }[];
  const upd = db.prepare("UPDATE papers SET authors = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of rows) {
      const tokens = String(r.authors || "").split(",").map((t) => t.trim()).filter(Boolean);
      let changed = false;
      const next = tokens.map((tok) => {
        const stripped = tok.replace(AUTHOR_TITLE_RE, "").trim();
        const original = AUTHOR_NAME_FIXES[stripped];
        if (original) { changed = true; return original; }
        return tok;
      });
      if (changed) upd.run(next.join(", "), r.id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES (?, datetime('now'))").run(AUTHOR_FIX_FLAG);
  });
  tx();
}

// Prefer migrating an existing JSON datastore (legacy real data); fall back to samples.
function seedCoreData(db: BetterSqlite3.Database) {
  const legacy = findLegacyJson();
  let lecturers: Lecturer[] = SAMPLE_LECTURERS;
  let papers: Paper[] = SAMPLE_PAPERS;
  let aliases: Record<string, number> = {};

  if (legacy) {
    try {
      const parsed = JSON.parse(fs.readFileSync(legacy, "utf-8"));
      if (Array.isArray(parsed.lecturers)) lecturers = parsed.lecturers;
      if (Array.isArray(parsed.papers)) papers = parsed.papers;
      if (parsed.authorAliases && typeof parsed.authorAliases === "object") {
        aliases = parsed.authorAliases;
      }
    } catch {
      // corrupt legacy file -> fall back to samples
    }
  }

  const insLecturer = db.prepare(
    "INSERT OR IGNORE INTO lecturers (id, name, email, title, department, phone, academic_rank) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const lecturerIds = new Set<number>();
  for (const l of lecturers) {
    insLecturer.run(
      l.id,
      l.name,
      l.email,
      l.title,
      l.department,
      l.phone ?? null,
      l.academicRank ?? academicRankFromTitle(l.title)
    );
    lecturerIds.add(l.id);
  }

  const insPaper = db.prepare(
    "INSERT OR IGNORE INTO papers (id, title, year, pub_month, venue_code, authors, doi, url, abstract) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insLink = db.prepare(
    "INSERT OR IGNORE INTO paper_lecturers (paper_id, lecturer_id) VALUES (?, ?)"
  );
  for (const p of papers) {
    insPaper.run(
      p.id,
      p.title,
      p.year,
      (p as Paper & { pubMonth?: number }).pubMonth ?? null,
      p.venue ?? "",
      p.authors ?? "",
      p.doi ?? null,
      p.url ?? null,
      p.abstract ?? null
    );
    for (const lid of p.lecturerIds ?? []) {
      // Skip dangling refs to keep FK integrity.
      if (lecturerIds.has(lid)) insLink.run(p.id, lid);
    }
  }

  const insAlias = db.prepare(
    "INSERT OR IGNORE INTO author_aliases (raw_name, lecturer_id) VALUES (?, ?)"
  );
  for (const [rawName, lid] of Object.entries(aliases)) {
    if (lecturerIds.has(lid as number)) insAlias.run(rawName, lid);
  }
}

// Create the initial manager account from env, if there are no users yet.
// Runs on every boot but is a no-op once any user exists, so an operator can
// enable it later by setting the env vars and restarting.
export function ensureBootstrapAdmin(db: BetterSqlite3.Database) {
  const { n } = db.prepare("SELECT count(*) AS n FROM users").get() as { n: number };
  if (n > 0) return;

  const username = process.env.INITIAL_ADMIN_USER;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) return;

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role, lecturer_id) VALUES (?, ?, 'manager', NULL)"
  ).run(username, hash);
}

function seedVenues(db: BetterSqlite3.Database) {
  const ins = db.prepare(
    "INSERT OR IGNORE INTO venues (id, code, name_en, name_vi, type, rank, scopus_indexed) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (const v of VENUES) {
    ins.run(v.id, v.code, v.nameEn ?? "", v.nameVi ?? "", v.type ?? 1, v.rank ?? "", v.scopusIndexed ?? 0);
  }
}

function seedIndicators(db: BetterSqlite3.Database) {
  const ins = db.prepare(
    "INSERT OR IGNORE INTO kpi_indicators (code, name_vi, unit, agg) VALUES (?, ?, ?, ?)"
  );
  for (const i of DEFAULT_INDICATORS) ins.run(i.code, i.name_vi, i.unit, i.agg);
}

function seedBoMon(db: BetterSqlite3.Database) {
  const ins = db.prepare(
    "INSERT OR IGNORE INTO bo_mon (code, name_vi, name_en) VALUES (?, ?, ?)"
  );
  for (const b of DEFAULT_BO_MON) ins.run(b.code, b.name_vi, b.name_en);
}

// Assign lecturers without a bộ môn to the default unit (KHMT). Only touches
// NULL rows, so manager reassignments are preserved.
function backfillLecturerBoMon(db: BetterSqlite3.Database) {
  const def = db.prepare("SELECT id FROM bo_mon WHERE code = 'KHMT'").get() as { id: number } | undefined;
  if (!def) return;
  db.prepare("UPDATE lecturers SET bo_mon_id = ? WHERE bo_mon_id IS NULL").run(def.id);
}

// Look for a legacy database.json next to the DB file, then in the working dir.
function findLegacyJson(): string | null {
  const candidates: string[] = [];
  if (process.env.DATABASE_FILE) {
    candidates.push(path.join(path.dirname(path.resolve(process.env.DATABASE_FILE)), "database.json"));
  }
  candidates.push(path.join(process.cwd(), "database.json"));
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}
