import PlagiarismClient from "./PlagiarismClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function PlagiarismPage() {
  return (
    <ToolErrorBoundary toolName="Plagiarism Self-Check">
      <PlagiarismClient />
    </ToolErrorBoundary>
  );
}
