import { getLlkhAggregate } from "@/app/actions/llkh";
import { LlkhAggregateView } from "../_components/llkh-aggregate-view";

export default async function AdminLlkhPage() {
  const data = await getLlkhAggregate();
  return <LlkhAggregateView initial={data} />;
}
