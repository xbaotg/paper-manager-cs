import { requireManager } from "@/lib/dal";
import { DataManager } from "../_components/data-manager";

export default async function AdminDataPage() {
  await requireManager();
  return <DataManager />;
}
