import type { EventContext } from '@dcl/sdk/network/events'
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { getDogeRoom } from '../shared/messages'
import {
  SERVER_ROOM_ID,
  SERVER_ROOM_MAX_PLAYERS,
  SERVER_ROOM_MAX_SPECTATORS,
  type ServerRoomPlayer,
  type ServerRoomSpectator,
  type ServerRoomSnapshot,
} from '../shared/serverRoom'
import {
  createPresentationDogeIdentities,
  createPrivatePlayerSeed,
  createServerPublicDoges,
  getServerTotalDoges,
  LOCAL_RUNTIME_PLAYER_ID,
  type ServerMatchStartPayload,
} from '../shared/serverMatch'
import {
  SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS,
  SERVER_TURN_TO_ROCK_DURATION_SECONDS,
  parseServerBonkActionRequestPayload,
  parseServerBonkRequestPayload,
  parseServerDebugEliminateAllRequestPayload,
  parseServerDebugForceRoundEndRequestPayload,
  parseServerDebugMarkOutRequestPayload,
  parseServerDebugNpcFreezeRequestPayload,
  parseServerRoundEndRequestPayload,
  parseServerTurnToRockRequestPayload,
  type ServerBonkActionEventPayload,
  type ServerBonkRejectReason,
  type ServerBonkRequestPlatform,
  type ServerBonkResultPayload,
  type ServerDebugEliminateAllResultPayload,
  type ServerDebugForceRoundEndResultPayload,
  type ServerDebugMarkOutResultPayload,
  type ServerDebugNpcFreezeResultPayload,
  type ServerRoundEndRejectReason,
  type ServerRoundEndResultPayload,
  type ServerTurnToRockRejectReason,
  type ServerTurnToRockResultPayload,
} from '../shared/serverGameplay'
import {
  SERVER_ROUND_DURATION_SECONDS,
  countAlivePublicDoges,
  countAliveTargetDoges,
  type ServerPublicMatchSnapshot,
  type ServerPublicPlayerPose,
  type ServerPublicPlayerState,
} from '../shared/serverPublicState'
import { createServerNpcSnapshot, getServerNpcTransform } from '../shared/serverNpcSnapshot'
import { getMatchSpawnPoint } from '../shared/playerSpawns'
import { isDogeHuntAdmin } from '../shared/leaderboardConfig'
import { rankServerPlayers } from '../shared/leaderboardRanking'
import type { LocalRoundEndReason, PublicDogeState } from '../localMatchState'
import type { LocalMatchConfig, LocalMatchPlayerSlot } from '../localMatch'
import {
  awardMatchLeaderboardPoints,
  getLeaderboardExportSnapshot,
  getPublicLeaderboardSnapshot,
  refreshLeaderboardPlayerName,
  setupLeaderboardServer,
} from './leaderboard'

type ActiveServerMatch = {
  matchId: string
  version: number
  phase: 'active' | 'ended'
  totalDoges: number
  playerCount: number
  decoyNpcCount: number
  publicDoges: PublicDogeState[]
  publicPlayers: ServerPublicPlayerState[]
  playerSkills: ServerPlayerSkillState[]
  elapsedSeconds: number
  npcsFrozen: boolean
  npcFrozenElapsedSeconds: number
  tickAccumulator: number
  poseTickAccumulator: number
  heartbeatFinalSurvivorCheckSeconds: number
  endReason: LocalRoundEndReason | null
  winnerAddress: string
  winnerDisplayName: string
  winnerPublicDogeId: string
  nextEliminationOrder: number
  settlingElapsedSeconds: number
}

type ServerPlayerSkillState = {
  address: string
  activeSecondsRemaining: number
  cooldownSecondsRemaining: number
}

type ServerBonkTarget = {
  kind: 'decoy' | 'player'
  publicDoge: PublicDogeState
  targetPlayer: ServerPublicPlayerState | null
}

type ServerAttackPose = {
  origin: Vector3
  forward: Vector3
}

type ServerPlayerTransform = ServerPublicPlayerPose

type ServerPlayerBonkMeasurement = {
  transformFound: boolean
  distance: number | null
  forwardDistance: number | null
  lateralDistance: number | null
  inArc: boolean
}

type ServerBonkHitEnvelope = {
  minForward: number
  range: number
  radius: number
}

type PendingMatchStart = {
  requestedBy: string
  requestId: string
  mode: 'solo' | 'party'
  countdownSeconds: number
  lastBroadcastSeconds: number
}

const SERVER_BONK_MIN_FORWARD = 0.15
const SERVER_BONK_RANGE = 3.95
const SERVER_BONK_RADIUS = 2.7
const SERVER_MOBILE_BONK_HIT_SCALE = 0.70
const SERVER_BONK_CLIENT_ORIGIN_TOLERANCE = 2.25
const SERVER_BONK_CLIENT_YAW_AUDIT_DEGREES = 70
const SERVER_NPC_HIT_LAG_COMPENSATION_SECONDS = 0.3
const SERVER_ROOM_HEARTBEAT_TIMEOUT_SECONDS = 12
const SERVER_ROOM_PRUNE_INTERVAL_SECONDS = 2
const SERVER_ROOM_SETTLING_TIMEOUT_SECONDS = 30
const SERVER_PLAYER_POSE_BROADCAST_INTERVAL_SECONDS = 0.2
const SERVER_MATCH_START_COUNTDOWN_SECONDS = 3
const SERVER_HEARTBEAT_FINAL_SURVIVOR_GRACE_SECONDS = 4
const SERVER_RECENT_HEARTBEAT_SECONDS = 5
let serverLobbyStarted = false
let roomMaintenanceSystemStarted = false
let publicStateSystemStarted = false
let players: ServerRoomPlayer[] = []
let spectators: ServerRoomSpectator[] = []
let playerLastSeenSeconds = new Map<string, number>()
let roomElapsedSeconds = 0
let roomPruneAccumulator = 0
let roomVersion = 0
let matchVersion = 0
let nextMatchId = 1
let activeMatch: ActiveServerMatch | null = null
let pendingMatchStart: PendingMatchStart | null = null

function getServerBonkHitEnvelope(platform: ServerBonkRequestPlatform): ServerBonkHitEnvelope {
  const scale = platform === 'mobile' ? SERVER_MOBILE_BONK_HIT_SCALE : 1
  return {
    minForward: SERVER_BONK_MIN_FORWARD,
    range: SERVER_BONK_RANGE * scale,
    radius: SERVER_BONK_RADIUS * scale,
  }
}

export function setupServerLobby(): void {
  if (serverLobbyStarted) return
  serverLobbyStarted = true

  void setupLeaderboardServer().catch((error) => {
    console.log('[Server][LB] Leaderboard initialization failed:', error)
  })

  const room = getDogeRoom()

  room.onMessage('joinRoom', (data, context) => {
    if (!context) return

    handleJoinRoom(context, data.displayName)
  })

  room.onMessage('spectateMatch', (data, context) => {
    if (!context) return

    handleSpectateMatch(context, data.displayName)
  })

  room.onMessage('leaveRoom', (data, context) => {
    if (!context) return

    handleLeaveRoom(context, data.reason)
  })

  room.onMessage('setReady', (data, context) => {
    if (!context) return

    handleSetReady(context, data.isReady)
  })

  room.onMessage('requestRoomSnapshot', (data, context) => {
    if (!context) return

    sendRoomSnapshotToAddress(context.from, data.reason)
  })

  room.onMessage('roomHeartbeat', (data, context) => {
    if (!context) return

    handleRoomHeartbeat(context, data.status)
  })

  room.onMessage('leaderboardSnapshotRequest', (data, context) => {
    if (!context) return

    void handleLeaderboardSnapshotRequest(context, data.reason)
  })

  room.onMessage('leaderboardExportRequest', (data, context) => {
    if (!context) return

    void handleLeaderboardExportRequest(context, data.reason)
  })

  room.onMessage('requestStartMatch', (data, context) => {
    if (!context) return

    handleRequestStartMatch(context, data.requestId, data.mode)
  })

  room.onMessage('cancelMatchStart', (data, context) => {
    if (!context) return

    handleCancelMatchStart(context, data.reason)
  })

  room.onMessage('bonkRequest', (data, context) => {
    if (!context) return

    handleBonkRequest(context, data.payloadJson)
  })

  room.onMessage('bonkActionRequest', (data, context) => {
    if (!context) return

    handleBonkActionRequest(context, data.payloadJson)
  })

  room.onMessage('turnToRockRequest', (data, context) => {
    if (!context) return

    handleTurnToRockRequest(context, data.payloadJson)
  })

  room.onMessage('roundEndRequest', (data, context) => {
    if (!context) return

    handleRoundEndRequest(context, data.payloadJson)
  })

  room.onMessage('debugMarkOutRequest', (data, context) => {
    if (!context) return

    handleDebugMarkOutRequest(context, data.payloadJson)
  })

  room.onMessage('debugEliminateAllRequest', (data, context) => {
    if (!context) return

    handleDebugEliminateAllRequest(context, data.payloadJson)
  })

  room.onMessage('debugForceRoundEndRequest', (data, context) => {
    if (!context) return

    handleDebugForceRoundEndRequest(context, data.payloadJson)
  })

  room.onMessage('debugNpcFreezeRequest', (data, context) => {
    if (!context) return

    handleDebugNpcFreezeRequest(context, data.payloadJson)
  })

  setupServerRoomMaintenanceSystem()
  setupServerPublicStateSystem()

  console.log(`[Server][P] Server lobby handlers registered. roomId=${SERVER_ROOM_ID}`)
  console.log(`[Server][Combat] BONK envelope configured desktopRange=${formatServerAuditNumber(SERVER_BONK_RANGE)} desktopRadius=${formatServerAuditNumber(SERVER_BONK_RADIUS)} mobileScale=${SERVER_MOBILE_BONK_HIT_SCALE.toFixed(2)} mobileRange=${formatServerAuditNumber(SERVER_BONK_RANGE * SERVER_MOBILE_BONK_HIT_SCALE)} mobileRadius=${formatServerAuditNumber(SERVER_BONK_RADIUS * SERVER_MOBILE_BONK_HIT_SCALE)}`)
}

