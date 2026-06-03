import { Badge } from "@/components/ui/badge";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_BADGE_CLASS,
  type SubmissionStatus,
} from "@/lib/data";

// Single source of truth for rendering a paper's submission status everywhere
// (lists + detail). Falls back to "submitted" for legacy/missing values.
export function SubmissionStatusBadge({
  status,
  className = "",
}: {
  status: SubmissionStatus | undefined | null;
  className?: string;
}) {
  const s = (status ?? "submitted") as SubmissionStatus;
  return (
    <Badge variant="outline" className={`${SUBMISSION_STATUS_BADGE_CLASS[s]} ${className}`}>
      {SUBMISSION_STATUS_LABEL[s]}
    </Badge>
  );
}
