import "server-only";
import { getDb } from "../sqlite";
import { KPI_PLAN_START_YEAR } from "../kpi";
import type { Paper } from "../data";

interface PaperRow {
  id: number;
  title: string;
  year: number;
  pub_month: number | null;
  venue_code: string;
  authors: string;
  authors_json: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  credited_lecturer_id: number | null;
  is_first_author: number;
  is_corresponding_author: number;
  quartile: string | null;
  submission_status: string;
}

// Parse the stored ordered author list. Returns undefined for legacy rows (no
// authors_json), so the editor knows to fall back to its heuristic.
function parseAuthorLinks(json: string): Paper["authorLinks"] | undefined {
  if (!json) return undefined;
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr
      .map((a) => ({
        name: String(a?.name ?? "").trim(),
        lecturerId: a?.lecturerId != null ? Number(a.lecturerId) : null,
      }))
      .filter((a) => a.name);
  } catch {
    return undefined;
  }
}

function toPaper(r: PaperRow, lecturerIds: number[]): Paper {
  const authorLinks = parseAuthorLinks(r.authors_json);
  return {
    id: r.id,
    title: r.title,
    year: r.year,
    venue: r.venue_code,
    authors: r.authors,
    lecturerIds,
    pubMonth: r.pub_month,
    creditedLecturerId: r.credited_lecturer_id,
    isFirstAuthor: !!r.is_first_author,
    isCorrespondingAuthor: !!r.is_corresponding_author,
    quartile: r.quartile,
    submissionStatus: (r.submission_status as Paper["submissionStatus"]) ?? "submitted",
    ...(authorLinks ? { authorLinks } : {}),
    ...(r.doi ? { doi: r.doi } : {}),
    ...(r.url ? { url: r.url } : {}),
    ...(r.abstract ? { abstract: r.abstract } : {}),
  };
}

// authors_json is the source of truth when present: the flat `authors` string and
// the lecturerIds set are derived from it so they can never drift.
function deriveAuthors(p: Paper): { authors: string; lecturerIds: number[]; authorsJson: string } {
  if (p.authorLinks && p.authorLinks.length > 0) {
    const authors = p.authorLinks.map((a) => a.name.trim()).filter(Boolean).join(", ");
    const linkIds = p.authorLinks.filter((a) => a.lecturerId != null).map((a) => a.lecturerId as number);
    // Union with any extra ids the caller attached (e.g. addPaperServer auto-links
    // a lecturer to their own paper even when they aren't in the author byline).
    const lecturerIds = [...new Set([...linkIds, ...(p.lecturerIds ?? [])])];
    return { authors, lecturerIds, authorsJson: JSON.stringify(p.authorLinks) };
  }
  return { authors: p.authors ?? "", lecturerIds: p.lecturerIds ?? [], authorsJson: "" };
}

// One query for papers + one for all links, grouped in memory (avoids N+1).
export function listPapers(): Paper[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM papers ORDER BY rowid DESC").all() as PaperRow[];
  const links = db
    .prepare("SELECT paper_id, lecturer_id FROM paper_lecturers")
    .all() as { paper_id: number; lecturer_id: number }[];

  const byPaper = new Map<number, number[]>();
  for (const { paper_id, lecturer_id } of links) {
    const arr = byPaper.get(paper_id);
    if (arr) arr.push(lecturer_id);
    else byPaper.set(paper_id, [lecturer_id]);
  }

  return rows.map((r) => toPaper(r, byPaper.get(r.id) ?? []));
}

// Lightweight id+title list for the duplicate-title check in the add-paper form
// (avoids shipping every paper's full payload just to compare titles).
export function listPaperTitles(): { id: number; title: string }[] {
  return getDb()
    .prepare("SELECT id, title FROM papers ORDER BY id DESC")
    .all() as { id: number; title: string }[];
}

export function getPaperById(id: number): Paper | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as PaperRow | undefined;
  if (!r) return null;
  const links = db
    .prepare("SELECT lecturer_id FROM paper_lecturers WHERE paper_id = ?")
    .all(id) as { lecturer_id: number }[];
  return toPaper(r, links.map((l) => l.lecturer_id));
}

// Papers authored by a given lecturer (for the GV self-service view).
export function getPapersByLecturer(lecturerId: number): Paper[] {
  const db = getDb();
  const ids = (
    db
      .prepare("SELECT paper_id FROM paper_lecturers WHERE lecturer_id = ?")
      .all(lecturerId) as { paper_id: number }[]
  ).map((r) => r.paper_id);
  if (ids.length === 0) return [];
  const idSet = new Set(ids);
  return listPapers().filter((p) => idSet.has(p.id));
}

