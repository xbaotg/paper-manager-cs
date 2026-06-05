"use client";

import Link from "next/link";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { LecturerCombobox } from "@/app/_components/lecturer-combobox";
import { PaperFormAdmin } from "../_components/paper-form-admin";
import { ConfirmDialog } from "../_components/confirm-dialog";
import {
  type Paper,
  type Lecturer,
  type SubmissionStatus,
  SUBMISSION_STATUS_LABEL,
  isPendingSubmission,
} from "@/lib/data";
import { SubmissionStatusBadge } from "@/app/_components/submission-status-badge";
import { getVenueRankShort, getVenueRankBucket, hydrateVenues } from "@/lib/venues";
import { getDatabase, addPaperServer, updatePaperServer, deletePaperServer, updatePaperStatusServer } from "@/app/actions";

const ITEMS_PER_PAGE = 8;

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterLecturer, setFilterLecturer] = useState<number | null>(null);
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all"); // "all" | "pending" | <SubmissionStatus>
  const [yearSortDir, setYearSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Paper | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Paper | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteMultipleOpen, setDeleteMultipleOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Hydrate the client venue cache first so the rank/Scopus badges resolve
        // custom venues (the static bundle alone misses runtime-added/edited ones).
        await hydrateVenues();
        const db = await getDatabase();
        setPapers(db.papers);
        setLecturers(db.lecturers);
      } catch (err) {
        console.error(err);
        setPapers([]);
        setLecturers([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Derive filter options
  const years = useMemo(
    () =>
      [...new Set(papers.map((p) => p.year))].sort((a, b) => b - a),
    [papers]
  );
  const venues = useMemo(
    () => [...new Set(papers.map((p) => p.venue))].sort(),
    [papers]
  );

  // Lecturer lookup
  const lecturerMap = useMemo(() => {
    const m: Record<number, Lecturer> = {};
    lecturers.forEach((l) => (m[l.id] = l));
    return m;
  }, [lecturers]);

  // Filtered papers
  const filtered = useMemo(() => {
    let result = [...papers];

    // Search
    const q = search.toLowerCase();
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

    // Lecturer filter
    if (filterLecturer !== null) {
      result = result.filter((p) =>
        (p.lecturerIds || []).includes(filterLecturer)
      );
    }

    // Venue filter
    if (filterVenue !== "all") {
      result = result.filter((p) => p.venue === filterVenue);
    }

    // Submission-status filter ("pending" = the un-accepted, still-in-review group)
    if (filterStatus === "pending") {
      result = result.filter((p) => isPendingSubmission(p.submissionStatus));
    } else if (filterStatus !== "all") {
      result = result.filter((p) => (p.submissionStatus ?? "submitted") === filterStatus);
    }

    // Sort by year (direction toggled via the "Năm" column header), newest id as tiebreak
    result.sort((a, b) => {
      const cmp = a.year - b.year;
      return (yearSortDir === "desc" ? -cmp : cmp) || b.id - a.id;
    });

    return result;
  }, [papers, search, filterYear, filterLecturer, filterVenue, filterStatus, yearSortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  const hasFilters =
    filterYear !== "all" || filterLecturer !== null || filterVenue !== "all" || filterStatus !== "all";

  function clearFilters() {
    setFilterYear("all");
    setFilterLecturer(null);
    setFilterVenue("all");
    setFilterStatus("all");
    setSearch("");
    setPage(1);
    setSelectedIds(new Set());
  }

  async function handleStatusChange(paper: Paper, status: SubmissionStatus) {
    if ((paper.submissionStatus ?? "submitted") === status) return;
    try {
      const db = await updatePaperStatusServer(paper.id, status);
      setPapers(db.papers);
      toast.success("Đã cập nhật trạng thái");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được trạng thái");
    }
  }

  async function handleSave(paper: Paper) {
    if (editing) {
      const db = await updatePaperServer(editing.id, paper);
      setPapers(db.papers);
      toast.success("Cập nhật bài báo thành công!");
    } else {
      const db = await addPaperServer(paper);
      setPapers(db.papers);
      toast.success("Thêm bài báo thành công!");
    }
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const db = await deletePaperServer(deleteTarget.id);
    setPapers(db.papers);
    toast.success("Xoá bài báo thành công!");
    setDeleteTarget(null);
    if (selectedIds.has(deleteTarget.id)) {
      const newSet = new Set(selectedIds);
      newSet.delete(deleteTarget.id);
      setSelectedIds(newSet);
    }
  }

  async function handleDeleteMultiple() {
    if (selectedIds.size === 0) return;
    let db: any = null;
    for (const id of Array.from(selectedIds)) {
      db = await deletePaperServer(id);
    }
    if (db) setPapers(db.papers);
    toast.success(`Đã xoá ${selectedIds.size} bài báo!`);
    setSelectedIds(new Set());
    setDeleteMultipleOpen(false);
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
            <FileText className="size-6 text-primary" />
            Quản lý bài báo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {papers.length} bài báo • Đang hiển thị{" "}
            {filtered.length} kết quả
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => setDeleteMultipleOpen(true)}
            >
              <Trash2 className="size-4" data-icon="inline-start" />
              Xóa đã chọn ({selectedIds.size})
            </Button>
          )}
          <Button
            className="cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" data-icon="inline-start" />
            Thêm bài báo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Tìm kiếm bài báo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-10"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="size-4 text-muted-foreground hidden sm:block" />

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

          <div className="w-[200px]">
            <LecturerCombobox
              lecturers={lecturers}
              value={filterLecturer}
              onChange={(v: number | null) => {
                setFilterLecturer(v);
                setPage(1);
              }}
              nullOptionLabel="Tất cả giảng viên"
              placeholder="Tìm theo tên..."
            />
          </div>

          <Select
            value={filterVenue}
            onValueChange={(v) => {
              setFilterVenue(v ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-10 cursor-pointer">
              <SelectValue placeholder="Hội nghị" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">
                Tất cả
              </SelectItem>
              {venues.map((v) => (
                <SelectItem key={v} value={v} className="cursor-pointer">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterStatus}
            onValueChange={(v) => {
              setFilterStatus(v ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px] h-10 cursor-pointer">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">
                Tất cả trạng thái
              </SelectItem>
              <SelectItem value="pending" className="cursor-pointer font-medium text-amber-600">
                Chưa chấp nhận (đang xử lý)
              </SelectItem>
              {(Object.keys(SUBMISSION_STATUS_LABEL) as SubmissionStatus[]).map((s) => (
                <SelectItem key={s} value={s} className="cursor-pointer">
                  {SUBMISSION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="size-3.5 mr-1" />
              Xoá bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="w-[4%] py-4 text-center">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-gray-300 cursor-pointer accent-primary"
                    checked={pageItems.length > 0 && pageItems.every(p => selectedIds.has(p.id))}
                    onChange={(e) => {
                      const newSet = new Set(selectedIds);
                      if (e.target.checked) {
                        pageItems.forEach(p => newSet.add(p.id));
                      } else {
                        pageItems.forEach(p => newSet.delete(p.id));
                      }
                      setSelectedIds(newSet);
                    }}
                  />
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[28%]">
                  Tên bài báo
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center w-[8%]">
                  <button
                    type="button"
                    onClick={() => { setYearSortDir((d) => (d === "asc" ? "desc" : "asc")); setPage(1); }}
                    className="inline-flex items-center gap-1 mx-auto hover:text-foreground transition-colors cursor-pointer uppercase"
                    title="Sắp xếp theo năm"
                  >
                    Năm
                    {yearSortDir === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[9%]">
                  Hội nghị
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[15%]">
                  Trạng thái
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[22%]">
                  Giảng viên
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right w-[14%]">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <FileText className="size-8 text-primary/20 mx-auto mb-2" />
                    Không tìm thấy bài báo nào
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((paper) => (
                  <TableRow
                    key={paper.id}
                    className={`hover:bg-muted/40 transition-colors group ${selectedIds.has(paper.id) ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                  >
                    <TableCell className="py-4 text-center">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-gray-300 cursor-pointer accent-primary"
                        checked={selectedIds.has(paper.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedIds);
                          if (e.target.checked) newSet.add(paper.id);
                          else newSet.delete(paper.id);
                          setSelectedIds(newSet);
                        }}
                      />
                    </TableCell>
                    <TableCell className="py-4 whitespace-normal">
                      <Link
                        href={`/papers/${paper.id}`}
                        className="font-medium text-sm leading-snug break-words hover:text-primary hover:underline transition-colors"
                      >
                        {paper.title}
                      </Link>
                      {paper.doi && (
                        <div className="text-xs text-muted-foreground mt-1">
                          DOI: <span className="font-mono text-[11px] bg-muted/30 px-1 py-0.5 rounded">{paper.doi}</span>
                        </div>
                      )}
                      {paper.url && (
                        <a
                          href={paper.url.startsWith('http') ? paper.url : `https://${paper.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline mt-1 flex items-center gap-1 w-fit break-all"
                          title={paper.url}
                        >
                          <ExternalLink className="size-3 shrink-0" />
                          <span className="line-clamp-1 max-w-[200px]">{paper.url}</span>
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-center whitespace-normal">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-secondary/80 font-semibold font-heading text-primary text-sm">
                        {paper.year}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 whitespace-normal">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary border border-primary/20 font-semibold text-center"
                      >
                        {paper.venue}
                      </Badge>
                      {(() => {
                        const rank = paper.quartile || (paper.venue ? getVenueRankShort(paper.venue) : "");
                        return rank ? (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[10px]" title={paper.venue ? getVenueRankBucket(paper.venue) : ""}>
                              {rank}
                            </Badge>
                          </div>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell className="py-4 whitespace-normal">
                      <Select
                        value={paper.submissionStatus ?? "submitted"}
                        onValueChange={(v) => handleStatusChange(paper, v as SubmissionStatus)}
                      >
                        <SelectTrigger className="h-auto w-fit border-0 bg-transparent shadow-none rounded-md px-1 py-0.5 gap-1 cursor-pointer hover:bg-muted/60 focus-visible:ring-0 [&>svg]:size-3.5 [&>svg]:opacity-50" title="Đổi trạng thái">
                          <SubmissionStatusBadge status={paper.submissionStatus} className="text-[11px]" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(SUBMISSION_STATUS_LABEL) as SubmissionStatus[]).map((s) => (
                            <SelectItem key={s} value={s} className="cursor-pointer text-xs">
                              {SUBMISSION_STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-4 whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {(paper.lecturerIds || []).map((lid: number) => {
                          const l = lecturerMap[lid];
                          return l ? (
                            <Badge
                              key={lid}
                              variant="secondary"
                              className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs text-center"
                            >
                              {l.title}. {l.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      {paper.authors && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {paper.authors}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditing(paper);
                            setFormOpen(true);
                          }}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer opacity-60 hover:opacity-100 hover:text-destructive"
                          onClick={() => setDeleteTarget(paper)}
                          title="Xoá"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
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
              ? `Hiển thị ${start + 1}–${Math.min(
                  start + ITEMS_PER_PAGE,
                  filtered.length
                )} trong ${filtered.length}`
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
                      <span className="px-1 text-muted-foreground/50">
                        …
                      </span>
                    )}
                    <Button
                      variant={
                        p === currentPage ? "default" : "outline"
                      }
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
      </Card>

      {/* Paper Form Dialog */}
      <PaperFormAdmin
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        onSave={handleSave}
        lecturers={lecturers}
        editingPaper={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Xoá bài báo"
        description={`Bạn có chắc chắn muốn xoá bài báo "${deleteTarget?.title}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        onConfirm={handleDelete}
      />

      {/* Delete Multiple Confirmation */}
      <ConfirmDialog
        open={deleteMultipleOpen}
        onOpenChange={setDeleteMultipleOpen}
        title="Xoá nhiều bài báo"
        description={`Bạn có chắc chắn muốn xoá ${selectedIds.size} bài báo đã chọn? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        onConfirm={handleDeleteMultiple}
      />
    </div>
  );
}
