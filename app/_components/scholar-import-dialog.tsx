"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Loader2,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  CircleAlert,
  Download,
  Sparkles,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { LecturerCombobox } from "./lecturer-combobox";
import { VenuePicker } from "@/app/admin/_components/venue-picker";
import {
  scanScholarProfileServer,
  type ScholarStagedPaper,
} from "@/app/actions/scholar";
import { addPapersBulkServer, getDatabase } from "@/app/actions";
import {
  searchOpenAlexAuthors,
  fetchOpenAlexWorksByAuthor,
  type OpenAlexAuthorHit,
  type ParsedBibtex,
} from "@/lib/bibtex";
import { findSimilarTitles } from "@/lib/text-match";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  SUBMISSION_STATUS_LABEL,
  type SubmissionStatus,
  type Lecturer,
  type Paper,
} from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScholarImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturers: Lecturer[];
  // Called after a successful bulk import with the refreshed paper list.
  onImported: (papers: Paper[]) => void;
}

// Local editable mirror of a scanned draft (strings for the input fields).
interface EditItem {
  title: string;
  year: string;
  venueCode: string;
  venueRaw: string;
  doi: string;
  url: string;
  authors: ScholarStagedPaper["authors"];
  duplicateOfId: number | null;
  duplicateTitle: string | null;
  source: ScholarStagedPaper["source"];
  include: boolean;
  status: SubmissionStatus;
}

function toEditItem(p: ScholarStagedPaper): EditItem {
  return {
    title: p.title,
    year: p.year === "" ? "" : String(p.year),
    venueCode: p.venueCode,
    venueRaw: p.venueRaw,
    doi: p.doi,
    url: p.url,
    authors: p.authors,
    duplicateOfId: p.duplicateOfId,
    duplicateTitle: p.duplicateTitle,
    source: p.source,
    // Pre-uncheck likely duplicates so a careless "import all" can't re-add them.
    include: p.duplicateOfId == null,
    // Scholar lists published works — default to published, editable per paper.
    status: "published",
  };
}

function isValid(it: EditItem): boolean {
  return (
    !!it.title.trim() &&
    /^\d{4}$/.test(it.year.trim()) &&
    !!(it.venueCode || it.venueRaw).trim()
  );
}

// Build an EditItem from an OpenAlex match, flagging likely duplicates against
// the existing catalog (client-side, same threshold the Scholar scan uses).
function parsedToEditItem(pb: ParsedBibtex, existingTitles: { id: number; title: string }[]): EditItem {
  const dup = findSimilarTitles(pb.title, existingTitles, { threshold: 0.85, limit: 1 })[0] ?? null;
  return {
    title: pb.title,
    year: pb.year === "" ? "" : String(pb.year),
    venueCode: pb.venueMatch?.code ?? "",
    venueRaw: pb.venueRaw,
    doi: pb.doi ?? "",
    url: pb.url ?? "",
    authors: pb.authors,
    duplicateOfId: dup?.id ?? null,
    duplicateTitle: dup?.title ?? null,
    source: "openalex",
    include: dup == null,
    status: "published",
  };
}

