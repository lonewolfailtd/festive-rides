import ReferencesManager from "./ReferencesManager";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function ReferencesPage() {
  return (
    <ToolErrorBoundary toolName="References">
      <ReferencesManager />
    </ToolErrorBoundary>
  );
}
