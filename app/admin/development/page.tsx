import { getDevelopmentSnapshot } from "@/app/actions/development";
import { DevelopmentManager } from "../_components/development-manager";

export default async function DevelopmentPage() {
  const snap = await getDevelopmentSnapshot();
  return <DevelopmentManager initial={snap} />;
}
