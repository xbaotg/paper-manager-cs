"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Download, Upload, Database, ScrollText, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "./confirm-dialog";
import {
  exportDataAction,
  importDataAction,
  listLogsAction,
  downloadLogAction,
} from "@/app/actions/data";
import type { LogFileInfo } from "@/lib/logger";

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataManager() {
  const [pending, startTransition] = useTransition();
  const [logs, setLogs] = useState<LogFileInfo[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function refreshLogs() {
    setLogsLoading(true);
    listLogsAction()
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }

  // Initial load: set state only in the async callbacks (not synchronously in
  // the effect body) — logsLoading already starts true.
  useEffect(() => {
    let cancelled = false;
    listLogsAction()
      .then((l) => { if (!cancelled) setLogs(l); })
      .catch(() => { if (!cancelled) setLogs([]); })
      .finally(() => { if (!cancelled) setLogsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleExport() {
    startTransition(async () => {
      try {
        const { filename, json } = await exportDataAction();
        downloadBlob(json, filename, "application/json");
        toast.success("Đã xuất toàn bộ dữ liệu");
      } catch {
        toast.error("Xuất dữ liệu thất bại");
      }
    });
  }

  // Stage the chosen file's text, then confirm before the destructive restore.
  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImport(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Không đọc được tệp.");
    reader.readAsText(file);
  }

  function confirmImport() {
    const json = pendingImport;
    setPendingImport(null);
    if (!json) return;
    startTransition(async () => {
      const res = await importDataAction(json);
      if (res.ok) {
        const total = Object.values(res.counts ?? {}).reduce((s, n) => s + n, 0);
        toast.success(`Đã nhập dữ liệu: ${total} bản ghi vào ${Object.keys(res.counts ?? {}).length} bảng`);
        refreshLogs();
      } else {
        toast.error(res.error ?? "Nhập dữ liệu thất bại");
      }
    });
  }

  function handleDownloadLog(name: string) {
    startTransition(async () => {
      const res = await downloadLogAction(name);
      if (res.ok && res.content != null) downloadBlob(res.content, name, "text/plain");
      else toast.error(res.error ?? "Không tải được log");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
          <Database className="size-6 text-primary" /> Dữ liệu &amp; Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sao lưu / phục hồi toàn bộ dữ liệu hệ thống và tải nhật ký hoạt động.
        </p>
      </div>

      {/* Export */}
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Download className="size-4 text-primary" /> Xuất dữ liệu
          </div>
          <p className="text-sm text-muted-foreground">
            Tải toàn bộ dữ liệu (giảng viên, bài báo, KPI, tài khoản, venue, LLKH…) ra một tệp JSON để sao lưu.
          </p>
          <Button onClick={handleExport} disabled={pending} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
            <Download className="size-4" /> Xuất toàn bộ dữ liệu (.json)
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card className="border-amber-500/30">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Upload className="size-4 text-amber-600" /> Nhập dữ liệu
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 flex gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              <strong>Ghi đè toàn bộ.</strong> Mỗi bảng có trong tệp sẽ bị xoá sạch rồi nạp lại từ tệp. Hãy <strong>xuất sao lưu trước</strong> khi nhập.
            </span>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFilePicked} />
          <Button onClick={() => fileRef.current?.click()} disabled={pending} variant="outline" className="cursor-pointer gap-1.5">
            <Upload className="size-4" /> Chọn tệp JSON để nhập…
          </Button>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <ScrollText className="size-4 text-primary" /> Nhật ký hoạt động
            </div>
            <Button onClick={refreshLogs} variant="ghost" size="sm" className="cursor-pointer gap-1.5 text-muted-foreground">
              <RefreshCw className="size-3.5" /> Làm mới
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Mọi hành động được ghi vào tệp, tự động tách tệp mới khi đạt 50MB.
          </p>
          {logsLoading ? (
            <p className="text-sm text-muted-foreground italic">Đang tải…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Chưa có tệp log nào.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {logs.map((l) => (
                <div key={l.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono break-all">{l.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmtSize(l.size)} · {new Date(l.mtime).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <Button onClick={() => handleDownloadLog(l.name)} disabled={pending} variant="outline" size="sm" className="cursor-pointer gap-1.5 shrink-0">
                    <Download className="size-3.5" /> Tải
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingImport != null}
        onOpenChange={(open) => { if (!open) setPendingImport(null); }}
        title="Xác nhận nhập dữ liệu"
        description="Toàn bộ dữ liệu hiện tại trong các bảng có trong tệp sẽ bị GHI ĐÈ và không thể hoàn tác. Bạn chắc chắn muốn tiếp tục?"
        confirmLabel="Ghi đè & nhập"
        onConfirm={confirmImport}
      />
    </div>
  );
}
