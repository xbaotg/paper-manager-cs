import { getReportData } from "@/app/actions/report";
import { ReportView } from "../_components/report-view";

export default async function ReportsPage() {
  const data = await getReportData();
  return <ReportView initial={data} />;
}
