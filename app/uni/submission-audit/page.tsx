import SubmissionAuditClient from "./SubmissionAuditClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Submission Audit">
      <SubmissionAuditClient />
    </ToolErrorBoundary>
  );
}
