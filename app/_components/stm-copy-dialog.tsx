"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Copy, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { stmRowsAction } from "@/app/actions/export";
import { STM_FIELDS, type StmRow } from "@/lib/stm-export";
import { downloadCsv } from "@/lib/csv";
import { copyText } from "@/lib/clipboard";

const TITLE =
  "Chép từng trường vào form 'Thêm mới công bố khoa học' của STM (Bộ KH&CN)";

interface Data {
  lecturerName: string;
  filename: string;
  rows: StmRow[];
}

// STM has no import, so publications are typed in one form at a time. This shows
// each paper as the form's own field list, click-to-copy, with a "đã nhập" mark
// so a 40-paper session can be picked up where it was left off.
export function StmCopyButton({
  lecturerId,
  label = "Nhập vào STM",
  iconOnly = false,
}: {
  lecturerId: number;
  label?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(""); // "<paperId>:<field>" of the last copy
  const [done, setDone] = useState<Set<number>>(new Set());

  // ponytail: progress is per-browser localStorage, not a DB column. Move it
  // server-side if it ever needs to follow the user to another machine.
  const doneKey = `paperManagerCS_stmDone_${lecturerId}`;

  function handleOpen() {
    startTransition(async () => {
      try {
        const res = await stmRowsAction(lecturerId);
        if (res.rows.length === 0) {
          toast.error("Giảng viên này chưa có bài báo đã chấp nhận/xuất bản");
          return;
        }
        try {
          setDone(new Set(JSON.parse(localStorage.getItem(doneKey) ?? "[]")));
        } catch {
          setDone(new Set());
        }
        setData(res);
        setCopied("");
        setOpen(true);
      } catch {
        toast.error("Không tải được danh sách công bố");
      }
    });
  }

  async function copy(rowId: number, field: string, value: string) {
    if (await copyText(value)) setCopied(`${rowId}:${field}`);
    else toast.error("Không sao chép được — hãy bôi đen và Ctrl+C");
  }

  function toggleDone(id: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(doneKey, JSON.stringify([...next]));
      } catch {
        /* private mode / quota — the marks just won't survive a reload */
      }
      return next;
    });
  }

  function handleCsv() {
    if (!data) return;
    downloadCsv(data.filename, [
      ["STT", ...STM_FIELDS.map((f) => f.label)],
      ...data.rows.map((r, i) => [i + 1, ...STM_FIELDS.map((f) => String(r[f.key] ?? ""))]),
    ]);
  }

  return (
    <>
      {iconOnly ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleOpen}
          disabled={pending}
          className="cursor-pointer opacity-60 hover:opacity-100 hover:text-primary"
          title={TITLE}
        >
          <ClipboardList className="size-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleOpen}
          disabled={pending}
          className="cursor-pointer gap-1.5"
          title={TITLE}
        >
          <ClipboardList className="size-4" /> {label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nhập vào STM — {data?.lecturerName}</DialogTitle>
            <DialogDescription>
              STM không có chức năng import. Bấm vào từng ô để sao chép rồi dán vào form
              &quot;Thêm mới công bố khoa học&quot; — các trường xếp đúng thứ tự của form.
            </DialogDescription>
          </DialogHeader>

          {data && (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Đã nhập {data.rows.filter((r) => done.has(r.id)).length}/{data.rows.length} công bố
                </span>
                <Button variant="outline" size="sm" onClick={handleCsv} className="cursor-pointer gap-1.5">
                  <Download className="size-4" /> Tải CSV
                </Button>
              </div>

              <div className="space-y-3">
                {data.rows.map((row, i) => {
                  const isDone = done.has(row.id);
                  return (
                    <div
                      key={row.id}
                      className={`rounded-lg border p-3 space-y-1 ${isDone ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-sm leading-snug">
                          {i + 1}. {row.tenCongTrinh}
                        </div>
                        <Button
                          variant={isDone ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => toggleDone(row.id)}
                          className="cursor-pointer shrink-0 gap-1.5 text-xs"
                        >
                          <Check className="size-3.5" /> Đã nhập
                        </Button>
                      </div>

                      {STM_FIELDS.map((f) => {
                        const value = String(row[f.key] ?? "");
                        const key = `${row.id}:${f.key}`;
                        return (
                          <div key={f.key} className="grid grid-cols-[7rem_1fr] gap-2 items-start">
                            <div className="text-xs text-muted-foreground pt-1.5">
                              {f.label}
                              {f.required && <span className="text-destructive"> *</span>}
                            </div>
                            {value ? (
                              <button
                                type="button"
                                onClick={() => copy(row.id, f.key, value)}
                                title="Bấm để sao chép"
                                className="group flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent cursor-pointer"
                              >
                                <span className="flex-1 break-words">{value}</span>
                                {copied === key ? (
                                  <Check className="size-3.5 shrink-0 mt-0.5 text-green-600" />
                                ) : (
                                  <Copy className="size-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60" />
                                )}
                              </button>
                            ) : (
                              <div className="px-2 py-1 text-sm italic text-muted-foreground">
                                chưa có — điền ISSN cho tạp chí ở trang Quản lý tạp chí
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