function handleJoinRoom(context: EventContext, displayName: string): void {
  const address = normalizeAddress(context.from)
  const existingPlayer = players.find((player) => player.address === address)

  if ((activeMatch || pendingMatchStart) && !existingPlayer) {
    const matchState = pendingMatchStart
      ? 'starting'
      : activeMatch?.phase ?? 'unknown'
    const matchId = activeMatch?.matchId ?? 'pending'
    console.log(`[Server][U] joinRoom rejected match-${matchState} address=${address} matchId=${matchId}`)
    void getDogeRoom().send('roomError', {
      code: pendingMatchStart ? 'match-starting' : activeMatch?.phase === 'active' ? 'match-active' : 'match-settling',
      message: pendingMatchStart
        ? 'Match is starting'
        : activeMatch?.phase === 'active'
          ? 'A match is already in progress'
          : 'Waiting for players to exit',
    }, { to: [address] })
    return
  }

  if (!existingPlayer && players.length >= SERVER_ROOM_MAX_PLAYERS) {
    console.log(`[Server][P] joinRoom rejected room-full address=${address}`)
    void getDogeRoom().send('roomError', {
      code: 'room-full',
      message: 'Room is full',
    }, { to: [address] })
    return
  }

  const normalizedDisplayName = normalizeDisplayName(displayName, address)

  if (existingPlayer) {
    existingPlayer.displayName = normalizedDisplayName
    touchRoomPlayer(address)
    console.log(`[Server][P] joinRoom refreshed address=${address} ready=${existingPlayer.isReady} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS}`)
  } else {
    const isHost = players.length === 0
    players.push({
      id: address,
      address,
      displayName: normalizedDisplayName,
      isHost,
      isReady: false,
      isSimulated: false,
    })
    touchRoomPlayer(address)
    console.log(`[Server][P] joinRoom accepted address=${address} host=${isHost} ready=false players=${players.length}/${SERVER_ROOM_MAX_PLAYERS}`)
  }

  refreshLeaderboardPlayerName(address, normalizedDisplayName)

  broadcastRoomSnapshot('join')
}

function handleSpectateMatch(context: EventContext, displayName: string): void {
  const address = normalizeAddress(context.from)
  if (!activeMatch || activeMatch.phase !== 'active') {
    void getDogeRoom().send('roomError', {
      code: 'match-not-active',
      message: 'No active match to watch',
    }, { to: [address] })
    return
  }

  if (players.some((player) => player.address === address)) {
    void getDogeRoom().send('roomError', {
      code: 'already-player',
      message: 'You are already playing this match',
    }, { to: [address] })
    return
  }

  const normalizedDisplayName = normalizeDisplayName(displayName, address)
  const existingSpectator = spectators.find((spectator) => spectator.address === address)
  if (existingSpectator) {
    existingSpectator.displayName = normalizedDisplayName
    touchRoomMember(address)
  } else {
    if (spectators.length >= SERVER_ROOM_MAX_SPECTATORS) {
      void getDogeRoom().send('roomError', {
        code: 'spectators-full',
        message: 'Spectator seats are full',
      }, { to: [address] })
      return
    }

    spectators.push({ address, displayName: normalizedDisplayName })
    touchRoomMember(address)
  }

  const payload = createSpectatorMatchStartPayload(spectators.find((spectator) => spectator.address === address)!)
  void getDogeRoom().send('matchStarted', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
  console.log(`[Server][Spectator] watch accepted address=${address} matchId=${activeMatch.matchId} spectators=${spectators.length}/${SERVER_ROOM_MAX_SPECTATORS}`)
  broadcastRoomSnapshot('spectator-join')
}

function handleLeaveRoom(context: EventContext, reason: string): void {
  const address = normalizeAddress(context.from)
  removePlayerFromRoom(address, reason || 'none')
}

function removePlayerFromRoom(address: string, reason: string): void {
  if (!players.some((player) => player.address === address)) {
    const spectatorIndex = spectators.findIndex((spectator) => spectator.address === address)
    if (spectatorIndex >= 0) {
      spectators.splice(spectatorIndex, 1)
      playerLastSeenSeconds.delete(address)
      console.log(`[Server][Spectator] leave address=${address} reason=${reason || 'none'} spectators=${spectators.length}/${SERVER_ROOM_MAX_SPECTATORS}`)
      broadcastRoomSnapshot('spectator-leave')
      return
    }
    console.log(`[Server][P] leaveRoom ignored missing-member address=${address} reason=${reason || 'none'}`)
    return
  }

  const beforeCount = players.length
  if (pendingMatchStart) {
    cancelPendingMatchStart(`player-left:${reason || 'none'}`)
  }
  const removedFromActiveMatch = markServerPlayerAsSpectator(address, `leave:${reason || 'none'}`)

  players = players.filter((player) => player.address !== address)
  playerLastSeenSeconds.delete(address)

  if (players.length > 0 && !players.some((player) => player.isHost)) {
    players[0].isHost = true
  }

  syncActiveMatchHostFlags()
  const heartbeatTimeout = reason === 'heartbeat-timeout'
  const survivorEnded = removedFromActiveMatch && !heartbeatTimeout && maybeEndMatchByFinalSurvivor('player-left')

  if (players.length === 0) {
    resetActiveMatch('room-empty')
  } else if (removedFromActiveMatch) {
    if (heartbeatTimeout && activeMatch?.phase === 'active') {
      activeMatch.heartbeatFinalSurvivorCheckSeconds = SERVER_HEARTBEAT_FINAL_SURVIVOR_GRACE_SECONDS
      console.log(`[Server][U] final survivor deferred after heartbeat timeout address=${address} grace=${SERVER_HEARTBEAT_FINAL_SURVIVOR_GRACE_SECONDS}s`)
    }
    broadcastPublicMatchSnapshot(
      survivorEnded ? 'final-survivor' : heartbeatTimeout ? 'heartbeat-timeout' : 'player-left'
    )
  }

  console.log(`[Server][P] leaveRoom address=${address} reason=${reason || 'none'} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS} before=${beforeCount}`)
  broadcastRoomSnapshot('leave')
}

function handleSetReady(context: EventContext, isReady: boolean): void {
  const address = normalizeAddress(context.from)
  const player = players.find((entry) => entry.address === address)

  if (!player) {
    console.log(`[Server][P] setReady ignored missing-player address=${address}`)
    return
  }

  if (activeMatch || pendingMatchStart) {
    const matchState = pendingMatchStart
      ? 'starting'
      : activeMatch?.phase ?? 'unknown'
    console.log(`[Server][P] setReady ignored match-${matchState} address=${address}`)
    return
  }

  touchRoomPlayer(address)
  player.isReady = isReady
  console.log(`[Server][P] setReady address=${address} ready=${isReady}`)
  broadcastRoomSnapshot('ready')
}

function handleRoomHeartbeat(context: EventContext, _status: string): void {
  const address = normalizeAddress(context.from)

  if (!players.some((player) => player.address === address) && !spectators.some((spectator) => spectator.address === address)) return

  touchRoomMember(address)
}

async function handleLeaderboardSnapshotRequest(context: EventContext, reason: string): Promise<void> {
  const address = normalizeAddress(context.from)

  try {
    const snapshot = await getPublicLeaderboardSnapshot()
    await getDogeRoom().send('leaderboardSnapshot', snapshot, { to: [address] })
    console.log(`[Server][LB] public snapshot sent to=${address} reason=${reason || 'none'} entries=${snapshot.addresses.length}`)
  } catch (error) {
    console.log(`[Server][LB] public snapshot request failed to=${address}:`, error)
  }
}

async function handleLeaderboardExportRequest(context: EventContext, reason: string): Promise<void> {
  const address = normalizeAddress(context.from)

  if (!isDogeHuntAdmin(address)) {
    console.log(`[Server][LB] export rejected unauthorized address=${address}`)
    return
  }

  try {
    const snapshot = await getLeaderboardExportSnapshot()
    await getDogeRoom().send('leaderboardExportSnapshot', snapshot, { to: [address] })
    console.log(`[Server][LB] full CSV export sent to=${address} reason=${reason || 'none'} entries=${snapshot.addresses.length}`)
  } catch (error) {
    console.log(`[Server][LB] export request failed to=${address}:`, error)
  }
}

function handleRequestStartMatch(context: EventContext, requestId: string, requestedMode: string): void {
  const address = normalizeAddress(context.from)
  const requester = players.find((player) => player.address === address)
  const mode = requestedMode === 'solo' ? 'solo' : requestedMode === 'party' ? 'party' : null

  if (!requester) {
    console.log(`[Server][Q] requestStartMatch rejected missing-player address=${address} requestId=${requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'missing-player',
      message: 'Join the room before starting a match',
    }, { to: [address] })
    return
  }

  touchRoomPlayer(address)

  if (!requester.isHost) {
    console.log(`[Server][Q] requestStartMatch rejected not-host address=${address} requestId=${requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'not-host',
      message: 'Only the host can start the match',
    }, { to: [address] })
    return
  }

  if (!mode) {
    console.log(`[Server][Q] requestStartMatch rejected invalid-mode address=${address} mode=${requestedMode || 'none'} requestId=${requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'invalid-start-mode',
      message: 'Choose solo or party start',
    }, { to: [address] })
    return
  }

  if (pendingMatchStart) {
    console.log(`[Server][Q] requestStartMatch rejected already-starting address=${address} requestId=${requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'match-starting',
      message: 'Match is already starting',
    }, { to: [address] })
    return
  }

  if (activeMatch?.phase === 'active') {
    console.log(`[Server][U] requestStartMatch rejected match-active address=${address} requestId=${requestId} matchId=${activeMatch.matchId}`)
    void getDogeRoom().send('matchError', {
      code: 'match-active',
      message: 'A match is already in progress',
    }, { to: [address] })
    return
  }

  if (activeMatch?.phase === 'ended') {
    console.log(`[Server][U] requestStartMatch rejected match-settling address=${address} requestId=${requestId} matchId=${activeMatch.matchId}`)
    void getDogeRoom().send('matchError', {
      code: 'match-settling',
      message: 'Waiting for players to exit',
    }, { to: [address] })
    return
  }

  if (!canStartCurrentRoom(mode)) {
    console.log(`[Server][Q] requestStartMatch rejected not-ready address=${address} mode=${mode} requestId=${requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'not-ready',
      message: mode === 'solo'
        ? 'Ready up before starting solo'
        : 'At least two ready players are needed to start a match',
    }, { to: [address] })
    return
  }

  pendingMatchStart = {
    requestedBy: address,
    requestId,
    mode,
    countdownSeconds: SERVER_MATCH_START_COUNTDOWN_SECONDS,
    lastBroadcastSeconds: SERVER_MATCH_START_COUNTDOWN_SECONDS,
  }
  console.log(`[Server][Q] match countdown started address=${address} mode=${mode} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS} seconds=${SERVER_MATCH_START_COUNTDOWN_SECONDS} requestId=${requestId}`)
  broadcastRoomSnapshot('match-countdown-started')
}

function handleCancelMatchStart(context: EventContext, reason: string): void {
  const address = normalizeAddress(context.from)
  const requester = players.find((player) => player.address === address)

  if (!requester?.isHost) {
    console.log(`[Server][Q] cancelMatchStart rejected not-host address=${address}`)
    void getDogeRoom().send('matchError', {
      code: 'not-host',
      message: 'Only the host can cancel the match countdown',
    }, { to: [address] })
    return
  }

  if (!pendingMatchStart) {
    console.log(`[Server][Q] cancelMatchStart ignored no-pending-start address=${address}`)
    return
  }

  if (pendingMatchStart.requestedBy !== address) {
    console.log(`[Server][Q] cancelMatchStart rejected not-requester address=${address} requestId=${pendingMatchStart.requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'not-start-requester',
      message: 'Only the host who started the countdown can cancel it',
    }, { to: [address] })
    return
  }

  cancelPendingMatchStart(`host-cancelled:${reason || 'none'}`)
  broadcastRoomSnapshot('match-countdown-cancelled-by-host')
}

