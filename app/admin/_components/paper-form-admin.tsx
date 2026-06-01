"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthorshipInput, type AuthorEntry } from "@/app/_components/authorship-input";
import { VenuePicker } from "./venue-picker";
import { BibtexImportDialog } from "@/app/_components/bibtex-import-dialog";
import type { Paper, Lecturer, ScopusIndexStatus, SubmissionStatus } from "@/lib/data";
import { SUBMISSION_STATUS_LABEL } from "@/lib/data";

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
  scopusIndexStatus: "unknown" as ScopusIndexStatus,
  scopusIndexYear: "",
  quartile: "",
  submissionStatus: "submitted" as SubmissionStatus,
};

export function PaperFormAdmin({
  open,
  onOpenChange,
  onSave,
  lecturers,
  editingPaper,
}: PaperFormAdminProps) {
  const [form, setForm] = useState(emptyForm);
  const [authors, setAuthors] = useState<AuthorEntry[]>([]);
  const [creditedId, setCreditedId] = useState<string>("");
  const [firstAuthor, setFirstAuthor] = useState(false);
  const [corresponding, setCorresponding] = useState(false);
  const [isBibtexOpen, setIsBibtexOpen] = useState(false);

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
        scopusIndexStatus: editingPaper.scopusIndexStatus ?? "unknown",
        scopusIndexYear: editingPaper.scopusIndexYear != null ? String(editingPaper.scopusIndexYear) : "",
        quartile: editingPaper.quartile ?? "",
        submissionStatus: editingPaper.submissionStatus ?? "submitted",
      });
      setCreditedId(editingPaper.creditedLecturerId != null ? String(editingPaper.creditedLecturerId) : "");
      setFirstAuthor(!!editingPaper.isFirstAuthor);
      setCorresponding(!!editingPaper.isCorrespondingAuthor);

      const allNames = editingPaper.authors ? editingPaper.authors.split(",").map(x => x.trim()).filter(Boolean) : [];
      const tempAuthors: AuthorEntry[] = [];
      const usedIds = new Set<number>();
      
      allNames.forEach(name => {
         const l = lecturers.find(x => `${x.title}. ${x.name}` === name && (editingPaper.lecturerIds || []).includes(x.id));
         if (l) {
            tempAuthors.push({ type: "internal", id: l.id, name: `${l.title}. ${l.name}`, email: l.email });
            usedIds.add(l.id);
         } else {
            tempAuthors.push({ type: "external", name });
         }
      });

      // Fallback for missing internal IDs that didn't match the string perfectly
      (editingPaper.lecturerIds || []).forEach(lid => {
         if (!usedIds.has(lid)) {
             const l = lecturers.find(x => x.id === lid);
             if (l) tempAuthors.push({ type: "internal", id: l.id, name: `${l.title}. ${l.name}`, email: l.email });
         }
      });
      setAuthors(tempAuthors);
    } else {
      setForm(emptyForm);
      setAuthors([]);
      setCreditedId("");
      setFirstAuthor(false);
      setCorresponding(false);
    }
  }, [editingPaper, open, lecturers]);

  // Internal (faculty) authors are the only candidates for the single credit.
  const internalAuthors = authors.filter(
    (a): a is Extract<AuthorEntry, { type: "internal" }> => a.type === "internal"
  );

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

    const allAuthors = authors.map((a) => a.name).join(", ");
    const lecturerIds = internalAuthors.map((a) => a.id);

    // Only a linked internal author may hold the credit (enforced server-side too).
    const credited = creditedId && lecturerIds.includes(Number(creditedId)) ? Number(creditedId) : null;

    const paper: Paper = {
      id: editingPaper?.id ?? Date.now(),
      title: form.title.trim(),
      year: parseInt(form.year, 10),
      venue: form.venue.trim(),
      authors: allAuthors,
      lecturerIds,
      doi: form.doi.trim() || undefined,
      url: form.url.trim() || undefined,
      abstract: form.abstract.trim() || undefined,
      creditedLecturerId: credited,
      isFirstAuthor: firstAuthor,
      isCorrespondingAuthor: corresponding,
      scopusIndexStatus: form.scopusIndexStatus,
      scopusIndexYear: form.scopusIndexYear ? parseInt(form.scopusIndexYear, 10) : null,
      quartile: form.quartile || null,
      submissionStatus: form.submissionStatus,
    };

    onSave(paper);
    onOpenChange(false);
    setForm(emptyForm);
    setAuthors([]);
    setCreditedId("");
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
    setAuthors(data.authors);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Venue picker */}
          <VenuePicker
            value={form.venue}
            onChange={(venue) => setForm({ ...form, venue })}
          />

          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Danh sách tác giả <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-4">
              Khuyến khích xếp tác giả theo đúng thứ tự trên bài báo để đảm bảo thống kê chính xác. 
              Bạn có thể kéo thả hoặc sử dụng phím mũi tên để sắp xếp lại.
            </p>
            <AuthorshipInput
              lecturers={lecturers}
              value={authors}
              onChange={setAuthors}
            />
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
                Cá nhân được tính kết quả (chỉ 1 người thuộc Khoa)
              </label>
              <Select
                value={creditedId || "none"}
                onValueChange={(v) => setCreditedId(v && v !== "none" ? v : "")}
              >
                <SelectTrigger className="h-11 cursor-pointer">
                  <SelectValue placeholder="Chọn tác giả nội bộ..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">— Chưa xác định —</SelectItem>
                  {internalAuthors.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)} className="cursor-pointer">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Một bài chỉ được tính cho một cá nhân. Nếu có đồng tác giả ngoài Trường, chỉ tính khi là tác giả chính/liên hệ.
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tình trạng Scopus</label>
                <Select
                  value={form.scopusIndexStatus}
                  onValueChange={(v) => setForm({ ...form, scopusIndexStatus: (v as ScopusIndexStatus) ?? "unknown" })}
                >
                  <SelectTrigger className="h-11 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown" className="cursor-pointer">Chưa rõ</SelectItem>
                    <SelectItem value="accepted" className="cursor-pointer">Đã chấp nhận (chưa index)</SelectItem>
                    <SelectItem value="indexed" className="cursor-pointer">Đã index Scopus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Năm index</label>
                <Input
                  type="number"
                  min={2000}
                  max={2035}
                  placeholder="VD: 2026"
                  value={form.scopusIndexYear}
                  onChange={(e) => setForm({ ...form, scopusIndexYear: e.target.value })}
                  className="h-11"
                />
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
              Bài chỉ được tính vào KPI Scopus/Q1 ở <strong>năm index</strong> (không phải năm chấp nhận).
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
