import ReaderClient from "./ReaderClient";
import { ToolErrorBoundary } from "../../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Source Reader">
      <ReaderClient />
    </ToolErrorBoundary>
  );
}
