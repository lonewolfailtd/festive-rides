import ArticleQAClient from "./ArticleQAClient";
import { ToolErrorBoundary } from "../ToolErrorBoundary";

export default function Page() {
  return (
    <ToolErrorBoundary toolName="Article Q&A">
      <ArticleQAClient />
    </ToolErrorBoundary>
  );
}
