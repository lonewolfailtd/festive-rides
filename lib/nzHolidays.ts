// NZ public holidays + common regional anniversaries.
// Dates are hardcoded for 2026–2028 because parliament publishes them
// well in advance and they don't change. Matariki is the only "computed"
// one — its Friday is set annually by the Matariki Advisory Committee.
// Source: https://www.employment.govt.nz/leave-and-holidays/public-holidays/
//
// Dates are stored as ISO yyyy-mm-dd strings keyed for direct lookup.

export interface NzHoliday {
  date: string; // ISO yyyy-mm-dd
  name: string;
  type: "national" | "regional" | "matariki";
  region?: string; // for regional anniversaries
  notes?: string;
}

export const NZ_HOLIDAYS: NzHoliday[] = [
  // ---- 2026 ----
  { date: "2026-01-01", name: "New Year's Day", type: "national" },
  { date: "2026-01-02", name: "Day after New Year's", type: "national" },
  { date: "2026-01-19", name: "Wellington Anniversary", type: "regional", region: "Wellington" },
  { date: "2026-01-26", name: "Auckland Anniversary", type: "regional", region: "Auckland / Northland" },
  { date: "2026-02-06", name: "Waitangi Day", type: "national" },
  { date: "2026-03-23", name: "Otago Anniversary", type: "regional", region: "Otago" },
  { date: "2026-04-03", name: "Good Friday", type: "national" },
  { date: "2026-04-06", name: "Easter Monday", type: "national" },
  { date: "2026-04-07", name: "Southland Anniversary (Easter Tuesday)", type: "regional", region: "Southland" },
  { date: "2026-04-27", name: "ANZAC Day (observed)", type: "national", notes: "Falls on Saturday 25 Apr, observed Monday" },
  { date: "2026-06-01", name: "King's Birthday", type: "national" },
  { date: "2026-07-10", name: "Matariki", type: "matariki" },
  { date: "2026-10-23", name: "Hawke's Bay Anniversary", type: "regional", region: "Hawke's Bay" },
  { date: "2026-10-26", name: "Labour Day", type: "national" },
  { date: "2026-11-13", name: "Canterbury Show Day", type: "regional", region: "Canterbury" },
  { date: "2026-11-30", name: "Chatham Islands Anniversary", type: "regional", region: "Chatham Islands" },
  { date: "2026-12-01", name: "Westland Anniversary", type: "regional", region: "Westland" },
  { date: "2026-12-14", name: "South Canterbury Anniversary", type: "regional", region: "South Canterbury" },
  { date: "2026-12-25", name: "Christmas Day", type: "national" },
  { date: "2026-12-28", name: "Boxing Day (observed)", type: "national", notes: "Falls on Saturday 26 Dec, observed Monday" },

  // ---- 2027 ----
  { date: "2027-01-01", name: "New Year's Day", type: "national" },
  { date: "2027-01-04", name: "Day after New Year's (observed)", type: "national" },
  { date: "2027-01-25", name: "Wellington Anniversary", type: "regional", region: "Wellington" },
  { date: "2027-02-01", name: "Auckland Anniversary", type: "regional", region: "Auckland / Northland" },
  { date: "2027-02-08", name: "Waitangi Day (observed)", type: "national", notes: "Falls Saturday 6 Feb, observed Monday" },
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

  // ---- 2028 ----
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

// Quick lookup by ISO yyyy-mm-dd. Returns ALL holidays falling on that day
// because regional + national can overlap (e.g. Easter Tuesday is both
// Easter Tuesday and Southland Anniversary).
export function holidaysOn(iso: string): NzHoliday[] {
  return NZ_HOLIDAYS.filter((h) => h.date === iso);
}

// All holidays falling within a yyyy-mm window, inclusive on both ends.
export function holidaysInRange(startIso: string, endIso: string): NzHoliday[] {
  return NZ_HOLIDAYS.filter((h) => h.date >= startIso && h.date <= endIso);
}

// Convert a Date to local-NZ ISO yyyy-mm-dd (no UTC offset surprises).
export function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- iCal (.ics) generation ---------------------------------------------
// Lightweight RFC 5545 emitter. We only need VEVENT for all-day events
// (holidays + assignment due dates) so the surface area is small.
//
// All-day VEVENTs use DATE values (yyyyMMdd) with VALUE=DATE. DTEND is
// exclusive — for a single all-day event on day X, DTEND is X+1.

interface IcsEvent {
  uid: string;
  date: string; // yyyy-mm-dd
  summary: string;
  description?: string;
  category?: string;
}

const escapeIcs = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const isoToIcsDate = (iso: string): string => iso.replace(/-/g, "");

const addDay = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return toIsoDay(dt);
};

// Fold long lines per RFC 5545 (max 75 octets per line).
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

export function buildIcs(events: IcsEvent[]): string {
  const now =
    new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uni Citation Tool//NZ//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Uni assignments and NZ holidays",
    "X-WR-TIMEZONE:Pacific/Auckland",
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
    lines.push("TRANSP:TRANSPARENT"); // doesn't block as "busy"
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
