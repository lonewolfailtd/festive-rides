// Server-side copy of the holiday list + .ics builder. Convex can't import
// from app/lib because its bundler is scoped to the convex/ directory, so
// this file mirrors lib/nzHolidays.ts.
//
// Files prefixed with _ are not exposed as Convex functions — they're just
// helpers for the http route in this directory.
//
// KEEP IN SYNC with lib/nzHolidays.ts when holiday dates need updating.

interface NzHoliday {
  date: string; // ISO yyyy-mm-dd
  name: string;
  type: "national" | "regional" | "matariki";
  region?: string;
  notes?: string;
}

export const NZ_HOLIDAYS: NzHoliday[] = [
  // 2026
  { date: "2026-01-01", name: "New Year's Day", type: "national" },
  { date: "2026-01-02", name: "Day after New Year's", type: "national" },
  { date: "2026-01-19", name: "Wellington Anniversary", type: "regional", region: "Wellington" },
  { date: "2026-01-26", name: "Auckland Anniversary", type: "regional", region: "Auckland / Northland" },
  { date: "2026-02-06", name: "Waitangi Day", type: "national" },
  { date: "2026-03-23", name: "Otago Anniversary", type: "regional", region: "Otago" },
  { date: "2026-04-03", name: "Good Friday", type: "national" },
  { date: "2026-04-06", name: "Easter Monday", type: "national" },
  { date: "2026-04-07", name: "Southland Anniversary (Easter Tuesday)", type: "regional", region: "Southland" },
  { date: "2026-04-27", name: "ANZAC Day (observed)", type: "national" },
  { date: "2026-06-01", name: "King's Birthday", type: "national" },
  { date: "2026-07-10", name: "Matariki", type: "matariki" },
  { date: "2026-10-23", name: "Hawke's Bay Anniversary", type: "regional", region: "Hawke's Bay" },
  { date: "2026-10-26", name: "Labour Day", type: "national" },
  { date: "2026-11-13", name: "Canterbury Show Day", type: "regional", region: "Canterbury" },
  { date: "2026-11-30", name: "Chatham Islands Anniversary", type: "regional", region: "Chatham Islands" },
  { date: "2026-12-01", name: "Westland Anniversary", type: "regional", region: "Westland" },
  { date: "2026-12-14", name: "South Canterbury Anniversary", type: "regional", region: "South Canterbury" },
  { date: "2026-12-25", name: "Christmas Day", type: "national" },
  { date: "2026-12-28", name: "Boxing Day (observed)", type: "national" },
  // 2027
  { date: "2027-01-01", name: "New Year's Day", type: "national" },
  { date: "2027-01-04", name: "Day after New Year's (observed)", type: "national" },
  { date: "2027-01-25", name: "Wellington Anniversary", type: "regional", region: "Wellington" },
  { date: "2027-02-01", name: "Auckland Anniversary", type: "regional", region: "Auckland / Northland" },
  { date: "2027-02-08", name: "Waitangi Day (observed)", type: "national" },
  { date: "2027-03-22", name: "Otago Anniversary", type: "regional", region: "Otago" },
  { date: "2027-03-26", name: "Good Friday", type: "national" },
  { date: "2027-03-29", name: "Easter Monday", type: "national" },
  { date: "2027-03-30", name: "Southland Anniversary (Easter Tuesday)", type: "regional", region: "Southland" },
  { date: "2027-04-26", name: "ANZAC Day (observed)", type: "national" },
  { date: "2027-06-07", name: "King's Birthday", type: "national" },
  { date: "2027-06-25", name: "Matariki", type: "matariki" },
  { date: "2027-10-22", name: "Hawke's Bay Anniversary", type: "regional", region: "Hawke's Bay" },
  { date: "2027-10-25", name: "Labour Day", type: "national" },
  { date: "2027-11-12", name: "Canterbury Show Day", type: "regional", region: "Canterbury" },
  { date: "2027-11-29", name: "Chatham Islands Anniversary", type: "regional", region: "Chatham Islands" },
  { date: "2027-11-30", name: "Westland Anniversary", type: "regional", region: "Westland" },
  { date: "2027-12-13", name: "South Canterbury Anniversary", type: "regional", region: "South Canterbury" },
  { date: "2027-12-27", name: "Christmas Day (observed)", type: "national" },
  { date: "2027-12-28", name: "Boxing Day (observed)", type: "national" },
  // 2028
  { date: "2028-01-03", name: "New Year's Day (observed)", type: "national" },
  { date: "2028-01-04", name: "Day after New Year's (observed)", type: "national" },
  { date: "2028-01-24", name: "Wellington Anniversary", type: "regional", region: "Wellington" },
  { date: "2028-01-31", name: "Auckland Anniversary", type: "regional", region: "Auckland / Northland" },
  { date: "2028-02-07", name: "Waitangi Day (observed)", type: "national" },
  { date: "2028-03-23", name: "Otago Anniversary", type: "regional", region: "Otago" },
  { date: "2028-04-14", name: "Good Friday", type: "national" },
  { date: "2028-04-17", name: "Easter Monday", type: "national" },
  { date: "2028-04-18", name: "Southland Anniversary (Easter Tuesday)", type: "regional", region: "Southland" },
  { date: "2028-04-25", name: "ANZAC Day", type: "national" },
  { date: "2028-06-05", name: "King's Birthday", type: "national" },
  { date: "2028-07-14", name: "Matariki", type: "matariki" },
  { date: "2028-10-20", name: "Hawke's Bay Anniversary", type: "regional", region: "Hawke's Bay" },
  { date: "2028-10-23", name: "Labour Day", type: "national" },
  { date: "2028-11-10", name: "Canterbury Show Day", type: "regional", region: "Canterbury" },
  { date: "2028-11-27", name: "Chatham Islands Anniversary", type: "regional", region: "Chatham Islands" },
  { date: "2028-12-01", name: "Westland Anniversary", type: "regional", region: "Westland" },
  { date: "2028-12-11", name: "South Canterbury Anniversary", type: "regional", region: "South Canterbury" },
  { date: "2028-12-25", name: "Christmas Day", type: "national" },
  { date: "2028-12-26", name: "Boxing Day", type: "national" },
];

