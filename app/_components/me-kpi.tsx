"use client";

import { useEffect, useState, useTransition } from "react";
import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyKpi, type MyKpiData } from "@/app/actions/kpi";

function barColor(pct: number | null): string {
  if (pct == null) return "bg-muted";
  if (pct >= 100) return "bg-green-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-destructive";
}

export function MeKpi({ initial }: { initial: MyKpiData }) {
  const [data, setData] = useState<MyKpiData>(initial);
  const [, startTransition] = useTransition();

  const { periods, indicators, cells, selectedPeriodId } = data;
  const LS_KEY = "paperManagerCS_kpiPeriod_me";
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  function reload(periodId: number) {
    startTransition(async () => setData(await getMyKpi(periodId)));
  }

  // Prefer the user's last-viewed period; fall back to the period covering the
  // current calendar year. Server already picks a sensible default, so this
  // only fires a reload when the stored/current-year period differs.
  useEffect(() => {
    let storedId: number | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) storedId = Number(raw);
    } catch {}

    let target = storedId != null && !Number.isNaN(storedId)
      ? periods.find((p) => p.id === storedId)
      : null;
    if (!target) {
      const currentYear = new Date().getFullYear();
      target = periods.find((p) => p.startYear === currentYear);
    }
    if (target && target.id !== selectedPeriodId) reload(target.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      try { localStorage.setItem(LS_KEY, String(selectedPeriod.id)); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod?.id]);

  // The paper dashboard below dispatches "me-kpi:refresh" after add/edit/delete.
  // Re-fetch the current period so the Scopus/Q1 actuals update live (no F5).
  useEffect(() => {
    const handler = () => {
      startTransition(async () => setData(await getMyKpi(selectedPeriodId ?? undefined)));
    };
    window.addEventListener("me-kpi:refresh", handler);
    return () => window.removeEventListener("me-kpi:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId]);

  if (periods.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Chưa có kỳ KPI nào được thiết lập.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold flex items-center gap-2">
          <Target className="size-4 text-primary" /> KPI của tôi
        </h2>
        <Select value={selectedPeriodId ? String(selectedPeriodId) : ""} onValueChange={(v) => v && reload(Number(v))}>
          <SelectTrigger className="w-[140px] h-9 cursor-pointer"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={String(p.id)} className="cursor-pointer">{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {indicators.map((ind) => {
          const cell = cells.find((c) => c.indicatorId === ind.id);
          const target = cell?.target ?? null;
          const actual = cell?.actual ?? 0;
          const pct = cell?.pct ?? null;
          return (
            <Card key={ind.id}>
              <CardContent className="p-5 space-y-2">
                <div className="text-sm font-medium">{ind.nameVi}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold">{actual}</span>
                  <span className="text-sm text-muted-foreground">
                    / {target ?? "—"} {ind.unit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${barColor(pct)}`}
                    style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {pct == null ? "Chưa có chỉ tiêu" : `Hoàn thành ${pct}%`}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
