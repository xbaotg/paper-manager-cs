"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Mail, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { approveSubmissionServer, rejectSubmissionServer } from "../../actions/submissions";
import { SUBMISSION_REVIEW_LABEL, type PaperSubmission } from "@/lib/data";

export function SubmissionsQueue({
  initialPending,
  initialRecent,
}: {
  initialPending: PaperSubmission[];
  initialRecent: PaperSubmission[];
}) {
  const [pending, setPending] = useState(initialPending);
  const [recent, setRecent] = useState(initialRecent);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  async function approve(s: PaperSubmission) {
    setBusyId(s.id);
    try {
      await approveSubmissionServer(s.id);
      setPending((p) => p.filter((x) => x.id !== s.id));
      setRecent((r) => [{ ...s, status: "approved" }, ...r]);
      toast.success("Đã duyệt và thêm vào hệ thống.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(s: PaperSubmission) {
    setBusyId(s.id);
    try {
      await rejectSubmissionServer(s.id, note);
      setPending((p) => p.filter((x) => x.id !== s.id));
      setRecent((r) => [{ ...s, status: "rejected", reviewerNote: note.trim() || undefined }, ...r]);
      setRejectingId(null);
      setNote("");
      toast.success("Đã từ chối.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            Không có bài nào đang chờ duyệt.
          </p>
        )}
        {pending.map((s) => {
          const busy = busyId === s.id;
          return (
            <Card key={s.id} className="border-border/50">
              <CardContent className="p-5 space-y-3">
                <div className="space-y-1">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {s.year}
                    {s.venue ? ` · ${s.venue}` : ""}
                  </p>
                  <p className="text-sm">{s.authors}</p>
                </div>

                {s.abstract && <p className="text-sm text-muted-foreground line-clamp-3">{s.abstract}</p>}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {s.doi && <span>DOI: {s.doi}</span>}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      <ExternalLink className="size-3" /> Link
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" /> {s.submitterName} ({s.submitterEmail})
                  </span>
                  <span>Gửi: {s.createdAt.slice(0, 10)}</span>
                </div>

                {rejectingId === s.id ? (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="Lý do từ chối (sinh viên sẽ thấy qua link sửa bài)…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => reject(s)} className="cursor-pointer">
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4 mr-1" />} Xác nhận từ chối
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setRejectingId(null); setNote(""); }} className="cursor-pointer">
                        Huỷ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" disabled={busy} onClick={() => approve(s)} className="cursor-pointer bg-green-600 text-white hover:bg-green-600/90">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 mr-1" />} Duyệt
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejectingId(s.id); setNote(""); }} className="cursor-pointer">
                      <X className="size-4 mr-1" /> Từ chối
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Đã xử lý gần đây</h2>
          <div className="divide-y rounded-lg border">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge
                  variant="outline"
                  className={s.status === "approved" ? "text-green-600 border-green-600/40" : "text-destructive border-destructive/40"}
                >
                  {SUBMISSION_REVIEW_LABEL[s.status]}
                </Badge>
                <span className="flex-1 truncate">{s.title}</span>
                {s.status === "approved" && s.paperId != null && (
                  <Link href={`/papers/${s.paperId}`} className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
