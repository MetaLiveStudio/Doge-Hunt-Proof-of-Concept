import type { LocalRoundEndReason } from '../localMatchState'

export const SERVER_TURN_TO_ROCK_DURATION_SECONDS = 5
export const SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS = 15

export type SerializableVector3 = {
  x: number
  y: number
  z: number
}

export type ServerBonkRequestPlatform = 'desktop' | 'mobile'

export type ServerBonkRequestPayload = {
  requestId: string
  matchId: string
  targetPublicDogeId: string
  aimedPlayerPublicDogeId: string
  origin: SerializableVector3
  yawDegrees: number
  aimYawDegrees: number
  platform: ServerBonkRequestPlatform
  source: 'attack' | 'debug-eliminate-all'
}

export type ServerBonkActionRequestPayload = {
  requestId: string
  matchId: string
  playerId: string
  origin: SerializableVector3
  yawDegrees: number
}

export type ServerBonkActionEventPayload = {
  eventId: string
  matchId: string
  playerId: string
  address: string
  origin: SerializableVector3
  yawDegrees: number
}

export type ServerBonkRejectReason =
  | 'missing-match'
  | 'match-ended'
  | 'missing-player'
  | 'eliminated'
  | 'invalid-target'
  | 'self-target'
  | 'already-eliminated'

export type ServerBonkResultPayload = {
  requestId: string
  matchId: string
  outcome: 'accepted' | 'rejected'
  reason: ServerBonkRejectReason | ''
  targetPublicDogeId: string
  origin: SerializableVector3
  bonks: number
  targetDogesAlive: number
  targetDogesTotal: number
  roundOver: boolean
  serverPlatform?: ServerBonkRequestPlatform
  validatedRange?: number
  validatedRadius?: number
}

export type ServerTurnToRockRequestPayload = {
  requestId: string
  matchId: string
  playerId: string
  position: SerializableVector3
  yawDegrees: number
}

export type ServerTurnToRockRejectReason =
  | 'missing-match'
  | 'match-ended'
  | 'missing-player'
  | 'eliminated'
  | 'already-active'
  | 'cooldown'

export type ServerTurnToRockResultPayload = {
  requestId: string
  matchId: string
  outcome: 'activated' | 'rejected'
  reason: ServerTurnToRockRejectReason | ''
  playerId: string
  position: SerializableVector3
  yawDegrees: number
  durationSeconds: number
  cooldownSeconds: number
}

export type ServerRoundEndRequestPayload = {
  requestId: string
  matchId: string
  reason: LocalRoundEndReason
  bonks: number
  aliveDoges: number
  totalDoges: number
  timeLeftSeconds: number
  elapsedSeconds: number
}

export type ServerRoundEndRejectReason =
  | 'missing-match'
  | 'round-not-over'
  | 'invalid-reason'

export type ServerRoundEndResultPayload = {
  requestId: string
  matchId: string
  outcome: 'accepted' | 'rejected'
  reason: LocalRoundEndReason | ServerRoundEndRejectReason
  bonks: number
  aliveDoges: number
  totalDoges: number
  timeLeftSeconds: number
  elapsedSeconds: number
  roundOver: boolean
}

export type ServerDebugMarkOutRequestPayload = {
  requestId: string
  matchId: string
  reason: 'debug-self-out'
}

export type ServerDebugMarkOutResultPayload = {
  requestId: string
  matchId: string
  outcome: 'accepted' | 'rejected'
  reason: '' | 'missing-match' | 'missing-player' | 'match-ended'
  playerId: string
  publicDogeId: string
  status: 'active' | 'out' | 'spectator'
}

export type ServerDebugEliminateAllRequestPayload = {
  requestId: string
  matchId: string
  reason: 'debug-eliminate-all'
}

export type ServerDebugEliminateAllResultPayload = {
  requestId: string
  matchId: string
  outcome: 'accepted' | 'rejected'
  reason: '' | 'unauthorized' | 'missing-match' | 'match-ended'
  eliminatedCount: number
  roundOver: boolean
}

export type ServerDebugForceRoundEndRequestPayload = {
  requestId: string
  matchId: string
  reason: 'debug-force-round-end'
}

export type ServerDebugForceRoundEndResultPayload = {
  requestId: string
  matchId: string
  outcome: 'accepted' | 'rejected'
  reason: '' | 'missing-match' | 'match-ended'
  roundOver: boolean
}

export type ServerDebugNpcFreezeRequestPayload = {
  requestId: string
  matchId: string
  reason: 'debug-toggle-npc-freeze'
}

