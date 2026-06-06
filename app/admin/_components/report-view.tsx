"use client";

import { useState, useTransition } from "react";
import { Printer, Download, FileSpreadsheet, Target, GraduationCap, TrendingUp, Building2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getReportData, getReportRangeData, type ReportData } from "@/app/actions/report";
import { isVenueScopus } from "@/lib/venues";

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
  const { period, periods, indicators, rollup, boMonRollups, pipeline, lecturers, papers, development, phdActual, phdMilestones } = data;
  // Drop the redundant "Số bài báo" total everywhere — keep Scopus / Q1 (+ PhD
  // headcount in the faculty table).
  const facultyIndicators = indicators.filter((i) => i.code !== "paper_count");
  const perPerson = indicators.filter((i) => i.agg !== "phd_count" && i.code !== "paper_count");
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
    const header = ["STT", "Năm", "Tiêu đề", "Hội nghị/Tạp chí", "Tác giả", "Scopus", "Xếp hạng", "DOI", "URL"];
    const rows = papers.map((p, idx) => [
      idx + 1, p.year, p.title, p.venue, p.authors,
      isVenueScopus(p.venue) ? "Có" : "Không", p.quartile ?? "", p.doi ?? "", p.url ?? "",
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
          {/* Executive summary — one-glance status for leadership */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold flex items-center gap-2"><TrendingUp className="size-5 text-primary" /> Tổng quan — {periodLabel}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {facultyIndicators.map((ind) => {
                const r = rollupBy.get(ind.id);
                const isPhd = ind.agg === "phd_count";
                return (
                  <Card key={ind.id}>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">{ind.nameVi}</div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-semibold font-heading">{r?.totalActual ?? 0}</span>
                        <span className="text-sm text-muted-foreground">/ {r?.facultyTarget ?? "—"} {ind.unit}</span>
                      </div>
                      <div className={`text-xs mt-0.5 ${pctColor(r?.facultyPct ?? null)}`}>
                        {r?.facultyPct == null ? "Chưa đặt chỉ tiêu" : `Đạt ${r.facultyPct}%`}
                      </div>
                      {!isPhd && (r?.withTarget ?? 0) > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-1">{r?.metCount ?? 0}/{r?.withTarget ?? 0} GV đạt chỉ tiêu</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Công bố trong kỳ</div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-semibold font-heading text-green-600">{pipeline.publications}</span>
                    <span className="text-sm text-muted-foreground">đã chấp nhận</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {pipeline.inProgress} đang xử lý · {pipeline.denied} từ chối
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

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
                  {facultyIndicators.map((ind) => {
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

          {/* By-department breakdown (year mode only) */}
          {boMonRollups.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-heading font-semibold flex items-center gap-2"><Building2 className="size-5 text-primary" /> Theo bộ môn — {periodLabel}</h2>
              <div className="rounded-md border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bộ môn</TableHead>
                      <TableHead className="text-center">GV</TableHead>
                      {perPerson.map((i) => <TableHead key={i.id} className="text-center border-l">{i.nameVi}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boMonRollups.map((bm) => {
                      const by = new Map(bm.rollup.map((r) => [r.indicatorId, r]));
                      return (
                        <TableRow key={bm.boMonId}>
                          <TableCell className="font-medium">{bm.boMonName}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{bm.headcount}</TableCell>
                          {perPerson.map((i) => {
                            const r = by.get(i.id);
                            return (
                              <TableCell key={i.id} className="text-center border-l">
                                <span className="font-semibold">{r?.totalActual ?? 0}</span>
                                <span className="text-muted-foreground">/{r?.facultyTarget ?? "—"}</span>
                                <span className={`block text-[11px] ${pctColor(r?.facultyPct ?? null)}`}>{r?.facultyPct == null ? "—" : `${r.facultyPct}%`}</span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* Submission pipeline detail */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold flex items-center gap-2"><Activity className="size-5 text-primary" /> Tiến độ nộp bài — {periodLabel}</h2>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Đã gửi", v: pipeline.submitted },
                { label: "Đang phản biện", v: pipeline.underReview },
                { label: "Rebuttal", v: pipeline.rebuttal },
                { label: "Đã chấp nhận", v: pipeline.accepted },
                { label: "Đã xuất bản", v: pipeline.published },
                { label: "Từ chối", v: pipeline.denied },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-semibold font-heading">{s.v}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tổng {pipeline.total} bài trong kỳ · {pipeline.inProgress} đang xử lý · {pipeline.publications} đã chấp nhận/xuất bản.
            </p>
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
