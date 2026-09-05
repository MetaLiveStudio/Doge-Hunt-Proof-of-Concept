import { engine, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { applyServerBonkAccepted } from '../combat'
import { playBonkHitSound, playBonkMissSound } from './gameAudio'
import { showBonkAcceptedFeedback } from './gameplayFeedback'
import { setGameplayResolvers } from '../gameResolvers'
import type {
  BonkActionStartRequest,
  BonkRequest,
  BonkResult,
  RoundEndRequest,
  RoundEndResult,
  TurnToRockRequest,
  TurnToRockResult,
} from '../gameResolvers'
import { recordLocalRoundEnded } from '../localMatchState'
import type { LocalRoundEndReason } from '../localMatchState'
import { applyServerTurnToRockActivated } from '../skills'
import { getDogeRoom } from '../shared/messages'
import {
  parseServerDebugForceRoundEndResultPayload,
  parseServerDebugEliminateAllResultPayload,
  parseServerDebugMarkOutResultPayload,
  parseServerDebugNpcFreezeResultPayload,
  parseServerBonkActionEventPayload,
  parseServerBonkResultPayload,
  parseServerRoundEndResultPayload,
  parseServerTurnToRockResultPayload,
  type SerializableVector3,
  type ServerBonkActionRequestPayload,
  type ServerBonkRequestPayload,
  type ServerBonkResultPayload,
  type ServerDebugForceRoundEndRequestPayload,
  type ServerDebugEliminateAllRequestPayload,
  type ServerDebugMarkOutRequestPayload,
  type ServerDebugNpcFreezeRequestPayload,
  type ServerRoundEndRequestPayload,
  type ServerTurnToRockRequestPayload,
} from '../shared/serverGameplay'
import {
  canLocalServerPlayerAct,
  getLocalServerAddress,
  getLocalServerPlayerStatus,
  getServerPublicMatchSnapshot,
} from './serverPublicStateClient'
import { playRemotePlayerBonkAction } from './remotePlayerProxies'
import { areServerNpcsFrozen, setServerNpcsFrozen } from './serverNpcFreezeState'

let serverGameplayClientStarted = false
let nextBonkActionRequestId = 1
let nextBonkRequestId = 1
let nextTurnToRockRequestId = 1
let nextRoundEndRequestId = 1
let nextDebugMarkOutRequestId = 1
let nextDebugEliminateAllRequestId = 1
let nextDebugForceRoundEndRequestId = 1
let nextDebugNpcFreezeRequestId = 1
let pendingTurnToRockRequestId = ''

const LOCAL_PLAYER_ID = 'local-player'

export function setupServerGameplayClient(): void {
  if (serverGameplayClientStarted) return
  serverGameplayClientStarted = true

  const room = getDogeRoom()

  room.onMessage('bonkActionEvent', (data) => {
    const payload = parseServerBonkActionEventPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][W3f] bonkActionEvent ignored invalid payload.')
      return
    }

    const localAddress = getLocalServerAddress()
    const senderAddress = normalizeAddress(payload.address)
    if (localAddress && senderAddress === normalizeAddress(localAddress)) return

    const played = playRemotePlayerBonkAction(senderAddress, payload.eventId)
    console.log(`[Client][W3f] bonkActionEvent received address=${senderAddress} eventId=${payload.eventId} played=${played}`)
  })

  room.onMessage('bonkResult', (data) => {
    const payload = parseServerBonkResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][S] bonkResult ignored invalid payload.')
      return
    }

    if (payload.outcome === 'accepted') {
      playBonkHitSound()
      const targetPlayer = getServerPublicMatchSnapshot(payload.matchId)
        ?.players.find((player) => player.publicDogeId === payload.targetPublicDogeId)
      showBonkAcceptedFeedback(targetPlayer?.displayName ?? '')
      const applied = applyServerBonkAccepted(payload.targetPublicDogeId, toVector3(payload.origin))
    console.log(`[Client][S] bonkResult accepted requestId=${payload.requestId} target=${payload.targetPublicDogeId} applied=${applied} targetAlive=${payload.targetDogesAlive}/${payload.targetDogesTotal} ${formatServerBonkEnvelope(payload)}`)
      return
    }

    if (payload.reason === 'invalid-target') {
      playBonkMissSound()
    }

    console.log(`[Client][S] bonkResult rejected requestId=${payload.requestId} reason=${payload.reason} target=${payload.targetPublicDogeId} ${formatServerBonkEnvelope(payload)}`)
  })

  room.onMessage('turnToRockResult', (data) => {
    const payload = parseServerTurnToRockResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][S] turnToRockResult ignored invalid payload.')
      return
    }

    if (payload.requestId === pendingTurnToRockRequestId) {
      pendingTurnToRockRequestId = ''
    }

    if (payload.outcome === 'activated') {
      const applied = applyServerTurnToRockActivated({
        playerId: payload.playerId,
        position: toVector3(payload.position),
        yawDegrees: payload.yawDegrees,
        durationSeconds: payload.durationSeconds,
        cooldownSeconds: payload.cooldownSeconds,
      })
      console.log(`[Client][S] turnToRockResult activated requestId=${payload.requestId} applied=${applied}`)
      return
    }

    console.log(`[Client][S] turnToRockResult rejected requestId=${payload.requestId} reason=${payload.reason}`)
  })

  room.onMessage('roundEndResult', (data) => {
    const payload = parseServerRoundEndResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][S] roundEndResult ignored invalid payload.')
      return
    }

    if (payload.outcome === 'accepted' && isLocalRoundEndReason(payload.reason)) {
      recordLocalRoundEnded({
        reason: payload.reason,
        bonks: payload.bonks,
        aliveDoges: payload.aliveDoges,
        totalDoges: payload.totalDoges,
        timeLeftSeconds: payload.timeLeftSeconds,
        elapsedSeconds: payload.elapsedSeconds,
      })
      console.log(`[Client][S] roundEndResult accepted requestId=${payload.requestId} reason=${payload.reason}`)
      return
    }

    console.log(`[Client][S] roundEndResult rejected requestId=${payload.requestId} reason=${payload.reason}`)
  })

  room.onMessage('debugMarkOutResult', (data) => {
    const payload = parseServerDebugMarkOutResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][T] debugMarkOutResult ignored invalid payload.')
      return
    }

    console.log(`[Client][T] debugMarkOutResult ${payload.outcome} requestId=${payload.requestId} status=${payload.status} publicDoge=${payload.publicDogeId || 'none'} reason=${payload.reason || 'none'}`)
  })

  room.onMessage('debugEliminateAllResult', (data) => {
    const payload = parseServerDebugEliminateAllResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][Admin] debugEliminateAllResult ignored invalid payload.')
      return
    }

    console.log(`[Client][Admin] debugEliminateAllResult ${payload.outcome} requestId=${payload.requestId} eliminated=${payload.eliminatedCount} roundOver=${payload.roundOver} reason=${payload.reason || 'none'}`)
  })

  room.onMessage('debugForceRoundEndResult', (data) => {
    const payload = parseServerDebugForceRoundEndResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][T] debugForceRoundEndResult ignored invalid payload.')
      return
    }

    console.log(`[Client][T] debugForceRoundEndResult ${payload.outcome} requestId=${payload.requestId} roundOver=${payload.roundOver} reason=${payload.reason || 'none'}`)
  })

  room.onMessage('debugNpcFreezeResult', (data) => {
    const payload = parseServerDebugNpcFreezeResultPayload(data.payloadJson)
    if (!payload) {
      console.log('[Client][Admin] debugNpcFreezeResult ignored invalid payload.')
      return
    }

    setServerNpcsFrozen(payload.isFrozen)
    console.log(`[Client][Admin] debugNpcFreezeResult ${payload.outcome} requestId=${payload.requestId} frozen=${payload.isFrozen} reason=${payload.reason || 'none'}`)
  })

  setGameplayResolvers({
    notifyBonkActionStart: notifyServerBonkActionStart,
    resolveBonk: resolveServerBonk,
    resolveTurnToRock: resolveServerTurnToRock,
    resolveRoundEnd: resolveServerRoundEnd,
  })
}

