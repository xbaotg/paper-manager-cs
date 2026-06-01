import "server-only";
import { getDb } from "../sqlite";
import type { Paper } from "../data";

interface PaperRow {
  id: number;
  title: string;
  year: number;
  pub_month: number | null;
  venue_code: string;
  authors: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  credited_lecturer_id: number | null;
  is_first_author: number;
  is_corresponding_author: number;
  scopus_index_status: string;
  scopus_index_year: number | null;
  quartile: string | null;
  submission_status: string;
}

function toPaper(r: PaperRow, lecturerIds: number[]): Paper {
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
    scopusIndexStatus: (r.scopus_index_status as Paper["scopusIndexStatus"]) ?? "unknown",
    scopusIndexYear: r.scopus_index_year,
    quartile: r.quartile,
    submissionStatus: (r.submission_status as Paper["submissionStatus"]) ?? "submitted",
    ...(r.doi ? { doi: r.doi } : {}),
    ...(r.url ? { url: r.url } : {}),
    ...(r.abstract ? { abstract: r.abstract } : {}),
  };
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
function normalizeCredited(p: Paper): number | null {
  const linked = p.lecturerIds ?? [];
  if (p.creditedLecturerId != null && linked.includes(p.creditedLecturerId)) {
    return p.creditedLecturerId;
  }
  return null;
}

export function createPaper(p: Paper): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO papers
         (id, title, year, pub_month, venue_code, authors, doi, url, abstract,
          credited_lecturer_id, is_first_author, is_corresponding_author,
          scopus_index_status, scopus_index_year, quartile, submission_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      p.id,
      p.title,
      p.year,
      p.pubMonth ?? null,
      p.venue ?? "",
      p.authors ?? "",
      p.doi ?? null,
      p.url ?? null,
      p.abstract ?? null,
      normalizeCredited(p),
      p.isFirstAuthor ? 1 : 0,
      p.isCorrespondingAuthor ? 1 : 0,
      p.scopusIndexStatus ?? "unknown",
      p.scopusIndexYear ?? null,
      p.quartile ?? null,
      p.submissionStatus ?? "submitted"
    );
    setPaperLecturers(p.id, p.lecturerIds ?? []);
  })();
}

export function updatePaper(id: number, p: Paper): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE papers SET
         title = ?, year = ?, pub_month = ?, venue_code = ?, authors = ?, doi = ?, url = ?, abstract = ?,
         credited_lecturer_id = ?, is_first_author = ?, is_corresponding_author = ?,
         scopus_index_status = ?, scopus_index_year = ?, quartile = ?, submission_status = ?
       WHERE id = ?`
    ).run(
      p.title,
      p.year,
      p.pubMonth ?? null,
      p.venue ?? "",
      p.authors ?? "",
      p.doi ?? null,
      p.url ?? null,
      p.abstract ?? null,
      normalizeCredited(p),
      p.isFirstAuthor ? 1 : 0,
      p.isCorrespondingAuthor ? 1 : 0,
      p.scopusIndexStatus ?? "unknown",
      p.scopusIndexYear ?? null,
      p.quartile ?? null,
      p.submissionStatus ?? "submitted",
      id
    );
    setPaperLecturers(id, p.lecturerIds ?? []);
  })();
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

// Papers with internal authors but no credited person yet — managers must
// resolve these so the single-credit KPI count is correct.
export function listPapersNeedingCredit(): { id: number; title: string; year: number }[] {
  return getDb()
    .prepare(
      `SELECT p.id, p.title, p.year FROM papers p
       WHERE p.credited_lecturer_id IS NULL
         AND EXISTS (SELECT 1 FROM paper_lecturers pl WHERE pl.paper_id = p.id)
       ORDER BY p.year DESC, p.rowid DESC`
    )
    .all() as { id: number; title: string; year: number }[];
}

// Ownership check for lecturer-scoped edits (Phase 4).
export function isPaperAuthor(paperId: number, lecturerId: number): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM paper_lecturers WHERE paper_id = ? AND lecturer_id = ?")
    .get(paperId, lecturerId);
  return !!row;
}
