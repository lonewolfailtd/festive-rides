import CitationsClient from "./CitationsClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Citation Extractor">
      <CitationsClient />
    </ToolErrorBoundary>
  );
}
