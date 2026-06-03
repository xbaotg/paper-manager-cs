import { notFound } from "next/navigation";
import { Navbar } from "@/app/_components/navbar";
import { Footer } from "@/app/_components/footer";
import { getPaperById } from "@/lib/queries/papers";
import { listLecturers } from "@/lib/queries/lecturers";
import { getCurrentUser, canManage } from "@/lib/dal";
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
  // A rejected ("denied") status is private — only admins/head and the paper's
  // own author may see it. For anyone else, strip it so the public detail page
  // shows no submission status for a rejected paper (and it never ships in the
  // payload). Other in-progress statuses stay visible.
  const canViewStatus = !!user && (canManage(user) || user.role === "head" || ownsPaper);
  const safePaper =
    !canViewStatus && paper.submissionStatus === "denied"
      ? { ...paper, submissionStatus: undefined }
      : paper;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <PaperManage paper={safePaper} lecturers={lecturers} canEdit={canEdit} />
        </div>
      </main>
      <Footer />
    </>
  );
}
