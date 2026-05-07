import CoachClient from "./CoachClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Draft Coach">
      <CoachClient />
    </ToolErrorBoundary>
  );
}
