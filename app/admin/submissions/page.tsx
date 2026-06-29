import { listSubmissions } from "@/lib/queries/submissions";
import { SubmissionsQueue } from "../_components/submissions-queue";

// The /admin layout already gates this area to managers (requireAdminArea).
export default function AdminSubmissionsPage() {
  const pending = listSubmissions("pending");
  const recent = listSubmissions().filter((s) => s.status !== "pending").slice(0, 30);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold font-heading">Bài sinh viên chờ duyệt</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bài do sinh viên tự nộp (không có giảng viên đứng tên). Duyệt để thêm vào hệ thống —
          KPI được tính về Khoa. Từ chối nếu không hợp lệ.
        </p>
      </div>
      <SubmissionsQueue initialPending={pending} initialRecent={recent} />
    </div>
  );
}