function notifyServerBonkActionStart(request: BonkActionStartRequest): void {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) return

  if (!canLocalServerPlayerAct()) {
    console.log(`[Client][T] bonk action ignored localStatus=${getLocalServerPlayerStatus()}`)
    return
  }

  const requestId = `bonk-action-${nextBonkActionRequestId++}`
  const payload: ServerBonkActionRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    playerId: request.attackerPlayerId,
    origin: fromVector3(request.origin),
    yawDegrees: getYawFromForward(request.forward),
  }

  void getDogeRoom().send('bonkActionRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][W3f] bonkActionRequest sent requestId=${requestId} matchId=${snapshot.matchId} yaw=${formatClientNumber(payload.yawDegrees)}`)
}

function resolveServerBonk(request: BonkRequest): BonkResult {
  const snapshot = getServerPublicMatchSnapshot()
  const targetPublicDogeId = request.candidatePublicDogeId ?? ''
  const aimedPlayerPublicDogeId = request.aimedPlayerPublicDogeId ?? ''

  if (!canLocalServerPlayerAct()) {
    console.log(`[Client][T] bonk ignored localStatus=${getLocalServerPlayerStatus()}`)
    return {
      outcome: 'miss',
      request,
    }
  }

  if (!snapshot) {
    return {
      outcome: 'miss',
      request,
    }
  }

  const requestId = sendServerBonkRequest(
    snapshot.matchId,
    targetPublicDogeId,
    aimedPlayerPublicDogeId,
    fromVector3(request.origin),
    getYawFromForward(request.forward),
    getYawFromForward(request.aimForward ?? request.forward)
  )

  return {
    outcome: 'pending',
    request,
    requestId,
  }
}

