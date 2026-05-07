import SourcesClient from "./SourcesClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function SourcesPage() {
  return (
    <ToolErrorBoundary toolName="Source Finder">
      <SourcesClient />
    </ToolErrorBoundary>
  );
}
