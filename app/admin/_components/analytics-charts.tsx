"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { type Paper, type SubmissionStatus, SUBMISSION_STATUS_LABEL } from "@/lib/data";
import { getVenueRankBucket, getVenueByCode, isVenueQ1 } from "@/lib/venues";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#64748b", "#8b5cf6", "#ec4899"];

// Status → display colour. Maps to the Webflow accent palette.
const SUBMISSION_COLORS: Record<SubmissionStatus, string> = {
  submitted: "#64748b",     // slate (waiting)
  under_review: "#f59e0b",  // amber
  rebuttal: "#fb923c",      // orange
  accepted: "#3b89ff",      // blue
  denied: "#ee1d36",        // red
  published: "#00d722",     // green
};

interface ChartProps {
  papers: Paper[];
}

export function GrowthChart({ papers }: ChartProps) {
  const data = useMemo(() => {
    const counts: Record<number, number> = {};
    papers.forEach((p) => {
      counts[p.year] = (counts[p.year] || 0) + 1;
    });

    return Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b)
      .map((year) => ({
        year: String(year),
        count: counts[year],
      }));
  }, [papers]);

  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Không đủ dữ liệu</div>;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="year" 
            tick={{ fontSize: 12 }} 
            tickLine={false} 
            axisLine={false} 
            padding={{ left: 20, right: 20 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            tickLine={false} 
            axisLine={false} 
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            cursor={{ fill: "transparent", stroke: "#e2e8f0", strokeWidth: 2, strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey="count"
            name="Số bài báo"
            stroke="#4f46e5"
            strokeWidth={3}
            activeDot={{ r: 6, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
            dot={{ r: 4, fill: "#4f46e5" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankingChart({ papers }: ChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {
      "Hạng Cao (A*, A, Q1)": 0,
      "Hạng Vừa (B, Q2)": 0,
      "Đang lên (C, Q3, Q4)": 0,
      "Chưa phân loại": 0,
    };

    papers.forEach((p) => {
      const bucket = getVenueRankBucket(p.venue);
      counts[bucket] += 1;
    });

    return [
      { name: "Cao (A*, A, Q1)", count: counts["Hạng Cao (A*, A, Q1)"] },
      { name: "Vừa (B, Q2)", count: counts["Hạng Vừa (B, Q2)"] },
      { name: "Mới (C, Q3, Q4)", count: counts["Đang lên (C, Q3, Q4)"] },
      { name: "Khác", count: counts["Chưa phân loại"] },
    ].filter(d => d.count > 0); // Hide empty buckets if we want? Actually, it's nice to keep them.
  }, [papers]);

  if (data.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">Không đủ dữ liệu</div>;
  }

  return (
    <div className="h-[250px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11 }} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            tickLine={false} 
            axisLine={false} 
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            cursor={{ fill: "rgba(79, 70, 229, 0.05)" }}
          />
          <Bar dataKey="count" name="Số bài" fill="#3b82f6" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VenueTypePieChart({ papers }: ChartProps) {
  const data = useMemo(() => {
    let conf = 0;
    let jour = 0;
    let other = 0;

    papers.forEach((p) => {
      const v = getVenueByCode(p.venue);
      if (!v) {
        other++;
      } else if (v.type === 1) {
        conf++;
      } else if (v.type === 2) {
        jour++;
      } else {
        other++;
      }
    });

    return [
      { name: "Hội nghị", value: conf },
      { name: "Tạp chí", value: jour },
      { name: "Khác", value: other },
    ].filter(d => d.value > 0);
  }, [papers]);

  if (data.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Không đủ dữ liệu</div>;
  }

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.name === "Hội nghị" ? "#10b981" : entry.name === "Tạp chí" ? "#8b5cf6" : "#cbd5e1"} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Submission pipeline pie — where every paper is in the journal/conf workflow.
export function SubmissionStatusPie({ papers }: ChartProps) {
  const data = useMemo(() => {
    const counts: Record<SubmissionStatus, number> = {
      submitted: 0, under_review: 0, rebuttal: 0, accepted: 0, denied: 0, published: 0,
    };
    papers.forEach((p) => { counts[p.submissionStatus ?? "submitted"] += 1; });
    return (Object.keys(counts) as SubmissionStatus[])
      .filter((s) => counts[s] > 0)
      .map((s) => ({ name: SUBMISSION_STATUS_LABEL[s], status: s, value: counts[s] }));
  }, [papers]);

  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Không đủ dữ liệu</div>;
  }
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
            {data.map((d) => <Cell key={d.status} fill={SUBMISSION_COLORS[d.status]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Scopus indexed vs non-Scopus per year — shows the share that counts for KPI.
export function ScopusByYearChart({ papers }: ChartProps) {
  const data = useMemo(() => {
    const byYear: Record<number, { year: number; scopus: number; other: number; q1: number }> = {};
    papers.forEach((p) => {
      const y = p.scopusIndexYear ?? p.year;
      if (!byYear[y]) byYear[y] = { year: y, scopus: 0, other: 0, q1: 0 };
      if (p.scopusIndexStatus === "indexed") {
        byYear[y].scopus += 1;
        const isQ1 = p.quartile ? p.quartile.toUpperCase().includes("Q1") : isVenueQ1(p.venue);
        if (isQ1) byYear[y].q1 += 1;
      } else {
        byYear[y].other += 1;
      }
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year).map((d) => ({ ...d, year: String(d.year) }));
  }, [papers]);

  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Không đủ dữ liệu</div>;
  }
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="scopus" stackId="a" name="Scopus" fill="#3b89ff" />
          <Bar dataKey="other" stackId="a" name="Khác" fill="#cbd5e1" />
          <Bar dataKey="q1" name="Trong đó Q1" fill="#00d722" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Q1 ratio per year (Q1 / total Scopus). The dept target is ≥30%.
export function Q1RatioChart({ papers }: ChartProps) {
  const data = useMemo(() => {
    const byYear: Record<number, { scopus: number; q1: number }> = {};
    papers.forEach((p) => {
      if (p.scopusIndexStatus !== "indexed") return;
      const y = p.scopusIndexYear ?? p.year;
      if (!byYear[y]) byYear[y] = { scopus: 0, q1: 0 };
      byYear[y].scopus += 1;
      const isQ1 = p.quartile ? p.quartile.toUpperCase().includes("Q1") : isVenueQ1(p.venue);
      if (isQ1) byYear[y].q1 += 1;
    });
    return Object.entries(byYear).sort(([a], [b]) => Number(a) - Number(b)).map(([y, v]) => ({
      year: y,
      ratio: v.scopus > 0 ? Math.round((v.q1 / v.scopus) * 100) : 0,
    }));
  }, [papers]);

  if (data.length === 0) {
    return <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Không đủ dữ liệu</div>;
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none" }} formatter={(v: unknown) => [`${v}%`, "Tỷ lệ Q1"]} />
          <Line type="monotone" dataKey="ratio" name="Q1 / Scopus" stroke="#00d722" strokeWidth={3} dot={{ r: 4, fill: "#00d722" }} />
          {/* Faculty target reference line: 30%. */}
          <Line type="monotone" dataKey={() => 30} name="Mục tiêu 30%" stroke="#ee1d36" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------- KPI achievement (for the selected year) ----------------

interface FacultyKpiBarsProps {
  rollup: { indicatorId: number; totalActual: number; facultyTarget: number | null; facultyPct: number | null }[];
  indicators: { id: number; code: string; nameVi: string; agg: string }[];
}

// Faculty actual vs target per indicator — the headline "did we hit the year".
export function FacultyKpiBars({ rollup, indicators }: FacultyKpiBarsProps) {
  const data = indicators
    .map((i) => {
      const r = rollup.find((x) => x.indicatorId === i.id);
      const actual = r?.totalActual ?? 0;
      const target = r?.facultyTarget ?? 0;
      return { name: i.nameVi, actual, target, pct: r?.facultyPct ?? null };
    })
    .filter((d) => d.target > 0 || d.actual > 0);

  if (data.length === 0) {
    return <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Chưa có chỉ tiêu Khoa cho năm này</div>;
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={130} />
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="actual" name="Thực đạt" fill="#080808" />
          <Bar dataKey="target" name="Mục tiêu" fill="#cbd5e1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LecturerKpiBarsProps {
  rows: { lecturerId: number; cells: { indicatorId: number; actual: number; target: number | null }[] }[];
  lecturers: { id: number; name: string; title: string }[];
  indicators: { id: number; code: string; nameVi: string }[];
  indicatorCode?: string;
}

// Top lecturers for the year by actual on a given indicator (default Scopus).
// Met/not-met colour encodes whether the personal target was reached.
export function LecturerKpiBars({
  rows, lecturers, indicators, indicatorCode = "scopus_paper_count",
}: LecturerKpiBarsProps) {
  const ind = indicators.find((i) => i.code === indicatorCode);
  if (!ind) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Chưa có chỉ tiêu &quot;{indicatorCode}&quot;</div>;
  }
  const lecturerById = new Map(lecturers.map((l) => [l.id, l]));
  const data = rows
    .map((r) => {
      const c = r.cells.find((x) => x.indicatorId === ind.id);
      const l = lecturerById.get(r.lecturerId);
      const actual = c?.actual ?? 0;
      const target = c?.target ?? null;
      return {
        name: l ? `${l.title}. ${l.name}` : `#${r.lecturerId}`,
        actual,
        target: target ?? 0,
        met: target != null && actual >= target,
        hasTarget: target != null,
      };
    })
    .filter((d) => d.actual > 0 || d.hasTarget)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 12);

  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Chưa có dữ liệu</div>;
  }
  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={170} />
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="actual" name={`Thực đạt — ${ind.nameVi}`}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.hasTarget ? (d.met ? "#00d722" : "#ee1d36") : "#3b89ff"} />
            ))}
          </Bar>
          <Bar dataKey="target" name="Chỉ tiêu cá nhân" fill="#cbd5e1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Top venues by paper count, with Scopus share + rank bucket.
export function TopVenues({ papers }: ChartProps) {
  const rows = useMemo(() => {
    const map = new Map<string, { code: string; total: number; scopus: number; q1: number }>();
    papers.forEach((p) => {
      if (!p.venue) return;
      const r = map.get(p.venue) ?? { code: p.venue, total: 0, scopus: 0, q1: 0 };
      r.total += 1;
      if (p.scopusIndexStatus === "indexed") r.scopus += 1;
      const isQ1 = p.quartile ? p.quartile.toUpperCase().includes("Q1") : isVenueQ1(p.venue);
      if (isQ1) r.q1 += 1;
      map.set(p.venue, r);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [papers]);

  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu venue.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left font-medium py-2">Tạp chí / Hội nghị</th>
            <th className="text-center font-medium py-2">Tổng</th>
            <th className="text-center font-medium py-2">Scopus</th>
            <th className="text-center font-medium py-2">Q1</th>
            <th className="text-left font-medium py-2 pl-3">Hạng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const bucket = getVenueRankBucket(r.code);
            return (
              <tr key={r.code} className="border-b border-border/50 last:border-0">
                <td className="py-2 font-medium">{r.code}</td>
                <td className="py-2 text-center">{r.total}</td>
                <td className="py-2 text-center text-blue-600">{r.scopus}</td>
                <td className="py-2 text-center text-green-600 font-semibold">{r.q1}</td>
                <td className="py-2 pl-3 text-xs text-muted-foreground">{bucket.split(" ")[0]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
