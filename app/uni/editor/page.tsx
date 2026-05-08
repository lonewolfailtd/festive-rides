import EditorClient from "./EditorClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="NZ Editor">
      <EditorClient />
    </ToolErrorBoundary>
  );
}
