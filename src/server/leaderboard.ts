import { Entity, engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { Storage } from '@dcl/sdk/server'

import { getDogeRoom } from '../shared/messages'
import {
  LEADERBOARD_DAILY_STORAGE_KEY,
  LEADERBOARD_STORAGE_KEY,
  LEADERBOARD_TOP_N,
  MULTI_DAILY_CAP,
  MULTI_RANK_POINTS,
  SOLO_DAILY_CAP,
  SOLO_WIN_POINTS,
} from '../shared/leaderboardConfig'
import { rankServerPlayers } from '../shared/leaderboardRanking'
import { Leaderboard } from '../shared/leaderboardSchemas'
import type { LocalRoundEndReason } from '../localMatchState'
import type { ServerPublicPlayerState } from '../shared/serverPublicState'

type PlayerRecord = {
  name: string
  totalScore: number
}

type DailyRecord = {
  dateKey: string
  soloEarned: number
  multiEarned: number
}

type MatchAwardContext = {
  matchId: string
  playerCount: number
  endReason: LocalRoundEndReason
  winnerAddress: string
  publicPlayers: ServerPublicPlayerState[]
}

type AwardedPlayer = Pick<ServerPublicPlayerState, 'address' | 'displayName'>

const scores = new Map<string, PlayerRecord>()
const awardedMatchIds = new Set<string>()
const pendingAwardMatchIds = new Set<string>()

let leaderboardEntity: Entity | null = null
let leaderboardReady: Promise<void> | null = null

export function setupLeaderboardServer(): Promise<void> {
  if (leaderboardReady) return leaderboardReady

  leaderboardEntity = engine.addEntity()
  Leaderboard.create(leaderboardEntity, { names: [], scores: [], updatedAt: Date.now() })
  syncEntity(leaderboardEntity, [Leaderboard.componentId])

  leaderboardReady = loadFromStorage().then(() => {
    publishLeaderboard()
    console.log(`[Server][LB] Ready. Restored ${scores.size} player record(s) from Storage.`)
  })

  return leaderboardReady
}

export async function awardMatchLeaderboardPoints(context: MatchAwardContext): Promise<boolean> {
  try {
    await setupLeaderboardServer()
  } catch (error) {
    console.log(`[Server][LB] Award skipped because Storage did not initialize matchId=${context.matchId}:`, error)
    return false
  }

  if (awardedMatchIds.has(context.matchId) || pendingAwardMatchIds.has(context.matchId)) {
    console.log(`[Server][LB] Skip duplicate award matchId=${context.matchId}`)
    return true
  }

  pendingAwardMatchIds.add(context.matchId)

  try {
    if (context.playerCount <= 1) {
      await awardSoloMatch(context)
    } else {
      await awardMultiMatch(context)
    }

    awardedMatchIds.add(context.matchId)
    return true
  } catch (error) {
    console.log(`[Server][LB] Award persistence failed matchId=${context.matchId}:`, error)
    return false
  } finally {
    pendingAwardMatchIds.delete(context.matchId)
  }
}

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

async function loadDailyRecord(address: string): Promise<DailyRecord> {
  const dateKey = getUtcDateKey()

  try {
    const raw = await Storage.player.get<string>(address, LEADERBOARD_DAILY_STORAGE_KEY)
    if (!raw) return { dateKey, soloEarned: 0, multiEarned: 0 }

    const parsed = JSON.parse(raw) as Partial<DailyRecord>
    if (parsed.dateKey !== dateKey) {
      return { dateKey, soloEarned: 0, multiEarned: 0 }
    }

    return {
      dateKey,
      soloEarned: typeof parsed.soloEarned === 'number' ? parsed.soloEarned : 0,
      multiEarned: typeof parsed.multiEarned === 'number' ? parsed.multiEarned : 0,
    }
  } catch (error) {
    console.log(`[Server][LB] Could not load daily record for ${shortAddress(address)}:`, error)
    return { dateKey, soloEarned: 0, multiEarned: 0 }
  }
}

async function saveDailyRecord(address: string, record: DailyRecord): Promise<boolean> {
  try {
    const persisted = await Storage.player.set(address, LEADERBOARD_DAILY_STORAGE_KEY, JSON.stringify(record))
    if (persisted) return true

    console.log(`[Server][LB] Daily record was rejected for ${shortAddress(address)}`)
    return false
  } catch (error) {
    console.log(`[Server][LB] Could not persist daily record for ${shortAddress(address)}:`, error)
    return false
  }
}

async function awardSoloMatch(context: MatchAwardContext): Promise<void> {
  if (context.endReason !== 'all-doges-eliminated') {
    console.log(`[Server][LB] Solo match ended without win reason=${context.endReason} matchId=${context.matchId}`)
    return
  }

  const winner = context.publicPlayers.find((player) => {
    return normalizeAddress(player.address) === normalizeAddress(context.winnerAddress)
  })

  if (!winner) {
    console.log(`[Server][LB] Solo win skipped, no winner matchId=${context.matchId}`)
    return
  }

  const daily = await loadDailyRecord(winner.address)
  const remaining = Math.max(0, SOLO_DAILY_CAP - daily.soloEarned)
  const points = Math.min(SOLO_WIN_POINTS, remaining)

  if (points <= 0) {
    console.log(`[Server][LB] Solo cap reached address=${shortAddress(winner.address)} matchId=${context.matchId}`)
    sendPointsAwarded(winner.address, {
      points: 0,
      mode: 'solo',
      rank: 1,
      totalScore: getTotalScore(winner.address),
      soloDailyRemaining: 0,
      multiDailyRemaining: Math.max(0, MULTI_DAILY_CAP - daily.multiEarned),
    })
    return
  }

  const totalScore = await commitAward(winner, daily, points, 'solo')

  console.log(`[Server][LB] Solo awarded address=${shortAddress(winner.address)} points=${points} total=${totalScore} matchId=${context.matchId}`)
  sendPointsAwarded(winner.address, {
    points,
    mode: 'solo',
    rank: 1,
    totalScore,
    soloDailyRemaining: Math.max(0, SOLO_DAILY_CAP - daily.soloEarned),
    multiDailyRemaining: Math.max(0, MULTI_DAILY_CAP - daily.multiEarned),
  })
}

async function awardMultiMatch(context: MatchAwardContext): Promise<void> {
  const ranked = rankServerPlayers(context.publicPlayers, context.winnerAddress)

  for (const player of ranked) {
    if (player.rank > MULTI_RANK_POINTS.length) continue

    const requested = MULTI_RANK_POINTS[player.rank - 1] ?? 0
    const daily = await loadDailyRecord(player.address)
    const remaining = Math.max(0, MULTI_DAILY_CAP - daily.multiEarned)
    const points = Math.min(requested, remaining)

    if (points <= 0) {
      console.log(`[Server][LB] Multi cap reached address=${shortAddress(player.address)} rank=${player.rank} matchId=${context.matchId}`)
      sendPointsAwarded(player.address, {
        points: 0,
        mode: 'multi',
        rank: player.rank,
        totalScore: getTotalScore(player.address),
        soloDailyRemaining: Math.max(0, SOLO_DAILY_CAP - daily.soloEarned),
        multiDailyRemaining: 0,
      })
      continue
    }

    const totalScore = await commitAward(player, daily, points, 'multi')

    console.log(`[Server][LB] Multi awarded address=${shortAddress(player.address)} rank=${player.rank} points=${points} total=${totalScore} matchId=${context.matchId}`)
    sendPointsAwarded(player.address, {
      points,
      mode: 'multi',
      rank: player.rank,
      totalScore,
      soloDailyRemaining: Math.max(0, SOLO_DAILY_CAP - daily.soloEarned),
      multiDailyRemaining: Math.max(0, MULTI_DAILY_CAP - daily.multiEarned),
    })
  }
}

function getTotalScore(address: string): number {
  return scores.get(normalizeAddress(address))?.totalScore ?? 0
}

function addScore(address: string, displayName: string, points: number): number {
  const key = normalizeAddress(address)
  const record = scores.get(key) ?? { name: displayName || 'Player', totalScore: 0 }
  record.name = displayName || record.name
  record.totalScore += points
  scores.set(key, record)
  return record.totalScore
}

function publishLeaderboard(): void {
  if (!leaderboardEntity) return

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1].totalScore - a[1].totalScore)
    .slice(0, LEADERBOARD_TOP_N)

  const board = Leaderboard.getMutable(leaderboardEntity)
  board.names = ranked.map(([, record]) => record.name)
  board.scores = ranked.map(([, record]) => record.totalScore)
  board.updatedAt = Date.now()
}

