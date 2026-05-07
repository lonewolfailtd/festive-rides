import CheckerClient from "./CheckerClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function CheckerPage() {
  return (
    <ToolErrorBoundary toolName="AI Checker">
      <CheckerClient />
    </ToolErrorBoundary>
  );
}
