"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getHeadKpi, type HeadKpiData } from "@/app/actions/kpi";

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 100) return "text-green-600 font-semibold";
  if (pct >= 70) return "text-amber-600";
  return "text-destructive";
}

export function HeadKpiView({ initial }: { initial: HeadKpiData }) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  const { boMonName, periods, indicators, lecturers, rows, rollup, selectedPeriodId } = data;
  const rowByLecturer = new Map(rows.map((r) => [r.lecturerId, r]));
  const rollupByIndicator = new Map(rollup.map((r) => [r.indicatorId, r]));
  const perPersonIndicators = indicators.filter((i) => i.agg !== "phd_count");
  const YEARS = [2026, 2027, 2028, 2029, 2030];
  const periodByYear = new Map(periods.map((p) => [p.startYear, p]));
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;
  const LS_KEY = "paperManagerCS_kpiYear_head";

  function reload(periodId?: number) {
    startTransition(async () => setData(await getHeadKpi(periodId)));
  }

  // On mount, switch to the user's last-chosen year (or the current calendar
  // year if no preference is stored yet). Only reloads when the chosen year's
  // period exists and is not already active.
  useEffect(() => {
    let target: number | null = null;
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) target = Number(stored);
    } catch {}
    if (target == null || Number.isNaN(target)) target = new Date().getFullYear();
    const p = periodByYear.get(target);
    if (p && p.id !== selectedPeriodId) reload(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the year corresponding to whatever period the server returns.
  useEffect(() => {
    if (selectedPeriod) {
      try { localStorage.setItem(LS_KEY, String(selectedPeriod.startYear)); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod?.startYear]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">KPI bộ môn — {boMonName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi tiến độ công bố và phát triển đội ngũ của bộ môn (chỉ xem).
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <label className="text-xs text-muted-foreground">Năm KPI</label>
          <div className="inline-flex rounded-md border border-border p-0.5 bg-card">
            {YEARS.map((y) => {
              const p = periodByYear.get(y);
              const active = selectedPeriod?.startYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  disabled={!p || pending}
                  onClick={() => p && reload(p.id)}
                  title={p ? `Kỳ ${p.label}` : "Quản lý Khoa chưa tạo kỳ này"}
                  className={`px-3.5 h-9 rounded-sm text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!selectedPeriodId ? (
        <div className="text-center text-muted-foreground py-16 border rounded-xl bg-card">
          Chưa có kỳ KPI nào. Quản lý Khoa sẽ tạo kỳ KPI.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rollup.map((r) => {
              const ind = indicators.find((i) => i.id === r.indicatorId);
              return (
                <Card key={r.indicatorId}>
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Target className="size-4 text-primary" /> {ind?.nameVi}
                    </div>
                    <div className="text-2xl font-semibold">
                      {r.totalActual}
                      {r.facultyTarget != null && (
                        <span className="text-sm font-normal text-muted-foreground"> / {r.facultyTarget}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className={`inline-flex items-center gap-1 ${pctColor(r.facultyPct)}`}>
                        <TrendingUp className="size-3" /> {r.facultyPct == null ? "—" : `${r.facultyPct}%`}
                      </span>
                      {ind?.agg !== "phd_count" && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" /> Đạt: {r.metCount}/{r.withTarget}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Giảng viên</TableHead>
                  {perPersonIndicators.map((ind) => (
                    <TableHead key={ind.id} className="text-center border-l" colSpan={3}>
                      {ind.nameVi} <span className="text-muted-foreground font-normal">({ind.unit})</span>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead />
                  {perPersonIndicators.map((ind) => (
                    <Fragment key={ind.id}>
                      <TableHead className="text-center text-xs border-l">Chỉ tiêu</TableHead>
                      <TableHead className="text-center text-xs">Thực đạt</TableHead>
                      <TableHead className="text-center text-xs">%</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lecturers.map((l) => {
                  const row = rowByLecturer.get(l.id);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <span className="text-muted-foreground text-xs">{l.title}. </span>
                        <Link href={`/head/lecturers/${l.id}`} className="hover:text-primary hover:underline">{l.name}</Link>
                      </TableCell>
                      {perPersonIndicators.map((ind) => {
                        const cell = row?.cells.find((c) => c.indicatorId === ind.id);
                        return (
                          <Fragment key={ind.id}>
                            <TableCell className="text-center border-l">{cell?.target ?? "—"}</TableCell>
                            <TableCell className="text-center font-medium">{cell?.actual ?? 0}</TableCell>
                            <TableCell className={`text-center text-sm ${pctColor(cell?.pct ?? null)}`}>
                              {cell?.pct == null ? "—" : `${cell.pct}%`}
                            </TableCell>
                          </Fragment>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {lecturers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={1 + perPersonIndicators.length * 3} className="text-center text-muted-foreground py-8">
                      Bộ môn chưa có giảng viên.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {pending && <p className="text-xs text-muted-foreground">Đang tải...</p>}
        </>
      )}
    </div>
  );
}
