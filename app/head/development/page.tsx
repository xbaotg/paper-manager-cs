import { getHeadDevelopment } from "@/app/actions/development";
import { HeadDevelopmentView } from "../_components/head-development-view";

export default async function HeadDevelopmentPage() {
  const data = await getHeadDevelopment();
  return <HeadDevelopmentView data={data} />;
}