async function loadFromStorage(): Promise<void> {
  const raw = await Storage.get<string>(LEADERBOARD_STORAGE_KEY)
  if (!raw) return

  const entries = JSON.parse(raw) as [string, PlayerRecord][]
  for (const [address, record] of entries) {
    scores.set(normalizeAddress(address), {
      name: record.name || 'Player',
      totalScore: typeof record.totalScore === 'number' ? record.totalScore : 0,
    })
  }
}

async function persistToStorage(): Promise<void> {
  try {
    const persisted = await Storage.set(LEADERBOARD_STORAGE_KEY, JSON.stringify([...scores.entries()]))
    if (persisted) return

    throw new Error('Leaderboard totals were rejected by Storage')
  } catch (error) {
    console.log('[Server][LB] Could not persist leaderboard to Storage:', error)
    throw error
  }
}

async function commitAward(
  player: AwardedPlayer,
  daily: DailyRecord,
  points: number,
  mode: 'solo' | 'multi'
): Promise<number> {
  const previousDaily = { ...daily }
  const currentScore = scores.get(normalizeAddress(player.address))
  const previousScore = currentScore ? { ...currentScore } : undefined

  if (mode === 'solo') {
    daily.soloEarned += points
  } else {
    daily.multiEarned += points
  }

  if (!(await saveDailyRecord(player.address, daily))) {
    throw new Error(`Could not persist daily record for ${shortAddress(player.address)}`)
  }

  const totalScore = addScore(player.address, player.displayName, points)

  try {
    await persistToStorage()
  } catch (error) {
    restoreScore(player.address, previousScore)
    const dailyRolledBack = await saveDailyRecord(player.address, previousDaily)
    if (!dailyRolledBack) {
      console.log(`[Server][LB] Daily rollback failed for ${shortAddress(player.address)}`)
    }
    throw error
  }

  publishLeaderboard()
  return totalScore
}

function restoreScore(address: string, previousScore: PlayerRecord | undefined): void {
  const key = normalizeAddress(address)
  if (previousScore) {
    scores.set(key, previousScore)
  } else {
    scores.delete(key)
  }
}

function sendPointsAwarded(
  address: string,
  payload: {
    points: number
    mode: string
    rank: number
    totalScore: number
    soloDailyRemaining: number
    multiDailyRemaining: number
  }
): void {
  void getDogeRoom().send('leaderboardPointsAwarded', payload, { to: [address] })
}

function shortAddress(address: string): string {
  if (!address || address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
