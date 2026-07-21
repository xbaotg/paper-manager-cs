"use server";

import { redirect } from "next/navigation";
import { requireUser, canManage, homeForUser } from "@/lib/dal";
import { getPapersByLecturer } from "@/lib/queries/papers";
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

// One lecturer's papers as the university import template (.xlsx), base64-encoded
// so it can come back through a server action. Always scoped to a single
// lecturer — the receiving system tracks publications per person.
// Only accepted/published papers are exported: in-review and rejected ones have
// no business in the university's publication register.
export async function exportPapersXlsxAction(
  lecturerId: number
): Promise<{ filename: string; base64: string; count: number }> {
  const user = await requireUser();
  const lecturer = getLecturerById(lecturerId);
  if (!lecturer) throw new Error("Không tìm thấy giảng viên");

  // Your own papers, any manager, or a head within their own bộ môn.
  const allowed =
    lecturerId === user.lecturerId ||
    canManage(user) ||
    (user.role === "head" && user.boMonId != null && lecturer.boMonId === user.boMonId);
  if (!allowed) redirect(await homeForUser(user));

  const papers = getPapersByLecturer(lecturerId).filter((p) =>
    countsAsPublication(p.submissionStatus)
  );

  const today = new Date().toISOString().slice(0, 10);
  const file = buildPapersImportXlsx(papers, today);

  await logAction("papers.export_xlsx", { lecturerId, papers: papers.length });

  return {
    filename: `Bai-bao-${slug(lecturer.name) || lecturerId}-${today}.xlsx`,
    base64: file.toString("base64"),
    count: papers.length,
  };
}
