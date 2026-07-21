"use client";

import { useTransition } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportPapersXlsxAction } from "@/app/actions/export";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Downloads one lecturer's papers as the university import template. `iconOnly`
// is for the per-row action column in the lecturer list.
export function ExportPapersButton({
  lecturerId,
  label = "Xuất Excel (mẫu import)",
  iconOnly = false,
}: {
  lecturerId: number;
  label?: string;
  iconOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      try {
        const { filename, base64, count, incomplete, missing } =
          await exportPapersXlsxAction(lecturerId);
        if (count === 0) {
          toast.error("Giảng viên này chưa có bài báo đã chấp nhận/xuất bản");
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
        // The university import rejects a row with any required cell blank, so
        // say up front which ones to fill in rather than letting the upload fail.
        if (incomplete > 0) {
          toast.warning(`Đã xuất ${count} bài — ${incomplete} bài sẽ bị từ chối khi import`, {
            description: `Còn thiếu: ${missing.join(", ")}. Bổ sung trong app rồi xuất lại.`,
            duration: 10000,
          });
        } else {
          toast.success(`Đã xuất ${count} bài báo`);
        }
      } catch {
        toast.error("Xuất Excel thất bại");
      }
    });
  }

  const title = "Xuất bài báo ra file .xlsx theo mẫu import của hệ thống quản lý khoa học";

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleExport}
        disabled={pending}
        className="cursor-pointer opacity-60 hover:opacity-100 hover:text-primary"
        title={title}
      >
        <FileSpreadsheet className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={pending}
      className="cursor-pointer gap-1.5"
      title={title}
    >
      <FileSpreadsheet className="size-4" /> {label}
    </Button>
  );
}
