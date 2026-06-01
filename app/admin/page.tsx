"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  FileText,
  Trophy,
  Plus,
  ArrowRight,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  FilterX,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  GraduationCap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "@/components/ui/select";
import { LecturerCombobox } from "@/app/_components/lecturer-combobox";
import { StatsCard } from "./_components/stats-card";
import {
  GrowthChart, RankingChart, VenueTypePieChart,
  SubmissionStatusPie, ScopusByYearChart, Q1RatioChart, TopVenues,
  FacultyKpiBars, LecturerKpiBars,
} from "./_components/analytics-charts";
import { getKpiByYear, type ManagerKpiData } from "@/app/actions/kpi";
import { type Paper, type Lecturer, LECTURER_TITLE_LABELS } from "@/lib/data";
import { getVenueRankBucket, isVenueQ1 } from "@/lib/venues";
import { getDatabase } from "@/app/actions";

export default function AdminDashboard() {
  const router = useRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Global Filters. Year range defaults to the current calendar year (the most
  // common scope on first visit) and is restored from localStorage on later
  // visits so the chosen tab survives navigation.
  const KPI_YEAR_LS_KEY = "paperManagerCS_kpiYear_admin";
  const currentYear = new Date().getFullYear();
  const [filterLecturerId, setFilterLecturerId] = useState<number | null>(null);
  const [filterStartYear, setFilterStartYear] = useState<string>(String(currentYear));
  const [filterEndYear, setFilterEndYear] = useState<string>(String(currentYear));

  // Hydrate the year selection from localStorage once on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KPI_YEAR_LS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { start: string; end: string };
        if (parsed.start) setFilterStartYear(parsed.start);
        if (parsed.end) setFilterEndYear(parsed.end);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist subsequent edits.
  useEffect(() => {
    try {
      localStorage.setItem(
        KPI_YEAR_LS_KEY,
        JSON.stringify({ start: filterStartYear, end: filterEndYear })
      );
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStartYear, filterEndYear]);

  // Lecturer Analytics state
  const [lecturerSearch, setLecturerSearch] = useState("");
  const [lecturerSortKey, setLecturerSortKey] = useState<"name" | "totalPapers" | "latestYear">("totalPapers");
  const [lecturerSortDir, setLecturerSortDir] = useState<"asc" | "desc">("desc");
  
  const [filterTitle, setFilterTitle] = useState<string>("all");
  const [filterMinPapers, setFilterMinPapers] = useState<string>("0");
  const [filterRankBucket, setFilterRankBucket] = useState<string>("all");
  const [filterLecturerYear, setFilterLecturerYear] = useState<string>("all");
  const [filterHasPapersOnly, setFilterHasPapersOnly] = useState(false);

  // KPI achievement for the year tab — loaded lazily when a single year is selected.
  const [kpiYearData, setKpiYearData] = useState<ManagerKpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const activeYear = useMemo(
    () => (filterStartYear !== "all" && filterStartYear === filterEndYear ? Number(filterStartYear) : null),
    [filterStartYear, filterEndYear]
  );
  useEffect(() => {
    if (activeYear == null) { setKpiYearData(null); return; }
    let cancelled = false;
    setKpiLoading(true);
    getKpiByYear(activeYear)
      .then((d) => { if (!cancelled) setKpiYearData(d); })
      .catch(() => { if (!cancelled) setKpiYearData(null); })
      .finally(() => { if (!cancelled) setKpiLoading(false); });
    return () => { cancelled = true; };
  }, [activeYear]);

  useEffect(() => {
    getDatabase().then(db => {
      setPapers(db.papers);
      setLecturers(db.lecturers);
      setLoaded(true);
    }).catch(err => {
      console.error(err);
      setPapers([]);
      setLecturers([]);
      setLoaded(true);
    });
  }, []);

  const years = useMemo(
    () => [...new Set(papers.map((p) => p.year))].sort((a, b) => b - a),
    [papers]
  );

  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (filterLecturerId !== null && !(p.lecturerIds || []).includes(filterLecturerId)) return false;
      if (filterStartYear !== "all" && p.year < parseInt(filterStartYear, 10)) return false;
      if (filterEndYear !== "all" && p.year > parseInt(filterEndYear, 10)) return false;
      return true;
    });
  }, [papers, filterLecturerId, filterStartYear, filterEndYear]);

  // Derived Stats
  const hasFilters = filterLecturerId !== null || filterStartYear !== "all" || filterEndYear !== "all";

  const venueCounts: Record<string, number> = {};
  filteredPapers.forEach((p) => {
    venueCounts[p.venue] = (venueCounts[p.venue] || 0) + 1;
  });
  const topVenue = Object.entries(venueCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";

  // Leaderboards
  const lecturerStats = useMemo(() => {
    const stats: Record<number, { count: number }> = {};
    filteredPapers.forEach((p) => {
      (p.lecturerIds || []).forEach((lid) => {
        if (!stats[lid]) stats[lid] = { count: 0 };
        stats[lid].count += 1;
      });
    });
    return stats;
  }, [filteredPapers]);

  // Full lecturer analytics (for the table section)
  const allLecturerAnalytics = useMemo(() => {
    // Apply lecturer-specific year filter to papers before computing stats
    const basePapers = filterLecturerYear !== "all"
      ? filteredPapers.filter((p) => p.year === parseInt(filterLecturerYear, 10))
      : filteredPapers;

    return lecturers.map((lecturer) => {
      const lecturerPapers = basePapers.filter((p) =>
        (p.lecturerIds || []).includes(lecturer.id)
      );
      const totalPapers = lecturerPapers.length;

      const papersByYear: Record<number, number> = {};
      lecturerPapers.forEach((p) => {
        papersByYear[p.year] = (papersByYear[p.year] || 0) + 1;
      });

      const rankBuckets: Record<string, number> = {};
      lecturerPapers.forEach((p) => {
        const bucket = getVenueRankBucket(p.venue);
        rankBuckets[bucket] = (rankBuckets[bucket] || 0) + 1;
      });

      const sortedYears = Object.keys(papersByYear)
        .map(Number)
        .sort((a, b) => b - a);
      const latestYear = sortedYears[0] || 0;

      return {
        ...lecturer,
        totalPapers,
        papersByYear,
        rankBuckets,
        latestYear,
        papers: lecturerPapers,
      };
    });
  }, [lecturers, filteredPapers, filterLecturerYear]);

  const filteredLecturerAnalytics = useMemo(() => {
    const q = lecturerSearch.toLowerCase();
    let list = allLecturerAnalytics;

    // Text search
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.title.toLowerCase().includes(q) ||
          l.department.toLowerCase().includes(q)
      );
    }

    // Title filter
    if (filterTitle !== "all") {
      list = list.filter((l) => l.title === filterTitle);
    }

    // Min papers filter
    const minPapers = parseInt(filterMinPapers, 10) || 0;
    if (minPapers > 0) {
      list = list.filter((l) => l.totalPapers >= minPapers);
    }

    // Has papers only
    if (filterHasPapersOnly) {
      list = list.filter((l) => l.totalPapers > 0);
    }

    // Rank bucket filter — show only lecturers who have at least one paper in the selected rank
    if (filterRankBucket !== "all") {
      list = list.filter((l) =>
        Object.keys(l.rankBuckets).some((bucket) => bucket === filterRankBucket)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (lecturerSortKey === "name") cmp = a.name.localeCompare(b.name, "vi");
      else if (lecturerSortKey === "totalPapers") cmp = a.totalPapers - b.totalPapers;
      else if (lecturerSortKey === "latestYear") cmp = a.latestYear - b.latestYear;
      return lecturerSortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [allLecturerAnalytics, lecturerSearch, lecturerSortKey, lecturerSortDir, filterTitle, filterMinPapers, filterHasPapersOnly, filterRankBucket, filterLecturerYear]);

  const hasLecturerFilters = lecturerSearch !== "" || filterTitle !== "all" || filterMinPapers !== "0" || filterHasPapersOnly || filterRankBucket !== "all" || filterLecturerYear !== "all";

  // Summary stats for filtered lecturer analytics
  const lecturerSummary = useMemo(() => {
    const total = filteredLecturerAnalytics.length;
    const withPapers = filteredLecturerAnalytics.filter((l) => l.totalPapers > 0).length;
    const totalPapersSum = filteredLecturerAnalytics.reduce((s, l) => s + l.totalPapers, 0);
    const avgPapers = total > 0 ? (totalPapersSum / total).toFixed(1) : "0";
    return { total, withPapers, totalPapersSum, avgPapers };
  }, [filteredLecturerAnalytics]);

  // Available titles for the filter dropdown
  const availableTitles = useMemo(() => {
    return [...new Set(lecturers.map((l) => l.title))].sort();
  }, [lecturers]);

  function toggleLecturerSort(key: typeof lecturerSortKey) {
    if (lecturerSortKey === key) {
      setLecturerSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setLecturerSortKey(key);
      setLecturerSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ column }: { column: typeof lecturerSortKey }) {
    if (lecturerSortKey !== column) return <ChevronsUpDown className="size-3 opacity-30" />;
    return lecturerSortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />;
  }

  const topLecturersByVolume = [...lecturers]
    .map((l) => ({ ...l, stat: lecturerStats[l.id]?.count || 0 }))
    .filter(l => l.stat > 0)
    .sort((a, b) => b.stat - a.stat)
    .slice(0, 5);

  const recentPapers = [...filteredPapers].sort((a, b) => b.id - a.id).slice(0, 5);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Báo cáo hiệu suất công bố khoa học của Bộ môn
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/lecturers">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <Users className="size-4 mr-2" /> Thêm giảng viên
            </Button>
          </Link>
          <Link href="/admin/papers">
            <Button size="sm" className="cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90">
              <Plus className="size-4 mr-2" /> Thêm bài báo
            </Button>
          </Link>
        </div>
      </div>

      {/* Year tabs — quick single-year scope (also reflects/updates the from/to range below). */}
      {(() => {
        const YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030];
        const activeYear =
          filterStartYear !== "all" && filterStartYear === filterEndYear ? Number(filterStartYear) : null;
        function selectYear(y: number | null) {
          if (y == null) { setFilterStartYear("all"); setFilterEndYear("all"); }
          else { setFilterStartYear(String(y)); setFilterEndYear(String(y)); }
        }
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Năm KPI:</span>
            <div className="inline-flex rounded-md border border-border p-0.5 bg-card">
              <button
                type="button"
                onClick={() => selectYear(null)}
                className={`px-3 h-9 rounded-sm text-sm font-medium cursor-pointer transition-colors ${
                  activeYear == null ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                Tất cả
              </button>
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => selectYear(y)}
                  className={`px-3.5 h-9 rounded-sm text-sm font-medium cursor-pointer transition-colors ${
                    activeYear === y ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Global Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center bg-card p-4 rounded-xl border shadow-sm">
        <div className="text-sm font-semibold text-muted-foreground mr-2">BỘ LỌC CỤC BỘ:</div>
        <Select value={filterStartYear} onValueChange={(v) => setFilterStartYear(v || "all")}>
          <SelectTrigger className="w-[150px] h-9">
            <span className="truncate text-sm">{filterStartYear === "all" ? "Từ năm: Tất cả" : `Từ năm: ${filterStartYear}`}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Từ năm: Tất cả</SelectItem>
            {years.map((y) => (
              <SelectItem key={`start-${y}`} value={String(y)}>Từ năm: {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground text-sm">—</span>

        <Select value={filterEndYear} onValueChange={(v) => setFilterEndYear(v || "all")}>
          <SelectTrigger className="w-[150px] h-9">
            <span className="truncate text-sm">{filterEndYear === "all" ? "Đến năm: Tất cả" : `Đến năm: ${filterEndYear}`}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Đến năm: Tất cả</SelectItem>
            {years.map((y) => (
              <SelectItem key={`end-${y}`} value={String(y)}>Đến năm: {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-[240px]">
          <LecturerCombobox
            lecturers={lecturers}
            value={filterLecturerId}
            onChange={setFilterLecturerId}
            nullOptionLabel="Toàn bộ khoa"
            placeholder="Tìm theo tên/email..."
          />
        </div>

        {hasFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setFilterStartYear("all");
              setFilterEndYear("all");
              setFilterLecturerId(null);
            }}
            className="text-muted-foreground hover:text-destructive h-9"
          >
            <FilterX className="size-4 mr-2" /> Xóa lọc
          </Button>
        )}
      </div>

      {/* KPI achievement — shown only when a single year tab is active. */}
      {activeYear != null && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading font-semibold flex items-center gap-2 text-lg">
              <Trophy className="size-5 text-primary" /> KPI đạt được — năm {activeYear}
            </h2>
            {kpiLoading && <span className="text-xs text-muted-foreground">Đang tải…</span>}
            {!kpiLoading && kpiYearData && !kpiYearData.selectedPeriodId && (
              <span className="text-xs text-amber-600">Chưa có kỳ KPI cho năm này.</span>
            )}
          </div>
          {kpiYearData && kpiYearData.selectedPeriodId && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
                    <BarChart3 className="size-4 text-primary" /> Cấp Khoa — thực đạt vs mục tiêu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FacultyKpiBars rollup={kpiYearData.rollup} indicators={kpiYearData.indicators} />
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
                    <Trophy className="size-4 text-emerald-500" /> Top giảng viên — Bài Scopus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LecturerKpiBars rows={kpiYearData.rows} lecturers={kpiYearData.lecturers} indicators={kpiYearData.indicators} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Submission pipeline + Scopus / Q1 / journal stats */}
      {(() => {
        const scopusCount = filteredPapers.filter((p) => p.scopusIndexStatus === "indexed").length;
        const q1Count = filteredPapers.filter((p) => {
          if (p.scopusIndexStatus !== "indexed") return false;
          return p.quartile ? p.quartile.toUpperCase().includes("Q1") : isVenueQ1(p.venue);
        }).length;
        const pending = filteredPapers.filter((p) => p.submissionStatus === "submitted" || p.submissionStatus === "under_review").length;
        const accepted = filteredPapers.filter((p) => p.submissionStatus === "accepted" || p.submissionStatus === "published").length;
        const denied = filteredPapers.filter((p) => p.submissionStatus === "denied").length;
        const decisions = accepted + denied;
        const acceptRate = decisions > 0 ? Math.round((accepted / decisions) * 100) : null;
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard icon={FileText} label="Bài Scopus" value={scopusCount} subtext={`${filteredPapers.length} bài tổng`} accentClass="text-blue-500 bg-blue-500/10" />
              <StatsCard icon={Trophy} label="Bài Q1" value={q1Count} subtext="Theo dữ liệu paper" accentClass="text-emerald-500 bg-emerald-500/10" />
              <StatsCard icon={TrendingUp} label="Đang chờ kết quả" value={pending} subtext="Submitted + Đang phản biện" accentClass="text-amber-500 bg-amber-500/10" />
              <StatsCard icon={Users} label="Tỷ lệ chấp nhận" value={acceptRate == null ? "—" : `${acceptRate}%`} subtext={`${accepted} chấp nhận / ${denied} từ chối`} accentClass="text-indigo-500 bg-indigo-500/10" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
                    <PieChartIcon className="size-4 text-amber-500" /> Trạng thái nộp bài
                  </CardTitle>
                </CardHeader>
                <CardContent><SubmissionStatusPie papers={filteredPapers} /></CardContent>
              </Card>
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
                    <BarChart3 className="size-4 text-blue-500" /> Bài Scopus / Q1 theo năm
                  </CardTitle>
                </CardHeader>
                <CardContent><ScopusByYearChart papers={filteredPapers} /></CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
                    <TrendingUp className="size-4 text-emerald-500" /> Tỷ lệ Q1 theo năm
                  </CardTitle>
                </CardHeader>
                <CardContent><Q1RatioChart papers={filteredPapers} /></CardContent>
              </Card>
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
                    <Trophy className="size-4 text-indigo-500" /> Top tạp chí / hội nghị
                  </CardTitle>
                </CardHeader>
                <CardContent><TopVenues papers={filteredPapers} /></CardContent>
              </Card>
            </div>
          </>
        );
      })()}

      {/* Stats Grid (volume only — KPI-related stats sit in the section above) */}
      <div className="grid grid-cols-1 gap-4">
        <StatsCard
          icon={FileText}
          label="Tổng công bố"
          value={filteredPapers.length}
          subtext="Trong phạm vi trích lọc"
          accentClass="text-blue-500 bg-blue-500/10"
        />
      </div>

      {/* Charting Section 1 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
              <TrendingUp className="size-4 text-blue-500" />
              Tiến độ công bố theo năm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart papers={filteredPapers} />
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
              <BarChart3 className="size-4 text-amber-500" />
              Chất lượng hội nghị (Rank)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart papers={filteredPapers} />
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards & 3rd Chart */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
              <PieChartIcon className="size-4 text-purple-500" />
              Loại hình (Hội nghị/Tạp chí)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center p-0">
            <VenueTypePieChart papers={filteredPapers} />
          </CardContent>
        </Card>

        {filterLecturerId === null && (
          <>
            <Card className="shadow-sm">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase">
                  <FileText className="size-4 text-blue-500" />
                  Top Số Lượng (Số Bài)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col divide-y divide-border/50">
                  {topLecturersByVolume.map((lecturer, idx) => (
                    <div key={lecturer.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-muted text-muted-foreground">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lecturer.title}. {lecturer.name}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{lecturer.stat} bài</Badge>
                    </div>
                  ))}
                  {topLecturersByVolume.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Không có dữ liệu</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {filterLecturerId !== null && (
           <Card className="lg:col-span-2 shadow-sm border-border/50">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase">
               <FileText className="size-4 text-primary" />
               Các bài báo đã xếp hạng
             </CardTitle>
           </CardHeader>
           <CardContent className="p-6">
             <div className="space-y-3">
               {recentPapers.map((paper) => (
                 <div key={paper.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                   <div className="flex-1 min-w-0">
                     <Link href={`/papers/${paper.id}`} className="text-sm font-medium leading-snug line-clamp-2 hover:text-primary hover:underline">{paper.title}</Link>
                     <div className="flex items-center gap-2 mt-1.5">
                       <Badge variant="outline" className="bg-primary/5 text-primary text-xs">
                         {paper.venue}
                       </Badge>
                       <span className="text-xs text-muted-foreground">{paper.year}</span>
                     </div>
                   </div>
                 </div>
               ))}
               {recentPapers.length === 0 && (
                 <p className="text-sm text-muted-foreground text-center py-4">Chưa có bài báo nào trong phạm vi lộc.</p>
               )}
               {filteredPapers.length > 5 && (
                 <div className="pt-2 text-center">
                    <Link href="/admin/papers">
                     <Button variant="ghost" size="sm" className="text-xs">
                       Xem danh sách đầy đủ ({filteredPapers.length}) <ArrowRight className="size-3 ml-1" />
                     </Button>
                    </Link>
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
        )}
      </div>

      {/* ── Full Lecturer Analytics Table ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-0 border-b space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase">
              <GraduationCap className="size-4 text-primary" />
              Phân tích giảng viên toàn bộ
              <Badge variant="secondary" className="text-xs ml-2 font-normal">{filteredLecturerAnalytics.length} giảng viên</Badge>
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm tên, email, chức danh..."
                value={lecturerSearch}
                onChange={(e) => setLecturerSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Filter bar for lecturer analytics */}
          <div className="flex flex-wrap items-center gap-3 pb-4">
            <Select value={filterTitle} onValueChange={(v) => setFilterTitle(v || "all")}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <span className="truncate">{filterTitle === "all" ? "Chức danh: Tất cả" : `Chức danh: ${filterTitle}`}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Chức danh: Tất cả</SelectItem>
                {availableTitles.map((t) => (
                  <SelectItem key={t} value={t}>{t} — {LECTURER_TITLE_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterMinPapers} onValueChange={(v) => setFilterMinPapers(v || "0")}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <span className="truncate">{filterMinPapers === "0" ? "Số bài: Không giới hạn" : `Số bài: ≥ ${filterMinPapers}`}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Số bài: Không giới hạn</SelectItem>
                <SelectItem value="1">Số bài: ≥ 1</SelectItem>
                <SelectItem value="2">Số bài: ≥ 2</SelectItem>
                <SelectItem value="3">Số bài: ≥ 3</SelectItem>
                <SelectItem value="5">Số bài: ≥ 5</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRankBucket} onValueChange={(v) => setFilterRankBucket(v || "all")}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <span className="truncate">{filterRankBucket === "all" ? "Rank: Tất cả" : `Rank: ${filterRankBucket === "Hạng Cao (A*, A, Q1)" ? "A*/A/Q1" : filterRankBucket === "Hạng Vừa (B, Q2)" ? "B/Q2" : filterRankBucket === "Đang lên (C, Q3, Q4)" ? "C/Q3-4" : "Chưa phân loại"}`}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Rank: Tất cả</SelectItem>
                <SelectItem value="Hạng Cao (A*, A, Q1)">Rank: Hạng Cao (A*/A/Q1)</SelectItem>
                <SelectItem value="Hạng Vừa (B, Q2)">Rank: Hạng Vừa (B/Q2)</SelectItem>
                <SelectItem value="Đang lên (C, Q3, Q4)">Rank: Đang lên (C/Q3-4)</SelectItem>
                <SelectItem value="Chưa phân loại">Rank: Chưa phân loại</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterLecturerYear} onValueChange={(v) => setFilterLecturerYear(v || "all")}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <span className="truncate">{filterLecturerYear === "all" ? "Năm: Tất cả" : `Năm: ${filterLecturerYear}`}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Năm: Tất cả</SelectItem>
                {years.map((y) => (
                  <SelectItem key={`lyr-${y}`} value={String(y)}>Năm: {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => setFilterHasPapersOnly(!filterHasPapersOnly)}
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-md border cursor-pointer transition-colors ${
                filterHasPapersOnly
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              <FileText className="size-3" />
              Chỉ có bài báo
            </button>

            {hasLecturerFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLecturerSearch("");
                  setFilterTitle("all");
                  setFilterMinPapers("0");
                  setFilterRankBucket("all");
                  setFilterLecturerYear("all");
                  setFilterHasPapersOnly(false);
                }}
                className="text-muted-foreground hover:text-destructive h-8 text-xs"
              >
                <FilterX className="size-3 mr-1" /> Xóa bộ lọc
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Summary stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b bg-muted/20">
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tổng GV</div>
            <div className="text-lg font-semibold font-heading text-foreground">{lecturerSummary.total}</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Có bài báo</div>
            <div className="text-lg font-semibold font-heading text-primary">{lecturerSummary.withPapers}</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tổng bài</div>
            <div className="text-lg font-semibold font-heading text-blue-500">{lecturerSummary.totalPapersSum}</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">TB bài/GV</div>
            <div className="text-lg font-semibold font-heading text-emerald-500">{lecturerSummary.avgPapers}</div>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>
                    <button onClick={() => toggleLecturerSort("name")} className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer font-semibold">
                      Giảng viên <SortIcon column="name" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Chức danh</TableHead>
                  <TableHead>
                    <button onClick={() => toggleLecturerSort("totalPapers")} className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer font-semibold">
                      Bài báo <SortIcon column="totalPapers" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Phân bố Rank</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <button onClick={() => toggleLecturerSort("latestYear")} className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer font-semibold">
                      Năm gần nhất <SortIcon column="latestYear" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLecturerAnalytics.map((lecturer, idx) => (
                    <TableRow
                      key={lecturer.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => router.push(`/lecturers/${lecturer.id}`)}
                    >
                      <TableCell className="text-center text-muted-foreground text-xs font-mono">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-primary/20 bg-primary/10 text-primary shrink-0">
                            <AvatarFallback className="text-xs font-semibold">
                              {lecturer.name.split(" ").pop()?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate flex items-center gap-1">
                              {lecturer.name}
                            </span>
                            <p className="text-xs text-muted-foreground truncate md:hidden">{LECTURER_TITLE_LABELS[lecturer.title] || lecturer.title}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{lecturer.title}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-lg font-semibold font-heading ${lecturer.totalPapers > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {lecturer.totalPapers}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {lecturer.totalPapers === 0 ? (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(lecturer.rankBuckets).map(([bucket, count]) => {
                              const color =
                                bucket.includes("Cao") ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                bucket.includes("Vừa") ? "bg-blue-100 text-blue-800 border-blue-200" :
                                bucket.includes("lên") ? "bg-amber-100 text-amber-800 border-amber-200" :
                                "bg-gray-100 text-gray-600 border-gray-200";
                              const label =
                                bucket.includes("Cao") ? "A*/A/Q1" :
                                bucket.includes("Vừa") ? "B/Q2" :
                                bucket.includes("lên") ? "C/Q3-4" :
                                "Khác";
                              return (
                                <span key={bucket} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
                                  {label}: {count}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lecturer.latestYear > 0 ? (
                          <span className="text-sm font-medium">{lecturer.latestYear}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                ))}
                {filteredLecturerAnalytics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Không tìm thấy giảng viên nào phù hợp.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
