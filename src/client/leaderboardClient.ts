import { getDogeRoom } from '../shared/messages'
import { copyToClipboard } from '~system/RestrictedActions'

export type LeaderboardPointsAwarded = {
  points: number
  mode: 'solo' | 'multi' | string
  rank: number
  totalScore: number
  soloDailyRemaining: number
  multiDailyRemaining: number
}

export type PublicLeaderboardSnapshot = {
  addresses: string[]
  names: string[]
  scores: number[]
  updatedAt: number
}

let leaderboardClientStarted = false
let latestAward: LeaderboardPointsAwarded | null = null
let latestPublicSnapshot: PublicLeaderboardSnapshot | null = null

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

  getDogeRoom().onMessage('leaderboardSnapshot', (data) => {
    latestPublicSnapshot = {
      addresses: [...data.addresses],
      names: [...data.names],
      scores: [...data.scores],
      updatedAt: Number(data.updatedAt),
    }

    console.log(`[Client][LB] public snapshot received entries=${data.addresses.length} updatedAt=${data.updatedAt}`)
  })

  getDogeRoom().onMessage('leaderboardExportSnapshot', (data) => {
    const csv = createLeaderboardCsv(data.addresses, data.names, data.scores)
    void copyToClipboard({ text: csv })
    console.log(`[Client][LB] CSV export copied entries=${data.addresses.length} updatedAt=${data.updatedAt}`)
  })
}

export function resetLeaderboardAward(): void {
  latestAward = null
}

export function getLatestLeaderboardAward(): LeaderboardPointsAwarded | null {
  return latestAward
}

export function requestPublicLeaderboardSnapshot(reason = 'client-request'): void {
  void getDogeRoom().send('leaderboardSnapshotRequest', { reason })
  console.log(`[Client][LB] public snapshot requested reason=${reason}`)
}

export function getLatestPublicLeaderboardSnapshot(): PublicLeaderboardSnapshot | null {
  return latestPublicSnapshot
}

export function requestLeaderboardCsvExport(): void {
  void getDogeRoom().send('leaderboardExportRequest', { reason: 'owner-export' })
  console.log('[Client][LB] full CSV export requested.')
}

function createLeaderboardCsv(addresses: readonly string[], names: readonly string[], scores: readonly number[]): string {
  const rows = ['rank,walletAddress,displayName,weeklyScore']

  for (let index = 0; index < addresses.length; index += 1) {
    rows.push([
      index + 1,
      addresses[index] ?? '',
      names[index] ?? '',
      scores[index] ?? 0,
    ].map(escapeCsvValue).join(','))
  }

  return rows.join('\n')
}

function escapeCsvValue(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
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
    return `+${latestAward.points} pt (Solo win) | Weekly: ${latestAward.totalScore}`
  }

  return `+${latestAward.points} pts (Rank #${latestAward.rank}) | Weekly: ${latestAward.totalScore}`
}
