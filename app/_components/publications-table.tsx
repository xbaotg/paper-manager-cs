"use client";

import Link from "next/link";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVenueByCode, hydrateVenues } from "@/lib/venues";
import type { Paper, Lecturer } from "@/lib/data";

const ITEMS_PER_PAGE = 5;

// Short Journal/Conference tag from the venue type (1/4 = conference, 2/3 =
// journal; book/other gets no tag).
function venueTypeTag(code: string): { short: string; full: string; cls: string } | null {
  const t = getVenueByCode(code)?.type;
  if (t === 1 || t === 4) return { short: "HN", full: "Hội nghị", cls: "bg-teal-500/10 text-teal-700 border-teal-500/20" };
  if (t === 2 || t === 3) return { short: "TC", full: "Tạp chí", cls: "bg-purple-500/10 text-purple-700 border-purple-500/20" };
  return null;
}

type SortField = "title" | "year" | "venue" | "authors";
type SortDir = "asc" | "desc";

export function PublicationsTable({
  papers,
  lecturers,
}: {
  papers: Paper[];
  lecturers: Lecturer[];
}) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [page, setPage] = useState(1);
  // Hydrate the venue catalog so the Journal/Conference tag resolves custom
  // venues too (the static bundle only has the seed list). Re-render on success.
  const [, bumpVenues] = useState(0);
  useEffect(() => {
    hydrateVenues().then(() => bumpVenues((v) => v + 1)).catch(() => {});
  }, []);

  // Lecturer lookup
  const lecturerMap = useMemo(() => {
    const m: Record<number, Lecturer> = {};
    lecturers.forEach((l) => (m[l.id] = l));
    return m;
  }, [lecturers]);

  // Unique years for filter
  const years = useMemo(
    () => [...new Set(papers.map((p) => p.year))].sort((a, b) => b - a),
    [papers]
  );

  // Unique venues (tạp chí / hội nghị) for filter, alphabetical
  const venues = useMemo(
    () =>
      [...new Set(papers.map((p) => p.venue).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [papers]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = [...papers];

    // Text search
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.venue.toLowerCase().includes(q) ||
          p.authors.toLowerCase().includes(q) ||
          String(p.year).includes(q)
      );
    }

    // Year filter
    if (filterYear !== "all") {
      result = result.filter((p) => String(p.year) === filterYear);
    }

    // Venue (tạp chí / hội nghị) filter
    if (filterVenue !== "all") {
      result = result.filter((p) => p.venue === filterVenue);
    }

    // Sort
    result.sort((a, b) => {
      let va = a[sortField] as string | number;
      let vb = b[sortField] as string | number;
      if (typeof va === "string") {
        va = va.toLowerCase();
        vb = (vb as string).toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [papers, search, sortField, sortDir, filterYear, filterVenue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "year" ? "desc" : "asc");
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="size-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="size-3.5 ml-1" />
    ) : (
      <ArrowDown className="size-3.5 ml-1" />
    );
  }

  return (
    <section id="publications" className="py-24 bg-secondary/50">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/8 text-xs font-semibold text-primary uppercase tracking-wider">
            Công bố khoa học
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold font-heading mb-4">
            Danh sách bài báo
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Tổng hợp toàn bộ công bố khoa học của các thành viên trong Khoa.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Tìm kiếm bài báo..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 h-10"
                aria-label="Tìm kiếm bài báo"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select
                value={filterYear}
                onValueChange={(v) => {
                  setFilterYear(v ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[120px] h-10 cursor-pointer">
                  <SelectValue placeholder="Năm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">
                    Tất cả năm
                  </SelectItem>
                  {years.map((y) => (
                    <SelectItem
                      key={y}
                      value={String(y)}
                      className="cursor-pointer"
                    >
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterVenue}
                onValueChange={(v) => {
                  setFilterVenue(v ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px] h-10 cursor-pointer">
                  <SelectValue placeholder="Tạp chí / Hội nghị" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all" className="cursor-pointer">
                    Tất cả tạp chí / hội nghị
                  </SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v} value={v} className="cursor-pointer">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Tổng:{" "}
            <span className="font-semibold text-foreground">
              {filtered.length} bài báo
            </span>
          </p>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                  <TableHead className="w-[6%] text-muted-foreground font-semibold text-xs uppercase tracking-wider text-center py-4">
                    STT
                  </TableHead>
                  <TableHead
                    className="w-[34%] text-muted-foreground cursor-pointer select-none font-semibold text-xs uppercase tracking-wider py-4"
                    onClick={() => toggleSort("title")}
                  >
                    <span className="flex items-center hover:text-primary transition-colors">
                      Tên bài báo
                      <SortIcon field="title" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[8%] text-muted-foreground cursor-pointer select-none font-semibold text-xs uppercase tracking-wider text-center py-4"
                    onClick={() => toggleSort("year")}
                  >
                    <span className="flex items-center justify-center hover:text-primary transition-colors">
                      Năm
                      <SortIcon field="year" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[14%] text-muted-foreground cursor-pointer select-none font-semibold text-xs uppercase tracking-wider py-4"
                    onClick={() => toggleSort("venue")}
                  >
                    <span className="flex items-center hover:text-primary transition-colors">
                      Hội nghị
                      <SortIcon field="venue" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[15%] text-muted-foreground font-semibold text-xs uppercase tracking-wider py-4">
                    Giảng viên Khoa
                  </TableHead>
                  <TableHead className="w-[23%] text-muted-foreground font-semibold text-xs uppercase tracking-wider py-4">
                    Tác giả
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center whitespace-normal">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <FileSearch className="size-10 text-primary/30" />
                        <p>Không tìm thấy bài báo nào</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((paper, i) => (
                    <TableRow
                      key={paper.id}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      <TableCell className="px-4 py-4 align-middle text-center text-sm font-medium text-muted-foreground tabular-nums">
                        {start + i + 1}
                      </TableCell>
                      <TableCell className="px-4 py-4 align-middle whitespace-normal">
                        <Link
                          href={`/papers/${paper.id}`}
                          className="font-medium text-foreground text-sm xl:text-base leading-snug break-words hover:text-primary hover:underline transition-colors"
                        >
                          {paper.title}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-middle text-center whitespace-normal">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-secondary/80 font-semibold font-heading text-primary text-sm shadow-sm">
                          {paper.year}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-middle whitespace-normal">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="secondary"
                            className="max-w-full h-auto whitespace-normal break-words leading-tight py-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-semibold shadow-sm"
                          >
                            {paper.venue}
                          </Badge>
                          {(() => {
                            const tag = venueTypeTag(paper.venue);
                            return tag ? (
                              <Badge
                                variant="secondary"
                                className={`h-auto px-1.5 py-0 text-[10px] font-medium border ${tag.cls}`}
                                title={tag.full}
                              >
                                {tag.short}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                      {/* Internal lecturers (Vietnamese names) — own column */}
                      <TableCell className="px-4 py-4 align-middle whitespace-normal">
                        {(paper.lecturerIds || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {paper.lecturerIds.map((lid) => {
                              const l = lecturerMap[lid];
                              return l ? (
                                <Badge
                                  key={lid}
                                  variant="secondary"
                                  className="max-w-full h-auto whitespace-normal break-words leading-tight py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs"
                                >
                                  {l.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Authors exactly as written in the paper */}
                      <TableCell className="px-4 py-4 align-middle whitespace-normal">
                        <p className="text-sm text-muted-foreground leading-relaxed break-words">
                          {paper.authors}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center px-6 py-3 border-t border-border/50 text-sm text-muted-foreground">
            <span>
              {filtered.length > 0
                ? `Hiển thị ${start + 1}–${Math.min(start + ITEMS_PER_PAGE, filtered.length)} trong ${filtered.length}`
                : "Không có kết quả"}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                className="cursor-pointer"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1
                )
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev != null && p - prev > 1;
                  return (
                    <span key={p} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-1 text-muted-foreground/50">…</span>
                      )}
                      <Button
                        variant={p === currentPage ? "default" : "outline"}
                        size="icon-sm"
                        className="cursor-pointer min-w-[28px]"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  );
                })}
              <Button
                variant="outline"
                size="icon-sm"
                className="cursor-pointer"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
