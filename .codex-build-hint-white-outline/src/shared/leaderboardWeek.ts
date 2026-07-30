const MONDAY_UTC_DAY_INDEX = 1

export function getLeaderboardWeekStartUtc(now = new Date()): string {
  const midnightUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ))
  const daysSinceMonday = (
    midnightUtc.getUTCDay() - MONDAY_UTC_DAY_INDEX + 7
  ) % 7

  midnightUtc.setUTCDate(midnightUtc.getUTCDate() - daysSinceMonday)
  return midnightUtc.toISOString().slice(0, 10)
}
