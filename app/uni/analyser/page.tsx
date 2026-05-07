import AnalyserClient from "./AnalyserClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Assignment Analyser">
      <AnalyserClient />
    </ToolErrorBoundary>
  );
}
