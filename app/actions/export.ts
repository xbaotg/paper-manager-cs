"use server";

import { redirect } from "next/navigation";
import { requireUser, canManage, homeForUser } from "@/lib/dal";
import { getPapersByLecturer } from "@/lib/queries/papers";
import { getLecturerById, listLecturers } from "@/lib/queries/lecturers";
import { countsAsPublication } from "@/lib/data";
import { buildPapersImportXlsx, missingImportFields, MISSING_MAGV } from "@/lib/xlsx-export";
import { stmRows, type StmRow } from "@/lib/stm-export";
import { ensureVenuesHydrated } from "@/lib/queries/venues";
import { logAction } from "@/lib/logger";

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Every export is scoped to one lecturer (both receiving systems track
// publications per person). Readable by that lecturer, any manager, or a head
// within their own bộ môn.
async function requireExportAccess(lecturerId: number) {
  const user = await requireUser();
  const lecturer = getLecturerById(lecturerId);
  if (!lecturer) throw new Error("Không tìm thấy giảng viên");

  const allowed =
    lecturerId === user.lecturerId ||
    canManage(user) ||
    (user.role === "head" && user.boMonId != null && lecturer.boMonId === user.boMonId);
  if (!allowed) redirect(await homeForUser(user));

  return lecturer;
}

// One lecturer's papers as the university import template (.xlsx), base64-encoded
// so it can come back through a server action.
// Only accepted/published papers are exported: in-review and rejected ones have
// no business in the university's publication register.
export async function exportPapersXlsxAction(
  lecturerId: number
): Promise<{
  filename: string;
  base64: string;
  count: number;
  incomplete: number;
  missing: string[];
}> {
  const lecturer = await requireExportAccess(lecturerId);

  const papers = getPapersByLecturer(lecturerId).filter((p) =>
    countsAsPublication(p.submissionStatus)
  );

  const all = listLecturers();
  const magvById = new Map(all.map((l) => [l.id, l.magv ?? ""]));
  const today = new Date().toISOString().slice(0, 10);
  const file = buildPapersImportXlsx(papers, today, magvById);

  // Tell the user which required cells are still blank, so the gaps get filled in
  // the app rather than discovered one row at a time in the import report.
  const gaps = papers.map((p) => missingImportFields(p, magvById)).filter((g) => g.length > 0);
  const nameById = new Map(all.map((l) => [l.id, l.name]));
  const noMagv = [...new Set(papers.flatMap((p) => p.lecturerIds ?? []))]
    .filter((id) => !magvById.get(id)?.trim())
    .map((id) => nameById.get(id) ?? String(id));
  const missing = [...new Set(gaps.flat())].map((m) =>
    m === MISSING_MAGV ? `mã GV của ${noMagv.join(", ")}` : m
  );

  await logAction("papers.export_xlsx", {
    lecturerId,
    papers: papers.length,
    incomplete: gaps.length,
  });

  return {
    filename: `Bai-bao-${slug(lecturer.name) || lecturerId}-${today}.xlsx`,
    base64: file.toString("base64"),
    count: papers.length,
    incomplete: gaps.length,
    missing,
  };
}

// The same papers laid out as rows of the STM (Bộ KH&CN) publication form. STM
// has no import, so this feeds a copy-paste UI rather than a file upload.
export async function stmRowsAction(
  lecturerId: number
): Promise<{ lecturerName: string; filename: string; rows: StmRow[] }> {
  const lecturer = await requireExportAccess(lecturerId);
  ensureVenuesHydrated(); // stmRows reads the venue catalog for type/rank

  const rows = stmRows(getPapersByLecturer(lecturerId));
  await logAction("papers.export_stm", { lecturerId, papers: rows.length });

  return {
    lecturerName: lecturer.name,
    filename: `STM-${slug(lecturer.name) || lecturerId}.csv`,
    rows,
  };
}
