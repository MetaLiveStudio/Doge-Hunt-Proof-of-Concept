export const SOLO_WIN_POINTS = 1
export const SOLO_DAILY_CAP = 10
export const MULTI_RANK_POINTS = [20, 10, 5, 3] as const
export const MULTI_DAILY_CAP = 100
export const LEADERBOARD_TOP_N = 100
export const LEADERBOARD_PAGE_SIZE = 10
export const DOGE_HUNT_ADMIN_ADDRESSES = [
  '0x797066a17f83425c1b4c7a8cca52d19095520a52',
  '0x1b7a738a4aacbd3fbe1000795f2bae3377e0431d',
  '0x9b3ae2dd9eaad174cf5700420d4861a5a73a2d2a',
] as const

export function isDogeHuntAdmin(address: string): boolean {
  return DOGE_HUNT_ADMIN_ADDRESSES.includes(address.trim().toLowerCase() as typeof DOGE_HUNT_ADMIN_ADDRESSES[number])
}
export const LEADERBOARD_STORAGE_KEY = 'leaderboard:weekly:v1'
export const LEADERBOARD_DAILY_STORAGE_KEY = 'daily'
export const LEADERBOARD_ROLLOVER_CHECK_SECONDS = 30
