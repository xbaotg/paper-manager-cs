"use client";

import { useState } from "react";
import { Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AuthorshipInput, type AuthorEntry } from "./authorship-input";
import { VenuePicker } from "@/app/admin/_components/venue-picker";
import type { PaperSubmission, StudentSubmissionInput } from "@/lib/data";

function initialAuthors(s?: PaperSubmission | null): AuthorEntry[] {
  if (!s?.authors) return [];
  return s.authors
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ type: "external", name }));
}

// Public, account-free paper form for students. Authors are always external
// (we pass an empty lecturer list to AuthorshipInput) — there is deliberately no
// way to link a lecturer here, since these papers have no lecturer byline.
export function StudentSubmissionForm({
  mode,
  initial,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: PaperSubmission | null;
  onSubmit: (input: StudentSubmissionInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [authors, setAuthors] = useState<AuthorEntry[]>(initialAuthors(initial));
  const [doi, setDoi] = useState(initial?.doi ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [abstract, setAbstract] = useState(initial?.abstract ?? "");
  const [submitterName, setSubmitterName] = useState(initial?.submitterName ?? "");
  const [submitterEmail, setSubmitterEmail] = useState(initial?.submitterEmail ?? "");
  const [website, setWebsite] = useState(""); // honeypot — stays empty for humans
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!title.trim() || !year || authors.length === 0 || !submitterName.trim() || !submitterEmail.trim()) {
      toast.error("Vui lòng điền các trường bắt buộc (*).");
      return;
    }
    const input: StudentSubmissionInput = {
      title: title.trim(),
      year: parseInt(year, 10),
      venue: venue.trim(),
      authors: authors.map((a) => a.name.trim()).filter(Boolean),
      doi: doi.trim() || undefined,
      url: url.trim() || undefined,
      abstract: abstract.trim() || undefined,
      submitterName: submitterName.trim(),
      submitterEmail: submitterEmail.trim(),
      website,
    };
    setPending(true);
    try {
      await onSubmit(input);
      if (mode === "edit") toast.success("Đã lưu thay đổi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-border/50 bg-card/80 shadow-xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-cta to-primary/60" />
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Honeypot: off-screen, hidden from real users and assistive tech. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          <div className="space-y-2">
            <label htmlFor="s-title" className="text-sm font-semibold font-heading">
              Tên bài báo <span className="text-destructive">*</span>
            </label>
            <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="h-11" />
          </div>

          <div className="space-y-2">
            <label htmlFor="s-year" className="text-sm font-semibold font-heading">
              Năm công bố <span className="text-destructive">*</span>
            </label>
            <Input
              id="s-year"
              type="number"
              min={1990}
              max={2100}
              placeholder="VD: 2025"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div>
            <label className="text-sm font-semibold font-heading">Nơi công bố (tạp chí / hội nghị)</label>
            <div className="mt-2">
              <VenuePicker value={venue} onChange={(v) => setVenue(v)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Danh sách tác giả <span className="text-destructive">*</span>
            </label>
            {/* lecturers=[] -> every author is external (no lecturer link). */}
            <AuthorshipInput lecturers={[]} value={authors} onChange={setAuthors} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">DOI</label>
              <Input placeholder="VD: 10.1234/..." value={doi} onChange={(e) => setDoi(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">URL</label>
              <Input placeholder="VD: https://arxiv.org/..." value={url} onChange={(e) => setUrl(e.target.value)} className="h-11" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="s-abstract" className="text-sm font-semibold font-heading">Tóm tắt (tuỳ chọn)</label>
            <Textarea id="s-abstract" rows={4} value={abstract} onChange={(e) => setAbstract(e.target.value)} />
          </div>

          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 space-y-4">
            <p className="text-sm font-semibold font-heading">Thông tin người gửi</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="s-name" className="text-sm font-medium">
                  Họ tên <span className="text-destructive">*</span>
                </label>
                <Input id="s-name" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <label htmlFor="s-email" className="text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input id="s-email" type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} required className="h-11" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            {mode === "create" && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 cursor-pointer"
                disabled={pending}
                onClick={() => {
                  setTitle(""); setYear(""); setVenue(""); setAuthors([]);
                  setDoi(""); setUrl(""); setAbstract("");
                }}
              >
                <RotateCcw className="size-4" data-icon="inline-start" /> Đặt lại
              </Button>
            )}
            <Button type="submit" disabled={pending} className="flex-1 h-11 cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90">
              <Send className="size-4" data-icon="inline-start" />
              {pending ? "Đang gửi…" : mode === "edit" ? "Lưu thay đổi" : "Gửi bài báo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