function canStartCurrentRoom(mode: 'solo' | 'party'): boolean {
  if (activeMatch || pendingMatchStart) return false
  if (mode === 'solo') {
    return players.length === 1 && players[0].isHost && players[0].isReady
  }
  return players.length >= 2 && players.every((player) => player.isHost || player.isReady)
}

function cancelPendingMatchStart(reason: string): void {
  if (!pendingMatchStart) return

  console.log(`[Server][Q] match countdown cancelled reason=${reason} mode=${pendingMatchStart.mode} requestId=${pendingMatchStart.requestId}`)
  pendingMatchStart = null
}

function beginPendingMatch(): void {
  if (!pendingMatchStart) return

  const pending = pendingMatchStart
  if (!canStartPendingRoom(pending.mode)) {
    cancelPendingMatchStart('room-no-longer-ready')
    broadcastRoomSnapshot('match-countdown-cancelled')
    return
  }

  pendingMatchStart = null
  const matchId = `server-match-${nextMatchId++}`
  const publicDoges = createServerPublicDoges(matchId, getServerTotalDoges(players.length))
  matchVersion += 1

  console.log(`[Server][Q] match started address=${pending.requestedBy} mode=${pending.mode} requestId=${pending.requestId} matchId=${matchId} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS} doges=${publicDoges.length} npcs=${Math.max(0, publicDoges.length - players.length)} version=${matchVersion}`)
  for (const targetPlayer of players) {
    const payload = createMatchStartPayload(targetPlayer, matchId, publicDoges, matchVersion)
    void getDogeRoom().send('matchStarted', {
      payloadJson: JSON.stringify(payload),
    }, { to: [targetPlayer.address] })
    console.log(`[Server][Q] matchStarted sent to=${targetPlayer.address} matchId=${matchId} localPublicDoge=${payload.runtimeSeed.privatePlayers[0]?.publicDogeId ?? 'none'}`)
  }

  activeMatch = createActiveServerMatch(matchId, publicDoges, matchVersion)
  broadcastRoomSnapshot('match-started')
  broadcastPublicMatchSnapshot('match-started')
  broadcastServerNpcSnapshot('match-started')
}

function canStartPendingRoom(mode: 'solo' | 'party'): boolean {
  if (activeMatch) return false
  if (mode === 'solo') {
    return players.length === 1 && players[0].isHost && players[0].isReady
  }
  return players.length >= 2 && players.every((player) => player.isHost || player.isReady)
}

function handleBonkRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerBonkRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][S] bonk rejected invalid-payload address=${address}`)
    return
  }

  const hitEnvelope = getServerBonkHitEnvelope(payload.platform)
  console.log(`[Server][RayBonk] received address=${address} requestId=${payload.requestId} matchId=${payload.matchId} npcTarget=${payload.targetPublicDogeId || 'none'} aimedPlayer=${payload.aimedPlayerPublicDogeId || 'none'} source=${payload.source} platform=${payload.platform} range=${formatServerAuditNumber(hitEnvelope.range)} radius=${formatServerAuditNumber(hitEnvelope.radius)}`)

  const rejectReason = getBonkBaseRejectReason(address, payload.matchId)
  if (rejectReason) {
    sendBonkResult(address, buildBonkResult(payload, 'rejected', rejectReason, 0))
    console.log(`[Server][S] bonk rejected reason=${rejectReason} address=${address} target=${payload.targetPublicDogeId} requestId=${payload.requestId}`)
    return
  }

  const match = activeMatch as ActiveServerMatch
  const attackPose = getValidatedServerAttackPose(address, payload.origin, payload.yawDegrees)
  const playerAimPose = payload.aimedPlayerPublicDogeId && attackPose
    ? getServerAimPose(attackPose, payload.aimYawDegrees)
    : null
  const debugNpcSpatialBypass = payload.source === 'debug-eliminate-all' && isDogeHuntAdmin(address)
  const target = resolveServerBonkTarget(
    address,
    payload.targetPublicDogeId,
    payload.aimedPlayerPublicDogeId,
    attackPose,
    playerAimPose,
    hitEnvelope,
    debugNpcSpatialBypass
  )
  const player = findServerPublicPlayer(address)

  if (payload.source === 'debug-eliminate-all' && !debugNpcSpatialBypass) {
    console.log(`[Server][Admin] debug eliminate all denied address=${address}`)
  }

  if (typeof target === 'string' || !player) {
    const targetReason = typeof target === 'string' ? target : 'invalid-target'
    sendBonkResult(address, buildBonkResult(payload, 'rejected', targetReason, 0))
    console.log(`[Server][RayBonk] rejected reason=${targetReason} address=${address} npcTarget=${payload.targetPublicDogeId || 'none'} aimedPlayer=${payload.aimedPlayerPublicDogeId || 'none'} platform=${payload.platform} range=${formatServerAuditNumber(hitEnvelope.range)} radius=${formatServerAuditNumber(hitEnvelope.radius)} requestId=${payload.requestId}`)
    return
  }

  target.publicDoge.isEliminated = true
  target.publicDoge.visualState = 'eliminated'
  player.bonks += 1

  if (target.targetPlayer) {
    markServerPlayerAsSpectator(target.targetPlayer.address, `bonk:${address}`, player.displayName)
  }

  const targetDogesAlive = getServerTargetDogesAlive()
  let snapshotReason = target.kind === 'player' ? 'player-bonk' : 'bonk'
  if (target.kind === 'decoy' && maybeEndMatchBySinglePlayerNpcClear('bonk', player)) {
    snapshotReason = 'all-doges-eliminated'
  } else if (maybeEndMatchByFinalSurvivor('bonk')) {
    snapshotReason = 'final-survivor'
  }

  sendBonkResult(address, buildBonkResult(payload, 'accepted', '', player.bonks, target.publicDoge.publicDogeId))
  console.log(`[Server][RayBonk] accepted address=${address} target=${target.publicDoge.publicDogeId} kind=${target.kind} targetPlayer=${target.targetPlayer?.address ?? 'none'} aimedPlayer=${payload.aimedPlayerPublicDogeId || 'none'} bonks=${player.bonks} targetAlive=${targetDogesAlive}/${match.decoyNpcCount} platform=${payload.platform} range=${formatServerAuditNumber(hitEnvelope.range)} radius=${formatServerAuditNumber(hitEnvelope.radius)} requestId=${payload.requestId}`)
  broadcastPublicMatchSnapshot(snapshotReason)
  broadcastServerNpcSnapshot(snapshotReason)
}

function handleBonkActionRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerBonkActionRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][W3f] bonkAction rejected invalid-payload address=${address}`)
    return
  }

  const rejectReason = getBonkBaseRejectReason(address, payload.matchId)
  if (rejectReason) {
    console.log(`[Server][W3f] bonkAction rejected reason=${rejectReason} address=${address} requestId=${payload.requestId}`)
    return
  }

  const player = findServerPublicPlayer(address)
  if (!player) {
    console.log(`[Server][W3f] bonkAction rejected reason=missing-player address=${address} requestId=${payload.requestId}`)
    return
  }

  const eventPayload: ServerBonkActionEventPayload = {
    eventId: payload.requestId,
    matchId: payload.matchId,
    playerId: player.playerId,
    address,
    origin: payload.origin,
    yawDegrees: payload.yawDegrees,
  }

  void getDogeRoom().send('bonkActionEvent', {
    payloadJson: JSON.stringify(eventPayload),
  })
  console.log(`[Server][W3f] bonkActionEvent broadcast address=${address} requestId=${payload.requestId} matchId=${payload.matchId} yaw=${formatServerAuditNumber(payload.yawDegrees)}`)
}

function handleTurnToRockRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerTurnToRockRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][S] turnToRock rejected invalid-payload address=${address}`)
    return
  }

  const rejectReason = getTurnToRockRejectReason(address, payload.matchId)
  if (rejectReason) {
    sendTurnToRockResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: rejectReason,
      playerId: payload.playerId,
      position: payload.position,
      yawDegrees: payload.yawDegrees,
      durationSeconds: SERVER_TURN_TO_ROCK_DURATION_SECONDS,
      cooldownSeconds: SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS,
    })
    console.log(`[Server][S] turnToRock rejected reason=${rejectReason} address=${address} requestId=${payload.requestId}`)
    return
  }

  const player = findServerPublicPlayer(address)
  const skillState = findServerPlayerSkill(address)
  const playerDoge = player ? findServerPublicDoge(player.publicDogeId) : null

  if (!player || !skillState || !playerDoge) {
    sendTurnToRockResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'missing-player',
      playerId: payload.playerId,
      position: payload.position,
      yawDegrees: payload.yawDegrees,
      durationSeconds: SERVER_TURN_TO_ROCK_DURATION_SECONDS,
      cooldownSeconds: SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS,
    })
    console.log(`[Server][S] turnToRock rejected reason=missing-player address=${address} requestId=${payload.requestId}`)
    return
  }

  skillState.activeSecondsRemaining = SERVER_TURN_TO_ROCK_DURATION_SECONDS
  skillState.cooldownSecondsRemaining = 0
  playerDoge.visualState = 'rock'

  sendTurnToRockResult(address, {
    requestId: payload.requestId,
    matchId: payload.matchId,
    outcome: 'activated',
    reason: '',
    playerId: payload.playerId,
    position: payload.position,
    yawDegrees: payload.yawDegrees,
    durationSeconds: SERVER_TURN_TO_ROCK_DURATION_SECONDS,
    cooldownSeconds: SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS,
  })
  console.log(`[Server][S] turnToRock activated address=${address} publicDoge=${player.publicDogeId} requestId=${payload.requestId}`)
  broadcastPublicMatchSnapshot('turn-to-rock')
  broadcastServerNpcSnapshot('turn-to-rock')
}

function handleRoundEndRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerRoundEndRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][S] roundEnd rejected invalid-payload address=${address}`)
    return
  }

  const rejectReason = getRoundEndRejectReason(payload.matchId, payload.reason)
  if (rejectReason) {
    sendRoundEndResult(address, buildRoundEndResult(payload.requestId, payload.matchId, 'rejected', rejectReason, address))
    console.log(`[Server][S] roundEnd rejected reason=${rejectReason} address=${address} requestId=${payload.requestId}`)
    return
  }

  if (activeMatch && activeMatch.phase !== 'ended') {
    endActiveMatch(payload.reason, findServerPublicPlayer(address) ?? undefined)
  }

  sendRoundEndResult(address, buildRoundEndResult(payload.requestId, payload.matchId, 'accepted', payload.reason, address))
  console.log(`[Server][S] roundEnd accepted reason=${payload.reason} address=${address} requestId=${payload.requestId}`)
  broadcastPublicMatchSnapshot('round-end-request')
  broadcastServerNpcSnapshot('round-end-request')
}

function handleDebugMarkOutRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerDebugMarkOutRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][T] debugMarkOut rejected invalid-payload address=${address}`)
    return
  }

  if (!activeMatch || activeMatch.matchId !== payload.matchId) {
    sendDebugMarkOutResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'missing-match',
      playerId: address,
      publicDogeId: '',
      status: 'out',
    })
    console.log(`[Server][T] debugMarkOut rejected reason=missing-match address=${address} requestId=${payload.requestId}`)
    return
  }

  if (activeMatch.phase !== 'active') {
    sendDebugMarkOutResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'match-ended',
      playerId: address,
      publicDogeId: '',
      status: 'out',
    })
    console.log(`[Server][T] debugMarkOut rejected reason=match-ended address=${address} requestId=${payload.requestId}`)
    return
  }

  const player = findServerPublicPlayer(address)
  if (!player) {
    sendDebugMarkOutResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'missing-player',
      playerId: address,
      publicDogeId: '',
      status: 'out',
    })
    console.log(`[Server][T] debugMarkOut rejected reason=missing-player address=${address} requestId=${payload.requestId}`)
    return
  }

  markServerPlayerAsSpectator(address, 'debug-self-out')
  const survivorEnded = maybeEndMatchByFinalSurvivor('debug-self-out')

  sendDebugMarkOutResult(address, {
    requestId: payload.requestId,
    matchId: payload.matchId,
    outcome: 'accepted',
    reason: '',
    playerId: player.playerId,
    publicDogeId: player.publicDogeId,
    status: player.status,
  })
  console.log(`[Server][T] debugMarkOut accepted address=${address} status=${player.status} publicDoge=${player.publicDogeId} requestId=${payload.requestId}`)
  broadcastPublicMatchSnapshot(survivorEnded ? 'final-survivor' : 'player-spectator')
  broadcastServerNpcSnapshot(survivorEnded ? 'final-survivor' : 'player-spectator')
}

function handleDebugEliminateAllRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerDebugEliminateAllRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][Admin] debug eliminate all rejected invalid-payload address=${address}`)
    return
  }

  if (!isDogeHuntAdmin(address)) {
    sendDebugEliminateAllResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'unauthorized',
      eliminatedCount: 0,
      roundOver: Boolean(activeMatch?.phase === 'ended'),
    })
    console.log(`[Server][Admin] debug eliminate all rejected unauthorized address=${address} requestId=${payload.requestId}`)
    return
  }

  if (!activeMatch || activeMatch.matchId !== payload.matchId) {
    sendDebugEliminateAllResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'missing-match',
      eliminatedCount: 0,
      roundOver: false,
    })
    console.log(`[Server][Admin] debug eliminate all rejected missing-match address=${address} requestId=${payload.requestId}`)
    return
  }

  if (activeMatch.phase !== 'active') {
    sendDebugEliminateAllResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'match-ended',
      eliminatedCount: 0,
      roundOver: true,
    })
    console.log(`[Server][Admin] debug eliminate all rejected match-ended address=${address} requestId=${payload.requestId}`)
    return
  }

  let eliminatedCount = 0
  const firstDecoyIndex = activeMatch.playerCount
  const lastDecoyIndex = firstDecoyIndex + activeMatch.decoyNpcCount
  for (let index = firstDecoyIndex; index < lastDecoyIndex; index++) {
    const decoy = activeMatch.publicDoges[index]
    if (!decoy || decoy.isEliminated) continue

    decoy.isEliminated = true
    decoy.visualState = 'eliminated'
    eliminatedCount += 1
  }

  const roundEnded = maybeEndMatchBySinglePlayerNpcClear('debug-eliminate-all')
  sendDebugEliminateAllResult(address, {
    requestId: payload.requestId,
    matchId: payload.matchId,
    outcome: 'accepted',
    reason: '',
    eliminatedCount,
    roundOver: roundEnded,
  })
  console.log(`[Server][Admin] debug eliminate all accepted address=${address} eliminated=${eliminatedCount} matchId=${payload.matchId} roundOver=${roundEnded}`)
  broadcastPublicMatchSnapshot(roundEnded ? 'debug-eliminate-all-ended' : 'debug-eliminate-all')
  broadcastServerNpcSnapshot(roundEnded ? 'debug-eliminate-all-ended' : 'debug-eliminate-all')
}

function handleDebugForceRoundEndRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerDebugForceRoundEndRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][T] debugForceRoundEnd rejected invalid-payload address=${address}`)
    return
  }

  if (!activeMatch || activeMatch.matchId !== payload.matchId) {
    sendDebugForceRoundEndResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'missing-match',
      roundOver: false,
    })
    console.log(`[Server][T] debugForceRoundEnd rejected reason=missing-match address=${address} requestId=${payload.requestId}`)
    return
  }

  if (activeMatch.phase === 'ended') {
    sendDebugForceRoundEndResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'match-ended',
      roundOver: true,
    })
    console.log(`[Server][T] debugForceRoundEnd rejected reason=match-ended address=${address} requestId=${payload.requestId}`)
    return
  }

  endActiveMatch('time-up')

  sendDebugForceRoundEndResult(address, {
    requestId: payload.requestId,
    matchId: payload.matchId,
    outcome: 'accepted',
    reason: '',
    roundOver: true,
  })
  console.log(`[Server][T] debugForceRoundEnd accepted address=${address} requestId=${payload.requestId}`)
  broadcastPublicMatchSnapshot('debug-force-round-end')
  broadcastServerNpcSnapshot('debug-force-round-end')
}

function handleDebugNpcFreezeRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerDebugNpcFreezeRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][Admin] debug NPC freeze rejected invalid-payload address=${address}`)
    return
  }

  if (!isDogeHuntAdmin(address)) {
    sendDebugNpcFreezeResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'unauthorized',
      isFrozen: Boolean(activeMatch?.npcsFrozen),
    })
    console.log(`[Server][Admin] debug NPC freeze rejected unauthorized address=${address} requestId=${payload.requestId}`)
    return
  }

  if (!activeMatch || activeMatch.matchId !== payload.matchId) {
    sendDebugNpcFreezeResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'missing-match',
      isFrozen: false,
    })
    console.log(`[Server][Admin] debug NPC freeze rejected missing-match address=${address} requestId=${payload.requestId}`)
    return
  }

  if (activeMatch.phase !== 'active') {
    sendDebugNpcFreezeResult(address, {
      requestId: payload.requestId,
      matchId: payload.matchId,
      outcome: 'rejected',
      reason: 'match-ended',
      isFrozen: activeMatch.npcsFrozen,
    })
    console.log(`[Server][Admin] debug NPC freeze rejected match-ended address=${address} requestId=${payload.requestId}`)
    return
  }

  activeMatch.npcsFrozen = !activeMatch.npcsFrozen
  if (activeMatch.npcsFrozen) {
    activeMatch.npcFrozenElapsedSeconds = activeMatch.elapsedSeconds
  }

  sendDebugNpcFreezeResult(address, {
    requestId: payload.requestId,
    matchId: payload.matchId,
    outcome: 'accepted',
    reason: '',
    isFrozen: activeMatch.npcsFrozen,
  })
  console.log(`[Server][Admin] debug NPC freeze accepted address=${address} frozen=${activeMatch.npcsFrozen} frozenElapsed=${activeMatch.npcFrozenElapsedSeconds.toFixed(2)} matchId=${payload.matchId} requestId=${payload.requestId}`)
  broadcastServerNpcSnapshot(activeMatch.npcsFrozen ? 'debug-npcs-frozen' : 'debug-npcs-resumed')
}

function broadcastRoomSnapshot(reason: string): void {
  const snapshot = buildRoomSnapshot()

  console.log(`[Server][P] roomSnapshot v=${snapshot.version} reason=${reason} players=${snapshot.playerCount}/${snapshot.maxPlayers} host=${snapshot.hostAddress || 'none'}`)
  void getDogeRoom().send('roomSnapshot', {
    snapshotJson: JSON.stringify(snapshot),
  })

  for (const member of [...players, ...spectators]) {
    const personalizedSnapshot = buildRoomSnapshotForRecipient(member.address, snapshot.version)
    void getDogeRoom().send('roomSnapshot', {
      snapshotJson: JSON.stringify(personalizedSnapshot),
    }, { to: [member.address] })
  }
}

function sendRoomSnapshotToAddress(address: string, reason: string): void {
  roomVersion += 1
  const normalizedAddress = normalizeAddress(address)
  touchRoomPlayer(normalizedAddress)
  const snapshot = buildRoomSnapshotForRecipient(normalizedAddress, roomVersion)

  console.log(`[Server][P] roomSnapshot v=${snapshot.version} reason=${reason || 'request'} to=${normalizedAddress} localInRoom=${snapshot.isLocalPlayerInRoom} localHost=${snapshot.localPlayerIsHost} players=${snapshot.playerCount}/${snapshot.maxPlayers}`)
  void getDogeRoom().send('roomSnapshot', {
    snapshotJson: JSON.stringify(snapshot),
  }, { to: [normalizedAddress] })

  sendActiveMatchResumeToAddress(normalizedAddress, reason)
}

