import Link from "next/link";
import { Home, ScrollText, ArrowRight } from "lucide-react";
import { requireLecturer } from "@/lib/dal";
import { getPapersByLecturer } from "@/lib/queries/papers";
import { listLecturers, getLecturerById } from "@/lib/queries/lecturers";
import { getDevelopmentByLecturer, listProgress } from "@/lib/queries/development";
import { getMyKpi } from "@/app/actions/kpi";
import { buttonVariants } from "@/components/ui/button";
import { MeDashboard } from "../_components/me-dashboard";
import { MeKpi } from "../_components/me-kpi";
import { MeDevelopment } from "../_components/me-development";
import { AvatarUploader } from "../_components/avatar-uploader";

export default async function MePage() {
  const user = await requireLecturer();
  const lecturerId = user.lecturerId!;
  const myPapers = getPapersByLecturer(lecturerId);
  const lecturers = listLecturers();
  const me = getLecturerById(lecturerId);
  const kpi = await getMyKpi();
  const dev = getDevelopmentByLecturer(lecturerId);
  const devProgress = dev ? listProgress(dev.id) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold font-heading">Trang của tôi</h1>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" }) + " cursor-pointer gap-1.5"}>
          <Home className="size-4" /> Trang chủ
        </Link>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ảnh đại diện</h2>
        <AvatarUploader lecturerId={lecturerId} currentUrl={me?.avatarUrl} name={me?.name ?? user.username} />
      </div>
      <Link href="/me/llkh" className="block rounded-xl border bg-card p-5 hover:bg-muted/40 transition">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ScrollText className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-semibold">Lý lịch khoa học</h2>
              <p className="text-sm text-muted-foreground">Khai báo hồ sơ theo mẫu UIT (8 bước), bài báo tự lấy từ danh mục, rồi xuất PDF/Word.</p>
            </div>
          </div>
          <span className={buttonVariants({ variant: "outline", size: "sm" }) + " cursor-pointer gap-1.5 shrink-0"}>
            Mở <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>
      <MeKpi initial={kpi} />
      <MeDevelopment item={dev} progress={devProgress} />
      <MeDashboard
        lecturerId={lecturerId}
        lecturerName={me?.name ?? user.username}
        initialPapers={myPapers}
        lecturers={lecturers}
      />
    </div>
  );
}
