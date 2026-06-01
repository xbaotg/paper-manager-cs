import { getManagerKpi } from "@/app/actions/kpi";
import { KpiManager } from "../_components/kpi-manager";

export default async function KpiPage() {
  const data = await getManagerKpi();
  return <KpiManager initial={data} />;
}