export function ScholarImportDialog({
  open,
  onOpenChange,
  lecturers,
  onImported,
}: ScholarImportDialogProps) {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [items, setItems] = useState<EditItem[] | null>(null);
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);

  // OpenAlex (client-side) import: avoids the server-side Scholar block.
  const [mode, setMode] = useState<"openalex" | "scholar">("openalex");
  const [oaQuery, setOaQuery] = useState("");
  const [oaSearching, setOaSearching] = useState(false);
  const [oaAuthors, setOaAuthors] = useState<OpenAlexAuthorHit[] | null>(null);
  const [oaFetching, setOaFetching] = useState(false);
  const [aliases, setAliases] = useState<Record<string, number>>({});
  const [existingTitles, setExistingTitles] = useState<{ id: number; title: string }[]>([]);

  // Load aliases + existing titles once for client-side matching/dedup.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getDatabase()
      .then((db) => {
        if (cancelled) return;
        setAliases(db.authorAliases);
        setExistingTitles(db.papers.map((p) => ({ id: p.id, title: p.title })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  const includedCount = items?.filter((i) => i.include).length ?? 0;
  const validCount = items?.filter((i) => i.include && isValid(i)).length ?? 0;

  function reset() {
    setUrl("");
    setError("");
    setProfileName("");
    setItems(null);
    setPage(0);
    setScanning(false);
    setImporting(false);
    setOaQuery("");
    setOaAuthors(null);
    setOaSearching(false);
    setOaFetching(false);
  }

  // OpenAlex: find candidate authors by name.
  async function handleOaSearch() {
    if (!oaQuery.trim()) {
      setError("Nhập tên tác giả để tìm trên OpenAlex.");
      return;
    }
    setOaSearching(true);
    setError("");
    setOaAuthors(null);
    setItems(null);
    try {
      const hits = await searchOpenAlexAuthors(oaQuery.trim());
      setOaAuthors(hits);
      if (hits.length === 0) setError("Không tìm thấy tác giả nào khớp trên OpenAlex.");
    } catch {
      setError("Lỗi khi tìm tác giả trên OpenAlex.");
    } finally {
      setOaSearching(false);
    }
  }

  // OpenAlex: pull every work of the chosen author, match + dedup client-side.
  async function handlePickAuthor(author: OpenAlexAuthorHit) {
    setOaFetching(true);
    setError("");
    try {
      const parsed = await fetchOpenAlexWorksByAuthor(author.id, lecturers, aliases);
      if (parsed.length === 0) {
        setError("Tác giả này chưa có công trình nào trên OpenAlex.");
        return;
      }
      setProfileName(author.name);
      setItems(parsed.map((pb) => parsedToEditItem(pb, existingTitles)));
      setPage(0);
      setOaAuthors(null);
    } catch {
      setError("Lỗi khi tải danh sách công trình từ OpenAlex.");
    } finally {
      setOaFetching(false);
    }
  }

  function handleOpenChange(next: boolean, details?: { reason?: string }) {
    if (!next && details?.reason === "outside-press") return; // don't lose a scan on a stray click
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleScan() {
    if (!url.trim()) {
      setError("Nhập link hồ sơ Google Scholar.");
      return;
    }
    setScanning(true);
    setError("");
    setItems(null);
    try {
      const res = await scanScholarProfileServer(url.trim());
      if (!res.ok) {
        setError(res.error || "Quét thất bại.");
        setProfileName(res.profileName || "");
        return;
      }
      setProfileName(res.profileName || "");
      setItems(res.papers.map(toEditItem));
      setPage(0);
    } catch {
      setError("Có lỗi xảy ra khi quét hồ sơ.");
    } finally {
      setScanning(false);
    }
  }

  function patch(idx: number, p: Partial<EditItem>) {
    setItems((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...p };
      return next;
    });
  }

  function setAuthorMap(idx: number, authorIdx: number, lecturerId: number | null) {
    setItems((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const authors = next[idx].authors.map((a, i) =>
        i === authorIdx ? { ...a, mappedLecturerId: lecturerId } : a
      );
      next[idx] = { ...next[idx], authors };
      return next;
    });
  }

  async function handleImport() {
    if (!items) return;
    const chosen = items.filter((i) => i.include);
    const valid = chosen.filter(isValid);
    if (valid.length === 0) {
      toast.error("Không có bài hợp lệ để nhập (thiếu tên, năm hoặc nơi công bố).");
      return;
    }

    const base = Date.now();
    const papers: Paper[] = valid.map((it, i) => {
      const internalIds = Array.from(
        new Set(
          it.authors
            .map((a) => a.mappedLecturerId)
            .filter((v): v is number => v != null)
        )
      );
      return {
        id: base + i,
        title: it.title.trim(),
        year: parseInt(it.year.trim(), 10),
        venue: (it.venueCode || it.venueRaw).trim(),
        authors: it.authors.map((a) => a.rawName).join(", "),
        lecturerIds: internalIds,
        doi: it.doi.trim() || undefined,
        url: it.url.trim() || undefined,
        creditedLecturerId: null,
        isFirstAuthor: false,
        isCorrespondingAuthor: false,
        quartile: null,
        submissionStatus: it.status,
      };
    });

    setImporting(true);
    try {
      const db = await addPapersBulkServer(papers);
      onImported(db.papers);
      const skipped = chosen.length - valid.length;
      toast.success(
        `Đã nhập ${papers.length} bài báo${skipped > 0 ? ` (bỏ qua ${skipped} bài thiếu thông tin)` : ""}.`
      );
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nhập thất bại.");
    } finally {
      setImporting(false);
    }
  }

  const current = items?.[page];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-indigo-500" />
            Nhập bài báo tự động
          </DialogTitle>
          <DialogDescription>
            Quét toàn bộ công bố theo tác giả (OpenAlex — chạy từ trình duyệt, đỡ bị chặn) hoặc theo
            link Google Scholar; hệ thống tự dò hội nghị / tác giả / năm để bạn kiểm tra trước khi thêm.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — source picker */}
        {!items && (
          <Tabs value={mode} onValueChange={(v) => { setMode(v as "openalex" | "scholar"); setError(""); }} className="py-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="openalex">OpenAlex (đỡ bị chặn)</TabsTrigger>
              <TabsTrigger value="scholar">Google Scholar</TabsTrigger>
            </TabsList>

            {/* OpenAlex — by author, client-side */}
            <TabsContent value="openalex" className="flex flex-col gap-4 pt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Tên tác giả (VD: Thanh Duc Ngo)"
                  value={oaQuery}
                  onChange={(e) => setOaQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleOaSearch(); } }}
                  disabled={oaSearching || oaFetching}
                />
                <Button
                  onClick={handleOaSearch}
                  disabled={oaSearching || oaFetching || !oaQuery.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  {oaSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  <span className="ml-2">{oaSearching ? "Đang tìm..." : "Tìm"}</span>
                </Button>
              </div>
              {oaFetching && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" /> Đang tải toàn bộ công trình từ OpenAlex và đối chiếu...
                </p>
              )}
              {error && (
                <div className="text-sm text-destructive flex items-start gap-1.5 font-medium">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" /> {error}
                </div>
              )}
              {oaAuthors && oaAuthors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Chọn đúng tác giả để tải công trình:</p>
                  <div className="grid gap-2 max-h-[320px] overflow-y-auto">
                    {oaAuthors.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handlePickAuthor(a)}
                        disabled={oaFetching}
                        className="text-left rounded-lg border p-3 hover:border-primary hover:bg-muted/40 transition-colors disabled:opacity-50"
                      >
                        <p className="font-medium text-sm">{a.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          {a.institution && (<><Building2 className="size-3 shrink-0" /> {a.institution} · </>)}
                          {a.worksCount} công trình
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1.5"><Sparkles className="size-3.5 text-indigo-500" /> Vì sao OpenAlex?</p>
                <p>• Chạy thẳng từ trình duyệt (CORS) — không qua server nên tránh bị Google Scholar chặn.</p>
                <p>• Tìm theo tên → chọn đúng tác giả → tải toàn bộ công trình, tự dò venue + tác giả nội bộ.</p>
              </div>
            </TabsContent>

            {/* Google Scholar — by profile URL, server-side (fallback) */}
            <TabsContent value="scholar" className="flex flex-col gap-4 pt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="https://scholar.google.com/citations?user=XXXXXXX"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }}
                  disabled={scanning}
                />
                <Button
                  onClick={handleScan}
                  disabled={scanning || !url.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  {scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  <span className="ml-2">{scanning ? "Đang quét..." : "Quét"}</span>
                </Button>
              </div>
              {scanning && (
                <p className="text-xs text-muted-foreground">
                  Đang tải danh sách công bố và đối chiếu với kho dữ liệu — có thể mất ~10–20 giây cho hồ sơ nhiều bài.
                </p>
              )}
              {error && (
                <div className="text-sm text-destructive flex items-start gap-1.5 font-medium">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" /> {error}
                </div>
              )}
              <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Lưu ý</p>
                <p>• Mở hồ sơ Scholar của giảng viên → sao chép link trên thanh địa chỉ (chứa <code className="font-mono">?user=</code>).</p>
                <p>• Google Scholar có thể giới hạn truy cập tự động; nếu bị chặn, dùng tab OpenAlex.</p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Step 2 — paginated review */}
        {items && current && (
          <div className="flex flex-col gap-4 py-2">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
              <div className="text-sm">
                {profileName && <span className="font-semibold">{profileName}</span>}
                <span className="text-muted-foreground">
                  {profileName ? " — " : ""}
                  tìm thấy {items.length} bài • chọn {includedCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setItems((prev) => prev?.map((i) => ({ ...i, include: true })) ?? prev)}
                >
                  Chọn tất cả
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setItems((prev) => prev?.map((i) => ({ ...i, include: false })) ?? prev)}
                >
                  Bỏ chọn tất cả
                </Button>
              </div>
            </div>

            {/* Pager */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="size-4 mr-1" /> Trước
              </Button>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Bài {page + 1}</span>
                <span className="text-muted-foreground">/ {items.length}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(items.length - 1, p + 1))}
                disabled={page >= items.length - 1}
              >
                Sau <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>

            {/* Current paper card */}
            <div
              className={`space-y-4 rounded-xl border p-4 ${
                current.include ? "border-border bg-card" : "border-dashed bg-muted/20 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary"
                    checked={current.include}
                    onChange={(e) => patch(page, { include: e.target.checked })}
                  />
                  Nhập bài này
                </label>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {current.source === "openalex" ? "Khớp OpenAlex" : "Từ Scholar"}
                  </Badge>
                  {!isValid(current) && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">
                      Thiếu thông tin
                    </Badge>
                  )}
                </div>
              </div>

              {current.duplicateOfId != null && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs flex items-start gap-1.5">
                  <CircleAlert className="size-4 text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-amber-800">
                    Có thể trùng với bài đã có: <span className="font-medium">{current.duplicateTitle}</span>.
                    Mặc định bỏ chọn — tích lại nếu vẫn muốn thêm.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tên bài báo</label>
                <Input value={current.title} onChange={(e) => patch(page, { title: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Năm</label>
                  <Input
                    type="number"
                    value={current.year}
                    onChange={(e) => patch(page, { year: e.target.value })}
                    placeholder="VD: 2024"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Trạng thái</label>
                  <Select
                    value={current.status}
                    onValueChange={(v) => patch(page, { status: (v as SubmissionStatus) ?? "published" })}
                  >
                    <SelectTrigger className="h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SUBMISSION_STATUS_LABEL) as SubmissionStatus[]).map((s) => (
                        <SelectItem key={s} value={s} className="cursor-pointer">
                          {SUBMISSION_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Hội nghị / Tạp chí</label>
                <VenuePicker
                  value={current.venueCode}
                  onChange={(code) => patch(page, { venueCode: code })}
                  label=""
                  placeholder="Chọn nơi công bố..."
                />
                {current.venueRaw && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Gốc từ Scholar: {current.venueRaw}
                    {!current.venueCode && " — chưa khớp mã, hãy chọn để tính KPI Scopus/Q1."}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">DOI</label>
                  <Input value={current.doi} onChange={(e) => patch(page, { doi: e.target.value })} placeholder="(tùy chọn)" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">URL</label>
                  <Input value={current.url} onChange={(e) => patch(page, { url: e.target.value })} placeholder="(tùy chọn)" />
                </div>
              </div>

              {/* Author → lecturer mapping */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Ghép tác giả nội bộ</label>
                  <Badge variant="outline" className="text-[10px]">{current.authors.length} tác giả</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tên hiển thị giữ nguyên theo bài báo. Chỉ ghép giảng viên thuộc Khoa để tính KPI.
                </p>
                <div className="grid gap-2">
                  {current.authors.map((a, j) => {
                    const high =
                      a.topMatches[0] &&
                      a.topMatches[0].score >= 0.8 &&
                      a.mappedLecturerId === a.topMatches[0].lecturer.id;
                    return (
                      <div
                        key={j}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 border border-border/50 rounded-lg bg-muted/10"
                      >
                        <div className="sm:w-[38%]">
                          <p className="text-sm font-medium leading-none break-words">{a.rawName}</p>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <LecturerCombobox
                            lecturers={lecturers}
                            value={a.mappedLecturerId}
                            onChange={(id) => setAuthorMap(page, j, id)}
                            topMatches={a.topMatches}
                            isHighConfidence={!!high}
                          />
                          {a.mappedLecturerId != null && high && (
                            <div className="text-green-600 bg-green-500/10 p-1.5 rounded-full shrink-0" title="Khớp tự động độ tin cậy cao">
                              <Check className="size-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {items && (
          <DialogFooter className="mt-2 border-t pt-4 flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={reset} disabled={importing}>
              Quét hồ sơ khác
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="bg-cta text-cta-foreground hover:bg-cta/90"
            >
              {importing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Download className="size-4 mr-2" />}
              Nhập {validCount} bài đã chọn
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