export function requestServerDebugEliminateAllDoges(): void {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    console.log('[Client][S][RoundEnd] debug eliminate all ignored: missing server public snapshot.')
    return
  }

  const requestId = `debug-clear-${nextDebugEliminateAllRequestId++}`
  const payload: ServerDebugEliminateAllRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    reason: 'debug-eliminate-all',
  }

  void getDogeRoom().send('debugEliminateAllRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][Admin] debug eliminate all requested requestId=${requestId} matchId=${snapshot.matchId}`)
}

export function requestServerDebugToggleNpcFreeze(): void {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    console.log('[Client][Admin] debug NPC freeze ignored: missing server public snapshot.')
    return
  }

  const requestId = `debug-npc-freeze-${nextDebugNpcFreezeRequestId++}`
  const payload: ServerDebugNpcFreezeRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    reason: 'debug-toggle-npc-freeze',
  }

  void getDogeRoom().send('debugNpcFreezeRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][Admin] debug NPC freeze requested requestId=${requestId} matchId=${snapshot.matchId} currentFrozen=${areServerNpcsFrozen()}`)
}

export function requestServerDebugMarkLocalOut(): void {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    console.log('[Client][T] debug mark out ignored: missing server public snapshot.')
    return
  }

  const requestId = `out-${nextDebugMarkOutRequestId++}`
  const payload: ServerDebugMarkOutRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    reason: 'debug-self-out',
  }

  void getDogeRoom().send('debugMarkOutRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][T] debugMarkOutRequest sent requestId=${requestId} matchId=${snapshot.matchId}`)
}

export function requestServerDebugForceRoundEnd(): void {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    console.log('[Client][T] debug force round end ignored: missing server public snapshot.')
    return
  }

  const requestId = `end-${nextDebugForceRoundEndRequestId++}`
  const payload: ServerDebugForceRoundEndRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    reason: 'debug-force-round-end',
  }

  void getDogeRoom().send('debugForceRoundEndRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][T] debugForceRoundEndRequest sent requestId=${requestId} matchId=${snapshot.matchId}`)
}

