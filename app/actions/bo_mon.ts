"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import {
  listBoMon,
  getBoMonById,
  createBoMon,
  updateBoMon,
  deleteBoMon,
  countLecturersByBoMon,
  type BoMon,
} from "@/lib/queries/bo_mon";
import { logAction } from "@/lib/logger";

export interface BoMonListItem extends BoMon {
  lecturerCount: number;
}

export interface BoMonResult {
  ok: boolean;
  error?: string;
  data?: BoMonListItem[];
}

function snapshot(): BoMonListItem[] {
  const counts = countLecturersByBoMon();
  return listBoMon().map((b) => ({ ...b, lecturerCount: counts.get(b.id) ?? 0 }));
}

export async function getBoMonSnapshot(): Promise<BoMonListItem[]> {
  await requireManager();
  return snapshot();
}

// Lightweight list for pickers (lecturer form, user form).
export async function getBoMonOptions(): Promise<BoMon[]> {
  await requireManager();
  return listBoMon();
}

function validate(code: string, nameVi: string): string | null {
  if (!code.trim()) return "Thiếu mã bộ môn.";
  if (!nameVi.trim()) return "Thiếu tên bộ môn.";
  return null;
}

export async function createBoMonAction(input: {
  code: string;
  nameVi: string;
  nameEn?: string;
}): Promise<BoMonResult> {
  await requireManager();
  const err = validate(input.code, input.nameVi);
  if (err) return { ok: false, error: err };
  try {
    createBoMon({ code: input.code.trim(), nameVi: input.nameVi.trim(), nameEn: input.nameEn?.trim() });
  } catch {
    return { ok: false, error: "Mã bộ môn đã tồn tại." };
  }
  await logAction("bomon.create", { code: input.code.trim(), name: input.nameVi.trim() });
  revalidatePath("/admin/bo-mon");
  return { ok: true, data: snapshot() };
}

export async function updateBoMonAction(
  id: number,
  input: { code: string; nameVi: string; nameEn?: string; isActive?: boolean }
): Promise<BoMonResult> {
  await requireManager();
  if (!getBoMonById(id)) return { ok: false, error: "Bộ môn không tồn tại." };
  const err = validate(input.code, input.nameVi);
  if (err) return { ok: false, error: err };
  try {
    updateBoMon(id, {
      code: input.code.trim(),
      nameVi: input.nameVi.trim(),
      nameEn: input.nameEn?.trim(),
      isActive: input.isActive,
    });
  } catch {
    return { ok: false, error: "Mã bộ môn đã tồn tại." };
  }
  await logAction("bomon.update", { id });
  revalidatePath("/admin/bo-mon");
  return { ok: true, data: snapshot() };
}

export async function deleteBoMonAction(id: number): Promise<BoMonResult> {
  await requireManager();
  if (!getBoMonById(id)) return { ok: false, error: "Bộ môn không tồn tại." };
  deleteBoMon(id);
  await logAction("bomon.delete", { id });
  revalidatePath("/admin/bo-mon");
  return { ok: true, data: snapshot() };
}
