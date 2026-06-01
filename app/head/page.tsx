import { getHeadKpi } from "@/app/actions/kpi";
import { HeadKpiView } from "./_components/head-kpi-view";

export default async function HeadPage() {
  const data = await getHeadKpi();
  return <HeadKpiView initial={data} />;
}
