import type { EventContext } from '@dcl/sdk/network/events'
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { getDogeRoom } from '../shared/messages'
import {
  SERVER_ROOM_ID,
  SERVER_ROOM_MAX_PLAYERS,
  type ServerRoomPlayer,
  type ServerRoomSnapshot,
} from '../shared/serverRoom'
import {
  createPresentationDogeIdentities,
  createPrivatePlayerSeed,
  createServerPublicDoges,
  LOCAL_RUNTIME_PLAYER_ID,
  SERVER_TOTAL_DOGES,
  type ServerMatchStartPayload,
} from '../shared/serverMatch'
import {
  SERVER_TURN_TO_ROCK_COOLDOWN_SECONDS,
  SERVER_TURN_TO_ROCK_DURATION_SECONDS,
  parseServerBonkActionRequestPayload,
  parseServerBonkRequestPayload,
  parseServerDebugForceRoundEndRequestPayload,
  parseServerDebugMarkOutRequestPayload,
  parseServerRoundEndRequestPayload,
  parseServerTurnToRockRequestPayload,
  type ServerBonkActionEventPayload,
  type ServerBonkRejectReason,
  type ServerBonkResultPayload,
  type ServerDebugForceRoundEndResultPayload,
  type ServerDebugMarkOutResultPayload,
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
  type ServerPublicPlayerState,
} from '../shared/serverPublicState'
import { createServerNpcSnapshot } from '../shared/serverNpcSnapshot'
import { getMatchSpawnPoint } from '../shared/playerSpawns'
import type { LocalRoundEndReason, PublicDogeState } from '../localMatchState'
import type { LocalMatchConfig, LocalMatchPlayerSlot } from '../localMatch'
import {
  awardMatchLeaderboardPoints,
  getLeaderboardExportSnapshot,
  getPublicLeaderboardSnapshot,
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
  tickAccumulator: number
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

type ServerPlayerTransform = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

type ServerPlayerBonkMeasurement = {
  transformFound: boolean
  distance: number | null
  forwardDistance: number | null
  lateralDistance: number | null
  inArc: boolean
}

type ServerPlayerBonkCandidate = {
  player: ServerPublicPlayerState
  publicDoge: PublicDogeState
  measurement: ServerPlayerBonkMeasurement
}

const SERVER_BONK_MIN_FORWARD = 0.15
const SERVER_BONK_RANGE = 3.6
const SERVER_BONK_RADIUS = 2.45
const SERVER_ROOM_HEARTBEAT_TIMEOUT_SECONDS = 12
const SERVER_ROOM_PRUNE_INTERVAL_SECONDS = 2
const SERVER_ROOM_SETTLING_TIMEOUT_SECONDS = 30
const LEADERBOARD_EXPORT_ADMIN_ADDRESS = '0x797066a17f83425c1b4c7a8cca52d19095520a52'

let serverLobbyStarted = false
let roomMaintenanceSystemStarted = false
let publicStateSystemStarted = false
let players: ServerRoomPlayer[] = []
let playerLastSeenSeconds = new Map<string, number>()
let roomElapsedSeconds = 0
let roomPruneAccumulator = 0
let roomVersion = 0
let matchVersion = 0
let nextMatchId = 1
let activeMatch: ActiveServerMatch | null = null

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

    handleRequestStartMatch(context, data.requestId)
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

  room.onMessage('debugForceRoundEndRequest', (data, context) => {
    if (!context) return

    handleDebugForceRoundEndRequest(context, data.payloadJson)
  })

  setupServerRoomMaintenanceSystem()
  setupServerPublicStateSystem()

  console.log(`[Server][P] Server lobby handlers registered. roomId=${SERVER_ROOM_ID}`)
}