export type ServerDebugNpcFreezeResultPayload = {
  requestId: string
  matchId: string
  outcome: 'accepted' | 'rejected'
  reason: '' | 'unauthorized' | 'missing-match' | 'match-ended'
  isFrozen: boolean
}

export function parseServerBonkRequestPayload(payloadJson: string): ServerBonkRequestPayload | null {
  const parsed = parsePayload<ServerBonkRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (typeof parsed.targetPublicDogeId !== 'string') return null
  if (parsed.aimedPlayerPublicDogeId !== undefined && typeof parsed.aimedPlayerPublicDogeId !== 'string') return null
  if (!isSerializableVector3(parsed.origin)) return null
  if (typeof parsed.yawDegrees !== 'number' || !Number.isFinite(parsed.yawDegrees)) return null
  if (parsed.aimYawDegrees !== undefined && (typeof parsed.aimYawDegrees !== 'number' || !Number.isFinite(parsed.aimYawDegrees))) return null
  if (parsed.source !== undefined && parsed.source !== 'attack' && parsed.source !== 'debug-eliminate-all') return null
  if (parsed.platform !== undefined && parsed.platform !== 'desktop' && parsed.platform !== 'mobile') return null

  return {
    ...parsed,
    aimedPlayerPublicDogeId: parsed.aimedPlayerPublicDogeId ?? '',
    aimYawDegrees: parsed.aimYawDegrees ?? parsed.yawDegrees,
    platform: parsed.platform ?? 'desktop',
    source: parsed.source ?? 'attack',
  }
}

export function parseServerBonkActionRequestPayload(payloadJson: string): ServerBonkActionRequestPayload | null {
  const parsed = parsePayload<ServerBonkActionRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (typeof parsed.playerId !== 'string') return null
  if (!isSerializableVector3(parsed.origin)) return null
  if (typeof parsed.yawDegrees !== 'number') return null

  return parsed
}

export function parseServerBonkActionEventPayload(payloadJson: string): ServerBonkActionEventPayload | null {
  const parsed = parsePayload<ServerBonkActionEventPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.eventId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (typeof parsed.playerId !== 'string') return null
  if (typeof parsed.address !== 'string') return null
  if (!isSerializableVector3(parsed.origin)) return null
  if (typeof parsed.yawDegrees !== 'number') return null

  return parsed
}

export function parseServerBonkResultPayload(payloadJson: string): ServerBonkResultPayload | null {
  const parsed = parsePayload<ServerBonkResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') return null
  if (typeof parsed.reason !== 'string') return null
  if (typeof parsed.targetPublicDogeId !== 'string') return null
  if (!isSerializableVector3(parsed.origin)) return null
  if (typeof parsed.bonks !== 'number') return null
  if (typeof parsed.targetDogesAlive !== 'number') return null
  if (typeof parsed.targetDogesTotal !== 'number') return null
  if (typeof parsed.roundOver !== 'boolean') return null
  if (parsed.serverPlatform !== undefined && parsed.serverPlatform !== 'desktop' && parsed.serverPlatform !== 'mobile') return null
  if (parsed.validatedRange !== undefined && typeof parsed.validatedRange !== 'number') return null
  if (parsed.validatedRadius !== undefined && typeof parsed.validatedRadius !== 'number') return null

  return parsed
}

export function parseServerTurnToRockRequestPayload(payloadJson: string): ServerTurnToRockRequestPayload | null {
  const parsed = parsePayload<ServerTurnToRockRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (typeof parsed.playerId !== 'string') return null
  if (!isSerializableVector3(parsed.position)) return null
  if (typeof parsed.yawDegrees !== 'number') return null

  return parsed
}

export function parseServerTurnToRockResultPayload(payloadJson: string): ServerTurnToRockResultPayload | null {
  const parsed = parsePayload<ServerTurnToRockResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'activated' && parsed.outcome !== 'rejected') return null
  if (typeof parsed.reason !== 'string') return null
  if (typeof parsed.playerId !== 'string') return null
  if (!isSerializableVector3(parsed.position)) return null
  if (typeof parsed.yawDegrees !== 'number') return null
  if (typeof parsed.durationSeconds !== 'number') return null
  if (typeof parsed.cooldownSeconds !== 'number') return null

  return parsed
}

