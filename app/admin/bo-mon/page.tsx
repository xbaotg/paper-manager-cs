import { getBoMonSnapshot } from "@/app/actions/bo_mon";
import { BoMonManager } from "../_components/bo-mon-manager";

export default async function BoMonPage() {
  const items = await getBoMonSnapshot();
  return <BoMonManager initial={items} />;
}
