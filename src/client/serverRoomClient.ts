import { AvatarBase, engine } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'

import { getDogeRoom } from '../shared/messages'
import {
  createEmptyServerRoomSnapshot,
  parseServerRoomSnapshot,
  type ServerRoomSnapshot,
} from '../shared/serverRoom'
import { parseServerMatchStartPayload } from '../shared/serverMatch'
import type { LocalMatchConfig } from '../localMatch'
import type { LocalMatchRuntimeSeed } from '../localMatchState'
import { setServerPublicLocalAddress, setServerSpectatorMode } from './serverPublicStateClient'
import {
  SERVER_HEARTBEAT_TIMEOUT_SECONDS,
  ServerHeartbeat,
} from '../shared/serverHeartbeat'
import { primeGameAudioFromUserAction } from './gameAudio'

export type ServerRoomClientStatus = 'idle' | 'room-available' | 'match-in-progress' | 'settling' | 'connecting' | 'joining' | 'joined' | 'starting' | 'match-started' | 'left' | 'error'

let clientLobbyStarted = false
let joinRequested = false
let joinSent = false
let spectateRequested = false
let spectateSent = false
let snapshotRequested = false
let snapshotPendingResponse = false
let startupSnapshotRequested = false
let snapshotRequestReason = 'ui-open'
let serverRequestElapsed = 0
let joinRequestElapsed = 0
let roomRefreshElapsed = 0
let roomHeartbeatElapsed = 0
let lastSentDisplayName = ''
let clientRuntimeSeconds = 0
let lastServerHeartbeatTimestamp = 0
let lastServerHeartbeatSeenAtSeconds = -1
let hasReceivedRoomSnapshot = false
let status: ServerRoomClientStatus = 'idle'
let lastError = ''
let snapshot: ServerRoomSnapshot = createEmptyServerRoomSnapshot()
let matchStartHandler: ((matchConfig: LocalMatchConfig, runtimeSeed?: LocalMatchRuntimeSeed, isResume?: boolean) => void) | null = null
let nextStartRequestId = 1
const SERVER_RESPONSE_TIMEOUT_SECONDS = 10
const SERVER_WAKE_TIMEOUT_SECONDS = 30
const ROOM_SNAPSHOT_REFRESH_INTERVAL_SECONDS = 3
const ROOM_HEARTBEAT_INTERVAL_SECONDS = 2

