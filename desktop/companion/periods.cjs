'use strict';
const DAY = 86400000;
const HOUR = 3600000;
const key = n => new Date(n).toISOString().slice(0, 10);

// AION 2 Global: daily 07:00 UTC, weekly Wednesday 07:00 UTC.
// Server schedule can change after patches; verify before a public release.
function periods(at = Date.now()) {
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) throw new Error('Invalid time');
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 7);
  const daily = d.getTime() >= today ? today : today - DAY;
  const sinceWednesday = (new Date(daily).getUTCDay() + 4) % 7;
  const weekly = daily - sinceWednesday * DAY;
  return { day: key(daily), week: key(weekly), dailyAt: daily, weeklyAt: weekly,
    nextDaily: daily + DAY, nextWeekly: weekly + 7 * DAY };
}
module.exports = { periods };
