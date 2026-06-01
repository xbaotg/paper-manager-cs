"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2, Target, Users, TrendingUp, Wand2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "./confirm-dialog";
import {
  getManagerKpi,
  createPeriodAction,
  deletePeriodAction,
  upsertTargetAction,
  upsertFacultyTargetAction,
  seedRankTargetsAction,
  type ManagerKpiData,
} from "@/app/actions/kpi";
import { suggestedFacultyTarget } from "@/lib/kpi-policy";

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 100) return "text-green-600 font-semibold";
  if (pct >= 70) return "text-amber-600";
  return "text-destructive";
}

export function KpiManager({ initial }: { initial: ManagerKpiData }) {
  const [data, setData] = useState<ManagerKpiData>(initial);
  const [newYear, setNewYear] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletePeriod, setDeletePeriod] = useState(false);

  const { periods, indicators, lecturers, rows, rollup, selectedPeriodId, facultyTargets, needsCreditCount } = data;
  const rowByLecturer = new Map(rows.map((r) => [r.lecturerId, r]));
  const indById = new Map(indicators.map((i) => [i.id, i]));
  const rollupByIndicator = new Map(rollup.map((r) => [r.indicatorId, r]));
  // Faculty-scope (bo_mon_id = 0) target value per indicator.
  const facultyTargetByIndicator = new Map(
    facultyTargets.filter((t) => t.boMonId === 0).map((t) => [t.indicatorId, t.targetValue])
  );
  // PhD headcount is faculty-level only; keep it out of the per-person table.
  const perPersonIndicators = indicators.filter((i) => i.agg !== "phd_count");
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;
  // Fixed action-plan window 2026–2030. Each tab is a calendar year; the
  // matching `kpi_periods` row (startYear == year) drives the data. A missing
  // year shows a "+" — clicking creates that period in place.
  const YEARS = [2026, 2027, 2028, 2029, 2030];
  const periodByYear = new Map(periods.map((p) => [p.startYear, p]));

  function reload(periodId?: number) {
    startTransition(async () => {
      setData(await getManagerKpi(periodId));
    });
  }

  function handleYearClick(year: number) {
    const existing = periodByYear.get(year);
    if (existing) {
      reload(existing.id);
      return;
    }
    startTransition(async () => {
      const res = await createPeriodAction(year);
      if (res.ok && res.data) {
        setData(res.data);
        toast.success(`Đã tạo kỳ ${year}-${year + 1}`);
      } else {
        toast.error(res.error ?? "Không tạo được kỳ");
      }
    });
  }

  function handleCreatePeriod() {
    const y = parseInt(newYear, 10);
    startTransition(async () => {
      const res = await createPeriodAction(y);
      if (res.ok && res.data) {
        setData(res.data);
        setNewYear("");
        toast.success("Đã tạo kỳ KPI");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleDeletePeriod() {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await deletePeriodAction(selectedPeriodId);
      if (res.data) setData(res.data);
      toast.success("Đã xoá kỳ KPI");
    });
    setDeletePeriod(false);
  }

  function commitTarget(indicatorId: number, lecturerId: number, raw: string, current: number | null) {
    if (!selectedPeriodId) return;
    const value = raw.trim() === "" ? 0 : Number(raw);
    if (Number.isNaN(value)) return;
    if (value === (current ?? 0)) return; // unchanged
    startTransition(async () => {
      const res = await upsertTargetAction(selectedPeriodId, indicatorId, lecturerId, value);
      if (res.ok && res.data) setData(res.data);
      else toast.error(res.error ?? "Không lưu được chỉ tiêu");
    });
  }

  function commitFacultyTarget(indicatorId: number, raw: string, current: number | null) {
    if (!selectedPeriodId) return;
    const value = raw.trim() === "" ? 0 : Number(raw);
    if (Number.isNaN(value)) return;
    if (value === (current ?? 0)) return;
    startTransition(async () => {
      const res = await upsertFacultyTargetAction(selectedPeriodId, indicatorId, 0, value);
      if (res.ok && res.data) setData(res.data);
      else toast.error(res.error ?? "Không lưu được chỉ tiêu Khoa");
    });
  }

  function handleSeedRankTargets() {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await seedRankTargetsAction(selectedPeriodId);
      if (res.ok && res.data) {
        setData(res.data);
        toast.success("Đã áp chỉ tiêu công bố theo học hàm");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">KPI theo năm học</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Đặt chỉ tiêu theo từng giảng viên; thực đạt tự tính từ bài báo.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <label className="text-xs text-muted-foreground">Năm KPI (giai đoạn 2026–2030)</label>
          <div className="inline-flex rounded-md border border-border p-0.5 bg-card">
            {YEARS.map((y) => {
              const p = periodByYear.get(y);
              const active = selectedPeriod?.startYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleYearClick(y)}
                  disabled={pending}
                  title={p ? `Kỳ ${p.label}` : `Tạo kỳ ${y}-${y + 1}`}
                  className={`px-3.5 h-9 rounded-sm text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                  }`}
                >
                  {y}
                  {!p && <span className={`ml-1 text-xs ${active ? "" : "text-muted-foreground"}`}>+</span>}
                </button>
              );
            })}
          </div>
          {selectedPeriodId && (
            <button
              type="button"
              onClick={() => setDeletePeriod(true)}
              className="text-[11px] text-muted-foreground hover:text-destructive mt-1 cursor-pointer"
            >
              Xoá kỳ {selectedPeriod?.label}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground bg-muted/40 border rounded-lg px-3 py-2">
        Lưu ý: quy đổi năm học gần đúng theo năm dương lịch của bài báo (chưa có tháng xuất bản).
        Bài báo năm Y được tính cho năm học Y–Y+1.
      </p>

      {!selectedPeriodId ? (
        <div className="text-center text-muted-foreground py-16 border rounded-md bg-card">
          Chưa có kỳ KPI nào. Bấm một năm phía trên để tạo kỳ (vd: 2026 → kỳ “2026-2027”).
        </div>
      ) : (
        <>
          {needsCreditCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>
                <strong>{needsCreditCount}</strong> bài báo có tác giả nội bộ nhưng chưa gán “cá nhân được tính kết quả”.
                KPI tạm tính theo tác giả đầu tiên — vào trang Bài báo để xác định người được ghi nhận.
              </span>
            </div>
          )}

          {/* Faculty-level targets (55 Scopus / 17 Q1 / PhD milestone) */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="size-4 text-primary" /> Chỉ tiêu cấp Khoa
                </div>
                <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" disabled={pending} onClick={handleSeedRankTargets}>
                  <Wand2 className="size-4" /> Áp chỉ tiêu công bố theo học hàm
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chỉ tiêu</TableHead>
                      <TableHead className="text-center w-[140px]">Mục tiêu Khoa</TableHead>
                      <TableHead className="text-center">Thực đạt</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-center">GV đạt CN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indicators.map((ind) => {
                      const r = rollupByIndicator.get(ind.id);
                      const target = facultyTargetByIndicator.get(ind.id) ?? null;
                      const suggested = selectedPeriod ? suggestedFacultyTarget(ind.code, selectedPeriod.startYear) : null;
                      return (
                        <TableRow key={ind.id}>
                          <TableCell className="font-medium">
                            {ind.nameVi} <span className="text-muted-foreground font-normal">({ind.unit})</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              key={`fac-${selectedPeriodId}-${ind.id}`}
                              type="number" min={0} step="1"
                              defaultValue={target ?? ""}
                              placeholder={suggested != null ? `gợi ý ${suggested}` : ""}
                              disabled={pending}
                              onBlur={(e) => commitFacultyTarget(ind.id, e.target.value, target)}
                              className="h-8 w-24 mx-auto text-center"
                            />
                          </TableCell>
                          <TableCell className="text-center font-semibold">{r?.totalActual ?? 0}</TableCell>
                          <TableCell className={`text-center text-sm ${pctColor(r?.facultyPct ?? null)}`}>
                            {r?.facultyPct == null ? "—" : `${r.facultyPct}%`}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {ind.agg === "phd_count" ? "—" : `${r?.metCount ?? 0}/${r?.withTarget ?? 0}`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Per-lecturer target/actual table */}
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
                        <Link href={`/admin/lecturers/${l.id}`} className="hover:text-primary hover:underline">{l.name}</Link>
                      </TableCell>
                      {perPersonIndicators.map((ind) => {
                        const cell = row?.cells.find((c) => c.indicatorId === ind.id);
                        return (
                          <Fragment key={ind.id}>
                            <TableCell className="text-center border-l">
                              <Input
                                key={`${selectedPeriodId}-${l.id}-${ind.id}`}
                                type="number"
                                min={0}
                                step="0.5"
                                defaultValue={cell?.target ?? ""}
                                disabled={pending}
                                onBlur={(e) => commitTarget(ind.id, l.id, e.target.value, cell?.target ?? null)}
                                className="h-8 w-20 mx-auto text-center"
                              />
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {cell?.actual ?? 0}
                            </TableCell>
                            <TableCell className={`text-center text-sm ${pctColor(cell?.pct ?? null)}`}>
                              {cell?.pct == null ? "—" : `${cell.pct}%`}
                            </TableCell>
                          </Fragment>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deletePeriod}
        onOpenChange={setDeletePeriod}
        title="Xoá kỳ KPI?"
        description="Tất cả chỉ tiêu trong kỳ này sẽ bị xoá."
        confirmLabel="Xoá"
        onConfirm={handleDeletePeriod}
      />
    </div>
  );
}
