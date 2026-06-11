import { notFound } from "next/navigation";
import { STORIES } from "../stories/registry";
import StoryPageClient from "./StoryPageClient";

// Each book lives at its own URL: /surprise/<id> (e.g. /surprise/flight).
// Static sibling routes (unlock/, test/) take precedence over this segment.

export function generateStaticParams() {
  return STORIES.map((s) => ({ storyId: s.id }));
}

export default async function StoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!STORIES.some((s) => s.id === storyId)) notFound();
  return <StoryPageClient id={storyId} />;
}
