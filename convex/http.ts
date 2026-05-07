import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { buildFeedForUser } from "./_ical";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

auth.addHttpRoutes(http);

// Live calendar subscription endpoint. Path is /ical/<token>.ics so it
// looks like a static file to calendar apps (some are picky about the
// extension). The token IS the auth — no cookies, no session.
//
// We register two paths so both /ical/<token>.ics and /ical/<token>
// work — Apple Calendar in particular is fussy about the .ics suffix.
const icalHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  // path is /ical/<token>(.ics)
  const m = url.pathname.match(/^\/ical\/([A-Za-z0-9_-]+?)(?:\.ics)?$/);
  if (!m) {
    return new Response("Not found", { status: 404 });
  }
  const token = m[1];

  const userId = (await ctx.runQuery(internal.icalSubscription._resolveToken, {
    token,
  })) as Id<"users"> | null;
  if (!userId) {
    return new Response("Subscription revoked or invalid", { status: 404 });
  }

  const assignments = (await ctx.runQuery(
    internal.icalSubscription._assignmentsForUser,
    { userId }
  )) as {
    _id: string;
    name: string;
    courseCode?: string;
    dueDate?: number;
    wordCountTarget?: number;
  }[];

  const ics = buildFeedForUser(assignments);
  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=uni-calendar.ics",
      // Tell intermediate caches to revalidate hourly
      "Cache-Control": "public, max-age=3600",
    },
  });
});

http.route({ pathPrefix: "/ical/", method: "GET", handler: icalHandler });

export default http;
