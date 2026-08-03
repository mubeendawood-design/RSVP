// Shared .ics calendar-file builder. Used in two places:
//   - components/InviteCard.jsx (client) — demo-mode blob download + the
//     per-event Google/Outlook quick-add links, which reuse the date parser.
//   - app/api/calendar/[token]/route.js (server) — the real guest path: a
//     proper URL serving text/calendar, so phones hand the file straight to
//     the native calendar app instead of the browser's downloads folder.
//
// Events are stored as display strings only (dateNum '11', month 'SEP',
// year '2026', time '6:00 PM') — there's no raw timestamp column in the
// schema. We parse those strings back into wall-clock components and write
// them straight into the .ics text with an explicit TZID, rather than going
// through a real JS Date/toISOString. That means the file always reflects
// the venue's actual UK clock time, regardless of what timezone the guest's
// own phone or browser happens to be set to.

const ICS_MONTH_INDEX = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
export const ICS_EVENT_DURATION_HOURS = 3; // no end-time field yet — reasonable default for a wedding function

export function pad2(n) {
  return String(n).padStart(2, "0");
}

// Turns { dateNum, month, year, time } into a neutral Date object used only
// as a calendar/clock calculator (for adding hours, handling month/day
// rollover) — never treated as a real UTC instant.
export function parseEventDateTime(e) {
  const day = parseInt(e?.dateNum, 10);
  const month = ICS_MONTH_INDEX[String(e?.month || "").toUpperCase()];
  const year = parseInt(e?.year, 10);
  if (!day || month === undefined || !year) return null;

  let hour = 0, minute = 0;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(e?.time || "").trim());
  if (m) {
    hour = parseInt(m[1], 10) % 12;
    minute = parseInt(m[2], 10);
    if (/pm/i.test(m[3])) hour += 12;
  }
  return new Date(Date.UTC(year, month, day, hour, minute));
}

export function formatICSLocal(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00`;
}

function formatICSStamp(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

export function icsEscape(str) {
  return String(str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildICS(events, coupleLabel, token) {
  const stamp = formatICSStamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Haanji//Wedding Invite//EN", "CALSCALE:GREGORIAN"];

  events.forEach((e) => {
    const start = parseEventDateTime(e);
    if (!start) return; // skip events we can't confidently place on a calendar
    const end = new Date(start.getTime() + ICS_EVENT_DURATION_HOURS * 60 * 60 * 1000);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id || e.label}-${token || "guest"}@haanji.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/London:${formatICSLocal(start)}`,
      `DTEND;TZID=Europe/London:${formatICSLocal(end)}`,
      `SUMMARY:${icsEscape(`${coupleLabel} — ${e.label}`)}`
    );
    if (e.venue) lines.push(`LOCATION:${icsEscape(e.venue)}`);
    if (e.maps) lines.push(`DESCRIPTION:${icsEscape(e.maps)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function icsFilename(coupleLabel) {
  return `${(coupleLabel || "wedding").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
}
