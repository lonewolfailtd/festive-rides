import UnpackClient from "./UnpackClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Question Unpacker">
      <UnpackClient />
    </ToolErrorBoundary>
  );
}
