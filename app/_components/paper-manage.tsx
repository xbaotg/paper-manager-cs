"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Pencil, Trash2, ExternalLink, Link as LinkIcon, Users, Award, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/app/admin/_components/confirm-dialog";
import { PaperFormAdmin } from "@/app/admin/_components/paper-form-admin";
import { updatePaperServer, deletePaperServer, updateCreditedAuthorServer } from "@/app/actions";
import { getVenueRankBucket, getPaperImpactScore } from "@/lib/venues";
import type { Paper, Lecturer, SubmissionStatus } from "@/lib/data";
import { SUBMISSION_STATUS_LABEL } from "@/lib/data";

const SUBMISSION_BADGE_CLASS: Record<SubmissionStatus, string> = {
  submitted: "text-muted-foreground",
  under_review: "text-amber-600 border-amber-600/40",
  accepted: "text-blue-600 border-blue-600/40",
  denied: "text-destructive border-destructive/40",
  published: "text-green-600 border-green-600/40",
};

const STATUS_LABEL: Record<string, string> = {
  unknown: "Chưa rõ",
  accepted: "Đã chấp nhận",
  indexed: "Đã index Scopus",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function PaperManage({
  paper: initial,
  lecturers,
  canEdit,
}: {
  paper: Paper;
  lecturers: Lecturer[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [paper, setPaper] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const bucket = paper.venue ? getVenueRankBucket(paper.venue) : "Khác";
  const score = getPaperImpactScore(paper.venue);
  const lecturerById = new Map(lecturers.map((l) => [l.id, l]));
  const credited = paper.creditedLecturerId != null ? lecturerById.get(paper.creditedLecturerId) : null;
  const internal = (paper.lecturerIds ?? []).map((id) => lecturerById.get(id)).filter(Boolean) as Lecturer[];

  async function handleSave(updated: Paper) {
    try {
      const db = await updatePaperServer(paper.id, updated);
      const fresh = db.papers.find((p) => p.id === paper.id);
      if (fresh) setPaper(fresh);
      toast.success("Đã cập nhật bài báo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được");
    }
  }

  function handleChangeCredit(value: string | null) {
    const next = !value || value === "none" ? null : Number(value);
    if (next === (paper.creditedLecturerId ?? null)) return;
    startTransition(async () => {
      try {
        const db = await updateCreditedAuthorServer(paper.id, next);
        const fresh = db.papers.find((p) => p.id === paper.id);
        if (fresh) setPaper(fresh);
        toast.success("Đã cập nhật cá nhân được tính KPI");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không cập nhật được");
      }
    });
  }

  async function handleDelete() {
    try {
      await deletePaperServer(paper.id);
      toast.success("Đã xoá bài báo");
      router.back();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xoá được");
    }
    setDeleteOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
          <ArrowLeft className="size-4" /> Quay lại
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Chỉnh sửa
            </Button>
            <Button variant="destructive" size="sm" className="cursor-pointer gap-1.5" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Xoá
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold font-heading tracking-tight leading-snug">{paper.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={SUBMISSION_BADGE_CLASS[paper.submissionStatus ?? "submitted"]}>
                {SUBMISSION_STATUS_LABEL[paper.submissionStatus ?? "submitted"]}
              </Badge>
              <Badge variant="secondary" className="gap-1"><CalendarDays className="size-3" /> {paper.year}</Badge>
              {paper.venue && <Badge variant="outline">{paper.venue}</Badge>}
              {paper.venue && <Badge variant="outline">{bucket.split(" ")[0]}</Badge>}
              {paper.scopusIndexStatus === "indexed" && (
                <Badge variant="outline" className="text-green-600 border-green-600/40">Scopus {paper.scopusIndexYear ?? ""}</Badge>
              )}
              {score > 0 && <Badge variant="secondary" className="font-mono gap-1"><Award className="size-3" /> +{score}</Badge>}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 pt-2 border-t border-border">
            <Field label="Tác giả">{paper.authors || "—"}</Field>
            <Field label="Cá nhân được tính KPI">
              {canEdit && internal.length > 0 ? (
                <div className="space-y-1">
                  <Select
                    value={paper.creditedLecturerId != null ? String(paper.creditedLecturerId) : "none"}
                    onValueChange={handleChangeCredit}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-9 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="cursor-pointer">— Chưa xác định —</SelectItem>
                      {internal.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)} className="cursor-pointer">
                          {l.title}. {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Chọn 1 tác giả nội bộ để tính kết quả KPI (mỗi bài chỉ tính cho 1 người).</p>
                </div>
              ) : credited ? (
                <Link href={`/lecturers/${credited.id}`} className="text-primary hover:underline">{credited.title}. {credited.name}</Link>
              ) : (
                <span className="text-amber-600">Chưa xác định</span>
              )}
              {(paper.isFirstAuthor || paper.isCorrespondingAuthor) && (
                <span className="block text-xs text-muted-foreground mt-1">
                  {paper.isFirstAuthor && "Tác giả chính"}{paper.isFirstAuthor && paper.isCorrespondingAuthor && " · "}{paper.isCorrespondingAuthor && "Tác giả liên hệ"}
                </span>
              )}
            </Field>
            <Field label="Tình trạng Scopus">{STATUS_LABEL[paper.scopusIndexStatus ?? "unknown"]}</Field>
            <Field label="Xếp hạng">{paper.quartile || (paper.venue ? bucket.split(" ")[0] : "—")}</Field>
            {paper.doi && (
              <Field label="DOI">
                <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">{paper.doi} <ExternalLink className="size-3" /></a>
              </Field>
            )}
            {paper.url && (
              <Field label="Liên kết">
                <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><LinkIcon className="size-3" /> Mở bài báo</a>
              </Field>
            )}
          </div>

          {internal.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="eyebrow-sm text-muted-foreground mb-2 inline-flex items-center gap-1"><Users className="size-3" /> Tác giả thuộc Khoa</div>
              <div className="flex flex-wrap gap-2">
                {internal.map((l) => (
                  <Link key={l.id} href={`/lecturers/${l.id}`} className="text-xs rounded-sm border border-border px-2 py-1 hover:border-primary hover:text-primary">
                    {l.title}. {l.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {paper.abstract && (
            <div className="pt-2 border-t border-border">
              <div className="eyebrow-sm text-muted-foreground mb-2">Tóm tắt</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{paper.abstract}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <>
          <PaperFormAdmin
            open={editOpen}
            onOpenChange={setEditOpen}
            onSave={handleSave}
            lecturers={lecturers}
            editingPaper={paper}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Xoá bài báo?"
            description={`"${paper.title}" sẽ bị xoá vĩnh viễn.`}
            confirmLabel="Xoá"
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
