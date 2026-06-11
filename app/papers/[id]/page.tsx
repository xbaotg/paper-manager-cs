import { notFound } from "next/navigation";
import { Navbar } from "@/app/_components/navbar";
import { Footer } from "@/app/_components/footer";
import { getPaperById } from "@/lib/queries/papers";
import { listLecturers } from "@/lib/queries/lecturers";
import { getCurrentUser, canManage } from "@/lib/dal";
import { countsAsPublication } from "@/lib/data";
import { PaperManage } from "@/app/_components/paper-manage";

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = getPaperById(Number(id));
  if (!paper) notFound();

  const lecturers = listLecturers();
  const user = await getCurrentUser();
  const ownsPaper =
    !!user && user.role === "lecturer" && user.lecturerId != null && paper.lecturerIds.includes(user.lecturerId);
  // Managers manage any paper; a lecturer manages only papers they author.
  const canEdit = !!user && (user.role === "manager" || ownsPaper);
  // Only accepted/published papers are public. In-progress submissions and
  // rejected papers are private — visible only to admins/head and the paper's
  // own author. Everyone else gets a 404 (the un-accepted paper never ships).
  const canViewNonPublic = !!user && (canManage(user) || user.role === "head" || ownsPaper);
  if (!canViewNonPublic && !countsAsPublication(paper.submissionStatus)) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <PaperManage paper={paper} lecturers={lecturers} canEdit={canEdit} />
        </div>
      </main>
      <Footer />
    </>
  );
}
