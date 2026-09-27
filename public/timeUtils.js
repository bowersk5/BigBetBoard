/**
 * Start-time parsing shared between the server (src/consensus.js) and the
 * browser (public/app.js). Both sides need to turn a game's start time —
 * either an ISO string or a Covers-style display string like
 * "Sat, Aug 29 • 7:15 PM ET" — into a UTC epoch timestamp. This used to be
 * implemented twice (once per side) and had quietly drifted apart; keeping
 * one copy here means a fix only has to be made once.
 *
 * This file lives in public/ (not src/) so the browser can load it as a
 * plain ES module (`import ... from "./timeUtils.js"`) the same way it
 * loads app.js. The server imports it too, via a relative path — Node
 * doesn't care that the file happens to live under public/.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DISPLAY_TIME_PATTERN =
  /(?:[A-Za-z]{3,9},\s*)?([A-Za-z]{3,9})\s+(\d{1,2})\s*•?\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET/i;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export function monthIndexFromName(monthName) {
  return MONTHS.indexOf(`${monthName}`.slice(0, 3).toLowerCase());
}

/** Convert Eastern-time wall-clock components to a UTC epoch timestamp, correcting for DST. */
export function easternTimeToUtc(year, monthIndex, day, hour, minute) {
  let timestamp = Date.UTC(year, monthIndex, day, hour, minute);
  for (let i = 0; i < 2; i += 1) {
    timestamp = Date.UTC(year, monthIndex, day, hour, minute) - timeZoneOffset(timestamp, "America/New_York");
  }
  return timestamp;
}

function timeZoneOffset(timestamp, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(values.year, Number(values.month) - 1, values.day, values.hour, values.minute, values.second) - timestamp;
  } catch {
    return 0;
  }
}

/**
 * Parse a Covers-style display time such as "Sat, Aug 29 • 7:15 PM ET" into
 * a UTC epoch millisecond timestamp. Returns NaN when the value is missing
 * or unrecognized.
 *
 * The string has no year, so one is inferred from `now`: if the naive
 * same-year timestamp lands more than a week in the past, the year rolls
 * forward; if it lands more than six months in the future, it rolls back.
 * This keeps last-minute doubleheader games (in the recent past) and
 * far-future schedule releases from being misread as the wrong year.
 */
export function parseDisplayTimeMillis(value, now = Date.now()) {
  const match = `${value || ""}`.match(DISPLAY_TIME_PATTERN);
  if (!match) return NaN;

  const monthIndex = monthIndexFromName(match[1]);
  if (monthIndex < 0) return NaN;

  const year = new Date(now).getFullYear();
  const day = Number(match[2]);
  let hour = Number(match[3]) % 12;
  if (match[5].toUpperCase() === "PM") hour += 12;
  const minute = Number(match[4]);

  let timestamp = easternTimeToUtc(year, monthIndex, day, hour, minute);
  if (timestamp < now - SEVEN_DAYS_MS) {
    timestamp = easternTimeToUtc(year + 1, monthIndex, day, hour, minute);
  } else if (timestamp > now + SIX_MONTHS_MS) {
    timestamp = easternTimeToUtc(year - 1, monthIndex, day, hour, minute);
  }
  return timestamp;
}

/**
 * Parse any supported start-time value — an ISO string or a Covers display
 * string — into a UTC epoch millisecond timestamp. Returns NaN when the
 * value is missing or unrecognized; callers decide their own fallback
 * (the server treats an unknown time as "no time", the UI treats it as
 * "far future" so the card still displays instead of disappearing).
 */
export function startTimeMillis(value) {
  if (!value) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  return parseDisplayTimeMillis(value);
}
