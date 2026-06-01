import { requireLecturer } from "@/lib/dal";
import { getPapersByLecturer } from "@/lib/queries/papers";
import { listLecturers, getLecturerById } from "@/lib/queries/lecturers";
import { getDevelopmentByLecturer, listProgress } from "@/lib/queries/development";
import { getMyKpi } from "@/app/actions/kpi";
import { MeDashboard } from "../_components/me-dashboard";
import { MeKpi } from "../_components/me-kpi";
import { MeDevelopment } from "../_components/me-development";

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
