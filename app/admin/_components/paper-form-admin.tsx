"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, RotateCcw, Plus, AlertTriangle, X, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { listPaperTitlesServer } from "@/app/actions";
import { findSimilarTitles } from "@/lib/text-match";
import { reconstructAuthorLinks } from "@/lib/author-match";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthorshipInput, type AuthorEntry } from "@/app/_components/authorship-input";
import { LecturerCombobox } from "@/app/_components/lecturer-combobox";
import { VenuePicker } from "./venue-picker";
import { BibtexImportDialog } from "@/app/_components/bibtex-import-dialog";
import type { Paper, Lecturer, SubmissionStatus } from "@/lib/data";
import { SUBMISSION_STATUS_LABEL } from "@/lib/data";
import { isVenueScopus } from "@/lib/venues";

interface PaperFormAdminProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (paper: Paper) => void;
  lecturers: Lecturer[];
  editingPaper?: Paper | null;
}

const emptyForm = {
  title: "",
  year: "",
  venue: "",
  authors: "",
  doi: "",
  url: "",
  abstract: "",
  quartile: "",
  submissionStatus: "submitted" as SubmissionStatus,
};

// Rebuild the ordered author list from storage for editing (legacy papers with no
// authors_json). Delegates to the shared, containment-based matcher so a shortened
// byline like "Tien Do" links to "Đỗ Văn Tiến" IN PLACE instead of leaving an
// external chip and appending the full lecturer name as a duplicate.
function reconstructAuthors(
  authorsStr: string,
  lecturerIds: number[],
  lecturers: Lecturer[]
): AuthorEntry[] {
  return reconstructAuthorLinks(authorsStr, lecturerIds, lecturers).map((al): AuthorEntry => {
    if (al.lecturerId != null) {
      const l = lecturers.find((x) => x.id === al.lecturerId);
      return { type: "internal", id: al.lecturerId, name: al.name, email: l?.email };
    }
    return { type: "external", name: al.name };
  });
}

// Open the editor with the paper's authors. Prefer the persisted ordered list
// (authorLinks) — an exact round-trip of what add/import produced; only legacy
// papers without it fall back to the lossy reconstruction.
function authorsFromPaper(p: Paper, lecturers: Lecturer[]): AuthorEntry[] {
  if (p.authorLinks && p.authorLinks.length > 0) {
    return p.authorLinks.map((al): AuthorEntry => {
      if (al.lecturerId != null) {
        const l = lecturers.find((x) => x.id === al.lecturerId);
        return { type: "internal", id: al.lecturerId, name: al.name, email: l?.email };
      }
      return { type: "external", name: al.name };
    });
  }
  return reconstructAuthors(p.authors || "", p.lecturerIds || [], lecturers);
}

