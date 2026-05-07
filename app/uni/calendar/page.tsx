import CalendarClient from "./CalendarClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Calendar">
      <CalendarClient />
    </ToolErrorBoundary>
  );
}
