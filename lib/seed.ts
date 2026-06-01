import "server-only";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type BetterSqlite3 from "better-sqlite3";
import { SAMPLE_LECTURERS, SAMPLE_PAPERS, academicRankFromTitle, type Lecturer, type Paper } from "./data";
import { VENUES } from "./venues";

const SEED_FLAG = "seeded_core_v1";

// KPI indicators that are implemented now. The registry is extensible (new rows
// + a new `agg` arm in lib/kpi.ts) without schema changes.
const DEFAULT_INDICATORS = [
  { code: "paper_count", name_vi: "Số bài báo", unit: "bài", agg: "count" },
  { code: "paper_points", name_vi: "Điểm công bố (theo hạng)", unit: "điểm", agg: "weighted_points" },
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
  if (done) return;

  const tx = db.transaction(() => {
    seedCoreData(db);
    seedVenues(db);
    db.prepare("INSERT INTO meta (key, value) VALUES (?, datetime('now'))").run(SEED_FLAG);
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