export function parseServerRoundEndRequestPayload(payloadJson: string): ServerRoundEndRequestPayload | null {
  const parsed = parsePayload<ServerRoundEndRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (
    parsed.reason !== 'all-doges-eliminated' &&
    parsed.reason !== 'time-up' &&
    parsed.reason !== 'final-survivor'
  ) return null
  if (typeof parsed.bonks !== 'number') return null
  if (typeof parsed.aliveDoges !== 'number') return null
  if (typeof parsed.totalDoges !== 'number') return null
  if (typeof parsed.timeLeftSeconds !== 'number') return null
  if (typeof parsed.elapsedSeconds !== 'number') return null

  return parsed
}

export function parseServerRoundEndResultPayload(payloadJson: string): ServerRoundEndResultPayload | null {
  const parsed = parsePayload<ServerRoundEndResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') return null
  if (typeof parsed.reason !== 'string') return null
  if (typeof parsed.bonks !== 'number') return null
  if (typeof parsed.aliveDoges !== 'number') return null
  if (typeof parsed.totalDoges !== 'number') return null
  if (typeof parsed.timeLeftSeconds !== 'number') return null
  if (typeof parsed.elapsedSeconds !== 'number') return null
  if (typeof parsed.roundOver !== 'boolean') return null

  return parsed
}

export function parseServerDebugMarkOutRequestPayload(payloadJson: string): ServerDebugMarkOutRequestPayload | null {
  const parsed = parsePayload<ServerDebugMarkOutRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.reason !== 'debug-self-out') return null

  return parsed
}

export function parseServerDebugMarkOutResultPayload(payloadJson: string): ServerDebugMarkOutResultPayload | null {
  const parsed = parsePayload<ServerDebugMarkOutResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') return null
  if (typeof parsed.reason !== 'string') return null
  if (typeof parsed.playerId !== 'string') return null
  if (typeof parsed.publicDogeId !== 'string') return null
  if (parsed.status !== 'active' && parsed.status !== 'out' && parsed.status !== 'spectator') return null

  return parsed
}

export function parseServerDebugEliminateAllRequestPayload(payloadJson: string): ServerDebugEliminateAllRequestPayload | null {
  const parsed = parsePayload<ServerDebugEliminateAllRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.reason !== 'debug-eliminate-all') return null

  return parsed
}

export function parseServerDebugEliminateAllResultPayload(payloadJson: string): ServerDebugEliminateAllResultPayload | null {
  const parsed = parsePayload<ServerDebugEliminateAllResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') return null
  if (parsed.reason !== '' && parsed.reason !== 'unauthorized' && parsed.reason !== 'missing-match' && parsed.reason !== 'match-ended') return null
  if (typeof parsed.eliminatedCount !== 'number') return null
  if (typeof parsed.roundOver !== 'boolean') return null

  return parsed
}

export function parseServerDebugForceRoundEndRequestPayload(payloadJson: string): ServerDebugForceRoundEndRequestPayload | null {
  const parsed = parsePayload<ServerDebugForceRoundEndRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.reason !== 'debug-force-round-end') return null

  return parsed
}

export function parseServerDebugForceRoundEndResultPayload(payloadJson: string): ServerDebugForceRoundEndResultPayload | null {
  const parsed = parsePayload<ServerDebugForceRoundEndResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') return null
  if (typeof parsed.reason !== 'string') return null
  if (typeof parsed.roundOver !== 'boolean') return null

  return parsed
}

export function parseServerDebugNpcFreezeRequestPayload(payloadJson: string): ServerDebugNpcFreezeRequestPayload | null {
  const parsed = parsePayload<ServerDebugNpcFreezeRequestPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.reason !== 'debug-toggle-npc-freeze') return null

  return parsed
}

export function parseServerDebugNpcFreezeResultPayload(payloadJson: string): ServerDebugNpcFreezeResultPayload | null {
  const parsed = parsePayload<ServerDebugNpcFreezeResultPayload>(payloadJson)
  if (!parsed) return null
  if (typeof parsed.requestId !== 'string') return null
  if (typeof parsed.matchId !== 'string') return null
  if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') return null
  if (parsed.reason !== '' && parsed.reason !== 'unauthorized' && parsed.reason !== 'missing-match' && parsed.reason !== 'match-ended') return null
  if (typeof parsed.isFrozen !== 'boolean') return null

  return parsed
}

function parsePayload<T>(payloadJson: string): T | null {
  try {
    const parsed = JSON.parse(payloadJson) as unknown
    if (!isRecord(parsed)) return null

    return parsed as T
  } catch (error) {
    console.log('[Shared][S] Failed to parse gameplay payload:', error)
    return null
  }
}

function isSerializableVector3(value: unknown): value is SerializableVector3 {
  if (!isRecord(value)) return false

  return typeof value.x === 'number'
    && typeof value.y === 'number'
    && typeof value.z === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