interface IcsEvent {
  uid: string;
  date: string; // yyyy-mm-dd
  summary: string;
  description?: string;
  category?: string;
}

const escapeIcs = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const isoToIcsDate = (iso: string): string => iso.replace(/-/g, "");

function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const addDay = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDay(new Date(y, m - 1, d + 1));
};

const fold = (line: string): string => {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return chunks.join("\r\n");
};

interface IcsEventExt extends IcsEvent {
  // If true, attach a 24-hour-before VALARM (display + audio) — used for
  // assignment due-date events. Holiday events don't get reminders.
  remindDayBefore?: boolean;
}

export function buildIcs(events: IcsEventExt[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uni Citation Tool//NZ//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Uni assignments and NZ holidays",
    "X-WR-TIMEZONE:Pacific/Auckland",
    // Tell calendar apps to refresh hourly. Most clients ignore this and
    // set their own cadence (Google polls every few hours), but it's a hint.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${e.uid}`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${isoToIcsDate(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${isoToIcsDate(addDay(e.date))}`);
    lines.push(fold(`SUMMARY:${escapeIcs(e.summary)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeIcs(e.description)}`));
    if (e.category) lines.push(fold(`CATEGORIES:${escapeIcs(e.category)}`));
    lines.push("TRANSP:TRANSPARENT");
    if (e.remindDayBefore) {
      // 24-hour-before alarm. -PT24H from the event start (which is
      // midnight on the due day). Apple/Google display the trigger the
      // previous morning local time.
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(fold(`DESCRIPTION:Reminder — ${escapeIcs(e.summary)}`));
      lines.push("TRIGGER:-PT24H");
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function buildFeedForUser(
  assignments: {
    _id: string;
    name: string;
    courseCode?: string;
    dueDate?: number;
    wordCountTarget?: number;
    submittedAt?: number;
    grade?: number;
    gradeLetter?: string;
  }[]
): string {
  const events: IcsEventExt[] = [];
  for (const h of NZ_HOLIDAYS) {
    events.push({
      uid: `nz-holiday-${h.date}-${h.name.replace(/\W+/g, "")}@uni-citation`,
      date: h.date,
      summary: h.name,
      description: h.region ? `${h.region} regional anniversary.` : h.notes,
      category:
        h.type === "national"
          ? "Public Holiday"
          : h.type === "matariki"
            ? "Matariki"
            : "Regional Anniversary",
    });
  }
  for (const a of assignments) {
    if (!a.dueDate) continue;
    const submitted = a.submittedAt !== undefined;
    const gradeBit =
      a.grade !== undefined
        ? ` (${a.grade}%${a.gradeLetter ? `, ${a.gradeLetter}` : ""})`
        : a.gradeLetter
          ? ` (${a.gradeLetter})`
          : "";
    const summary = submitted
      ? `✓ ${a.courseCode ? `${a.courseCode}: ` : ""}${a.name}${gradeBit}`
      : `${a.courseCode ? `${a.courseCode}: ` : ""}${a.name} — DUE`;
    const descriptionParts: string[] = [];
    if (a.wordCountTarget) descriptionParts.push(`Target: ${a.wordCountTarget} words.`);
    if (submitted) descriptionParts.push(`Submitted ${new Date(a.submittedAt!).toLocaleDateString("en-NZ")}.`);
    events.push({
      uid: `assignment-${a._id}@uni-citation`,
      date: toIsoDay(new Date(a.dueDate)),
      summary,
      description: descriptionParts.length > 0 ? descriptionParts.join(" ") : undefined,
      category: submitted ? "Submitted Assignment" : "Assignment",
      // Only remind for unsubmitted assignments — no point pinging them
      // about something they've already turned in.
      remindDayBefore: !submitted,
    });
  }
  return buildIcs(events);
}
