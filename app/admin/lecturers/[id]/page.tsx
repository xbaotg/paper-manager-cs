import { notFound } from "next/navigation";
import { requireManager } from "@/lib/dal";
import { buildLecturerProfile } from "@/lib/profile";
import { LecturerProfile } from "@/app/_components/lecturer-profile";

export default async function AdminLecturerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const data = buildLecturerProfile(Number(id));
  if (!data) notFound();
  return <LecturerProfile data={data} backHref="/admin/lecturers" />;
}