export function setupServerRoomClient(): void {
  if (clientLobbyStarted) return
  clientLobbyStarted = true

  const room = getDogeRoom()

  room.onReady((isReady) => {
    console.log(`[Client][P] room ready=${isReady}`)
    if (!isReady && (joinRequested || joinSent)) {
      status = 'connecting'
    }
  })

  room.onMessage('roomSnapshot', (data) => {
    const parsed = parseServerRoomSnapshot(data.snapshotJson)
    if (!parsed) {
      status = 'error'
      lastError = 'Invalid room snapshot'
      return
    }

    // The server also broadcasts a generic room view for players outside the
    // room. Never let that view overwrite the member-specific snapshot that
    // keeps this client alive during an active match.
    const isGenericRoomSnapshot = !parsed.recipientAddress
    if (isGenericRoomSnapshot && snapshot.isLocalPlayerInRoom) {
      console.log(`[Client][P] roomSnapshot generic ignored v=${parsed.version} while local membership is confirmed.`)
      return
    }

    snapshot = parsed
    if (parsed.recipientAddress) {
      setServerPublicLocalAddress(parsed.recipientAddress)
      setServerSpectatorMode(parsed.isLocalSpectator)
    }
    lastError = ''
    snapshotRequested = false
    snapshotPendingResponse = false
    serverRequestElapsed = 0
    joinRequestElapsed = 0
    roomRefreshElapsed = 0
    hasReceivedRoomSnapshot = true

    if (parsed.phase === 'active') {
      status = parsed.isLocalPlayerInRoom || parsed.isLocalSpectator ? 'match-started' : 'match-in-progress'
      joinRequested = false
      joinSent = false
    } else if (parsed.phase === 'settling') {
      status = 'settling'
      joinRequested = false
      joinSent = false
    } else if (parsed.isLocalPlayerInRoom) {
      status = parsed.phase === 'waiting'
        ? 'joined'
        : parsed.phase === 'starting'
          ? 'starting'
          : 'left'
      joinRequested = parsed.phase === 'waiting' || parsed.phase === 'starting'
      joinSent = parsed.phase === 'waiting' || parsed.phase === 'starting'
    } else if (joinRequested || joinSent) {
      status = joinSent ? 'joining' : 'connecting'
    } else {
      status = parsed.phase === 'waiting' ? 'room-available' : 'idle'
      joinRequested = false
      joinSent = false
    }

    console.log(`[Client][P] roomSnapshot v=${parsed.version} players=${parsed.playerCount}/${parsed.maxPlayers} localInRoom=${parsed.isLocalPlayerInRoom} localHost=${parsed.localPlayerIsHost} settling=${parsed.settlingSecondsRemaining}s`)
  })

  room.onMessage('roomError', (data) => {
    status = 'error'
    lastError = data.message
    snapshotRequested = false
    snapshotPendingResponse = false
    console.log(`[Client][P] roomError code=${data.code} message=${data.message}`)
  })

  room.onMessage('matchStarted', (data) => {
    const payload = parseServerMatchStartPayload(data.payloadJson)
    if (!payload) {
      status = 'error'
      lastError = 'Invalid match start payload'
      return
    }

    status = 'match-started'
    lastError = ''
    setServerPublicLocalAddress(payload.recipientAddress)
    setServerSpectatorMode(Boolean(payload.isSpectator))
    spectateRequested = false
    spectateSent = false
    console.log(`[Client][Q] matchStarted received matchId=${payload.matchConfig.matchId} players=${payload.matchConfig.playerCount} decoys=${payload.matchConfig.decoyNpcCount} spectator=${Boolean(payload.isSpectator)} resume=${Boolean(payload.isResume)} version=${payload.version}`)

    if (matchStartHandler) {
      matchStartHandler(payload.matchConfig, payload.runtimeSeed, Boolean(payload.isResume))
    } else {
      console.log('[Client][Q] matchStarted ignored because no start handler is registered.')
    }
  })

  room.onMessage('matchError', (data) => {
    status = 'error'
    lastError = data.message
    console.log(`[Client][Q] matchError code=${data.code} message=${data.message}`)
  })

  engine.addSystem((dt) => {
    tickServerHeartbeat(dt)
    tickServerRoomTimeouts(dt)
    tickRoomSettlingCountdown(dt)
    tickRoomSnapshotAutoRefresh(dt)
    tickRoomHeartbeat(dt)
    refreshLocalDisplayName(room)

    if (!startupSnapshotRequested && isServerReadyForRequests()) {
      startupSnapshotRequested = true
      requestServerRoomSnapshot('scene-resume')
      console.log('[Client][P] startup room snapshot requested. reason=scene-resume')
    }

    if (spectateRequested && !spectateSent && isServerReadyForRequests()) {
      spectateSent = true
      status = 'joining'
      const displayName = getLocalDisplayName()
      void room.send('spectateMatch', { displayName })
      console.log(`[Client][Spectator] watch request sent displayName=${displayName}`)
    }

    if (snapshotRequested && isServerReadyForRequests()) {
      const reason = snapshotRequestReason
      snapshotRequested = false
      snapshotPendingResponse = true
      serverRequestElapsed = 0
      void room.send('requestRoomSnapshot', { reason })
      console.log(`[Client][P] room snapshot requested after state sync. reason=${reason}`)
    }

    if (!joinRequested || joinSent) return

    if (!isServerReadyForRequests()) {
      status = 'connecting'
      return
    }

    joinSent = true
    joinRequestElapsed = 0
    status = 'joining'
    lastSentDisplayName = getLocalDisplayName()
    void room.send('joinRoom', { displayName: lastSentDisplayName })
    console.log(`[Client][P] joinRoom sent after state sync. displayName=${lastSentDisplayName}`)
  })
}

