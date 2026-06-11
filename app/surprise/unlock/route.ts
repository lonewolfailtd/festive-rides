import { NextResponse } from "next/server";

// Family passcode check for the /surprise storybook. The code lives
// server-side so it never ships in the client bundle. Override via the
// SURPRISE_PASSCODE env var; defaults to the family code.
const PASSCODE = (process.env.SURPRISE_PASSCODE ?? "JuniperRaine").trim();

export async function POST(req: Request) {
  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    // ignore malformed body — treated as wrong code
  }
  const ok = code.trim().toLowerCase() === PASSCODE.toLowerCase();
  return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