function sendActiveMatchResumeToAddress(address: string, reason: string): void {
  if (!activeMatch || (activeMatch.phase !== 'active' && activeMatch.phase !== 'ended')) return

  const player = players.find((entry) => entry.address === address)
  const spectator = spectators.find((entry) => entry.address === address)
  if (!player && !spectator) return

  const payload = player
    ? createMatchStartPayload(player, activeMatch.matchId, activeMatch.publicDoges, activeMatch.version, true)
    : createSpectatorMatchStartPayload(spectator!, true)

  void getDogeRoom().send('matchStarted', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
  sendCurrentPublicMatchSnapshotToAddress(address, `resume:${reason || 'request'}`)
  console.log(`[Server][Resume] match session restored address=${address} matchId=${activeMatch.matchId} spectator=${Boolean(spectator)} phase=${activeMatch.phase}`)
}

function buildRoomSnapshot(): ServerRoomSnapshot {
  roomVersion += 1

  return buildRoomSnapshotForRecipient('', roomVersion)
}

function buildRoomSnapshotForRecipient(recipientAddress: string, version: number): ServerRoomSnapshot {
  const normalizedRecipientAddress = normalizeAddress(recipientAddress)
  const host = players.find((player) => player.isHost)
  const localPlayer = normalizedRecipientAddress
    ? players.find((player) => player.address === normalizedRecipientAddress)
    : undefined
  const localSpectator = normalizedRecipientAddress
    ? spectators.some((spectator) => spectator.address === normalizedRecipientAddress)
    : false
  const phase = activeMatch?.phase === 'active'
    ? 'active'
    : activeMatch?.phase === 'ended'
      ? 'settling'
      : pendingMatchStart
        ? 'starting'
        : players.length > 0
          ? 'waiting'
          : 'empty'
  const canHostStart = phase === 'waiting' && players.length >= 2 && players.every((player) => player.isHost || player.isReady)
  const canHostStartSolo = phase === 'waiting' && players.length === 1 && Boolean(host?.isReady)
  const settlingSecondsRemaining = activeMatch?.phase === 'ended'
    ? Math.max(0, Math.ceil(SERVER_ROOM_SETTLING_TIMEOUT_SECONDS - activeMatch.settlingElapsedSeconds))
    : 0

  return {
    roomId: SERVER_ROOM_ID,
    phase,
    recipientAddress: normalizedRecipientAddress,
    isLocalPlayerInRoom: Boolean(localPlayer),
    isLocalSpectator: localSpectator,
    localPlayerIsHost: Boolean(localPlayer?.isHost),
    localPlayerIsReady: Boolean(localPlayer?.isReady),
    players: [...players],
    spectatorCount: spectators.length,
    maxSpectators: SERVER_ROOM_MAX_SPECTATORS,
    playerCount: players.length,
    maxPlayers: SERVER_ROOM_MAX_PLAYERS,
    simulatedPlayerCount: 0,
    hostAddress: host?.address ?? '',
    hostDisplayName: host?.displayName ?? '',
    canHostStart,
    canHostStartSolo,
    startCountdownSeconds: pendingMatchStart ? Math.ceil(pendingMatchStart.countdownSeconds) : 0,
    canAddFakePlayer: false,
    canRemoveFakePlayer: false,
    settlingSecondsRemaining,
    version,
  }
}

function createMatchStartPayload(
  targetPlayer: ServerRoomPlayer,
  matchId: string,
  publicDoges: ReturnType<typeof createServerPublicDoges>,
  version: number,
  isResume = false
): ServerMatchStartPayload {
  const playerSlots = createPersonalizedPlayerSlots(targetPlayer)
  const playerCount = Math.max(1, players.length)
  const totalDoges = publicDoges.length
  const decoyNpcCount = Math.max(0, totalDoges - playerCount)
  const targetIndex = Math.max(0, players.findIndex((player) => player.address === targetPlayer.address))
  const localPublicDogeId = publicDoges[targetIndex]?.publicDogeId ?? `${matchId}-doge-1`
  const localSlot = playerSlots.find((slot) => slot.isLocal) ?? playerSlots[0]
  const localPrivatePlayer = createPrivatePlayerSeed(localSlot, localPublicDogeId)

  const matchConfig: LocalMatchConfig = {
    matchId,
    phase: 'active',
    totalDoges,
    playerCount,
    decoyNpcCount,
    playerSlots,
    localSpawnPoint: getMatchSpawnPoint(targetIndex, matchId),
  }

  return {
    matchConfig,
    recipientAddress: targetPlayer.address,
    serverMatchId: matchId,
    version,
    isResume,
    runtimeSeed: {
      source: 'server',
      localPlayerId: LOCAL_RUNTIME_PLAYER_ID,
      publicDoges,
      privatePlayers: [localPrivatePlayer],
      privateDogeIdentities: createPresentationDogeIdentities(
        publicDoges,
        playerCount,
        localPublicDogeId,
        LOCAL_RUNTIME_PLAYER_ID
      ),
    },
  }
}

function createSpectatorMatchStartPayload(spectator: ServerRoomSpectator, isResume = false): ServerMatchStartPayload {
  if (!activeMatch) {
    throw new Error('Cannot create spectator match payload without an active match')
  }

  const spectatorSlot: LocalMatchPlayerSlot = {
    playerId: LOCAL_RUNTIME_PLAYER_ID,
    displayName: spectator.displayName,
    isLocal: true,
    isHost: false,
    isSimulated: false,
    address: spectator.address,
  }
  const spectatorPrivatePlayer = createPrivatePlayerSeed(spectatorSlot, '')
  spectatorPrivatePlayer.isAlive = false
  spectatorPrivatePlayer.isSpectator = true
  const playerSlots = players.map((player) => ({
    playerId: player.address,
    displayName: player.displayName,
    isLocal: false,
    isHost: player.isHost,
    isSimulated: false,
    address: player.address,
  }))

  return {
    matchConfig: {
      matchId: activeMatch.matchId,
      phase: 'active',
      totalDoges: activeMatch.totalDoges,
      playerCount: activeMatch.playerCount,
      decoyNpcCount: activeMatch.decoyNpcCount,
      playerSlots,
    },
    recipientAddress: spectator.address,
    serverMatchId: activeMatch.matchId,
    version: activeMatch.version,
    isSpectator: true,
    isResume,
    runtimeSeed: {
      source: 'server',
      localPlayerId: LOCAL_RUNTIME_PLAYER_ID,
      publicDoges: activeMatch.publicDoges.map((doge) => ({ ...doge })),
      privatePlayers: [spectatorPrivatePlayer],
      privateDogeIdentities: [],
    },
  }
}

function setupServerRoomMaintenanceSystem(): void {
  if (roomMaintenanceSystemStarted) return
  roomMaintenanceSystemStarted = true

  engine.addSystem((dt: number) => {
    roomElapsedSeconds += dt
    roomPruneAccumulator += dt
    updatePendingMatchStart(dt)
    updateSettlingTimeout(dt)
    updateHeartbeatFinalSurvivorCheck(dt)

    if (roomPruneAccumulator < SERVER_ROOM_PRUNE_INTERVAL_SECONDS) return

    roomPruneAccumulator = 0
    pruneStaleRoomPlayers()
  })
}

function updatePendingMatchStart(dt: number): void {
  if (!pendingMatchStart) return

  pendingMatchStart.countdownSeconds = Math.max(0, pendingMatchStart.countdownSeconds - dt)
  const displaySeconds = Math.ceil(pendingMatchStart.countdownSeconds)
  if (displaySeconds !== pendingMatchStart.lastBroadcastSeconds) {
    pendingMatchStart.lastBroadcastSeconds = displaySeconds
    broadcastRoomSnapshot('match-countdown-tick')
  }

  if (pendingMatchStart.countdownSeconds <= 0) {
    beginPendingMatch()
  }
}

function updateHeartbeatFinalSurvivorCheck(dt: number): void {
  if (!activeMatch || activeMatch.phase !== 'active') return
  if (activeMatch.heartbeatFinalSurvivorCheckSeconds <= 0) return

  activeMatch.heartbeatFinalSurvivorCheckSeconds = Math.max(
    0,
    activeMatch.heartbeatFinalSurvivorCheckSeconds - dt
  )
  if (activeMatch.heartbeatFinalSurvivorCheckSeconds > 0) return

  const activePlayers = activeMatch.publicPlayers.filter((player) => player.isAlive && player.status === 'active')
  if (activePlayers.length !== 1) return

  const survivor = activePlayers[0]
  if (!isRoomPlayerRecentlySeen(survivor.address)) {
    console.log(`[Server][U] final survivor cancelled: remaining player is not heartbeating address=${survivor.address}`)
    return
  }

  endActiveMatch('final-survivor', survivor)
  console.log(`[Server][U] final survivor confirmed after heartbeat grace winner=${survivor.address} matchId=${activeMatch?.matchId ?? 'none'}`)
  broadcastPublicMatchSnapshot('final-survivor-heartbeat-confirmed')
  broadcastServerNpcSnapshot('final-survivor-heartbeat-confirmed')
}

function isRoomPlayerRecentlySeen(address: string): boolean {
  const lastSeen = playerLastSeenSeconds.get(normalizeAddress(address))
  return lastSeen !== undefined && roomElapsedSeconds - lastSeen <= SERVER_RECENT_HEARTBEAT_SECONDS
}

function updateSettlingTimeout(dt: number): void {
  if (!activeMatch || activeMatch.phase !== 'ended') return

  activeMatch.settlingElapsedSeconds += dt
  if (activeMatch.settlingElapsedSeconds < SERVER_ROOM_SETTLING_TIMEOUT_SECONDS) return

  releaseSettledRoom('settling-timeout')
}

function releaseSettledRoom(reason: string): void {
  if (!activeMatch || activeMatch.phase !== 'ended') return

  const matchId = activeMatch.matchId
  const removedPlayers = players.length

  activeMatch = null
  players = []
  playerLastSeenSeconds.clear()
  console.log(`[Server][U] settled room released reason=${reason} matchId=${matchId} removedPlayers=${removedPlayers}`)
  broadcastRoomSnapshot(reason)
}

function pruneStaleRoomPlayers(): void {
  if (players.length === 0 && spectators.length === 0) return

  const staleMembers = [...players, ...spectators].filter((member) => {
    const lastSeen = playerLastSeenSeconds.get(member.address)
    if (lastSeen === undefined) {
      playerLastSeenSeconds.set(member.address, roomElapsedSeconds)
      return false
    }

    return roomElapsedSeconds - lastSeen >= SERVER_ROOM_HEARTBEAT_TIMEOUT_SECONDS
  })

  for (const member of staleMembers) {
    const secondsSinceSeen = roomElapsedSeconds - (playerLastSeenSeconds.get(member.address) ?? roomElapsedSeconds)
    console.log(`[Server][P] room heartbeat timeout address=${member.address} stale=${secondsSinceSeen.toFixed(1)}s`)
    removePlayerFromRoom(member.address, 'heartbeat-timeout')
  }
}

function touchRoomPlayer(address: string): void {
  touchRoomMember(address)
}

function touchRoomMember(address: string): void {
  const normalizedAddress = normalizeAddress(address)
  if (!players.some((player) => player.address === normalizedAddress) && !spectators.some((spectator) => spectator.address === normalizedAddress)) return

  playerLastSeenSeconds.set(normalizedAddress, roomElapsedSeconds)
}

function setupServerPublicStateSystem(): void {
  if (publicStateSystemStarted) return
  publicStateSystemStarted = true

  engine.addSystem((dt: number) => {
    if (!activeMatch || activeMatch.phase === 'ended') return

    activeMatch.elapsedSeconds += dt
    activeMatch.tickAccumulator += dt
    activeMatch.poseTickAccumulator += dt

    if (updateServerPlayerSkills(dt)) {
      broadcastPublicMatchSnapshot('turn-to-rock-ended')
      broadcastServerNpcSnapshot('turn-to-rock-ended')
    }

    if (activeMatch.elapsedSeconds >= SERVER_ROUND_DURATION_SECONDS) {
      const timeUpWinner = getTimeUpWinner()
      endActiveMatch('time-up', timeUpWinner)
      console.log(`[Server][V] time-up winner=${timeUpWinner?.address ?? 'none'} matchId=${activeMatch.matchId}`)
      broadcastPublicMatchSnapshot('round-ended')
      broadcastServerNpcSnapshot('round-ended')
      return
    }

    if (activeMatch.tickAccumulator < 1) {
      if (activeMatch.poseTickAccumulator >= SERVER_PLAYER_POSE_BROADCAST_INTERVAL_SECONDS) {
        activeMatch.poseTickAccumulator = 0
        broadcastPublicMatchSnapshot('pose')
        broadcastServerNpcSnapshot('pose')
      }
      return
    }

    activeMatch.tickAccumulator = 0
    activeMatch.poseTickAccumulator = 0
    broadcastPublicMatchSnapshot('tick')
    broadcastServerNpcSnapshot('tick')
  })
}

function createActiveServerMatch(
  matchId: string,
  publicDoges: PublicDogeState[],
  version: number
): ActiveServerMatch {
  const playerCount = Math.max(1, players.length)
  const totalDoges = publicDoges.length
  const decoyNpcCount = Math.max(0, totalDoges - playerCount)

  return {
    matchId,
    version,
    phase: 'active',
    totalDoges,
    playerCount,
    decoyNpcCount,
    publicDoges: publicDoges.map((doge) => ({ ...doge })),
    publicPlayers: players.map((player, index) => ({
      playerId: player.address,
      displayName: player.displayName,
      address: player.address,
      publicDogeId: publicDoges[index]?.publicDogeId ?? `${matchId}-doge-1`,
      isHost: player.isHost,
      isAlive: true,
      status: 'active',
      bonks: 0,
      eliminationOrder: 0,
      eliminatedAtSeconds: 0,
    })),
    playerSkills: players.map((player) => ({
      address: player.address,
      activeSecondsRemaining: 0,
      cooldownSecondsRemaining: 0,
    })),
    elapsedSeconds: 0,
    npcsFrozen: false,
    npcFrozenElapsedSeconds: 0,
    tickAccumulator: 0,
    poseTickAccumulator: 0,
    heartbeatFinalSurvivorCheckSeconds: 0,
    endReason: null,
    winnerAddress: '',
    winnerDisplayName: '',
    winnerPublicDogeId: '',
    nextEliminationOrder: 1,
    settlingElapsedSeconds: 0,
  }
}

function broadcastPublicMatchSnapshot(reason: string): void {
  if (!activeMatch) return

  activeMatch.version += 1
  refreshPublicPlayerPoses()
  const snapshot = createPublicMatchSnapshot(reason)

  void getDogeRoom().send('publicStateSnapshot', {
    snapshotJson: JSON.stringify(snapshot),
  })
  if (reason !== 'pose') {
    console.log(`[Server][R] publicStateSnapshot sent reason=${reason} matchId=${snapshot.matchId} version=${snapshot.version} targetAlive=${snapshot.targetDogesAlive}/${snapshot.targetDogesTotal} publicAlive=${snapshot.publicAliveDoges}/${snapshot.totalDoges} timeLeft=${snapshot.timeLeftSeconds}`)
  }
}

function sendCurrentPublicMatchSnapshotToAddress(address: string, reason: string): void {
  if (!activeMatch) return

  refreshPublicPlayerPoses()
  const snapshot = createPublicMatchSnapshot(reason)
  void getDogeRoom().send('publicStateSnapshot', {
    snapshotJson: JSON.stringify(snapshot),
  }, { to: [address] })
  console.log(`[Server][Resume] public state restored address=${address} matchId=${snapshot.matchId} version=${snapshot.version} roundOver=${snapshot.roundOver}`)
}

function createPublicMatchSnapshot(reason: string): ServerPublicMatchSnapshot {
  if (!activeMatch) {
    throw new Error('Cannot create public match snapshot without an active match')
  }

  const elapsedSeconds = Math.floor(activeMatch.elapsedSeconds)
  const timeLeftSeconds = Math.max(0, SERVER_ROUND_DURATION_SECONDS - elapsedSeconds)
  return {
    source: 'server',
    matchId: activeMatch.matchId,
    version: activeMatch.version,
    reason,
    phase: activeMatch.phase,
    totalDoges: activeMatch.totalDoges,
    playerCount: activeMatch.playerCount,
    decoyNpcCount: activeMatch.decoyNpcCount,
    publicDoges: activeMatch.publicDoges.map((doge) => ({ ...doge })),
    players: activeMatch.publicPlayers.map((player) => ({ ...player })),
    publicAliveDoges: countAlivePublicDoges(activeMatch.publicDoges),
    targetDogesAlive: countAliveTargetDoges(
      activeMatch.publicDoges,
      activeMatch.playerCount,
      activeMatch.decoyNpcCount
    ),
    targetDogesTotal: activeMatch.decoyNpcCount,
    elapsedSeconds,
    timeLeftSeconds,
    roundOver: activeMatch.phase === 'ended' || timeLeftSeconds <= 0,
    endReason: activeMatch.endReason ?? '',
    winnerAddress: activeMatch.winnerAddress,
    winnerDisplayName: activeMatch.winnerDisplayName,
    winnerPublicDogeId: activeMatch.winnerPublicDogeId,
  }
}

function refreshPublicPlayerPoses(): void {
  if (!activeMatch) return

  for (const player of activeMatch.publicPlayers) {
    const transform = findServerPlayerTransform(player.address)
    if (!transform) continue

    player.pose = {
      position: {
        x: transform.position.x,
        y: transform.position.y,
        z: transform.position.z,
      },
      rotation: {
        x: transform.rotation.x,
        y: transform.rotation.y,
        z: transform.rotation.z,
        w: transform.rotation.w,
      },
    }
  }
}

function broadcastServerNpcSnapshot(reason: string): void {
  if (!activeMatch) return

  const decoyDoges = activeMatch.publicDoges.slice(
    activeMatch.playerCount,
    activeMatch.playerCount + activeMatch.decoyNpcCount
  )
  const payload = createServerNpcSnapshot({
    matchId: activeMatch.matchId,
    version: activeMatch.version,
    elapsedSeconds: getServerNpcSimulationElapsedSeconds(),
    isFrozen: activeMatch.npcsFrozen,
    publicDoges: decoyDoges,
  })

  void getDogeRoom().send('npcStateSnapshot', {
    payloadJson: JSON.stringify(payload),
  })
  if (reason !== 'pose') {
    console.log(`[Server][W2] npcStateSnapshot sent reason=${reason} matchId=${payload.matchId} version=${payload.version} npcs=${payload.npcs.length} frozen=${payload.isFrozen}`)
  }
}

function getServerNpcSimulationElapsedSeconds(): number {
  if (!activeMatch) return 0

  return activeMatch.npcsFrozen
    ? activeMatch.npcFrozenElapsedSeconds
    : activeMatch.elapsedSeconds
}

function updateServerPlayerSkills(dt: number): boolean {
  if (!activeMatch) return false

  let changedPublicState = false

  for (const skillState of activeMatch.playerSkills) {
    if (skillState.activeSecondsRemaining > 0) {
      skillState.activeSecondsRemaining = Math.max(0, skillState.activeSecondsRemaining - dt)

      if (skillState.activeSecondsRemaining <= 0) {
        const player = findServerPublicPlayer(skillState.address)
        const doge = player ? findServerPublicDoge(player.publicDogeId) : null
        if (doge && !doge.isEliminated) {
          doge.visualState = 'doge'
          changedPublicState = true
        }

        skillState.cooldownSecondsRemaining = SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS
        console.log(`[Server][S] turnToRock ended address=${skillState.address} cooldown=${SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS}`)
      }

      continue
    }

    if (skillState.cooldownSecondsRemaining > 0) {
      skillState.cooldownSecondsRemaining = Math.max(0, skillState.cooldownSecondsRemaining - dt)
    }
  }

  return changedPublicState
}

function markServerPlayerAsSpectator(address: string, reason: string, attackerDisplayName = ''): boolean {
  const player = findServerPublicPlayer(address)
  if (!player || !activeMatch) return false
  if (activeMatch.phase !== 'active') return false
  if (!player.isAlive && player.status === 'spectator') return false

  player.isAlive = false
  player.status = 'spectator'
  player.eliminatedByDisplayName = attackerDisplayName
  if (!player.eliminationOrder) {
    player.eliminationOrder = activeMatch.nextEliminationOrder
    activeMatch.nextEliminationOrder += 1
    player.eliminatedAtSeconds = Math.floor(activeMatch.elapsedSeconds)
  }

  const publicDoge = findServerPublicDoge(player.publicDogeId)
  if (publicDoge) {
    publicDoge.isEliminated = true
    publicDoge.visualState = 'eliminated'
  }

  const skillState = findServerPlayerSkill(address)
  if (skillState) {
    skillState.activeSecondsRemaining = 0
    skillState.cooldownSecondsRemaining = 0
  }

  console.log(`[Server][U] player marked spectator address=${address} reason=${reason} matchId=${activeMatch.matchId}`)
  return true
}

function syncActiveMatchHostFlags(): void {
  if (!activeMatch) return

  for (const publicPlayer of activeMatch.publicPlayers) {
    const roomPlayer = players.find((player) => player.address === publicPlayer.address)
    publicPlayer.isHost = Boolean(roomPlayer?.isHost)
  }
}

function resetActiveMatch(reason: string): void {
  if (!activeMatch) return

  console.log(`[Server][U] activeMatch reset reason=${reason} matchId=${activeMatch.matchId} phase=${activeMatch.phase}`)
  activeMatch = null
  if (spectators.length > 0) {
    console.log(`[Server][Spectator] match reset removed spectators=${spectators.length}`)
    spectators = []
  }
}

function resolveServerBonkTarget(
  attackerAddress: string,
  requestedPublicDogeId: string,
  aimedPlayerPublicDogeId: string,
  attackPose: ServerAttackPose | null,
  playerAimPose: ServerAttackPose | null,
  hitEnvelope: ServerBonkHitEnvelope,
  debugNpcSpatialBypass = false
): ServerBonkTarget | ServerBonkRejectReason {
  if (!activeMatch) return 'missing-match'

  if (!debugNpcSpatialBypass) {
    const playerTarget = resolveServerPlayerBonkTarget(
      attackerAddress,
      aimedPlayerPublicDogeId,
      playerAimPose,
      hitEnvelope
    )
    if (playerTarget) return playerTarget
  }
  if (!requestedPublicDogeId) return 'invalid-target'

  const targetIndex = activeMatch.publicDoges.findIndex((doge) => doge.publicDogeId === requestedPublicDogeId)
  if (targetIndex < 0) return 'invalid-target'

  const publicDoge = activeMatch.publicDoges[targetIndex]
  if (publicDoge.isEliminated) return 'already-eliminated'

  if (targetIndex < activeMatch.playerCount) {
    return 'invalid-target'
  }

  if (debugNpcSpatialBypass) {
    console.log(`[Server][Admin] debug NPC spatial bypass accepted address=${attackerAddress} doge=${publicDoge.publicDogeId}`)
    return {
      kind: 'decoy',
      publicDoge,
      targetPlayer: null,
    }
  }

  if (!attackPose) return 'invalid-target'

  const decoyIndex = targetIndex - activeMatch.playerCount
  const npcSimulationElapsedSeconds = getServerNpcSimulationElapsedSeconds()
  const currentPose = getServerNpcTransform(
    publicDoge.publicDogeId,
    decoyIndex,
    npcSimulationElapsedSeconds
  )
  const compensatedPose = getServerNpcTransform(
    publicDoge.publicDogeId,
    decoyIndex,
    activeMatch.npcsFrozen
      ? npcSimulationElapsedSeconds
      : Math.max(0, npcSimulationElapsedSeconds - SERVER_NPC_HIT_LAG_COMPENSATION_SECONDS)
  )
  const currentMeasurement = measureServerBonkPosition(attackPose, currentPose, hitEnvelope)
  const compensatedMeasurement = measureServerBonkPosition(attackPose, compensatedPose, hitEnvelope)

  if (!currentMeasurement.inArc && !compensatedMeasurement.inArc) {
    console.log(`[Server][Combat] npcSpatial rejected attacker=${attackerAddress} doge=${publicDoge.publicDogeId} currentDistance=${formatServerAuditNumber(currentMeasurement.distance)} compensatedDistance=${formatServerAuditNumber(compensatedMeasurement.distance)} range=${formatServerAuditNumber(hitEnvelope.range)} radius=${formatServerAuditNumber(hitEnvelope.radius)}`)
    return 'invalid-target'
  }

  console.log(`[Server][Combat] npcSpatial accepted attacker=${attackerAddress} doge=${publicDoge.publicDogeId} compensated=${currentMeasurement.inArc ? 'no' : 'yes'} range=${formatServerAuditNumber(hitEnvelope.range)} radius=${formatServerAuditNumber(hitEnvelope.radius)}`)

  return {
    kind: 'decoy',
    publicDoge,
    targetPlayer: null,
  }
}

function resolveServerPlayerBonkTarget(
  attackerAddress: string,
  aimedPlayerPublicDogeId: string,
  aimPose: ServerAttackPose | null,
  hitEnvelope: ServerBonkHitEnvelope
): ServerBonkTarget | ServerBonkRejectReason | null {
  if (!activeMatch) return null
  if (!aimedPlayerPublicDogeId) return null

  const requestedPlayer = findServerPublicPlayerByDogeId(aimedPlayerPublicDogeId)
  if (!requestedPlayer) {
    console.log(`[Server][RayBonk] player rejected reason=unknown-aimed-player attacker=${attackerAddress} aimed=${aimedPlayerPublicDogeId}`)
    return 'invalid-target'
  }

  if (requestedPlayer.address === attackerAddress) {
    console.log(`[Server][RayBonk] player rejected reason=self-target attacker=${attackerAddress} aimed=${aimedPlayerPublicDogeId}`)
    return 'self-target'
  }

  if (!requestedPlayer.isAlive || requestedPlayer.status !== 'active') {
    console.log(`[Server][RayBonk] player rejected reason=already-eliminated attacker=${attackerAddress} aimed=${aimedPlayerPublicDogeId}`)
    return 'already-eliminated'
  }

  if (!aimPose) {
    console.log(`[Server][RayBonk] player rejected reason=missing-aim-pose attacker=${attackerAddress} aimed=${aimedPlayerPublicDogeId}`)
    return 'invalid-target'
  }

  const publicDoge = findServerPublicDoge(requestedPlayer.publicDogeId)
  const measurement = measureServerPlayerBonkCandidate(aimPose, requestedPlayer.address, hitEnvelope)
  console.log(`[Server][RayBonk] player validate attacker=${attackerAddress} aimed=${aimedPlayerPublicDogeId} targetAddress=${requestedPlayer.address} transform=${measurement.transformFound ? 'yes' : 'no'} forward=${formatServerAuditNumber(measurement.forwardDistance)} lateral=${formatServerAuditNumber(measurement.lateralDistance)} distance=${formatServerAuditNumber(measurement.distance)} inArc=${measurement.inArc ? 'yes' : 'no'}`)

  if (!publicDoge || publicDoge.isEliminated) return 'already-eliminated'
  if (!measurement.inArc || measurement.distance === null) {
    return 'invalid-target'
  }

  return {
    kind: 'player',
    publicDoge,
    targetPlayer: requestedPlayer,
  }
}

function measureServerPlayerBonkCandidate(
  attackPose: ServerAttackPose,
  targetAddress: string,
  hitEnvelope: ServerBonkHitEnvelope
): ServerPlayerBonkMeasurement {
  const targetTransform = findServerPlayerTransform(targetAddress)
  if (!targetTransform) {
    return {
      transformFound: false,
      distance: null,
      forwardDistance: null,
      lateralDistance: null,
      inArc: false,
    }
  }

  return measureServerBonkPosition(attackPose, targetTransform.position, hitEnvelope)
}

function measureServerBonkPosition(
  attackPose: ServerAttackPose,
  targetPosition: { x: number; z: number },
  hitEnvelope: ServerBonkHitEnvelope
): ServerPlayerBonkMeasurement {
  const toTarget = Vector3.subtract(
    Vector3.create(targetPosition.x, 0, targetPosition.z),
    attackPose.origin
  )
  const forwardDistance = Vector3.dot(toTarget, attackPose.forward)

  const projected = Vector3.scale(attackPose.forward, forwardDistance)
  const lateralOffset = Vector3.subtract(toTarget, projected)
  const lateralDistance = Vector3.length(lateralOffset)
  const distance = Vector3.length(toTarget)

  return {
    transformFound: true,
    distance,
    forwardDistance,
    lateralDistance,
    inArc: forwardDistance >= hitEnvelope.minForward
      && forwardDistance <= hitEnvelope.range
      && lateralDistance <= hitEnvelope.radius,
  }
}

function getServerAttackPose(address: string): ServerAttackPose | null {
  const transform = findServerPlayerTransform(address)
  if (!transform) return null

  const rawForward = Vector3.rotate(Vector3.Forward(), transform.rotation)
  const flatForward = Vector3.create(rawForward.x, 0, rawForward.z)
  const flatForwardLength = Vector3.length(flatForward)
  const forward = flatForwardLength > 0.001
    ? Vector3.normalize(flatForward)
    : Vector3.Forward()

  return {
    origin: Vector3.create(transform.position.x, 0, transform.position.z),
    forward,
  }
}

function getValidatedServerAttackPose(
  address: string,
  clientOrigin: { x: number; y: number; z: number },
  clientYawDegrees: number
): ServerAttackPose | null {
  const authoritativePose = getServerAttackPose(address)
  if (!authoritativePose) return null

  const claimedOrigin = Vector3.create(clientOrigin.x, 0, clientOrigin.z)
  const originDelta = Vector3.distance(authoritativePose.origin, claimedOrigin)
  const authoritativeYaw = Math.atan2(authoritativePose.forward.x, authoritativePose.forward.z) * 180 / Math.PI
  const yawDelta = Math.abs(wrapServerAngleDegrees(clientYawDegrees - authoritativeYaw))

  const yawRadians = clientYawDegrees * Math.PI / 180
  const compensatedPose = {
    origin: originDelta <= SERVER_BONK_CLIENT_ORIGIN_TOLERANCE
      ? claimedOrigin
      : authoritativePose.origin,
    forward: Vector3.create(Math.sin(yawRadians), 0, Math.cos(yawRadians)),
  }

  if (originDelta > SERVER_BONK_CLIENT_ORIGIN_TOLERANCE) {
    console.log(`[Server][Combat] client attack origin rejected address=${address} originDelta=${formatServerAuditNumber(originDelta)} using=server-origin`)
  } else if (originDelta >= 0.1) {
    console.log(`[Server][Combat] client attack origin compensated address=${address} originDelta=${formatServerAuditNumber(originDelta)}`)
  }

  if (yawDelta > SERVER_BONK_CLIENT_YAW_AUDIT_DEGREES) {
    console.log(`[Server][Combat] client attack yaw divergence accepted address=${address} yawDelta=${formatServerAuditNumber(yawDelta)}`)
  }

  return compensatedPose
}

function getServerAimPose(attackPose: ServerAttackPose, aimYawDegrees: number): ServerAttackPose {
  const yawRadians = aimYawDegrees * Math.PI / 180
  return {
    origin: attackPose.origin,
    forward: Vector3.create(Math.sin(yawRadians), 0, Math.cos(yawRadians)),
  }
}

function wrapServerAngleDegrees(angle: number): number {
  let wrapped = angle
  while (wrapped > 180) wrapped -= 360
  while (wrapped < -180) wrapped += 360
  return wrapped
}

function findServerPlayerTransform(address: string): ServerPlayerTransform | null {
  const targetAddress = normalizeAddress(address)

  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    if (normalizeAddress(identity.address) !== targetAddress) continue

    const transform = Transform.getOrNull(entity)
    if (!transform) return null

    return {
      position: transform.position,
      rotation: transform.rotation,
    }
  }

  return null
}

function formatServerAuditNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'

  return value.toFixed(2)
}

function formatServerVectorXZ(value: { x: number; z: number }): string {
  return `${formatServerAuditNumber(value.x)},${formatServerAuditNumber(value.z)}`
}

function maybeEndMatchByFinalSurvivor(trigger: string): boolean {
  if (!activeMatch || activeMatch.phase !== 'active') return false
  if (activeMatch.playerCount <= 1) return false

  const activePlayers = activeMatch.publicPlayers.filter((player) => {
    return player.isAlive && player.status === 'active'
  })
  if (activePlayers.length !== 1) return false

  endActiveMatch('final-survivor', activePlayers[0])
  console.log(`[Server][V] final survivor trigger=${trigger} winner=${activePlayers[0].address} matchId=${activeMatch.matchId}`)
  return true
}

function maybeEndMatchBySinglePlayerNpcClear(trigger: string, winner?: ServerPublicPlayerState): boolean {
  if (!activeMatch || activeMatch.phase !== 'active') return false
  if (activeMatch.playerCount !== 1) return false
  if (getServerTargetDogesAlive() > 0) return false

  const winningPlayer = winner ?? activeMatch.publicPlayers.find((player) => {
    return player.isAlive && player.status === 'active'
  })
  endActiveMatch('all-doges-eliminated', winningPlayer)
  console.log(`[Server][V] single-player npc clear trigger=${trigger} winner=${winningPlayer?.address ?? 'none'} matchId=${activeMatch.matchId}`)
  return true
}

