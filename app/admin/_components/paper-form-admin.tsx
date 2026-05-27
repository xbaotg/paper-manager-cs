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
import { AuthorshipInput, type AuthorEntry } from "@/app/_components/authorship-input";
import { VenuePicker } from "./venue-picker";
import { BibtexImportDialog } from "@/app/_components/bibtex-import-dialog";
import type { Paper, Lecturer } from "@/lib/data";

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
      });

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
    }
  }, [editingPaper, open, lecturers]);

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
    const lecturerIds = authors
      .filter((a) => a.type === "internal")
      .map((a: any) => a.id);

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
    };

    onSave(paper);
    onOpenChange(false);
    setForm(emptyForm);
    setAuthors([]);
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
