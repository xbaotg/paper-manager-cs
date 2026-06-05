"use client";

import { useState, useEffect, useMemo, use } from "react";
import { Navbar } from "@/app/_components/navbar";
import { Footer } from "@/app/_components/footer";
import { getDatabase } from "@/app/actions";
import { Paper, Lecturer, LECTURER_TITLE_LABELS, countsAsPublication, isUnpublished } from "@/lib/data";
import { SubmissionStatusBadge } from "@/app/_components/submission-status-badge";
import { getVenueRankBucket, getVenueRankShort, hydrateVenues } from "@/lib/venues";
import { isCreditedTo } from "@/lib/kpi";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, FileText, Search, GraduationCap, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LecturerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"year" | "title">("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [chartYear, setChartYear] = useState<string>(""); // selected year for the per-year chart

  useEffect(() => {
    (async () => {
      try {
        // Hydrate the client venue cache so rank/Scopus resolution matches the
        // server (custom venues aren't in the static bundle).
        await hydrateVenues();
        const db = await getDatabase();
        setPapers(db.papers);
        setLecturers(db.lecturers);
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const lecturer = lecturers.find(l => l.id === Number(unwrappedParams.id));
  const lecturerPapers = useMemo(() => {
    return papers.filter(p => p.lecturerIds?.includes(Number(Number(unwrappedParams.id))));
  }, [papers, Number(unwrappedParams.id)]);

  const stats = useMemo(() => {
    const byYear: Record<number, number> = {};
    const rankBuckets: Record<string, number> = {};

    // Single-credit attribution: only papers credited to this lecturer count
    // (uncredited -> first author), so a paper co-authored with another faculty
    // member isn't counted on both profiles. Of those, only published / accepted
    // (in-press) papers count toward the totals; the in-progress pipeline and
    // denied papers are shown in the list but excluded.
    const id = Number(unwrappedParams.id);
    const credited = lecturerPapers.filter(p => isCreditedTo(p, id));
    const counted = credited.filter(p => countsAsPublication(p.submissionStatus));

    // Rank distribution per year, for the year-selectable chart.
    const byYearRank: Record<number, Record<string, number>> = {};

    counted.forEach(p => {
      byYear[p.year] = (byYear[p.year] || 0) + 1;
      const bucket = p.venue ? getVenueRankBucket(p.venue) : "Khác";
      rankBuckets[bucket] = (rankBuckets[bucket] || 0) + 1;
      byYearRank[p.year] = byYearRank[p.year] || {};
      byYearRank[p.year][bucket] = (byYearRank[p.year][bucket] || 0) + 1;
    });

    return {
      total: counted.length,
      pending: credited.length - counted.length,
      byYear,
      rankBuckets,
      byYearRank
    };
  }, [lecturerPapers, unwrappedParams.id]);

  const sortedAndFilteredPapers = useMemo(() => {
    let result = [...lecturerPapers];
    
    if (yearFilter !== "all" && !isNaN(Number(yearFilter))) {
      result = result.filter(p => p.year === Number(yearFilter));
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(s) || 
        (p.venue && p.venue.toLowerCase().includes(s))
      );
    }

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });

    return result;
  }, [lecturerPapers, yearFilter, search, sortField, sortDir]);

  const allYears = useMemo(() => {
    return Array.from(new Set(lecturerPapers.map(p => p.year))).sort((a, b) => b - a);
  }, [lecturerPapers]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lecturer) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-xl text-muted-foreground font-medium">Không tìm thấy giảng viên</p>
        <Button>
          <Link href="/lecturers">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

  const toggleSort = (field: "year" | "title") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc"); // Default heavily to descending for new sorts, especially Year
    }
  };

  // Years that have at least one counted publication, newest first — drives the
  // per-year chart selector. `chartYearEffective` falls back to the latest year.
  const publishedYears = useMemo(
    () => Object.keys(stats.byYear).map(Number).sort((a, b) => b - a),
    [stats.byYear]
  );
  const chartYearEffective =
    chartYear && stats.byYear[Number(chartYear)] != null ? Number(chartYear) : (publishedYears[0] ?? 0);
  const chartYearTotal = stats.byYear[chartYearEffective] || 0;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-muted/20 min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-7xl">
          
<Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
          <Link href="/admin" className="flex items-center"><ArrowLeft className="h-4 w-4 mr-2"/> Quay lại Admin</Link>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT PROFILE & STATS SECTIONS */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Profile Card */}
              <Card className="border-muted shadow-sm overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent"></div>
                <CardContent className="px-6 pb-6 pt-0 relative">
                  <Avatar className="h-24 w-24 border-4 border-background bg-primary/10 text-primary absolute -top-12">
                    {lecturer.avatarUrl && <AvatarImage src={lecturer.avatarUrl} alt={lecturer.name} />}
                    <AvatarFallback className="text-3xl font-semibold">{lecturer.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="pt-14">
                    <h1 className="text-2xl font-semibold font-heading leading-tight">{lecturer.name}</h1>
                    <div className="text-muted-foreground mt-1 font-medium">{LECTURER_TITLE_LABELS[lecturer.title] || lecturer.title}</div>
                    <div className="text-sm text-balance mt-3 space-y-1">
                      <p><span className="text-muted-foreground">Đơn vị:</span> <span className="font-semibold">{lecturer.department}</span></p>
                      <p><span className="text-muted-foreground">Email:</span> <a href={`mailto:${lecturer.email}`} className="text-primary hover:underline font-medium">{lecturer.email}</a></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="border-muted shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Chỉ số khoa học
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Lũy kế tất cả các năm</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <div className="text-3xl font-semibold text-primary font-heading">{stats.total}</div>
                    <div className="text-xs uppercase font-semibold text-muted-foreground mt-1 tracking-wider">Bài viết</div>
                    {stats.pending > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-1">{stats.pending} bài đang xử lý (không tính)</div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-3">Phân bố thứ hạng (Rank)</h3>
                    <div className="space-y-2">
                      {Object.entries(stats.rankBuckets).sort((a,b) => b[1] - a[1]).map(([bucket, count]) => {
                         const label =
                           bucket.includes("Cao") ? "A*/A/Q1 (Chất lượng cao)" :
                           bucket.includes("Vừa") ? "B/Q2 (Khá)" :
                           bucket.includes("lên") ? "C/Q3-4 (Trung bình)" :
                           "Không xếp hạng / Khác";
                         const isHigh = bucket.includes("Cao");
                         
                         return (
                           <div key={bucket} className="flex justify-between items-center text-sm">
                             <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></div>
                               <span className={isHigh ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
                             </div>
                             <span className="font-semibold">{count}</span>
                           </div>
                         )
                      })}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-muted/50">
                     <div className="flex items-center justify-between mb-4 gap-2">
                       <h3 className="text-sm font-semibold">Theo năm</h3>
                       {publishedYears.length > 0 && (
                         <Select value={String(chartYearEffective)} onValueChange={(v) => setChartYear(v ?? "")}>
                           <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                           <SelectContent>
                             {publishedYears.map((y) => (
                               <SelectItem key={y} value={String(y)} className="text-xs">Năm {y}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       )}
                     </div>
                     {publishedYears.length === 0 ? (
                       <p className="text-xs text-muted-foreground italic">Chưa có công bố được tính.</p>
                     ) : (
                       <>
                         <div className="mb-3">
                           <span className="text-3xl font-semibold text-primary font-heading">{chartYearTotal}</span>
                           <span className="text-xs text-muted-foreground ml-1.5">bài năm {chartYearEffective}</span>
                         </div>
                         <div className="space-y-2.5">
                           {Object.entries(stats.byYearRank[chartYearEffective] || {}).sort((a, b) => b[1] - a[1]).map(([bucket, count]) => {
                             const label =
                               bucket.includes("Cao") ? "A*/A/Q1" :
                               bucket.includes("Vừa") ? "B/Q2" :
                               bucket.includes("lên") ? "C/Q3-4" :
                               "Khác";
                             const isHigh = bucket.includes("Cao");
                             const pct = chartYearTotal > 0 ? (count / chartYearTotal) * 100 : 0;
                             return (
                               <div key={bucket} className="space-y-1">
                                 <div className="flex justify-between text-xs">
                                   <span className={isHigh ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
                                   <span className="font-semibold">{count}</span>
                                 </div>
                                 <div className="h-2 rounded-full bg-muted overflow-hidden">
                                   <div className={`h-full ${isHigh ? 'bg-emerald-500' : 'bg-primary/40'}`} style={{ width: `${pct}%` }} />
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       </>
                     )}
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* RIGHT PAPERS LIST SECTION */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Paper Filters Options */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-background p-4 rounded-xl border border-muted shadow-sm">
                 <div className="relative w-full sm:w-72">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input 
                      placeholder="Tìm bài báo..." 
                      className="pl-9"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                   />
                 </div>
                 <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-sm text-muted-foreground font-medium whitespace-nowrap hidden sm:inline">Lọc năm:</span>
                    <Select value={yearFilter} onValueChange={(v) => setYearFilter(v || "all")}>
                      <SelectTrigger className="w-[140px]">
                        <span className="truncate">
                          {yearFilter === "all" ? "Tất cả các năm" : `Năm ${yearFilter}`}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả các năm</SelectItem>
                        {allYears.map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              {/* Papers Table/List */}
              <Card className="border-muted shadow-sm overflow-hidden flex-1 flex flex-col">
                <CardHeader className="py-4 bg-muted/10 border-b border-muted">
                   <CardTitle className="text-base flex items-center gap-2">
                     <FileText className="h-4 w-4" /> Danh sách công bố ({sortedAndFilteredPapers.length})
                   </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto flex-1">
                  <Table>
                    <TableHeader className="bg-transparent hover:bg-transparent">
                      <TableRow>
                         <TableHead className="w-[80px] pl-4">
                           <button onClick={() => toggleSort("year")} className="flex items-center gap-1 font-semibold hover:text-foreground">
                             Năm {sortField === "year" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                           </button>
                         </TableHead>
                         <TableHead>
                           <button onClick={() => toggleSort("title")} className="flex items-center gap-1 font-semibold hover:text-foreground">
                             Bài báo {sortField === "title" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                           </button>
                         </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAndFilteredPapers.length > 0 ? (
                        sortedAndFilteredPapers.map((paper) => {
                          const rankBucket = paper.venue ? getVenueRankBucket(paper.venue) : "Khác";
                          const venueRank = paper.venue ? getVenueRankShort(paper.venue) : "";
                          const isHighRank = rankBucket.includes("Cao");

                          return (
                            <TableRow key={paper.id} className="hover:bg-muted/30">
                              <TableCell className="font-medium align-top pl-4 pt-5">{paper.year}</TableCell>
                              <TableCell className="align-top pt-5 pb-6 pr-6">
                                <Link href={`/papers/${paper.id}`} className="font-semibold text-[15px] hover:text-primary hover:underline group flex items-start gap-1 leading-snug">
                                  {paper.title}
                                  <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 text-primary transition-all shrink-0 mt-1" />
                                </Link>
                                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                                  {paper.venue ? <span className="font-medium">{paper.venue}</span> : <i className="text-muted-foreground/60">Chưa rõ nơi đăng</i>}
                                  {venueRank && (
                                    <Badge variant="outline" title={rankBucket} className={`text-[10px] py-0 px-1.5 font-medium ${isHighRank ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50 text-muted-foreground'}`}>
                                      {venueRank}
                                    </Badge>
                                  )}
                                  {isUnpublished(paper.submissionStatus) && (
                                    <SubmissionStatusBadge status={paper.submissionStatus} className="text-[10px] py-0 px-1.5" />
                                  )}
                                </p>
                                {paper.authors.length > 0 && (
                                  <p className="text-sm text-muted-foreground/80 mt-2 leading-relaxed">
                                    {paper.authors}
                                  </p>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="h-32 text-center text-muted-foreground">
                            Không tìm thấy bài báo nào phù hợp với bộ lọc hiện tại.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}