function getTimeUpWinner(): ServerPublicPlayerState | undefined {
  if (!activeMatch || activeMatch.playerCount <= 1) return undefined

  // Use the exact same ranking order that the results UI and score awards use.
  const ranked = rankServerPlayers(activeMatch.publicPlayers, '')
  const topPlayer = ranked[0]
  if (!topPlayer) return undefined

  return activeMatch.publicPlayers.find((player) => {
    return normalizeAddress(player.address) === normalizeAddress(topPlayer.address)
  })
}

function endActiveMatch(reason: LocalRoundEndReason, winner?: ServerPublicPlayerState): void {
  if (!activeMatch || activeMatch.phase === 'ended') return

  activeMatch.phase = 'ended'
  activeMatch.endReason = reason
  activeMatch.tickAccumulator = 0
  activeMatch.settlingElapsedSeconds = 0

  if (reason === 'time-up') {
    activeMatch.elapsedSeconds = SERVER_ROUND_DURATION_SECONDS
  }

  if (winner) {
    activeMatch.winnerAddress = winner.address
    activeMatch.winnerDisplayName = winner.displayName
    activeMatch.winnerPublicDogeId = winner.publicDogeId
  } else {
    activeMatch.winnerAddress = ''
    activeMatch.winnerDisplayName = ''
    activeMatch.winnerPublicDogeId = ''
  }

  console.log(`[Server][V] activeMatch ended reason=${reason} winner=${activeMatch.winnerAddress || 'none'} matchId=${activeMatch.matchId}`)

  const leaderboardMatchId = activeMatch.matchId

  void awardMatchLeaderboardPoints({
    matchId: leaderboardMatchId,
    playerCount: activeMatch.playerCount,
    endReason: reason,
    winnerAddress: activeMatch.winnerAddress,
    publicPlayers: activeMatch.publicPlayers,
  }).then((persisted) => {
    if (!persisted) {
      console.log(`[Server][LB] Match ended without a persisted leaderboard award matchId=${leaderboardMatchId}`)
    }
  })

  broadcastRoomSnapshot('match-ended')
}