export function setPaperLecturers(paperId: number, lecturerIds: number[]): void {
  const db = getDb();
  db.prepare("DELETE FROM paper_lecturers WHERE paper_id = ?").run(paperId);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO paper_lecturers (paper_id, lecturer_id) VALUES (?, ?)"
  );
  for (const lid of lecturerIds) ins.run(paperId, lid);
}

// Normalize the credited lecturer: must be one of the paper's linked authors,
// else null (the single-credit rule only applies within the faculty's members).
// When a paper has exactly one internal author there is no ambiguity, so credit
// them automatically — no manager assignment needed.
function normalizeCredited(p: Paper): number | null {
  const linked = p.lecturerIds ?? [];
  if (p.creditedLecturerId != null && linked.includes(p.creditedLecturerId)) {
    return p.creditedLecturerId;
  }
  if (linked.length === 1) return linked[0];
  return null;
}

export function createPaper(p: Paper): void {
  const db = getDb();
  const d = deriveAuthors(p);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO papers
         (id, title, year, pub_month, venue_code, authors, authors_json, doi, url, abstract,
          credited_lecturer_id, is_first_author, is_corresponding_author,
          quartile, submission_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      p.id,
      p.title,
      p.year,
      p.pubMonth ?? null,
      p.venue ?? "",
      d.authors,
      d.authorsJson,
      p.doi ?? null,
      p.url ?? null,
      p.abstract ?? null,
      normalizeCredited({ ...p, lecturerIds: d.lecturerIds }),
      p.isFirstAuthor ? 1 : 0,
      p.isCorrespondingAuthor ? 1 : 0,
      p.quartile ?? null,
      p.submissionStatus ?? "submitted"
    );
    setPaperLecturers(p.id, d.lecturerIds);
  })();
}

export function updatePaper(id: number, p: Paper): void {
  const db = getDb();
  const d = deriveAuthors(p);
  db.transaction(() => {
    db.prepare(
      `UPDATE papers SET
         title = ?, year = ?, pub_month = ?, venue_code = ?, authors = ?, authors_json = ?, doi = ?, url = ?, abstract = ?,
         credited_lecturer_id = ?, is_first_author = ?, is_corresponding_author = ?,
         quartile = ?, submission_status = ?
       WHERE id = ?`
    ).run(
      p.title,
      p.year,
      p.pubMonth ?? null,
      p.venue ?? "",
      d.authors,
      d.authorsJson,
      p.doi ?? null,
      p.url ?? null,
      p.abstract ?? null,
      normalizeCredited({ ...p, lecturerIds: d.lecturerIds }),
      p.isFirstAuthor ? 1 : 0,
      p.isCorrespondingAuthor ? 1 : 0,
      p.quartile ?? null,
      p.submissionStatus ?? "submitted",
      id
    );
    setPaperLecturers(id, d.lecturerIds);
  })();
}

// Quick submission-status change — used by the inline status select in the
// paper list (manage un-accepted papers without opening the full form).
export function updatePaperSubmissionStatus(paperId: number, status: string): void {
  getDb().prepare("UPDATE papers SET submission_status = ? WHERE id = ?").run(status, paperId);
}

// Quick credit reassignment — used by the inline "Người được tính KPI" select.
// The caller must already have validated the lecturer belongs to the paper.
export function updateCreditedLecturer(paperId: number, lecturerId: number | null): void {
  getDb().prepare("UPDATE papers SET credited_lecturer_id = ? WHERE id = ?").run(lecturerId, paperId);
}

export function deletePaper(id: number): void {
  // paper_lecturers rows cascade.
  getDb().prepare("DELETE FROM papers WHERE id = ?").run(id);
}

// Papers with MULTIPLE internal authors but no credited person yet — these are
// genuinely ambiguous and managers must resolve them so the single-credit KPI
// count is correct. Single-author papers are auto-credited (see normalizeCredited)
// and never flagged here.
// With `year`, restrict to that exact conference year (the selected KPI period);
// otherwise count the whole plan window (>= 2026).
export function listPapersNeedingCredit(year?: number): { id: number; title: string; year: number }[] {
  const db = getDb();
  const yearClause = year != null ? "p.year = ?" : "p.year >= ?";
  return db
    .prepare(
      `SELECT p.id, p.title, p.year FROM papers p
       WHERE p.credited_lecturer_id IS NULL
         AND ${yearClause}
         AND (SELECT COUNT(*) FROM paper_lecturers pl WHERE pl.paper_id = p.id) > 1
       ORDER BY p.year DESC, p.rowid DESC`
    )
    .all(year ?? KPI_PLAN_START_YEAR) as { id: number; title: string; year: number }[];
}

// Ownership check for lecturer-scoped edits (Phase 4).
export function isPaperAuthor(paperId: number, lecturerId: number): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM paper_lecturers WHERE paper_id = ? AND lecturer_id = ?")
    .get(paperId, lecturerId);
  return !!row;
}
