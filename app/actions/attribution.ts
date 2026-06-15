"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import { listPapers, getPaperById, updatePaper } from "@/lib/queries/papers";
import { listLecturers, getLecturerById } from "@/lib/queries/lecturers";
import { reconstructAuthorLinks, nameMatchScore, type AuthorLink } from "@/lib/author-match";
import { logAction } from "@/lib/logger";
import type { Paper, Lecturer } from "@/lib/data";

// A name scoring this high against the lecturer is treated as a match candidate
// (same threshold the import uses for auto-mapping).
const MATCH_THRESHOLD = 0.8;

export interface AttributionCandidate {
  paperId: number;
  title: string;
  year: number;
  authors: string;     // full byline, for context
  matchedName: string; // the external author name that matched
  authorIndex: number; // its position in the ordered list
  score: number;       // 0..1
}

// The ordered author list, from the stored authorLinks or reconstructed for
// legacy papers.
function orderedLinks(p: Paper, lecturers: Lecturer[]): AuthorLink[] {
  if (p.authorLinks && p.authorLinks.length > 0) return p.authorLinks;
  return reconstructAuthorLinks(p.authors || "", p.lecturerIds || [], lecturers);
}

// Find every paper that has an EXTERNAL author whose name fuzzy-matches the given
// lecturer and isn't already linked to them — candidates for bulk attribution.
export async function findPapersForLecturer(lecturerId: number): Promise<AttributionCandidate[]> {
  await requireManager();
  const lec = getLecturerById(lecturerId);
  if (!lec) return [];
  const lecturers = listLecturers();

  const out: AttributionCandidate[] = [];
  for (const p of listPapers()) {
    if ((p.lecturerIds ?? []).includes(lecturerId)) continue; // already attributed
    const links = orderedLinks(p, lecturers);

    let bestIdx = -1;
    let bestScore = 0;
    let bestName = "";
    links.forEach((a, i) => {
      if (a.lecturerId != null) return; // only convert external authors
      const s = nameMatchScore(a.name, lec.name);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
        bestName = a.name;
      }
    });

    if (bestIdx >= 0 && bestScore >= MATCH_THRESHOLD) {
      out.push({
        paperId: p.id,
        title: p.title,
        year: p.year,
        authors: p.authors,
        matchedName: bestName,
        authorIndex: bestIdx,
        score: Math.round(bestScore * 100) / 100,
      });
    }
  }
  out.sort((a, b) => b.score - a.score || b.year - a.year);
  return out;
}

// Link the matched external author (at the recorded position) to the lecturer for
// each selected paper — name + order untouched, only the internal link is set.
export async function applyLecturerToPapers(
  lecturerId: number,
  items: { paperId: number; authorIndex: number }[]
): Promise<{ ok: boolean; updated: number; error?: string }> {
  await requireManager();
  const lec = getLecturerById(lecturerId);
  if (!lec) return { ok: false, updated: 0, error: "Không tìm thấy giảng viên." };
  const lecturers = listLecturers();

  let updated = 0;
  for (const it of items) {
    const p = getPaperById(it.paperId);
    if (!p) continue;
    if ((p.lecturerIds ?? []).includes(lecturerId)) continue; // already linked elsewhere
    const links = orderedLinks(p, lecturers).map((a) => ({ ...a }));
    const target = links[it.authorIndex];
    if (!target || target.lecturerId != null) continue; // index shifted / already internal
    target.lecturerId = lecturerId; // preserve name + order; just attach the link
    updatePaper(p.id, { ...p, authorLinks: links });
    updated++;
  }

  if (updated > 0) {
    await logAction("attribution.apply", { lecturerId, updated });
    revalidatePath("/", "layout");
  }
  return { ok: true, updated };
}
