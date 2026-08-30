import type { PublicDogeState } from '../localMatchState'
import type { LocalRoundEndReason } from '../localMatchState'

export const SERVER_ROUND_DURATION_SECONDS = 180

export type ServerPlayerStatus = 'active' | 'out' | 'spectator'

export type ServerPublicPlayerPose = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

export type ServerPublicPlayerState = {
  playerId: string
  displayName: string
  address: string
  publicDogeId: string
  isHost: boolean
  isAlive: boolean
  status: ServerPlayerStatus
  bonks: number
  eliminatedByDisplayName?: string
  pose?: ServerPublicPlayerPose
  eliminationOrder?: number
  eliminatedAtSeconds?: number
}

export type ServerPublicMatchPhase = 'active' | 'ended'

export type ServerPublicMatchSnapshot = {
  source: 'server'
  matchId: string
  version: number
  reason: string
  phase: ServerPublicMatchPhase
  totalDoges: number
  playerCount: number
  decoyNpcCount: number
  publicDoges: PublicDogeState[]
  players: ServerPublicPlayerState[]
  publicAliveDoges: number
  targetDogesAlive: number
  targetDogesTotal: number
  elapsedSeconds: number
  timeLeftSeconds: number
  roundOver: boolean
  endReason: LocalRoundEndReason | ''
  winnerAddress: string
  winnerDisplayName: string
  winnerPublicDogeId: string
}

export function parseServerPublicMatchSnapshot(snapshotJson: string): ServerPublicMatchSnapshot | null {
  try {
    const parsed = JSON.parse(snapshotJson) as Partial<ServerPublicMatchSnapshot>

    if (!isRecord(parsed)) return null
    if (parsed.source !== 'server') return null
    if (typeof parsed.matchId !== 'string') return null
    if (typeof parsed.version !== 'number') return null
    if (typeof parsed.reason !== 'string') return null
    if (parsed.phase !== 'active' && parsed.phase !== 'ended') return null
    if (typeof parsed.totalDoges !== 'number') return null
    if (typeof parsed.playerCount !== 'number') return null
    if (typeof parsed.decoyNpcCount !== 'number') return null
    if (!Array.isArray(parsed.publicDoges)) return null
    if (!Array.isArray(parsed.players)) return null
    if (typeof parsed.publicAliveDoges !== 'number') return null
    if (typeof parsed.targetDogesAlive !== 'number') return null
    if (typeof parsed.targetDogesTotal !== 'number') return null
    if (typeof parsed.elapsedSeconds !== 'number') return null
    if (typeof parsed.timeLeftSeconds !== 'number') return null
    if (typeof parsed.roundOver !== 'boolean') return null

    const players = normalizeServerPublicPlayers(parsed.players)
    if (!players) return null
    const endReason = isServerRoundEndReason(parsed.endReason) ? parsed.endReason : ''

    return {
      ...parsed,
      players,
      endReason,
      winnerAddress: typeof parsed.winnerAddress === 'string' ? parsed.winnerAddress : '',
      winnerDisplayName: typeof parsed.winnerDisplayName === 'string' ? parsed.winnerDisplayName : '',
      winnerPublicDogeId: typeof parsed.winnerPublicDogeId === 'string' ? parsed.winnerPublicDogeId : '',
    } as ServerPublicMatchSnapshot
  } catch (error) {
    console.log('[Shared][R] Failed to parse server public snapshot:', error)
    return null
  }
}

export function countAlivePublicDoges(publicDoges: PublicDogeState[]): number {
  return publicDoges.filter((doge) => !doge.isEliminated).length
}

export function countAliveTargetDoges(
  publicDoges: PublicDogeState[],
  playerCount: number,
  decoyNpcCount: number
): number {
  return publicDoges
    .slice(playerCount, playerCount + decoyNpcCount)
    .filter((doge) => !doge.isEliminated).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeServerPublicPlayers(players: unknown[]): ServerPublicPlayerState[] | null {
  const normalized: ServerPublicPlayerState[] = []

  for (const entry of players) {
    if (!isRecord(entry)) return null
    if (typeof entry.playerId !== 'string') return null
    if (typeof entry.displayName !== 'string') return null
    if (typeof entry.address !== 'string') return null
    if (typeof entry.publicDogeId !== 'string') return null
    if (typeof entry.isHost !== 'boolean') return null
    if (typeof entry.isAlive !== 'boolean') return null
    if (typeof entry.bonks !== 'number') return null

    const status = isServerPlayerStatus(entry.status)
      ? entry.status
      : entry.isAlive
        ? 'active'
        : 'out'

    normalized.push({
      playerId: entry.playerId,
      displayName: entry.displayName,
      address: entry.address,
      publicDogeId: entry.publicDogeId,
      isHost: entry.isHost,
      isAlive: entry.isAlive,
      status,
      bonks: entry.bonks,
      eliminatedByDisplayName: typeof entry.eliminatedByDisplayName === 'string'
        ? entry.eliminatedByDisplayName
        : '',
      pose: parseServerPublicPlayerPose(entry.pose),
      eliminationOrder: typeof entry.eliminationOrder === 'number' ? entry.eliminationOrder : 0,
      eliminatedAtSeconds: typeof entry.eliminatedAtSeconds === 'number' ? entry.eliminatedAtSeconds : 0,
    })
  }

  return normalized
}

function parseServerPublicPlayerPose(value: unknown): ServerPublicPlayerPose | undefined {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.rotation)) return undefined

  const { position, rotation } = value
  if (
    typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number' ||
    typeof rotation.x !== 'number' || typeof rotation.y !== 'number' ||
    typeof rotation.z !== 'number' || typeof rotation.w !== 'number'
  ) return undefined

  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
  }
}

function isServerPlayerStatus(status: unknown): status is ServerPlayerStatus {
  return status === 'active' || status === 'out' || status === 'spectator'
}

function isServerRoundEndReason(reason: unknown): reason is LocalRoundEndReason {
  return reason === 'all-doges-eliminated' || reason === 'time-up' || reason === 'final-survivor'
}