function getBonkBaseRejectReason(
  address: string,
  matchId: string
): ServerBonkRejectReason | null {
  if (!activeMatch || activeMatch.matchId !== matchId) return 'missing-match'
  if (activeMatch.phase !== 'active') return 'match-ended'
  const player = findServerPublicPlayer(address)
  if (!player) return 'missing-player'
  if (!player.isAlive || player.status !== 'active') return 'eliminated'

  return null
}

function getTurnToRockRejectReason(
  address: string,
  matchId: string
): ServerTurnToRockRejectReason | null {
  if (!activeMatch || activeMatch.matchId !== matchId) return 'missing-match'
  if (activeMatch.phase !== 'active') return 'match-ended'

  const player = findServerPublicPlayer(address)
  if (!player) return 'missing-player'
  if (!player.isAlive || player.status !== 'active') return 'eliminated'

  const doge = findServerPublicDoge(player.publicDogeId)
  if (!doge || doge.isEliminated) return 'eliminated'

  const skillState = findServerPlayerSkill(address)
  if (!skillState) return 'missing-player'
  if (skillState.activeSecondsRemaining > 0) return 'already-active'
  if (skillState.cooldownSecondsRemaining > 0) return 'cooldown'

  return null
}

function getRoundEndRejectReason(
  matchId: string,
  reason: string
): ServerRoundEndRejectReason | null {
  if (!activeMatch || activeMatch.matchId !== matchId) return 'missing-match'
  if (reason !== 'all-doges-eliminated' && reason !== 'time-up' && reason !== 'final-survivor') return 'invalid-reason'
  if (activeMatch.phase === 'ended') return null

  const serverTimeLeft = getServerTimeLeftSeconds()
  const activePlayers = getActiveServerPlayerCount()

  if (reason === 'time-up' && serverTimeLeft <= 0) return null
  if (reason === 'all-doges-eliminated' && activeMatch.playerCount === 1 && getServerTargetDogesAlive() <= 0) return null
  if (reason === 'final-survivor' && activeMatch.playerCount > 1 && activePlayers === 1) return null

  return 'round-not-over'
}

function buildBonkResult(
  payload: { requestId: string; matchId: string; targetPublicDogeId: string; origin: { x: number; y: number; z: number }; platform: ServerBonkRequestPlatform },
  outcome: 'accepted' | 'rejected',
  reason: ServerBonkRejectReason | '',
  bonks: number,
  resolvedTargetPublicDogeId = payload.targetPublicDogeId
): ServerBonkResultPayload {
  const hitEnvelope = getServerBonkHitEnvelope(payload.platform)
  return {
    requestId: payload.requestId,
    matchId: payload.matchId,
    outcome,
    reason,
    targetPublicDogeId: resolvedTargetPublicDogeId,
    origin: payload.origin,
    bonks,
    targetDogesAlive: getServerTargetDogesAlive(),
    targetDogesTotal: activeMatch?.decoyNpcCount ?? 0,
    roundOver: activeMatch?.phase === 'ended',
    serverPlatform: payload.platform,
    validatedRange: hitEnvelope.range,
    validatedRadius: hitEnvelope.radius,
  }
}

function buildRoundEndResult(
  requestId: string,
  matchId: string,
  outcome: 'accepted' | 'rejected',
  reason: ServerRoundEndResultPayload['reason'],
  address: string
): ServerRoundEndResultPayload {
  const resultReason = outcome === 'accepted' && activeMatch?.endReason
    ? activeMatch.endReason
    : reason

  return {
    requestId,
    matchId,
    outcome,
    reason: resultReason,
    bonks: getServerPlayerBonks(address),
    aliveDoges: getServerTargetDogesAlive(),
    totalDoges: activeMatch?.decoyNpcCount ?? 0,
    timeLeftSeconds: getServerTimeLeftSeconds(),
    elapsedSeconds: getServerElapsedSeconds(),
    roundOver: activeMatch?.phase === 'ended',
  }
}

function sendBonkResult(address: string, payload: ServerBonkResultPayload): void {
  void getDogeRoom().send('bonkResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function sendTurnToRockResult(address: string, payload: ServerTurnToRockResultPayload): void {
  void getDogeRoom().send('turnToRockResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function sendRoundEndResult(address: string, payload: ServerRoundEndResultPayload): void {
  void getDogeRoom().send('roundEndResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function sendDebugMarkOutResult(address: string, payload: ServerDebugMarkOutResultPayload): void {
  void getDogeRoom().send('debugMarkOutResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function sendDebugEliminateAllResult(address: string, payload: ServerDebugEliminateAllResultPayload): void {
  void getDogeRoom().send('debugEliminateAllResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function sendDebugForceRoundEndResult(address: string, payload: ServerDebugForceRoundEndResultPayload): void {
  void getDogeRoom().send('debugForceRoundEndResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function sendDebugNpcFreezeResult(address: string, payload: ServerDebugNpcFreezeResultPayload): void {
  void getDogeRoom().send('debugNpcFreezeResult', {
    payloadJson: JSON.stringify(payload),
  }, { to: [address] })
}

function findServerPublicPlayer(address: string): ServerPublicPlayerState | null {
  if (!activeMatch) return null

  return activeMatch.publicPlayers.find((player) => player.address === address) ?? null
}

function findServerPublicPlayerByDogeId(publicDogeId: string): ServerPublicPlayerState | null {
  if (!activeMatch) return null

  return activeMatch.publicPlayers.find((player) => player.publicDogeId === publicDogeId) ?? null
}

function findServerPlayerSkill(address: string): ServerPlayerSkillState | null {
  if (!activeMatch) return null

  return activeMatch.playerSkills.find((skill) => skill.address === address) ?? null
}

function findServerPublicDoge(publicDogeId: string): PublicDogeState | null {
  if (!activeMatch) return null

  return activeMatch.publicDoges.find((doge) => doge.publicDogeId === publicDogeId) ?? null
}

function getServerTargetDogesAlive(): number {
  if (!activeMatch) return 0

  return countAliveTargetDoges(
    activeMatch.publicDoges,
    activeMatch.playerCount,
    activeMatch.decoyNpcCount
  )
}

function getActiveServerPlayerCount(): number {
  if (!activeMatch) return 0

  return activeMatch.publicPlayers.filter((player) => {
    return player.isAlive && player.status === 'active'
  }).length
}

function getServerPlayerBonks(address: string): number {
  return findServerPublicPlayer(address)?.bonks ?? 0
}

function getServerElapsedSeconds(): number {
  return Math.floor(activeMatch?.elapsedSeconds ?? 0)
}

function getServerTimeLeftSeconds(): number {
  return Math.max(0, SERVER_ROUND_DURATION_SECONDS - getServerElapsedSeconds())
}

function createPersonalizedPlayerSlots(targetPlayer: ServerRoomPlayer): LocalMatchPlayerSlot[] {
  return players.map((player) => ({
    playerId: player.address === targetPlayer.address
      ? LOCAL_RUNTIME_PLAYER_ID
      : player.address,
    displayName: player.displayName,
    isLocal: player.address === targetPlayer.address,
    isHost: player.isHost,
    isSimulated: false,
    address: player.address,
  }))
}

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

function normalizeDisplayName(displayName: string, address: string): string {
  const normalized = displayName.trim().slice(0, 24)
  return normalized || 'Player'
}
