import { notFound } from "next/navigation";
import { requireHead } from "@/lib/dal";
import { buildLecturerProfile } from "@/lib/profile";
import { LecturerProfile } from "@/app/_components/lecturer-profile";

export default async function HeadLecturerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireHead();
  const { id } = await params;
  const data = buildLecturerProfile(Number(id));
  // Scope: a head may only view lecturers in their own bộ môn.
  if (!data || data.lecturer.boMonId !== me.boMonId) notFound();
  return <LecturerProfile data={data} backHref="/head/lecturers" />;
}