export function setServerMatchStartHandler(
  handler: (matchConfig: LocalMatchConfig, runtimeSeed?: LocalMatchRuntimeSeed, isResume?: boolean) => void
): void {
  matchStartHandler = handler
}

export function requestServerRoomJoin(): void {
  primeGameAudioFromUserAction('join-room')
  setServerSpectatorMode(false)
  joinRequested = true
  joinSent = false
  joinRequestElapsed = 0
  roomHeartbeatElapsed = 0
  lastSentDisplayName = ''
  status = hasReceivedRoomSnapshot ? 'joining' : 'connecting'
  lastError = ''
  console.log('[Client][P] server room join requested.')
}

export function requestServerMatchSpectate(): void {
  spectateRequested = true
  spectateSent = false
  status = isServerReadyForRequests() ? 'joining' : 'connecting'
  lastError = ''
  console.log('[Client][Spectator] watch request queued.')
}

export function requestServerRoomSnapshot(reason = 'ui-open'): void {
  snapshotRequested = true
  snapshotPendingResponse = false
  snapshotRequestReason = reason
  serverRequestElapsed = 0
  lastError = ''
  if (reason !== 'auto-refresh' && (status === 'idle' || status === 'left' || status === 'error')) {
    status = 'connecting'
  }
  console.log(`[Client][P] server room snapshot requested. reason=${reason}`)
}

export function requestServerRoomLeave(reason = 'ui-leave'): void {
  const shouldNotifyServer = joinRequested
    || joinSent
    || snapshot.isLocalPlayerInRoom
    || snapshot.isLocalSpectator
    || status === 'joined'
    || status === 'starting'
    || status === 'match-started'
    || status === 'settling'

  joinRequested = false
  joinSent = false
  spectateRequested = false
  spectateSent = false
  snapshotRequested = false
  snapshotPendingResponse = false
  snapshotRequestReason = 'ui-open'
  serverRequestElapsed = 0
  joinRequestElapsed = 0
  roomRefreshElapsed = 0
  roomHeartbeatElapsed = 0
  hasReceivedRoomSnapshot = false
  snapshot = createEmptyServerRoomSnapshot()
  status = 'left'
  lastError = ''
  setServerSpectatorMode(false)

  if (shouldNotifyServer) {
    void getDogeRoom().send('leaveRoom', { reason })
  }

  console.log(`[Client][P] server room leave requested. reason=${reason}`)
}

export function requestServerRoomReady(isReady = true): void {
  if (status !== 'joined') {
    console.log(`[Client][P] setReady ignored status=${status}`)
    return
  }
  if (!snapshot.isLocalPlayerInRoom) {
    console.log('[Client][P] setReady ignored not-in-room')
    return
  }
  primeGameAudioFromUserAction(isReady ? 'ready-up' : 'unready')
  void getDogeRoom().send('setReady', { isReady })
  requestServerRoomSnapshot('ready-refresh')
  console.log(`[Client][P] setReady sent ready=${isReady}`)
}

export function requestServerMatchStart(mode: 'solo' | 'party'): void {
  if (status !== 'joined') {
    console.log(`[Client][Q] requestStartMatch ignored status=${status}`)
    return
  }
  if (!snapshot.localPlayerIsHost) {
    console.log('[Client][Q] requestStartMatch ignored not-host')
    return
  }

  const requestId = `start-${nextStartRequestId++}`
  status = 'starting'
  lastError = ''
  primeGameAudioFromUserAction(`start-${mode}`)
  void getDogeRoom().send('requestStartMatch', { requestId, mode })
  console.log(`[Client][Q] requestStartMatch sent requestId=${requestId} mode=${mode}`)
}

