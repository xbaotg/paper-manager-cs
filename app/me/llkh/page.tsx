import { getMyLlkh } from "@/app/actions/llkh";
import { LlkhEditor } from "@/app/_components/llkh-editor";

export default async function MeLlkhPage() {
  const data = await getMyLlkh();
  return (
    <div className="max-w-5xl mx-auto">
      <LlkhEditor initial={data} />
    </div>
  );
}
