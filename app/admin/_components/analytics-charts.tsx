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
import { type Paper } from "@/lib/data";
import { getVenueRankBucket, getVenueByCode } from "@/lib/venues";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#64748b", "#8b5cf6", "#ec4899"];

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