function handleJoinRoom(context: EventContext, displayName: string): void {
  const address = normalizeAddress(context.from)
  const existingPlayer = players.find((player) => player.address === address)

  if (activeMatch && !existingPlayer) {
    console.log(`[Server][U] joinRoom rejected match-${activeMatch.phase} address=${address} matchId=${activeMatch.matchId}`)
    void getDogeRoom().send('roomError', {
      code: activeMatch.phase === 'active' ? 'match-active' : 'match-settling',
      message: activeMatch.phase === 'active'
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

  if (existingPlayer) {
    existingPlayer.displayName = normalizeDisplayName(displayName, address)
    touchRoomPlayer(address)
    console.log(`[Server][P] joinRoom refreshed address=${address} ready=${existingPlayer.isReady} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS}`)
  } else {
    const isHost = players.length === 0
    players.push({
      id: address,
      address,
      displayName: normalizeDisplayName(displayName, address),
      isHost,
      isReady: isHost,
      isSimulated: false,
    })
    touchRoomPlayer(address)
    console.log(`[Server][P] joinRoom accepted address=${address} host=${isHost} ready=${isHost} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS}`)
  }

  broadcastRoomSnapshot('join')
}

function handleLeaveRoom(context: EventContext, reason: string): void {
  const address = normalizeAddress(context.from)
  removePlayerFromRoom(address, reason || 'none')
}

function removePlayerFromRoom(address: string, reason: string): void {
  if (!players.some((player) => player.address === address)) {
    console.log(`[Server][P] leaveRoom ignored missing-player address=${address} reason=${reason || 'none'}`)
    return
  }

  const beforeCount = players.length
  const removedFromActiveMatch = markServerPlayerAsSpectator(address, `leave:${reason || 'none'}`)

  players = players.filter((player) => player.address !== address)
  playerLastSeenSeconds.delete(address)

  if (players.length > 0 && !players.some((player) => player.isHost)) {
    players[0].isHost = true
  }

  syncActiveMatchHostFlags()
  const survivorEnded = removedFromActiveMatch && maybeEndMatchByFinalSurvivor('player-left')

  if (players.length === 0) {
    resetActiveMatch('room-empty')
  } else if (removedFromActiveMatch) {
    broadcastPublicMatchSnapshot(survivorEnded ? 'final-survivor' : 'player-left')
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

  if (activeMatch) {
    console.log(`[Server][P] setReady ignored match-${activeMatch.phase} address=${address}`)
    return
  }

  touchRoomPlayer(address)
  player.isReady = isReady
  console.log(`[Server][P] setReady address=${address} ready=${isReady}`)
  broadcastRoomSnapshot('ready')
}

function handleRoomHeartbeat(context: EventContext, _status: string): void {
  const address = normalizeAddress(context.from)

  if (!players.some((player) => player.address === address)) return

  touchRoomPlayer(address)
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

  if (address !== LEADERBOARD_EXPORT_ADMIN_ADDRESS) {
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

function handleRequestStartMatch(context: EventContext, requestId: string): void {
  const address = normalizeAddress(context.from)
  const requester = players.find((player) => player.address === address)

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

  const snapshot = buildRoomSnapshot()
  if (!snapshot.canHostStart) {
    console.log(`[Server][Q] requestStartMatch rejected not-ready address=${address} requestId=${requestId}`)
    void getDogeRoom().send('matchError', {
      code: 'not-ready',
      message: 'All players must be ready before starting',
    }, { to: [address] })
    return
  }

  const matchId = `server-match-${nextMatchId++}`
  const publicDoges = createServerPublicDoges(matchId)
  matchVersion += 1

  console.log(`[Server][Q] requestStartMatch accepted address=${address} requestId=${requestId} matchId=${matchId} players=${players.length}/${SERVER_ROOM_MAX_PLAYERS} version=${matchVersion}`)

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

function handleBonkRequest(context: EventContext, payloadJson: string): void {
  const address = normalizeAddress(context.from)
  const payload = parseServerBonkRequestPayload(payloadJson)

  if (!payload) {
    console.log(`[Server][S] bonk rejected invalid-payload address=${address}`)
    return
  }

  const rejectReason = getBonkBaseRejectReason(address, payload.matchId)
  if (rejectReason) {
    sendBonkResult(address, buildBonkResult(payload, 'rejected', rejectReason, 0))
    console.log(`[Server][S] bonk rejected reason=${rejectReason} address=${address} target=${payload.targetPublicDogeId} requestId=${payload.requestId}`)
    return
  }

  const match = activeMatch as ActiveServerMatch
  const target = resolveServerBonkTarget(address, payload.targetPublicDogeId)
  const player = findServerPublicPlayer(address)

  if (typeof target === 'string' || !player) {
    const targetReason = typeof target === 'string' ? target : 'invalid-target'
    sendBonkResult(address, buildBonkResult(payload, 'rejected', targetReason, 0))
    console.log(`[Server][S] bonk rejected reason=${targetReason} address=${address} target=${payload.targetPublicDogeId || 'server-resolve'} requestId=${payload.requestId}`)
    return
  }

  target.publicDoge.isEliminated = true
  target.publicDoge.visualState = 'eliminated'
  player.bonks += 1

  if (target.targetPlayer) {
    markServerPlayerAsSpectator(target.targetPlayer.address, `bonk:${address}`)
  }

  const targetDogesAlive = getServerTargetDogesAlive()
  let snapshotReason = target.kind === 'player' ? 'player-bonk' : 'bonk'
  if (target.kind === 'decoy' && maybeEndMatchBySinglePlayerNpcClear('bonk', player)) {
    snapshotReason = 'all-doges-eliminated'
  } else if (maybeEndMatchByFinalSurvivor('bonk')) {
    snapshotReason = 'final-survivor'
  }

  sendBonkResult(address, buildBonkResult(payload, 'accepted', '', player.bonks, target.publicDoge.publicDogeId))
  console.log(`[Server][V] bonk accepted address=${address} target=${target.publicDoge.publicDogeId} kind=${target.kind} targetPlayer=${target.targetPlayer?.address ?? 'none'} bonks=${player.bonks} targetAlive=${targetDogesAlive}/${match.decoyNpcCount} requestId=${payload.requestId}`)
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

function broadcastRoomSnapshot(reason: string): void {
  const snapshot = buildRoomSnapshot()

  console.log(`[Server][P] roomSnapshot v=${snapshot.version} reason=${reason} players=${snapshot.playerCount}/${snapshot.maxPlayers} host=${snapshot.hostAddress || 'none'}`)
  void getDogeRoom().send('roomSnapshot', {
    snapshotJson: JSON.stringify(snapshot),
  })

  for (const player of players) {
    const personalizedSnapshot = buildRoomSnapshotForRecipient(player.address, snapshot.version)
    void getDogeRoom().send('roomSnapshot', {
      snapshotJson: JSON.stringify(personalizedSnapshot),
    }, { to: [player.address] })
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
  const phase = activeMatch?.phase === 'active'
    ? 'active'
    : activeMatch?.phase === 'ended'
      ? 'settling'
      : players.length > 0
        ? 'waiting'
        : 'empty'
  const canHostStart = phase === 'waiting' && players.length > 0 && players.every((player) => player.isHost || player.isReady)
  const settlingSecondsRemaining = activeMatch?.phase === 'ended'
    ? Math.max(0, Math.ceil(SERVER_ROOM_SETTLING_TIMEOUT_SECONDS - activeMatch.settlingElapsedSeconds))
    : 0

  return {
    roomId: SERVER_ROOM_ID,
    phase,
    recipientAddress: normalizedRecipientAddress,
    isLocalPlayerInRoom: Boolean(localPlayer),
    localPlayerIsHost: Boolean(localPlayer?.isHost),
    localPlayerIsReady: Boolean(localPlayer?.isReady),
    players: [...players],
    playerCount: players.length,
    maxPlayers: SERVER_ROOM_MAX_PLAYERS,
    simulatedPlayerCount: 0,
    hostAddress: host?.address ?? '',
    hostDisplayName: host?.displayName ?? '',
    canHostStart,
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
  version: number
): ServerMatchStartPayload {
  const playerSlots = createPersonalizedPlayerSlots(targetPlayer)
  const playerCount = Math.max(1, players.length)
  const decoyNpcCount = Math.max(0, SERVER_TOTAL_DOGES - playerCount)
  const targetIndex = Math.max(0, players.findIndex((player) => player.address === targetPlayer.address))
  const localPublicDogeId = publicDoges[targetIndex]?.publicDogeId ?? `${matchId}-doge-1`
  const localSlot = playerSlots.find((slot) => slot.isLocal) ?? playerSlots[0]
  const localPrivatePlayer = createPrivatePlayerSeed(localSlot, localPublicDogeId)

  const matchConfig: LocalMatchConfig = {
    matchId,
    phase: 'active',
    totalDoges: SERVER_TOTAL_DOGES,
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

function setupServerRoomMaintenanceSystem(): void {
  if (roomMaintenanceSystemStarted) return
  roomMaintenanceSystemStarted = true

  engine.addSystem((dt: number) => {
    roomElapsedSeconds += dt
    roomPruneAccumulator += dt
    updateSettlingTimeout(dt)

    if (roomPruneAccumulator < SERVER_ROOM_PRUNE_INTERVAL_SECONDS) return

    roomPruneAccumulator = 0
    pruneStaleRoomPlayers()
  })
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
  if (players.length === 0) return

  const stalePlayers = players.filter((player) => {
    const lastSeen = playerLastSeenSeconds.get(player.address)
    if (lastSeen === undefined) {
      playerLastSeenSeconds.set(player.address, roomElapsedSeconds)
      return false
    }

    return roomElapsedSeconds - lastSeen >= SERVER_ROOM_HEARTBEAT_TIMEOUT_SECONDS
  })

  for (const player of stalePlayers) {
    const secondsSinceSeen = roomElapsedSeconds - (playerLastSeenSeconds.get(player.address) ?? roomElapsedSeconds)
    console.log(`[Server][P] room heartbeat timeout address=${player.address} stale=${secondsSinceSeen.toFixed(1)}s`)
    removePlayerFromRoom(player.address, 'heartbeat-timeout')
  }
}

function touchRoomPlayer(address: string): void {
  const normalizedAddress = normalizeAddress(address)
  if (!players.some((player) => player.address === normalizedAddress)) return

  playerLastSeenSeconds.set(normalizedAddress, roomElapsedSeconds)
}

function setupServerPublicStateSystem(): void {
  if (publicStateSystemStarted) return
  publicStateSystemStarted = true

  engine.addSystem((dt: number) => {
    if (!activeMatch || activeMatch.phase === 'ended') return

    activeMatch.elapsedSeconds += dt
    activeMatch.tickAccumulator += dt

    if (updateServerPlayerSkills(dt)) {
      broadcastPublicMatchSnapshot('turn-to-rock-ended')
      broadcastServerNpcSnapshot('turn-to-rock-ended')
    }

    if (activeMatch.elapsedSeconds >= SERVER_ROUND_DURATION_SECONDS) {
      endActiveMatch('time-up')
      broadcastPublicMatchSnapshot('round-ended')
      broadcastServerNpcSnapshot('round-ended')
      return
    }

    if (activeMatch.tickAccumulator < 1) return

    activeMatch.tickAccumulator = 0
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
  const decoyNpcCount = Math.max(0, SERVER_TOTAL_DOGES - playerCount)

  return {
    matchId,
    version,
    phase: 'active',
    totalDoges: SERVER_TOTAL_DOGES,
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
    tickAccumulator: 0,
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
  const elapsedSeconds = Math.floor(activeMatch.elapsedSeconds)
  const timeLeftSeconds = Math.max(0, SERVER_ROUND_DURATION_SECONDS - elapsedSeconds)
  const snapshot: ServerPublicMatchSnapshot = {
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

  void getDogeRoom().send('publicStateSnapshot', {
    snapshotJson: JSON.stringify(snapshot),
  })
  console.log(`[Server][R] publicStateSnapshot sent reason=${reason} matchId=${snapshot.matchId} version=${snapshot.version} targetAlive=${snapshot.targetDogesAlive}/${snapshot.targetDogesTotal} publicAlive=${snapshot.publicAliveDoges}/${snapshot.totalDoges} timeLeft=${snapshot.timeLeftSeconds}`)
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
    elapsedSeconds: Math.floor(activeMatch.elapsedSeconds),
    publicDoges: decoyDoges,
  })

  void getDogeRoom().send('npcStateSnapshot', {
    payloadJson: JSON.stringify(payload),
  })
  console.log(`[Server][W2] npcStateSnapshot sent reason=${reason} matchId=${payload.matchId} version=${payload.version} npcs=${payload.npcs.length}`)
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

function markServerPlayerAsSpectator(address: string, reason: string): boolean {
  const player = findServerPublicPlayer(address)
  if (!player || !activeMatch) return false
  if (activeMatch.phase !== 'active') return false
  if (!player.isAlive && player.status === 'spectator') return false

  player.isAlive = false
  player.status = 'spectator'
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
}

function resolveServerBonkTarget(
  attackerAddress: string,
  requestedPublicDogeId: string
): ServerBonkTarget | ServerBonkRejectReason {
  if (!activeMatch) return 'missing-match'

  const playerTarget = resolveServerPlayerBonkTarget(attackerAddress, requestedPublicDogeId)
  if (playerTarget) return playerTarget
  if (!requestedPublicDogeId) return 'invalid-target'

  const targetIndex = activeMatch.publicDoges.findIndex((doge) => doge.publicDogeId === requestedPublicDogeId)
  if (targetIndex < 0) return 'invalid-target'

  const publicDoge = activeMatch.publicDoges[targetIndex]
  if (publicDoge.isEliminated) return 'already-eliminated'

  if (targetIndex < activeMatch.playerCount) {
    return 'invalid-target'
  }

  return {
    kind: 'decoy',
    publicDoge,
    targetPlayer: null,
  }
}

function resolveServerPlayerBonkTarget(
  attackerAddress: string,
  requestedPublicDogeId: string
): ServerBonkTarget | ServerBonkRejectReason | null {
  if (!activeMatch) return null

  const requestedPlayer = requestedPublicDogeId
    ? findServerPublicPlayerByDogeId(requestedPublicDogeId)
    : null
  let requestedPlayerRejectReason: ServerBonkRejectReason | null = null

  if (requestedPlayer?.address === attackerAddress) {
    console.log(`[Server][W3a] playerSpatial rejected self-target attacker=${attackerAddress} requested=${requestedPublicDogeId}`)
    return 'self-target'
  }

  if (requestedPlayer && (!requestedPlayer.isAlive || requestedPlayer.status !== 'active')) {
    requestedPlayerRejectReason = 'already-eliminated'
  }

  const candidates = activeMatch.publicPlayers.filter((candidate) => {
    return candidate.address !== attackerAddress && candidate.isAlive && candidate.status === 'active'
  })
  const attackPose = getServerAttackPose(attackerAddress)
  const requestedKind = requestedPlayer
    ? 'player'
    : requestedPublicDogeId
      ? 'decoy-or-invalid'
      : 'none'

  console.log(`[Server][W3a] playerSpatial attacker=${attackerAddress} attackerTransform=${attackPose ? 'yes' : 'no'} requested=${requestedPublicDogeId || 'none'} requestedKind=${requestedKind} candidates=${candidates.length}`)

  if (!attackPose) {
    return requestedPlayerRejectReason ?? (requestedPlayer ? 'invalid-target' : null)
  }

  console.log(`[Server][W3a] playerSpatial attackerPose origin=${formatServerVectorXZ(attackPose.origin)} forward=${formatServerVectorXZ(attackPose.forward)} range=${SERVER_BONK_RANGE} radius=${SERVER_BONK_RADIUS}`)

  let bestCandidate: ServerPlayerBonkCandidate | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const publicDoge = findServerPublicDoge(candidate.publicDogeId)
    const measurement = measureServerPlayerBonkCandidate(attackPose, candidate.address)

    console.log(`[Server][W3a] playerSpatial candidate=${candidate.address} doge=${candidate.publicDogeId} dogeAlive=${publicDoge && !publicDoge.isEliminated ? 'yes' : 'no'} transform=${measurement.transformFound ? 'yes' : 'no'} forward=${formatServerAuditNumber(measurement.forwardDistance)} lateral=${formatServerAuditNumber(measurement.lateralDistance)} distance=${formatServerAuditNumber(measurement.distance)} inArc=${measurement.inArc ? 'yes' : 'no'}`)

    if (!publicDoge || publicDoge.isEliminated) continue
    if (!measurement.inArc || measurement.distance === null) continue

    if (measurement.distance < bestDistance) {
      bestDistance = measurement.distance
      bestCandidate = {
        player: candidate,
        publicDoge,
        measurement,
      }
    }
  }

  if (bestCandidate) {
    console.log(`[Server][W3a] playerSpatial selected target=${bestCandidate.player.address} doge=${bestCandidate.publicDoge.publicDogeId} distance=${formatServerAuditNumber(bestCandidate.measurement.distance)} requested=${requestedPublicDogeId || 'none'}`)
    return {
      kind: 'player',
      publicDoge: bestCandidate.publicDoge,
      targetPlayer: bestCandidate.player,
    }
  }

  return requestedPlayerRejectReason ?? (requestedPlayer ? 'invalid-target' : null)
}

function measureServerPlayerBonkCandidate(
  attackPose: ServerAttackPose,
  targetAddress: string
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

  const toTarget = Vector3.subtract(
    Vector3.create(targetTransform.position.x, 0, targetTransform.position.z),
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
    inArc: forwardDistance >= SERVER_BONK_MIN_FORWARD
      && forwardDistance <= SERVER_BONK_RANGE
      && lateralDistance <= SERVER_BONK_RADIUS,
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
  payload: { requestId: string; matchId: string; targetPublicDogeId: string; origin: { x: number; y: number; z: number } },
  outcome: 'accepted' | 'rejected',
  reason: ServerBonkRejectReason | '',
  bonks: number,
  resolvedTargetPublicDogeId = payload.targetPublicDogeId
): ServerBonkResultPayload {
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

function sendDebugForceRoundEndResult(address: string, payload: ServerDebugForceRoundEndResultPayload): void {
  void getDogeRoom().send('debugForceRoundEndResult', {
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
  return normalized || `Player ${address.slice(2, 8)}`
}
