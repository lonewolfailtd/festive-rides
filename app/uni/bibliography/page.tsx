import BibliographyClient from "./BibliographyClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Bibliography Importer">
      <BibliographyClient />
    </ToolErrorBoundary>
  );
}
