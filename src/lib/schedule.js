// Trading-window schedule. Mirrors the pg_cron jobs in Supabase:
//   stock-market-close-thursday   0 23 * * 4   (Thursday 23:00 UTC)
//   stock-market-settle-monday    0 10 * * 1   (Monday 10:00 UTC — settle + reopen)
//
// All math is in UTC; callers format for display in the viewer's local zone.

export const CLOSE_DAY_UTC = 4   // Thursday
export const CLOSE_HOUR_UTC = 23
export const OPEN_DAY_UTC = 1    // Monday
export const OPEN_HOUR_UTC = 10

function nextWeeklyUtc(now, day, hour) {
  const d = new Date(now)
  d.setUTCHours(hour, 0, 0, 0)
  let delta = (day - d.getUTCDay() + 7) % 7
  if (delta === 0 && d <= now) delta = 7
  d.setUTCDate(d.getUTCDate() + delta)
  return d
}

export function nextClose(now = new Date()) {
  return nextWeeklyUtc(now, CLOSE_DAY_UTC, CLOSE_HOUR_UTC)
}

export function nextOpen(now = new Date()) {
  return nextWeeklyUtc(now, OPEN_DAY_UTC, OPEN_HOUR_UTC)
}

// "3d 14h", "5h 20m", "12m", or "now"
export function formatCountdown(target, now = new Date()) {
  const ms = target - now
  if (ms <= 0) return 'now'
  const totalMin = Math.floor(ms / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// "Thu 6:00 PM" in the viewer's local zone
export function formatWeekdayTime(date) {
  return date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

// "Mon, Sep 7" in the viewer's local zone
export function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