export function PaperFormAdmin({
  open,
  onOpenChange,
  onSave,
  lecturers,
  editingPaper,
}: PaperFormAdminProps) {
  const [form, setForm] = useState(emptyForm);
  // Ordered author list (internal faculty + external). The verbatim names string
  // is derived from this on save; the internal links (for KPI) are the ids of the
  // "internal" entries — attribution keys off the id, not the displayed name.
  const [authors, setAuthors] = useState<AuthorEntry[]>([]);
  // The single credited lecturer (KPI). May be a byline author OR a lecturer who is
  // not in the byline (counted for KPI but not shown as an author).
  const [creditedId, setCreditedId] = useState<number | null>(null);
  // Attributed lecturers who are NOT byline authors — counted for KPI but kept out
  // of the author list. Seeded on edit from lecturerIds minus the internal authors.
  const [extraKpiIds, setExtraKpiIds] = useState<number[]>([]);
  const [firstAuthor, setFirstAuthor] = useState(false);
  const [corresponding, setCorresponding] = useState(false);
  const [isBibtexOpen, setIsBibtexOpen] = useState(false);
  const [existingTitles, setExistingTitles] = useState<{ id: number; title: string }[]>([]);

  // Load existing titles once the dialog opens, to flag near-duplicate titles.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listPaperTitlesServer()
      .then((rows) => { if (!cancelled) setExistingTitles(rows); })
      .catch(() => { /* non-critical: dup warning just won't show */ });
    return () => { cancelled = true; };
  }, [open]);

  // Titles >= 80% similar to the one being entered (excludes the paper being edited).
  const similarTitles = useMemo(
    () => findSimilarTitles(form.title, existingTitles, { excludeId: editingPaper?.id ?? null }),
    [form.title, existingTitles, editingPaper]
  );

  useEffect(() => {
    if (editingPaper) {
      setForm({
        title: editingPaper.title,
        year: String(editingPaper.year),
        venue: editingPaper.venue,
        authors: editingPaper.authors,
        doi: editingPaper.doi || "",
        url: editingPaper.url || "",
        abstract: editingPaper.abstract || "",
        quartile: editingPaper.quartile ?? "",
        submissionStatus: editingPaper.submissionStatus ?? "submitted",
      });
      setCreditedId(editingPaper.creditedLecturerId ?? null);
      setFirstAuthor(!!editingPaper.isFirstAuthor);
      setCorresponding(!!editingPaper.isCorrespondingAuthor);

      // Open with the EXACT saved author list (authorLinks) when present; legacy
      // papers (saved before authors_json) fall back to the heuristic.
      const loadedAuthors = authorsFromPaper(editingPaper, lecturers);
      setAuthors(loadedAuthors);

      // Lecturers attributed for KPI but absent from the byline (the "counted but
      // not an author" case) — preserve them across edits so re-saving never
      // silently orphans them.
      const authorIds = new Set(
        loadedAuthors.filter((a) => a.type === "internal").map((a) => (a as { id: number }).id)
      );
      setExtraKpiIds((editingPaper.lecturerIds ?? []).filter((id) => !authorIds.has(id)));
    } else {
      setForm(emptyForm);
      setAuthors([]);
      setCreditedId(null);
      setExtraKpiIds([]);
      setFirstAuthor(false);
      setCorresponding(false);
    }
  }, [editingPaper, open, lecturers]);

  // Internal (faculty) authors from the ordered byline — the default credit
  // candidates (the common case picks one of them).
  const internalAuthors = useMemo(() => {
    const seen = new Set<number>();
    const out: Lecturer[] = [];
    for (const a of authors) {
      if (a.type === "internal" && !seen.has(a.id)) {
        const l = lecturers.find((x) => x.id === a.id);
        if (l) { seen.add(a.id); out.push(l); }
      }
    }
    return out;
  }, [authors, lecturers]);

  const internalAuthorIds = useMemo(
    () => new Set(internalAuthors.map((l) => l.id)),
    [internalAuthors]
  );

  // Non-author KPI lecturers, resolved for display (stable order).
  const extraKpiLecturers = useMemo(
    () => extraKpiIds.map((id) => lecturers.find((l) => l.id === id)).filter((l): l is Lecturer => !!l),
    [extraKpiIds, lecturers]
  );

  // The credited lecturer is counted for KPI but isn't in the byline.
  const creditedIsExtra = creditedId != null && !internalAuthorIds.has(creditedId);

  // Update the author list. Keep the credit while the credited person is still an
  // internal author OR a non-author KPI lecturer; drop it only when they vanish
  // entirely. Also drop any non-author KPI entry that just became a byline author
  // (it's now tracked as an author — avoid double-listing).
  function handleAuthorsChange(next: AuthorEntry[]) {
    setAuthors(next);
    const nextAuthorIds = new Set(
      next.filter((a) => a.type === "internal").map((a) => (a as { id: number }).id)
    );
    setExtraKpiIds((prev) => prev.filter((id) => !nextAuthorIds.has(id)));
    if (creditedId != null && !nextAuthorIds.has(creditedId) && !extraKpiIds.includes(creditedId)) {
      setCreditedId(null);
    }
  }

  // Pick the single KPI-credited lecturer. When they aren't a byline author, also
  // attach them to the paper's KPI set so the paper shows on their profile and
  // they're a valid credit target (the "counted but not an author" case).
  function handleCreditChange(next: number | null) {
    setCreditedId(next);
    if (next != null && !internalAuthorIds.has(next)) {
      setExtraKpiIds((prev) => (prev.includes(next) ? prev : [...prev, next]));
    }
  }

  function removeExtraKpi(id: number) {
    setExtraKpiIds((prev) => prev.filter((x) => x !== id));
    if (creditedId === id) setCreditedId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.year) {
      toast.error("Vui lòng nhập đầy đủ tên bài báo và năm công bố.");
      return;
    }

    if (!form.venue) {
      toast.error("Vui lòng chọn hoặc nhập mới Hội nghị / Tạp chí.");
      return;
    }

    if (authors.length === 0) {
      toast.error("Vui lòng thêm ít nhất một tác giả.");
      return;
    }

    // The ordered author list is the source of truth — persisted as authorLinks so
    // editing later rebuilds the exact same chips. authors/lecturerIds are derived.
    const authorLinks = authors
      .map((a) => ({ name: a.name.trim(), lecturerId: a.type === "internal" ? (a as { id: number }).id : null }))
      .filter((a) => a.name);
    const allAuthors = authorLinks.map((a) => a.name).join(", ");
    const authorLecturerIds = [
      ...new Set(authorLinks.filter((a) => a.lecturerId != null).map((a) => a.lecturerId as number)),
    ];
    // The KPI set = internal authors ∪ non-author KPI lecturers. deriveAuthors
    // unions these again server-side, so this is the faithful set.
    const lecturerIds = [...new Set([...authorLecturerIds, ...extraKpiIds])];

    // The credited person must be in the KPI set — a byline author or a non-author
    // KPI lecturer (enforced server-side too via normalizeCredited).
    const credited = creditedId != null && lecturerIds.includes(creditedId) ? creditedId : null;

    const paper: Paper = {
      id: editingPaper?.id ?? Date.now(),
      title: form.title.trim(),
      year: parseInt(form.year, 10),
      venue: form.venue.trim(),
      authors: allAuthors,
      lecturerIds,
      authorLinks,
      doi: form.doi.trim() || undefined,
      url: form.url.trim() || undefined,
      abstract: form.abstract.trim() || undefined,
      creditedLecturerId: credited,
      isFirstAuthor: firstAuthor,
      isCorrespondingAuthor: corresponding,
      quartile: form.quartile || null,
      submissionStatus: form.submissionStatus,
    };

    onSave(paper);
    onOpenChange(false);
    setForm(emptyForm);
    setAuthors([]);
    setCreditedId(null);
    setExtraKpiIds([]);
    setFirstAuthor(false);
    setCorresponding(false);
  }

  function handleBibtexConfirm(data: {
    title: string;
    year: string;
    venue: string;
    authors: AuthorEntry[];
    doi?: string;
    url?: string;
  }) {
    setForm({
      ...form,
      title: data.title,
      year: data.year,
      venue: data.venue,
      doi: data.doi || "",
      url: data.url || "",
    });
    // The import already resolved internal/external entries (alias / suggestion);
    // drop them straight into the ordered author list, still editable below.
    setAuthors(data.authors);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        // Don't discard a half-filled form on an accidental backdrop click —
        // only ESC, the X icon, or the Cancel button may close it.
        if (!next && details?.reason === "outside-press") return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPaper ? "Chỉnh sửa bài báo" : "Thêm bài báo mới"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {!editingPaper && (
            <Button 
              variant="outline" 
              className="w-full border-dashed tracking-wide h-10 bg-muted/20 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
              onClick={() => setIsBibtexOpen(true)}
            >
              <Plus className="size-4 mr-2" />
              Nhập từ BibTeX
            </Button>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Tên bài báo <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="VD: Deep Learning for Vietnamese NLP..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="h-11"
            />
            {similarTitles.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="flex items-center gap-1.5 font-medium text-amber-700">
                  <AlertTriangle className="size-4" />
                  Có {similarTitles.length} bài báo tiêu đề tương tự (≥ 80%) — kiểm tra tránh trùng lặp
                </div>
                <ul className="mt-1.5 space-y-1">
                  {similarTitles.map((m) => (
                    <li key={m.id} className="text-amber-800/90">
                      <span className="font-mono text-xs rounded bg-amber-500/20 px-1 py-0.5">{Math.round(m.score * 100)}%</span>{" "}
                      {m.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Year */}
          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Năm công bố <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              placeholder="VD: 2024"
              min={2000}
              max={2030}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              required
              className="h-11"
            />
          </div>

          {/* Venue picker. Scopus eligibility is derived from the chosen venue
              (shown read-only below), so no Scopus fields are set here. */}
          <VenuePicker
            value={form.venue}
            onChange={(venue) => setForm((f) => ({ ...f, venue }))}
          />

          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Danh sách tác giả <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Thêm tác giả theo <strong>đúng thứ tự trong bài</strong>. Chọn giảng viên nội bộ (tính KPI) hoặc nhập tác giả ngoài — dùng mũi tên để sắp xếp lại thứ tự.
            </p>
            <AuthorshipInput lecturers={lecturers} value={authors} onChange={handleAuthorsChange} />
          </div>

          {/* KPI publication tracking (single-credit rule + Scopus/Q1) */}
          <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4">
            <p className="text-sm font-semibold font-heading">Ghi nhận KPI công bố</p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tình trạng nộp bài</label>
              <Select
                value={form.submissionStatus}
                onValueChange={(v) => setForm({ ...form, submissionStatus: (v as SubmissionStatus) ?? "submitted" })}
              >
                <SelectTrigger className="h-11 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBMISSION_STATUS_LABEL) as SubmissionStatus[]).map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer">{SUBMISSION_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Cá nhân được tính KPI (chỉ 1 người thuộc Khoa)
              </label>
              <LecturerCombobox
                lecturers={lecturers}
                value={creditedId}
                onChange={handleCreditChange}
                priorityLecturers={internalAuthors}
                nullOptionLabel="— Chưa xác định —"
                placeholder="Tìm giảng viên được tính KPI..."
              />
              {creditedIsExtra && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <BadgeCheck className="size-3.5" /> Tính KPI · không phải tác giả trong bài
                </p>
              )}
              {extraKpiLecturers.some((l) => l.id !== creditedId) && (
                <div className="rounded-lg border border-dashed bg-background/60 p-2.5 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Cũng được tính KPI (không phải tác giả):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extraKpiLecturers
                      .filter((l) => l.id !== creditedId)
                      .map((l) => (
                        <Badge
                          key={l.id}
                          variant="secondary"
                          className="gap-1 bg-amber-500/10 text-amber-700 border border-amber-500/20 pr-1"
                        >
                          {l.title}. {l.name}
                          <button
                            type="button"
                            onClick={() => removeExtraKpi(l.id)}
                            className="rounded-sm p-0.5 hover:bg-amber-500/20 cursor-pointer"
                            title="Bỏ khỏi danh sách tính KPI"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Mặc định chọn tác giả nội bộ trong bài (1 người). Cần tính KPI cho giảng viên không có trong danh sách tác giả? Gõ tên để tìm — họ vẫn được tính KPI nhưng không hiển thị là tác giả.
              </p>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={firstAuthor} onChange={(e) => setFirstAuthor(e.target.checked)} className="size-4 cursor-pointer" />
                Tác giả chính (đứng đầu)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={corresponding} onChange={(e) => setCorresponding(e.target.checked)} className="size-4 cursor-pointer" />
                Tác giả liên hệ
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Scopus (theo venue)</label>
                <div className="h-11 flex items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  {form.venue
                    ? isVenueScopus(form.venue)
                      ? <span className="text-green-600 font-medium">Có — venue thuộc Scopus</span>
                      : <span className="text-muted-foreground">Không thuộc Scopus</span>
                    : <span className="text-muted-foreground">Chọn venue để xác định</span>}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Xếp hạng (Q)</label>
                <Select
                  value={form.quartile || "auto"}
                  onValueChange={(v) => setForm({ ...form, quartile: v === "auto" ? "" : (v ?? "") })}
                >
                  <SelectTrigger className="h-11 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="cursor-pointer">Theo venue (tự động)</SelectItem>
                    <SelectItem value="Q1" className="cursor-pointer">Q1</SelectItem>
                    <SelectItem value="Q2" className="cursor-pointer">Q2</SelectItem>
                    <SelectItem value="Q3" className="cursor-pointer">Q3</SelectItem>
                    <SelectItem value="Q4" className="cursor-pointer">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bài tính vào KPI Scopus/Q1 theo <strong>năm hội nghị</strong> khi đã được chấp nhận, nếu venue thuộc Scopus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* DOI */}
            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">
                DOI
              </label>
              <Input
                placeholder="VD: 10.1234/..."
                value={form.doi}
                onChange={(e) => setForm({ ...form, doi: e.target.value })}
                className="h-11"
              />
            </div>
            {/* URL */}
            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">
                URL
              </label>
              <Input
                placeholder="VD: https://arxiv.org/..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          {/* Abstract */}
          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Tóm tắt
            </label>
            <Textarea
              placeholder="Nhập tóm tắt bài báo (tùy chọn)..."
              rows={3}
              value={form.abstract}
              onChange={(e) =>
                setForm({ ...form, abstract: e.target.value })
              }
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer h-11"
              onClick={() => onOpenChange(false)}
            >
              <RotateCcw className="size-4" data-icon="inline-start" />
              Huỷ bỏ
            </Button>
            <Button
              type="submit"
              className="flex-1 cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90 h-11"
            >
              <Save className="size-4" data-icon="inline-start" />
              {editingPaper ? "Cập nhật" : "Thêm bài báo"}
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>

      {/* Render the BibTex dialog separately so it doesn't nest inside DialogContent directly */}
      <BibtexImportDialog
        open={isBibtexOpen}
        onOpenChange={setIsBibtexOpen}
        lecturers={lecturers}
        onConfirm={handleBibtexConfirm}
      />
    </Dialog>
  );
}
