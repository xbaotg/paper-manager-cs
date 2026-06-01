"use client";

import { useState } from "react";
import { Send, RotateCcw, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AuthorshipInput, type AuthorEntry } from "./authorship-input";
import { VenuePicker } from "@/app/admin/_components/venue-picker";
import { BibtexImportDialog } from "./bibtex-import-dialog";
import type { Paper, Lecturer } from "@/lib/data";

interface PaperFormProps {
  onSubmit: (paper: Paper) => void;
  lecturers: Lecturer[];
}

export function PaperForm({ onSubmit, lecturers }: PaperFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [venue, setVenue] = useState("");
  const [authors, setAuthors] = useState<AuthorEntry[]>([]);
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  const [isBibtexOpen, setIsBibtexOpen] = useState(false);


  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !year || !venue) return;

    // Build authors string
    const allAuthors = authors.map((a) => a.name).join(", ");
    const lecturerIds = authors
      .filter((a) => a.type === "internal")
      .map((a: any) => a.id);

    const paper: Paper = {
      id: Date.now(),
      title: title.trim(),
      year: parseInt(year, 10),
      venue: venue.trim(),
      authors: allAuthors,
      lecturerIds,
      doi: doi.trim() || undefined,
      url: url.trim() || undefined,
    };

    onSubmit(paper);
    setSubmitted(true);
    toast.success("Bài báo đã được thêm thành công!");
  }

  function handleReset() {
    setTitle("");
    setYear("");
    setVenue("");
    setAuthors([]);
    setDoi("");
    setUrl("");
    setSubmitted(false);
  }

  function handleBibtexConfirm(data: {
    title: string;
    year: string;
    venue: string;
    authors: AuthorEntry[];
    doi?: string;
    url?: string;
  }) {
    setTitle(data.title);
    setYear(data.year);
    setVenue(data.venue);
    setAuthors(data.authors);
    setDoi(data.doi || "");
    setUrl(data.url || "");
  }

  return (
    <section id="submit" className="py-24 bg-gradient-to-b from-card to-background">
      <div className="container mx-auto px-6 max-w-5xl text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/8 text-xs font-semibold text-primary uppercase tracking-wider">
          Nhập thông tin
        </span>
        <h2 className="text-3xl sm:text-4xl font-semibold font-heading mb-4">
          Thêm bài báo mới
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-12">
          Điền thông tin bài báo của bạn để đưa vào danh sách công bố khoa học
          của Khoa.
        </p>

        <Card className="max-w-2xl mx-auto border-border/50 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-cta to-primary/60" />
          <CardContent className="p-8">
            {!submitted ? (
              <div className="space-y-6">
                <Button 
                  variant="outline" 
                  className="w-full border-dashed tracking-wide h-12 bg-muted/20 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                  onClick={() => setIsBibtexOpen(true)}
                >
                  <Plus className="size-4 mr-2" />
                  Nhập nhanh từ BibTeX (Google Scholar)
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Hoặc điền thủ công</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label
                    htmlFor="paper-title"
                    className="text-sm font-semibold font-heading"
                  >
                    Tên bài báo <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="paper-title"
                    placeholder="VD: Deep Learning for Vietnamese NLP..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2 text-left">
                    <label
                      htmlFor="paper-year"
                      className="text-sm font-semibold font-heading"
                    >
                      Năm công bố <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="paper-year"
                      type="number"
                      placeholder="VD: 2024"
                      min={2000}
                      max={2030}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                      className="h-11"
                    />
                </div>

                {/* Venue picker */}
                <div className="text-left">
                  <VenuePicker
                    value={venue}
                    onChange={(v) => setVenue(v)}
                  />
                </div>

                <div className="text-left space-y-2">
                  <label className="text-sm font-semibold font-heading">
                    Danh sách tác giả <span className="text-destructive">*</span>
                  </label>
                  <AuthorshipInput
                    lecturers={lecturers}
                    value={authors}
                    onChange={setAuthors}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                  {/* DOI */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold font-heading">
                      DOI
                    </label>
                    <Input
                      placeholder="VD: 10.1234/..."
                      value={doi}
                      onChange={(e) => setDoi(e.target.value)}
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
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 cursor-pointer h-11"
                    onClick={() => {
                      setTitle("");
                      setYear("");
                      setVenue("");
                      setAuthors([]);
                      setDoi("");
                      setUrl("");
                    }}
                  >
                    <RotateCcw className="size-4" data-icon="inline-start" />
                    Đặt lại
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90 h-11"
                  >
                    <Send className="size-4" data-icon="inline-start" />
                    Gửi bài báo
                  </Button>
                </div>
              </form>
            </div>
          ) : (
              <div className="py-8 animate-fade-up">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="size-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold font-heading text-green-600 mb-2">
                  Thêm thành công!
                </h3>
                <p className="text-muted-foreground mb-8">
                  Bài báo đã được thêm vào danh sách công bố khoa học của Khoa.
                </p>
                <Button
                  onClick={handleReset}
                  className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-4" data-icon="inline-start" />
                  Thêm bài báo khác
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <BibtexImportDialog
        open={isBibtexOpen}
        onOpenChange={setIsBibtexOpen}
        lecturers={lecturers}
        onConfirm={handleBibtexConfirm}
      />
    </section>
  );
}
