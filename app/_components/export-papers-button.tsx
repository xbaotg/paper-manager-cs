"use client";

import { useTransition } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportPapersXlsxAction } from "@/app/actions/export";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Downloads papers as the university import template. `lecturerId` omitted (or
// null) exports every paper — the action rejects that for non-managers.
export function ExportPapersButton({
  lecturerId,
  label = "Xuất Excel (mẫu import)",
}: {
  lecturerId?: number | null;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      try {
        const { filename, base64, count } = await exportPapersXlsxAction(lecturerId ?? undefined);
        if (count === 0) {
          toast.error("Không có bài báo đã chấp nhận/xuất bản để xuất");
          return;
        }
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Đã xuất ${count} bài báo`);
      } catch {
        toast.error("Xuất Excel thất bại");
      }
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={pending}
      className="cursor-pointer gap-1.5"
      title="Tải file .xlsx theo mẫu import của hệ thống quản lý khoa học"
    >
      <FileSpreadsheet className="size-4" /> {label}
    </Button>
  );
}
