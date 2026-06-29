"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Navbar } from "../../_components/navbar";
import { Footer } from "../../_components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudentSubmissionForm } from "../../_components/student-submission-form";
import { getSubmissionByTokenServer, updateStudentPaperServer } from "../../actions/submissions";
import { type PaperSubmission } from "@/lib/data";

export default function EditSubmissionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  // undefined = loading, null = not found
  const [sub, setSub] = useState<PaperSubmission | null | undefined>(undefined);

  useEffect(() => {
    getSubmissionByTokenServer(token).then(setSub).catch(() => setSub(null));
  }, [token]);

  function copyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success("Đã sao chép đường link."))
      .catch(() => toast.error("Không sao chép được."));
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-2xl">
          {sub === undefined && (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Đang tải…
            </div>
          )}

          {sub === null && (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center space-y-4">
                <h1 className="text-xl font-semibold font-heading">Không tìm thấy bài nộp</h1>
                <p className="text-muted-foreground">Đường link không đúng hoặc bài đã bị xoá.</p>
                <Link href="/nop-bai"><Button variant="outline">Nộp bài mới</Button></Link>
              </CardContent>
            </Card>
          )}

          {sub && (
            <>
              {/* Status + the all-important "save this link" reminder. */}
              {sub.status === "pending" && (
                <Card className="mb-6 border-amber-500/40 bg-amber-500/10">
                  <CardContent className="p-5 space-y-3">
                    <p className="text-sm text-amber-800">
                      Bài của bạn <strong>đang chờ quản trị viên duyệt</strong>. Trong lúc chờ, bạn vẫn có thể
                      chỉnh sửa bên dưới. <strong>Hãy lưu lại đường link này</strong> — đây là cách duy nhất để
                      quay lại sửa bài (không cần đăng nhập).
                    </p>
                    <Button variant="outline" size="sm" onClick={copyLink} className="cursor-pointer">
                      <Copy className="size-4 mr-2" /> Sao chép đường link sửa bài
                    </Button>
                  </CardContent>
                </Card>
              )}

              {sub.status === "approved" && (
                <Card className="mb-6 border-green-500/40 bg-green-500/10">
                  <CardContent className="p-5 flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-green-600 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm text-green-800">
                        Bài đã được <strong>duyệt</strong> và thêm vào hệ thống. Không thể chỉnh sửa thêm.
                      </p>
                      {sub.paperId != null && (
                        <Link href={`/papers/${sub.paperId}`}>
                          <Button variant="outline" size="sm" className="cursor-pointer">
                            <ExternalLink className="size-4 mr-2" /> Xem bài đã đăng
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {sub.status === "rejected" && (
                <Card className="mb-6 border-destructive/40 bg-destructive/10">
                  <CardContent className="p-5 flex items-start gap-3">
                    <XCircle className="size-5 text-destructive mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm text-destructive">Bài đã bị <strong>từ chối</strong>.</p>
                      {sub.reviewerNote && (
                        <p className="text-sm text-muted-foreground">Lý do: {sub.reviewerNote}</p>
                      )}
                      <Link href="/nop-bai" className="inline-block pt-1">
                        <Button variant="outline" size="sm" className="cursor-pointer">Nộp bài mới</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {sub.status === "pending" ? (
                <StudentSubmissionForm
                  mode="edit"
                  initial={sub}
                  onSubmit={async (input) => {
                    await updateStudentPaperServer(token, input);
                    const fresh = await getSubmissionByTokenServer(token);
                    if (fresh) setSub(fresh);
                  }}
                />
              ) : (
                <ReadOnlySummary sub={sub} />
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function ReadOnlySummary({ sub }: { sub: PaperSubmission }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-6 space-y-3">
        <h2 className="text-lg font-semibold font-heading">{sub.title}</h2>
        <p className="text-sm text-muted-foreground">
          {sub.year}
          {sub.venue ? ` · ${sub.venue}` : ""}
        </p>
        <p className="text-sm">{sub.authors}</p>
        {sub.abstract && <p className="text-sm text-muted-foreground whitespace-pre-line">{sub.abstract}</p>}
      </CardContent>
    </Card>
  );
}
