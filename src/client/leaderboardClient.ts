import { getDogeRoom } from '../shared/messages'

export type LeaderboardPointsAwarded = {
  points: number
  mode: 'solo' | 'multi' | string
  rank: number
  totalScore: number
  soloDailyRemaining: number
  multiDailyRemaining: number
}

let leaderboardClientStarted = false
let latestAward: LeaderboardPointsAwarded | null = null

export function setupLeaderboardClient(): void {
  if (leaderboardClientStarted) return
  leaderboardClientStarted = true

  getDogeRoom().onMessage('leaderboardPointsAwarded', (data) => {
    latestAward = {
      points: data.points,
      mode: data.mode,
      rank: data.rank,
      totalScore: data.totalScore,
      soloDailyRemaining: data.soloDailyRemaining,
      multiDailyRemaining: data.multiDailyRemaining,
    }

    console.log(`[Client][LB] pointsAwarded points=${data.points} mode=${data.mode} rank=${data.rank} total=${data.totalScore}`)
  })
}

export function resetLeaderboardAward(): void {
  latestAward = null
}

export function getLatestLeaderboardAward(): LeaderboardPointsAwarded | null {
  return latestAward
}

export function getLeaderboardAwardLabel(): string {
  if (!latestAward) return ''

  if (latestAward.points <= 0) {
    if (latestAward.mode === 'solo') {
      return 'Daily solo points cap reached (10/day)'
    }
    return 'Daily multiplayer points cap reached (100/day)'
  }

  if (latestAward.mode === 'solo') {
    return `+${latestAward.points} pt (Solo win) | Total: ${latestAward.totalScore}`
  }

  return `+${latestAward.points} pts (Rank #${latestAward.rank}) | Total: ${latestAward.totalScore}`
}
