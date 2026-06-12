import { notFound } from "next/navigation";
import { requireManager } from "@/lib/dal";
import { getLlkhForLecturer } from "@/app/actions/llkh";
import { LlkhEditor } from "@/app/_components/llkh-editor";

// Admin/manager view: edit + export any lecturer's Lý lịch khoa học.
export default async function AdminLecturerLlkhPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const lecturerId = Number(id);
  if (!Number.isFinite(lecturerId)) notFound();

  let data;
  try {
    data = await getLlkhForLecturer(lecturerId);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <LlkhEditor
        initial={data}
        lecturerId={lecturerId}
        backHref={`/admin/lecturers/${lecturerId}`}
        backLabel="Về hồ sơ giảng viên"
      />
    </div>
  );
}
