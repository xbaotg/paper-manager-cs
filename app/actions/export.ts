"use server";

import { requireUser, requireManager } from "@/lib/dal";
import { listPapers, getPapersByLecturer } from "@/lib/queries/papers";
import { getLecturerById } from "@/lib/queries/lecturers";
import { countsAsPublication } from "@/lib/data";
import { buildPapersImportXlsx } from "@/lib/xlsx-export";
import { logAction } from "@/lib/logger";

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Papers as the university import template (.xlsx), base64-encoded so it can come
// back through a server action. `lecturerId` omitted = every paper in the system.
// Only accepted/published papers are exported — in-review and rejected ones have
// no business in the university's publication register.
export async function exportPapersXlsxAction(
  lecturerId?: number
): Promise<{ filename: string; base64: string; count: number }> {
  const user = await requireUser();
  // Own papers need no elevation; every other scope (all papers, or another
  // lecturer's) is manager-only.
  if (lecturerId == null || lecturerId !== user.lecturerId) await requireManager();

  const papers = (lecturerId == null ? listPapers() : getPapersByLecturer(lecturerId)).filter((p) =>
    countsAsPublication(p.submissionStatus)
  );

  const today = new Date().toISOString().slice(0, 10);
  const who =
    lecturerId == null ? "tat-ca" : slug(getLecturerById(lecturerId)?.name ?? String(lecturerId));
  const file = buildPapersImportXlsx(papers, today);

  await logAction("papers.export_xlsx", { lecturerId: lecturerId ?? null, papers: papers.length });

  return {
    filename: `Bai-bao-${who}-${today}.xlsx`,
    base64: file.toString("base64"),
    count: papers.length,
  };
}