export function requestServerMatchStartCancel(): void {
  if (status !== 'starting') {
    console.log(`[Client][Q] cancelMatchStart ignored status=${status}`)
    return
  }
  if (!snapshot.localPlayerIsHost) {
    console.log('[Client][Q] cancelMatchStart ignored not-host')
    return
  }

  void getDogeRoom().send('cancelMatchStart', { reason: 'ui-cancel' })
  requestServerRoomSnapshot('match-countdown-cancel')
  console.log('[Client][Q] cancelMatchStart sent')
}

export function getServerRoomSnapshot(): ServerRoomSnapshot {
  return snapshot
}

export function getServerRoomClientStatus(): ServerRoomClientStatus {
  return status
}

export function getServerRoomStatusLabel(): string {
  if (status === 'idle') return 'No room open'
  if (status === 'room-available') return 'Room open'
  if (status === 'match-in-progress') return 'Game in progress'
  if (status === 'settling') return 'Waiting for players to exit'
  if (status === 'connecting') return getConnectingStatusLabel()
  if (status === 'joining') return 'Joining room'
  if (status === 'joined') return 'Room ready'
  if (status === 'starting') return snapshot.startCountdownSeconds > 0
    ? `Match starts in ${snapshot.startCountdownSeconds}s`
    : 'Starting match'
  if (status === 'match-started') return 'Game in progress'
  if (status === 'error') return lastError || 'Server room error'

  return 'No room open'
}

export function getLobbyRoomStatusLabel(): string {
  return getLobbyRoomPrompt().statusLabel
}

export function getLobbyRoomPrompt(): { statusLabel: string; actionLabel: string } {
  if (status === 'settling' || snapshot.phase === 'settling') {
    return {
      statusLabel: 'Waiting for players to exit',
      actionLabel: '',
    }
  }

  if (status === 'match-in-progress' || status === 'match-started' || snapshot.phase === 'active') {
    return {
      statusLabel: 'Game in progress',
      actionLabel: snapshot.isLocalSpectator ? '' : 'Watch Game',
    }
  }

  if (status === 'starting' || snapshot.phase === 'starting') {
    return {
      statusLabel: snapshot.startCountdownSeconds > 0
        ? `Match starts in ${snapshot.startCountdownSeconds}s`
        : 'Match starting',
      actionLabel: '',
    }
  }

  if (snapshot.phase === 'waiting' && snapshot.playerCount > 0) {
    const statusLabel = snapshot.isLocalPlayerInRoom
      ? `Room ready ${snapshot.playerCount}/${snapshot.maxPlayers}`
      : `Room open ${snapshot.playerCount}/${snapshot.maxPlayers}`

    return {
      statusLabel,
      actionLabel: snapshot.isLocalPlayerInRoom ? 'Open Room' : 'Click to Join',
    }
  }

  if (status === 'connecting' || status === 'joining') {
    return {
      statusLabel: hasReceivedRoomSnapshot ? 'Preparing room' : getConnectingStatusLabel(),
      actionLabel: 'Click to Play Game',
    }
  }

  if (status === 'error') {
    return {
      statusLabel: 'Server room error',
      actionLabel: 'Click to Play Game',
    }
  }

  return {
    statusLabel: 'No room open',
    actionLabel: 'Click to Play Game',
  }
}

function tickServerRoomTimeouts(dt: number): void {
  if (snapshotRequested || snapshotPendingResponse) {
    serverRequestElapsed += dt
    const timeoutSeconds = snapshotPendingResponse
      ? SERVER_RESPONSE_TIMEOUT_SECONDS
      : SERVER_WAKE_TIMEOUT_SECONDS
    if (serverRequestElapsed >= timeoutSeconds) {
      snapshotRequested = false
      snapshotPendingResponse = false
      serverRequestElapsed = 0
      status = 'error'
      lastError = 'Match server is still waking up'
      console.log('[Client][P] room snapshot timed out while waiting for match server.')
    }
  }

  if (joinRequested && (status === 'connecting' || status === 'joining')) {
    joinRequestElapsed += dt
    const timeoutSeconds = joinSent
      ? SERVER_RESPONSE_TIMEOUT_SECONDS
      : SERVER_WAKE_TIMEOUT_SECONDS
    if (joinRequestElapsed >= timeoutSeconds) {
      joinRequested = false
      joinSent = false
      joinRequestElapsed = 0
      status = 'error'
      lastError = 'Match server is still waking up'
      console.log('[Client][P] joinRoom timed out while waiting for match server.')
    }
  }
}

