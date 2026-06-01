"use client";

import { useState, useTransition } from "react";
import { Printer, Download, FileSpreadsheet, Target, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getReportData, getReportRangeData, type ReportData } from "@/app/actions/report";

const YEARS = [2026, 2027, 2028, 2029, 2030];

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  // BOM so Excel reads UTF-8 (Vietnamese) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 100) return "text-green-600 font-semibold";
  if (pct >= 70) return "text-amber-600";
  return "text-destructive";
}

export function ReportView({ initial }: { initial: ReportData }) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"year" | "range">(initial.range ? "range" : "year");
  const [rangeFrom, setRangeFrom] = useState<number>(initial.range?.from ?? YEARS[0]);
  const [rangeTo, setRangeTo] = useState<number>(initial.range?.to ?? YEARS[YEARS.length - 1]);
  const { period, periods, indicators, rollup, lecturers, papers, development, phdActual, phdMilestones } = data;
  const perPerson = indicators.filter((i) => i.agg !== "phd_count");
  const rollupBy = new Map(rollup.map((r) => [r.indicatorId, r]));
  const periodLabel = data.label;

  function reload(periodId: number) {
    startTransition(async () => setData(await getReportData(periodId)));
  }
  function reloadRange(from: number, to: number) {
    startTransition(async () => setData(await getReportRangeData(from, to)));
  }

  function exportLecturers() {
    const header = ["STT", "Họ và tên", "Học hàm/học vị", "Hạng KPI", "Bộ môn",
      ...perPerson.flatMap((i) => [`${i.nameVi} - Thực đạt`, `${i.nameVi} - Chỉ tiêu`])];
    const rows = lecturers.map((l, idx) => [
      idx + 1, l.name, l.title, l.academicRank, l.boMonName,
      ...perPerson.flatMap((i) => {
        const c = l.cells.find((x) => x.indicatorId === i.id);
        return [c?.actual ?? 0, c?.target ?? ""];
      }),
    ]);
    downloadCsv(`KPI-giang-vien-${periodLabel}.csv`, [header, ...rows]);
  }

  function exportPapers() {
    const header = ["STT", "Năm", "Tiêu đề", "Hội nghị/Tạp chí", "Tác giả", "Tình trạng Scopus", "Năm index", "Xếp hạng", "DOI", "URL"];
    const rows = papers.map((p, idx) => [
      idx + 1, p.year, p.title, p.venue, p.authors,
      p.scopusIndexStatus ?? "", p.scopusIndexYear ?? "", p.quartile ?? "", p.doi ?? "", p.url ?? "",
    ]);
    downloadCsv("Danh-sach-cong-bo.csv", [header, ...rows]);
  }

  function exportDevelopment() {
    const header = ["STT", "Họ và tên", "Bộ môn", "Hiện tại", "Mục tiêu", "Năm hoàn thành", "GV hướng dẫn", "Trạng thái", "Ghi chú"];
    const rows = development.map((d, idx) => [
      idx + 1, d.lecturerName, d.boMonName ?? "", d.currentDegree, d.targetDegree,
      d.expectedYear ?? "", d.mentorName ?? "", d.status, d.notes ?? "",
    ]);
    downloadCsv("Phat-trien-doi-ngu.csv", [header, ...rows]);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Controls (hidden when printing) */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">Báo cáo tổng hợp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Xuất dữ liệu KPI, công bố và phát triển đội ngũ để báo cáo cấp trên.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5 bg-card">
            <button
              type="button"
              onClick={() => setMode("year")}
              className={`px-3 h-9 rounded-sm text-sm font-medium cursor-pointer ${mode === "year" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >Theo năm</button>
            <button
              type="button"
              onClick={() => { setMode("range"); reloadRange(rangeFrom, rangeTo); }}
              className={`px-3 h-9 rounded-sm text-sm font-medium cursor-pointer ${mode === "range" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >Khoảng năm</button>
          </div>
          {mode === "year" ? (
            periods.length > 0 && (
              <Select value={period ? String(period.id) : ""} onValueChange={(v) => v && reload(Number(v))}>
                <SelectTrigger className="w-[150px] cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => <SelectItem key={p.id} value={String(p.id)} className="cursor-pointer">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )
          ) : (
            <>
              <Select value={String(rangeFrom)} onValueChange={(v) => { const y = Number(v); setRangeFrom(y); reloadRange(y, rangeTo); }}>
                <SelectTrigger className="w-[110px] cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)} className="cursor-pointer">Từ {y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(rangeTo)} onValueChange={(v) => { const y = Number(v); setRangeTo(y); reloadRange(rangeFrom, y); }}>
                <SelectTrigger className="w-[110px] cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)} className="cursor-pointer">Đến {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
          <Button variant="outline" className="cursor-pointer gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" /> In / Lưu PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="secondary" size="sm" className="cursor-pointer gap-1.5" onClick={exportLecturers}>
          <Download className="size-4" /> CSV — KPI giảng viên
        </Button>
        <Button variant="secondary" size="sm" className="cursor-pointer gap-1.5" onClick={exportPapers}>
          <FileSpreadsheet className="size-4" /> CSV — Danh sách công bố
        </Button>
        <Button variant="secondary" size="sm" className="cursor-pointer gap-1.5" onClick={exportDevelopment}>
          <Download className="size-4" /> CSV — Phát triển đội ngũ
        </Button>
      </div>

      {/* Printable report header */}
      <div className="hidden print:block text-center">
        <p className="font-semibold">KHOA KHOA HỌC MÁY TÍNH</p>
        <h1 className="text-xl font-semibold mt-2">BÁO CÁO KPI & PHÁT TRIỂN ĐỘI NGŨ — KỲ {periodLabel}</h1>
        <p className="text-sm text-muted-foreground">Ngày xuất: {new Date(data.generatedAt).toLocaleString("vi-VN")}</p>
      </div>

      {!period ? (
        <div className="text-center text-muted-foreground py-16 border rounded-md bg-card">Chưa có kỳ KPI.</div>
      ) : (
        <>
          {/* Faculty KPI summary */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold flex items-center gap-2"><Target className="size-5 text-primary" /> Chỉ tiêu cấp Khoa — {periodLabel}</h2>
            <div className="rounded-md border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chỉ tiêu</TableHead>
                    <TableHead className="text-center">Mục tiêu</TableHead>
                    <TableHead className="text-center">Thực đạt</TableHead>
                    <TableHead className="text-center">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicators.map((ind) => {
                    const r = rollupBy.get(ind.id);
                    return (
                      <TableRow key={ind.id}>
                        <TableCell className="font-medium">{ind.nameVi} <span className="text-muted-foreground font-normal">({ind.unit})</span></TableCell>
                        <TableCell className="text-center">{r?.facultyTarget ?? "—"}</TableCell>
                        <TableCell className="text-center font-semibold">{r?.totalActual ?? 0}</TableCell>
                        <TableCell className={`text-center ${pctColor(r?.facultyPct ?? null)}`}>{r?.facultyPct == null ? "—" : `${r.facultyPct}%`}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* PhD development summary */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold flex items-center gap-2"><GraduationCap className="size-5 text-primary" /> Phát triển đội ngũ Tiến sĩ</h2>
            <Card>
              <CardContent className="p-5 flex flex-wrap items-center gap-4">
                <div className="text-3xl font-semibold font-heading">{phdActual}</div>
                <div className="flex flex-wrap gap-2">
                  {phdMilestones.map((m) => (
                    <span key={m.year} className={`text-xs px-2 py-1 rounded-sm border ${phdActual >= m.target ? "text-green-600 border-green-600/40" : "text-muted-foreground border-border"}`}>
                      {m.year}: ≥{m.target} {phdActual >= m.target ? "✓" : ""}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Per-lecturer KPI */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold">Chi tiết theo giảng viên</h2>
            <div className="rounded-md border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Giảng viên</TableHead>
                    <TableHead>Hạng</TableHead>
                    <TableHead>Bộ môn</TableHead>
                    {perPerson.map((i) => <TableHead key={i.id} className="text-center border-l">{i.nameVi}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lecturers.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.title}. {l.name}</TableCell>
                      <TableCell>{l.academicRank}</TableCell>
                      <TableCell className="text-muted-foreground">{l.boMonName || "—"}</TableCell>
                      {perPerson.map((i) => {
                        const c = l.cells.find((x) => x.indicatorId === i.id);
                        return (
                          <TableCell key={i.id} className="text-center border-l">
                            <span className="font-semibold">{c?.actual ?? 0}</span>
                            <span className="text-muted-foreground">/{c?.target ?? "—"}</span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
          {pending && <p className="text-xs text-muted-foreground print:hidden">Đang tải...</p>}
        </>
      )}
    </div>
  );
}