function resolveServerTurnToRock(request: TurnToRockRequest): TurnToRockResult {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    return {
      outcome: 'rejected',
      reason: 'server-rejected',
      request,
    }
  }

  if (pendingTurnToRockRequestId) {
    return {
      outcome: 'rejected',
      reason: 'pending-server-result',
      request,
    }
  }

  if (!canLocalServerPlayerAct()) {
    console.log(`[Client][T] turnToRock ignored localStatus=${getLocalServerPlayerStatus()}`)
    return {
      outcome: 'rejected',
      reason: 'server-rejected',
      request,
    }
  }

  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) {
    return {
      outcome: 'rejected',
      reason: 'missing-player-transform',
      request,
    }
  }

  const requestId = `rock-${nextTurnToRockRequestId++}`
  pendingTurnToRockRequestId = requestId

  const payload: ServerTurnToRockRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    playerId: request.playerId || LOCAL_PLAYER_ID,
    position: fromVector3(playerTransform.position),
    yawDegrees: getYawFromRotation(playerTransform.rotation),
  }

  void getDogeRoom().send('turnToRockRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][S] turnToRockRequest sent requestId=${requestId} matchId=${snapshot.matchId}`)

  return {
    outcome: 'pending',
    request,
    requestId,
  }
}

function resolveServerRoundEnd(request: RoundEndRequest): RoundEndResult {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    return {
      outcome: 'ignored',
      reason: 'missing-runtime-state',
      request,
    }
  }

  const requestId = `round-${nextRoundEndRequestId++}`
  const payload: ServerRoundEndRequestPayload = {
    requestId,
    matchId: snapshot.matchId,
    reason: request.reason,
    bonks: request.bonks,
    aliveDoges: request.aliveDoges,
    totalDoges: request.totalDoges,
    timeLeftSeconds: request.timeLeftSeconds,
    elapsedSeconds: request.elapsedSeconds,
  }

  void getDogeRoom().send('roundEndRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][S] roundEndRequest sent requestId=${requestId} reason=${request.reason} alive=${request.aliveDoges}/${request.totalDoges}`)

  return {
    outcome: 'pending',
    request,
    requestId,
  }
}

function fromVector3(vector: { x: number; y: number; z: number }): SerializableVector3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  }
}

function sendServerBonkRequest(
  matchId: string,
  targetPublicDogeId: string,
  aimedPlayerPublicDogeId: string,
  origin: SerializableVector3,
  yawDegrees: number,
  aimYawDegrees: number,
  source: ServerBonkRequestPayload['source'] = 'attack'
): string {
  const requestId = `bonk-${nextBonkRequestId++}`
  const platform = isMobile() ? 'mobile' : 'desktop'
  const payload: ServerBonkRequestPayload = {
    requestId,
    matchId,
    targetPublicDogeId,
    aimedPlayerPublicDogeId,
    origin,
    yawDegrees,
    aimYawDegrees,
    platform,
    source,
  }

  void getDogeRoom().send('bonkRequest', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Client][RayBonk] request sent requestId=${requestId} matchId=${matchId} npcTarget=${targetPublicDogeId || 'none'} aimedPlayer=${aimedPlayerPublicDogeId || 'none'} source=${source} platform=${platform} yaw=${formatClientNumber(yawDegrees)} aimYaw=${formatClientNumber(aimYawDegrees)}`)

  return requestId
}

function getPlayerOrigin(): SerializableVector3 {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) {
    return { x: 48, y: 0, z: 48 }
  }

  return fromVector3(playerTransform.position)
}

function formatServerBonkEnvelope(payload: ServerBonkResultPayload): string {
  if (payload.serverPlatform === undefined || payload.validatedRange === undefined || payload.validatedRadius === undefined) {
    return 'serverEnvelope=unavailable'
  }

  return `serverPlatform=${payload.serverPlatform} serverRange=${formatClientNumber(payload.validatedRange)} serverRadius=${formatClientNumber(payload.validatedRadius)}`
}

function getPlayerYawDegrees(): number {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  return playerTransform ? getYawFromRotation(playerTransform.rotation) : 0
}

function toVector3(vector: SerializableVector3): Vector3 {
  return Vector3.create(vector.x, vector.y, vector.z)
}

function getYawFromRotation(rotation: { x: number; y: number; z: number; w: number }): number {
  const forward = Vector3.rotate(Vector3.Forward(), rotation)
  return Math.atan2(forward.x, forward.z) * (180 / Math.PI)
}

function getYawFromForward(forward: { x: number; z: number }): number {
  return Math.atan2(forward.x, forward.z) * (180 / Math.PI)
}

function isLocalRoundEndReason(reason: string): reason is LocalRoundEndReason {
  return reason === 'all-doges-eliminated' || reason === 'time-up'
}

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

function formatClientNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a'
}