function tickRoomSnapshotAutoRefresh(dt: number): void {
  if (!shouldAutoRefreshRoomSnapshot()) {
    roomRefreshElapsed = 0
    return
  }

  roomRefreshElapsed += dt
  if (roomRefreshElapsed < ROOM_SNAPSHOT_REFRESH_INTERVAL_SECONDS) return

  roomRefreshElapsed = 0
  requestServerRoomSnapshot('auto-refresh')
}

function tickRoomSettlingCountdown(dt: number): void {
  if (snapshot.phase !== 'settling' || snapshot.settlingSecondsRemaining <= 0) return

  snapshot.settlingSecondsRemaining = Math.max(0, snapshot.settlingSecondsRemaining - dt)
}

function shouldAutoRefreshRoomSnapshot(): boolean {
  if (!hasReceivedRoomSnapshot) return false
  if (snapshotRequested || snapshotPendingResponse) return false
  if (status === 'connecting' || status === 'joining' || status === 'starting' || status === 'error') return false

  return true
}

function getLocalDisplayName(): string {
  const profileName = (
    getPlayer()?.name
    ?? AvatarBase.getOrNull(engine.PlayerEntity)?.name
    ?? ''
  ).trim()
  if (profileName && profileName.toLowerCase() !== 'you') {
    return profileName.slice(0, 24)
  }

  return ''
}

function refreshLocalDisplayName(room: ReturnType<typeof getDogeRoom>): void {
  if (!joinSent || !snapshot.isLocalPlayerInRoom) return

  const displayName = getLocalDisplayName()
  if (!displayName || displayName === lastSentDisplayName) return

  lastSentDisplayName = displayName
  void room.send('joinRoom', { displayName })
  console.log(`[Client][P] joinRoom display name refreshed. displayName=${displayName}`)
}

function tickRoomHeartbeat(dt: number): void {
  if (!shouldSendRoomHeartbeat()) {
    roomHeartbeatElapsed = 0
    return
  }

  roomHeartbeatElapsed += dt
  if (roomHeartbeatElapsed < ROOM_HEARTBEAT_INTERVAL_SECONDS) return

  roomHeartbeatElapsed = 0
  void getDogeRoom().send('roomHeartbeat', { status })
}

function shouldSendRoomHeartbeat(): boolean {
  if (!snapshot.isLocalPlayerInRoom && !snapshot.isLocalSpectator) return false
  if (!isServerReadyForRequests()) return false
  if (status === 'idle' || status === 'room-available' || status === 'match-in-progress') return false
  if (status === 'connecting' || status === 'joining' || status === 'left' || status === 'error') return false

  return true
}

function tickServerHeartbeat(dt: number): void {
  clientRuntimeSeconds += dt

  for (const [, heartbeat] of engine.getEntitiesWith(ServerHeartbeat)) {
    if (heartbeat.timestamp === lastServerHeartbeatTimestamp) continue

    lastServerHeartbeatTimestamp = heartbeat.timestamp
    lastServerHeartbeatSeenAtSeconds = clientRuntimeSeconds
  }
}

function isMultiplayerServerAlive(): boolean {
  if (lastServerHeartbeatSeenAtSeconds < 0) return false

  return clientRuntimeSeconds - lastServerHeartbeatSeenAtSeconds <= SERVER_HEARTBEAT_TIMEOUT_SECONDS
}

function isServerReadyForRequests(): boolean {
  return getDogeRoom().isReady() && isStateSyncronized() && isMultiplayerServerAlive()
}

function getConnectingStatusLabel(): string {
  if (!isStateSyncronized()) return 'Connecting to scene'
  if (!isMultiplayerServerAlive()) return 'Match server is waking up'

  return 'Connecting to match server'
}
