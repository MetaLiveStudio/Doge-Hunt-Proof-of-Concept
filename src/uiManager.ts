/**
 * uiManager.ts — Unified UI renderer for all game screens
 */
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button, ScreenInsetArea } from '@dcl/sdk/react-ecs'
import { engine, PlayerIdentityData, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { getPlayer } from '@dcl/sdk/src/players'
import { triggerPlayerBonkAttack } from './combat'
import { triggerTurnToRock, getTurnToRockHudState } from './skills'
import { leaveLocalRoom } from './localRoom'
import type { LocalMatchConfig } from './localMatch'
import {
  getServerRoomClientStatus,
  getServerRoomSnapshot,
  getServerRoomStatusLabel,
  requestServerMatchStart,
  requestServerMatchStartCancel,
  requestServerRoomReady,
  requestServerRoomJoin,
  requestServerMatchSpectate,
  requestServerRoomLeave,
  requestServerRoomSnapshot,
} from './client/serverRoomClient'
import {
  requestServerDebugEliminateAllDoges,
  requestServerDebugForceRoundEnd,
  requestServerDebugMarkLocalOut,
  requestServerDebugToggleNpcFreeze,
} from './client/serverGameplayClient'
import { areServerNpcsFrozen } from './client/serverNpcFreezeState'
import type {
  ServerResultRevealPlayer,
  ServerResultsRevealData,
} from './client/serverPublicStateClient'
import { getShortAddress } from './shared/serverRoom'
import { isDogeHuntAdmin } from './shared/leaderboardConfig'
import { getLeaderboardAwardLabel, requestLeaderboardCsvExport } from './client/leaderboardClient'
import {
  getGameplayFeedback,
  getEliminationChoiceDetail,
  isEliminationChoicePending,
  resolveEliminationChoice,
} from './client/gameplayFeedback'
import { setLocalEliminatedSpectatingMode } from './client/serverPublicStateClient'

const h = ReactEcs.createElement
const DEBUG_CONTROLS_ENABLED = true
const PLAYER_LIST_PAGE_SIZE = 4
const MOBILE_MODAL_LAYOUT = {
  width: '52%',
  height: '62%',
  left: '7%',
  top: '17%',
} as const
let lastAdminResolutionLog = ''

export type GameStatsData = {
  bonks: number
  alive: number
  total: number
  time: string
  identityRevealLines?: string[]
  localStatusLabel?: string
  isWin?: boolean
  resultTitle?: string
  resultSubtitle?: string
  isSpectatorResult?: boolean
  revealData?: ServerResultsRevealData | null
}

export type HudData = {
  bonks: number
  alive: number
  total: number
  timeLeft: number
  roundOver: boolean
  realPlayersAlive?: number | null
  serverPublicLabel?: string
  localPlayerStatus?: string
  localStatusLabel?: string
  canAct?: boolean
  isWatcher?: boolean
}

// UI state
export const uiState = {
  showRoomEntry: false,
  showWaitingRoom: false,
  showGameOver: false,
  showHud: false,
  showLeaderboardRules: false,
  showSoloStartConfirmation: false,
  pendingSoloStart: false,
  waitingRoomPage: 0,
  resultPage: 0,
}

export function openLeaderboardRulesPopup(): void {
  uiState.showLeaderboardRules = true
}

// Callbacks (set by other modules)
export let onStartLocalMatch: ((matchConfig: LocalMatchConfig) => void) | null = null
export let onReturnToLobby: (() => void) | null = null
export let getGameStats: (() => GameStatsData) | null = null
export let getHudData: (() => HudData) | null = null

export function setCallbacks(callbacks: {
  onStartLocalMatch?: (matchConfig: LocalMatchConfig) => void
  onReturnToLobby?: () => void
  getGameStats?: () => GameStatsData
  getHudData?: () => HudData
}) {
  if (callbacks.onStartLocalMatch) onStartLocalMatch = callbacks.onStartLocalMatch
  if (callbacks.onReturnToLobby) onReturnToLobby = callbacks.onReturnToLobby
  if (callbacks.getGameStats) getGameStats = callbacks.getGameStats
  if (callbacks.getHudData) getHudData = callbacks.getHudData
}

/** Initialize the unified UI renderer */
export function setupUI(): void {
  console.log('[UI] Setting up unified UI renderer...')
  
  const uiComponent = () => {
    if (uiState.showRoomEntry && getServerRoomClientStatus() === 'joined') {
      uiState.showRoomEntry = false
      uiState.showWaitingRoom = true
      uiState.waitingRoomPage = 0
    }

    if (uiState.showLeaderboardRules) {
      return renderLeaderboardRulesUI()
    }

    // Priority: Game Over > Waiting Room > Room Entry > HUD
    if (uiState.showGameOver) {
      return renderGameOverUI()
    }

    if (uiState.showWaitingRoom) {
      return renderWaitingRoomUI()
    }
    
    if (uiState.showRoomEntry) {
      return renderRoomEntryUI()
    }
    
    if (uiState.showHud) {
      return renderHUD()
    }
    
    return renderLobbyHowToUI()
  }

  ReactEcsRenderer.setUiRenderer(uiComponent)
}

/** Render local room entry UI */
function renderRoomEntryUI() {
  const compact = isMobile()
  const room = getServerRoomSnapshot()
  const roomStatus = getServerRoomClientStatus()
  const matchSettling = room.phase === 'settling' || roomStatus === 'settling'
  const matchInProgress = room.phase === 'active' || roomStatus === 'match-in-progress' || roomStatus === 'match-started'
  const roomExists = room.phase === 'waiting' && room.playerCount > 0
  const localInRoom = room.isLocalPlayerInRoom
  const roomRequestBusy = roomStatus === 'connecting' || roomStatus === 'joining'
  const serverError = roomStatus === 'error'
  const entryActionLabel = serverError
    ? 'RETRY SERVER'
    : matchSettling
      ? 'WAITING'
    : roomStatus === 'connecting'
      ? 'CHECKING SERVER'
      : roomStatus === 'joining'
        ? roomExists ? 'JOINING ROOM' : 'CREATING ROOM'
        : matchInProgress
    ? 'WATCH GAME'
    : localInRoom
    ? 'OPEN ROOM'
    : roomExists
      ? 'JOIN ROOM'
      : 'CREATE ROOM'
  const entryDescription = serverError
    ? 'The match server may still be starting. Try again in a moment.'
    : matchSettling
      ? 'Waiting for players to exit before the next room can open.'
    : roomStatus === 'connecting'
      ? 'Connecting to the authoritative match server.'
      : roomStatus === 'joining'
        ? 'Sending your room request to the match server.'
        : matchInProgress
    ? 'Watch the current match. You will not join this round or affect its result.'
    : localInRoom
    ? 'You are already in this room.'
    : roomExists
      ? `Join ${displayNameOrAddress(room.hostDisplayName, room.hostAddress)}`
      : 'Create a room to start the current match.'

  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'modal',
      uiTransform: {
        width: compact ? MOBILE_MODAL_LAYOUT.width : 520,
        height: compact ? MOBILE_MODAL_LAYOUT.height : 340,
        positionType: undefined,
        position: undefined,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact
          ? { top: 28, bottom: 28, left: 24, right: 24 }
          : { top: 30, bottom: 30, left: 40, right: 40 },
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: 'DOGE HUNT ROOM',
        fontSize: compact ? 28 : 24,
        color: Color4.create(1, 0.84, 0, 1),
        uiTransform: { height: compact ? 46 : 40, margin: { bottom: compact ? 16 : 14 } },
      }),
      h(Label, {
        key: 'status',
        value: getServerRoomStatusLabel(),
        fontSize: compact ? 21 : 18,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { height: compact ? 34 : 30, margin: { bottom: compact ? 10 : 8 } },
      }),
      h(Label, {
        key: 'description',
        value: entryDescription,
        fontSize: compact ? 17 : 15,
        color: Color4.create(0.8, 0.8, 0.8, 1),
        uiTransform: {
          height: compact ? 'auto' : 28,
          minHeight: compact ? 40 : undefined,
          margin: { bottom: compact ? 28 : 24 },
        },
      }),
      h(Button, {
        key: 'createRoom',
        value: entryActionLabel,
        variant: 'primary',
        disabled: matchSettling || roomRequestBusy,
        uiTransform: { width: compact ? '82%' : 300, height: compact ? 66 : 60, margin: { bottom: compact ? 22 : 20 } },
        fontSize: compact ? 20 : 18,
        onMouseDown: () => {
          if (serverError) {
            console.log('[UI] Retry match server clicked')
            requestServerRoomSnapshot()
            return
          }
          if (matchSettling) return
          if (roomRequestBusy) return
          if (matchInProgress) {
            console.log('[UI] Watch active server match clicked')
            requestServerMatchSpectate()
            return
          }
          if (localInRoom) {
            console.log('[UI] Open existing server room clicked')
            uiState.showRoomEntry = false
            uiState.showWaitingRoom = true
            uiState.waitingRoomPage = 0
            return
          }

          console.log(roomExists ? '[UI] Join server room clicked' : '[UI] Create server room clicked')
          requestServerRoomJoin()
        },
      }),
      h(Button, {
        key: 'cancel',
        value: 'CANCEL',
        variant: 'secondary',
        uiTransform: { width: compact ? '62%' : 200, height: compact ? 54 : 50 },
        fontSize: compact ? 18 : 16,
        onMouseDown: () => {
          console.log('[UI] Cancel clicked')
          if (roomRequestBusy) {
            requestServerRoomLeave('ui-cancel')
          }
          uiState.showRoomEntry = false
        },
      }),
    ]),
  ])
}

/** Render server-owned waiting room UI */
function renderWaitingRoomUI() {
  const compact = isMobile()
  const room = getServerRoomSnapshot()
  const roomStatus = getServerRoomClientStatus()
  const statusLabel = getServerRoomStatusLabel()
  const localInRoom = room.isLocalPlayerInRoom
  const localIsHost = room.localPlayerIsHost
  const localIsReady = room.localPlayerIsReady
  const isStarting = roomStatus === 'starting' || room.phase === 'starting'
  const canStartMatch = roomStatus === 'joined' && localIsHost && room.canHostStart
  const canStartSolo = roomStatus === 'joined' && localIsHost && room.canHostStartSolo
  const canToggleReady = roomStatus === 'joined' && localInRoom
  const isSoloHost = localIsHost && room.playerCount === 1
  const isPartyHost = localIsHost && room.playerCount > 1

  if (uiState.pendingSoloStart) {
    if (!isSoloHost || isStarting || !localInRoom) {
      uiState.pendingSoloStart = false
    } else if (localIsReady && canStartSolo) {
      uiState.pendingSoloStart = false
      console.log('[UI] Solo confirmation ready sync complete; requesting authoritative start')
      requestServerMatchStart('solo')
    }
  }

  const canShowSoloStartConfirmation = uiState.showSoloStartConfirmation
    && roomStatus === 'joined'
    && localInRoom
    && isSoloHost
  if (uiState.showSoloStartConfirmation && !canShowSoloStartConfirmation) {
    uiState.showSoloStartConfirmation = false
  }
  if (canShowSoloStartConfirmation) {
    return renderSoloStartConfirmationUI()
  }

  const primaryButtonLabel = isStarting
    ? 'STARTING'
    : isSoloHost
      ? 'START GAME'
      : isPartyHost
        ? 'START GAME'
      : !localIsReady
      ? "I'M READY"
      : 'UNREADY'
  const primaryButtonDisabled = isStarting
    || (isSoloHost && !canToggleReady)
    || (isPartyHost && !canStartMatch)
    || (!isSoloHost && !localIsReady && !canToggleReady)
    || (!isSoloHost && !isPartyHost && localIsReady && !localIsHost && !canToggleReady)
  const startHint = isStarting
    ? room.startCountdownSeconds > 0
      ? `Match starts in ${room.startCountdownSeconds}s`
      : 'Starting match on server'
    : isSoloHost
      ? 'You are the host. Start the game when everyone is ready, or play solo.'
      : isPartyHost
        ? 'You are the host. Start the game when everyone is ready.'
      : localInRoom
        ? localIsReady
          ? 'Ready. Waiting for host to start'
          : 'Press Ready and wait for host to start game'
        : statusLabel
  const waitingRoomPageSize = getMobileOverlayPageSize(compact)
  const waitingRoomPageCount = Math.max(1, Math.ceil(room.players.length / waitingRoomPageSize))
  const waitingRoomPage = Math.min(uiState.waitingRoomPage, waitingRoomPageCount - 1)
  const waitingRoomPageStart = waitingRoomPage * waitingRoomPageSize
  const visiblePlayers = room.players.slice(waitingRoomPageStart, waitingRoomPageStart + waitingRoomPageSize)
  const waitingRoomRowHeight = compact ? 44 : 42
  const waitingRoomRowGap = compact ? 5 : 8
  const waitingRoomListHeight = visiblePlayers.length * waitingRoomRowHeight
    + Math.max(0, visiblePlayers.length - 1) * waitingRoomRowGap
  const playerRows = visiblePlayers.map((player, index) => {
    const isLocalPlayer = Boolean(
      room.recipientAddress &&
      player.address &&
      player.address.toLowerCase() === room.recipientAddress.toLowerCase()
    )
    const statusText = player.isHost
      ? 'HOST'
      : player.isSimulated
        ? 'SIM READY'
        : player.isReady
          ? 'READY'
          : 'WAITING'
    const statusColor = player.isHost
      ? Color4.create(1, 0.84, 0, 1)
      : player.isReady
        ? Color4.create(0.22, 1, 0.08, 1)
        : Color4.create(0.8, 0.8, 0.8, 1)

    return h(UiEntity, {
      key: `player-${player.id}-${waitingRoomPageStart + index}`,
      uiTransform: {
        width: '100%',
        height: waitingRoomRowHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? { left: 14, right: 14 } : { left: 18, right: 18 },
        margin: { bottom: index < waitingRoomPageSize - 1 ? waitingRoomRowGap : 0 },
      },
      uiBackground: { color: Color4.create(0.12, 0.12, 0.18, 0.95) },
    }, [
      h(Label, {
        key: 'rank',
        value: `#${waitingRoomPageStart + index + 1}`,
        fontSize: compact ? 15 : 13,
        color: player.isHost ? Color4.create(1, 0.84, 0, 1) : Color4.create(0.85, 0.85, 0.85, 1),
        textAlign: 'middle-left',
        uiTransform: { width: compact ? '8%' : 42, height: waitingRoomRowHeight },
      }),
      h(Label, {
        key: 'name',
        value: waitingRoomPlayerLabel(player.displayName, player.address),
        fontSize: compact ? 18 : 16,
        color: Color4.White(),
        uiTransform: { width: compact ? '54%' : 220, height: waitingRoomRowHeight, overflow: 'hidden' },
      }),
      h(Label, {
        key: 'status',
        value: statusText,
        fontSize: compact ? 16 : 14,
        color: statusColor,
        textAlign: 'middle-right',
        uiTransform: { width: compact ? '30%' : 120, height: waitingRoomRowHeight, overflow: 'hidden' },
      }),
    ])
  })
  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'modal',
      uiTransform: {
        width: compact ? MOBILE_MODAL_LAYOUT.width : 600,
        height: 'auto',
        minHeight: compact ? 300 : 340,
        positionType: undefined,
        position: undefined,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: compact ? 'flex-start' : 'center',
        padding: compact
          ? { top: 16, bottom: 16, left: 20, right: 20 }
          : { top: 28, bottom: 28, left: 40, right: 40 },
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(UiEntity, {
        key: 'titleBlock',
        uiTransform: {
          width: '100%',
          height: compact ? 52 : 38,
          margin: { bottom: compact ? 12 : 8 },
          justifyContent: 'center',
        },
      }, [h(Label, {
        key: 'title',
        value: roomStatus === 'joined'
          ? `WAITING ROOM (${room.playerCount}/${room.maxPlayers})`
          : 'WAITING ROOM',
        fontSize: compact ? 28 : 24,
        color: Color4.create(1, 0.84, 0, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compact ? 40 : 38 },
      })]),
      h(UiEntity, {
        key: 'playerList',
        uiTransform: {
          width: '100%',
          height: Math.max(waitingRoomRowHeight, waitingRoomListHeight),
          flexDirection: 'column',
          margin: { bottom: compact ? 6 : 16 },
        },
      }, playerRows),
      ...(compact || waitingRoomPageCount > 1 ? [renderPlayerListPager(
        'waitingRoomPager',
        waitingRoomPage,
        waitingRoomPageCount,
        (page) => { uiState.waitingRoomPage = page },
        compact
      )] : []),
      h(UiEntity, {
        key: 'waitingRoomActions',
        uiTransform: {
          width: '100%',
          height: compact ? 58 : 58,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          margin: { bottom: compact ? 10 : 8 },
        },
      }, [
        h(Button, {
          key: 'start',
          value: primaryButtonLabel,
          variant: 'primary',
          disabled: primaryButtonDisabled,
          uiTransform: { width: compact ? '44%' : '48%', height: 58, margin: { right: 8 } },
          fontSize: compact ? 18 : 18,
          onMouseDown: () => {
            if (isStarting) return
            if (isSoloHost) {
              if (!canToggleReady) return
              uiState.showSoloStartConfirmation = true
              console.log('[UI] Solo start confirmation opened')
              return
            }
            if (isPartyHost) {
              if (!canStartMatch) return
              console.log('[UI] Host requested authoritative party start')
              requestServerMatchStart('party')
              return
            }
            if (!localIsReady) {
              if (!canToggleReady) return
              console.log('[UI] Server room ready toggle clicked nextReady=true')
              requestServerRoomReady(true)
              return
            }

            if (!canToggleReady) return
            console.log('[UI] Server room ready toggle clicked nextReady=false')
            requestServerRoomReady(false)
          },
        }),
        h(Button, {
          key: 'leave',
          value: isStarting ? 'CANCEL' : 'LEAVE',
          variant: 'secondary',
          disabled: isStarting && !localIsHost,
          uiTransform: { width: compact ? '44%' : '48%', height: 58 },
          fontSize: compact ? 18 : 16,
          onMouseDown: () => {
            if (isStarting) {
              console.log('[UI] Match countdown cancellation requested')
              requestServerMatchStartCancel()
              return
            }

            console.log('[UI] Leave server room clicked')
            requestServerRoomLeave('ui-leave')
            leaveLocalRoom()
            uiState.showWaitingRoom = false
            uiState.showSoloStartConfirmation = false
            uiState.pendingSoloStart = false
            uiState.waitingRoomPage = 0
          },
        }),
      ]),
      h(Label, {
        key: 'serverStatus',
        value: startHint,
        fontSize: compact ? 18 : 14,
        color: roomStatus === 'error'
          ? Color4.create(1, 0.2, 0.2, 1)
          : localInRoom
            ? Color4.create(0.22, 1, 0.08, 1)
            : Color4.create(0.8, 0.8, 0.8, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compact ? 'auto' : 28, minHeight: compact ? 32 : undefined },
      }),
    ]),
  ])
}

function renderSoloStartConfirmationUI() {
  const compact = isMobile()
  const room = getServerRoomSnapshot()

  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'soloConfirmationModal',
      uiTransform: {
        width: compact ? MOBILE_MODAL_LAYOUT.width : 460,
        height: 'auto',
        minHeight: compact ? 300 : 260,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact
          ? { top: 24, bottom: 24, left: 24, right: 24 }
          : { top: 30, bottom: 30, left: 36, right: 36 },
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.97) },
    }, [
      h(Label, {
        key: 'soloConfirmationTitle',
        value: 'PLAY SOLO?',
        fontSize: compact ? 28 : 24,
        color: Color4.create(1, 0.84, 0, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compact ? 42 : 38, margin: { bottom: compact ? 16 : 12 } },
      }),
      h(Label, {
        key: 'soloConfirmationQuestion',
        value: 'Are you sure that you wanna play solo?',
        fontSize: compact ? 18 : 16,
        color: Color4.White(),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compact ? 'auto' : 32, minHeight: compact ? 42 : undefined, margin: { bottom: compact ? 22 : 20 } },
      }),
      h(Button, {
        key: 'confirmSoloYes',
        value: 'YES, I NEED PRACTICE',
        variant: 'primary',
        uiTransform: { width: compact ? '84%' : 300, height: compact ? 58 : 54, margin: { bottom: 12 } },
        fontSize: compact ? 16 : 15,
        onMouseDown: () => {
          uiState.showSoloStartConfirmation = false
          if (room.localPlayerIsReady && room.canHostStartSolo) {
            console.log('[UI] Solo start confirmed; requesting authoritative start')
            requestServerMatchStart('solo')
            return
          }

          uiState.pendingSoloStart = true
          console.log('[UI] Solo start confirmed; syncing ready state before authoritative start')
          requestServerRoomReady(true)
        },
      }),
      h(Button, {
        key: 'confirmSoloNo',
        value: "NO, I'LL WAIT FOR OTHERS",
        variant: 'secondary',
        uiTransform: { width: compact ? '84%' : 300, height: compact ? 54 : 50 },
        fontSize: compact ? 16 : 15,
        onMouseDown: () => {
          uiState.showSoloStartConfirmation = false
          uiState.pendingSoloStart = false
          console.log('[UI] Solo start confirmation declined')
        },
      }),
    ]),
  ])
}

function getMobileOverlayPageSize(compact: boolean): number {
  if (!compact) return PLAYER_LIST_PAGE_SIZE

  const reportedHeight = UiCanvasInformation.getOrNull(engine.RootEntity)?.height ?? 0
  if (reportedHeight > 0 && reportedHeight <= 560) return 2
  if (reportedHeight > 0 && reportedHeight <= 660) return 3

  return PLAYER_LIST_PAGE_SIZE
}

function getResultResponsiveLayout(compact: boolean): {
  pageSize: number
  showLeaderboardAward: boolean
} {
  const pageSize = getMobileOverlayPageSize(compact)
  if (!compact) return { pageSize, showLeaderboardAward: true }

  return { pageSize, showLeaderboardAward: pageSize > 2 }
}

/** Render game over UI */
function renderGameOverUI() {
  const stats = getGameStats
    ? getGameStats()
    : { bonks: 0, alive: 0, total: 11, time: '0:00', identityRevealLines: [], localStatusLabel: 'ACTIVE' }
  const isWin = stats.isWin ?? stats.alive === 0
  const localStatus = stats.localStatusLabel ?? 'ACTIVE'
  const isSpectatorResult = stats.isSpectatorResult === true
  const outcomeLabel = isSpectatorResult
    ? 'ROUND FINISHED'
    : isWin
      ? 'VICTORY'
      : localStatus === 'OUT' || localStatus === 'SPECTATING'
        ? 'ELIMINATED'
        : 'ROUND OVER'
  const titleColor = isSpectatorResult
    ? Color4.create(0, 0.96, 1, 1)
    : isWin ? Color4.create(0.22, 1, 0.08, 1) : Color4.create(1, 0.2, 0.2, 1)
  const desktopTitleBottomGap = isSpectatorResult ? 28 : 18
  const revealData = stats.revealData ?? null
  const revealLines = stats.identityRevealLines ?? []
  const room = getServerRoomSnapshot()
  const compactResultLayout = isMobile()
  const resultLayout = getResultResponsiveLayout(compactResultLayout)
  const resultPageSize = resultLayout.pageSize
  const visibleFallbackLines = revealLines.slice(0, compactResultLayout ? resultPageSize : 5)
  const resultPageCount = Math.max(1, Math.ceil((revealData?.players.length ?? 0) / resultPageSize))
  const resultPage = Math.min(uiState.resultPage, resultPageCount - 1)
  const resultPageStart = resultPage * resultPageSize
  const resultScale = 1
  const rs = (value: number) => Math.round(value * resultScale)
  const roomCloseSeconds = room.phase === 'settling'
    ? Math.ceil(room.settlingSecondsRemaining)
    : 0
  const roomCloseLabel = roomCloseSeconds > 0
    ? `Room closes in ${roomCloseSeconds}s`
    : ''
  const leaderboardLabel = getLeaderboardAwardLabel()
  const showLeaderboardAward = Boolean(leaderboardLabel) && resultLayout.showLeaderboardAward
  const localEliminationDetail = !isSpectatorResult
    ? revealData?.localEliminationDetail ?? ''
    : ''
  const visibleResultPlayers = revealData?.players.slice(resultPageStart, resultPageStart + resultPageSize) ?? []
  const resultPlayerRows = visibleResultPlayers.map((player, index) =>
    renderResultPlayerRow(player, resultPageStart + index, compactResultLayout, resultScale)
  )
  const handleReturnToLobby = () => {
    console.log('[UI] Return to Lobby button clicked')
    console.log('[UI] onReturnToLobby exists?', !!onReturnToLobby)
    uiState.showGameOver = false
    uiState.resultPage = 0

    if (onReturnToLobby) {
      console.log('[UI] Calling onReturnToLobby...')
      onReturnToLobby()
    } else {
      console.log('[UI] ERROR: onReturnToLobby is null!')
    }
  }

  return h(UiEntity, {
    key: 'gameOverOverlay',
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'gameOverModal',
      uiTransform: {
        width: compactResultLayout ? MOBILE_MODAL_LAYOUT.width : 640,
        height: 'auto',
        positionType: undefined,
        position: undefined,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: compactResultLayout
          ? { top: rs(12), bottom: rs(12), left: rs(14), right: rs(14) }
          : { top: 24, bottom: 24, left: 30, right: 30 },
        zIndex: 1,
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: outcomeLabel,
        fontSize: compactResultLayout ? 32 : 36,
        color: titleColor,
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: compactResultLayout ? 40 : 40,
          margin: { bottom: compactResultLayout ? 0 : desktopTitleBottomGap },
        },
      }),
      h(Label, {
        key: 'leaderboardAward',
        value: leaderboardLabel,
        fontSize: compactResultLayout ? 16 : 15,
        color: Color4.create(0.35, 1, 0.45, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: showLeaderboardAward ? compactResultLayout ? 22 : 24 : 0,
          margin: { bottom: showLeaderboardAward ? compactResultLayout ? 4 : 14 : 0 },
        },
      }),
      ...(localEliminationDetail ? [h(Label, {
        key: 'localEliminationDetail',
        value: localEliminationDetail,
        fontSize: compactResultLayout ? 16 : 15,
        color: Color4.create(1, 0.45, 0.45, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: 22,
          margin: { bottom: compactResultLayout ? 4 : 10 },
        },
      })] : []),
      ...(!compactResultLayout ? [h(UiEntity, {
        key: 'statsRow',
        uiTransform: {
          width: '100%',
          height: 66,
          flexDirection: 'row',
          justifyContent: 'space-between',
          margin: { bottom: 12 },
        },
      }, [
        renderResultStatBox('statBonks', 'BONKS', `${stats.bonks}`, Color4.create(0, 0.96, 1, 1), false, resultScale),
        renderResultStatBox('statTime', 'TIME', stats.time, Color4.create(1, 0.84, 0, 1), false, resultScale),
      ])] : []),
      ...(revealData ? [
        ...resultPlayerRows,
        renderPlayerListPager(
          'resultPager',
          resultPage,
          resultPageCount,
          (page) => { uiState.resultPage = page },
          compactResultLayout
        ),
      ] : visibleFallbackLines.length > 0 ? [
        h(Label, {
          key: 'fallbackRevealTitle',
          value: 'Match details',
          fontSize: rs(14),
          color: Color4.create(0.85, 0.85, 0.85, 1),
          textAlign: 'middle-center',
          uiTransform: { width: '100%', height: rs(20) },
        }),
        ...visibleFallbackLines.map((line, index) => h(Label, {
          key: `reveal-${index}`,
          value: line,
          fontSize: rs(13),
          color: Color4.create(0.85, 0.85, 0.85, 1),
          textAlign: 'middle-center',
          uiTransform: {
            width: '100%',
            height: rs(18),
            margin: { bottom: index === visibleFallbackLines.length - 1 ? rs(8) : rs(2) },
          },
        })),
      ] : []),
      ...(!compactResultLayout && roomCloseLabel ? [h(Label, {
        key: 'roomCloseCountdown',
        value: roomCloseLabel,
        fontSize: 13,
        color: Color4.create(0.85, 0.85, 0.9, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: 22,
          margin: { bottom: 8 },
        },
      })] : []),
      h(UiEntity, {
        key: 'returnBtn',
        uiTransform: {
          width: compactResultLayout ? '86%' : 340,
          height: compactResultLayout ? 52 : 52,
          margin: { top: compactResultLayout ? 8 : 12 },
          alignItems: 'center',
          justifyContent: 'center',
        },
        uiBackground: { color: Color4.create(1, 0.2, 0.45, 1) },
        uiText: {
          value: compactResultLayout && roomCloseSeconds > 0
            ? `RETURN TO LOBBY (${roomCloseSeconds}s)`
            : 'RETURN TO LOBBY',
          fontSize: compactResultLayout ? 17 : 18,
          color: Color4.create(1, 1, 1, 1),
          textAlign: 'middle-center',
        },
        onMouseDown: handleReturnToLobby,
      }),
    ]),
  ])
}

function renderResultStatBox(key: string, label: string, value: string, valueColor: Color4, compact = false, scale = 1) {
  const rs = (size: number) => Math.round(size * scale)

  return h(UiEntity, {
    key,
    uiTransform: {
      width: compact ? '46%' : 250,
      height: compact ? 64 : 66,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact
        ? { top: 4, bottom: 4, left: 6, right: 6 }
        : { top: 6, bottom: 6, left: 8, right: 8 },
    },
    uiBackground: { color: Color4.create(0.12, 0.12, 0.18, 0.92) },
  }, [
    h(Label, {
      key: 'label',
      value: label,
      fontSize: compact ? 12 : 11,
      color: Color4.create(0.75, 0.75, 0.8, 1),
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: compact ? 20 : 18 },
    }),
    h(Label, {
      key: 'value',
      value,
      fontSize: compact ? 19 : 16,
      color: valueColor,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: compact ? 30 : 30 },
    }),
  ])
}

function renderResultPlayerRow(
  player: ServerResultRevealPlayer,
  index: number,
  compact = false,
  scale = 1
) {
  const rs = (size: number) => Math.round(size * scale)
  const rowHeight = compact ? 44 : 34
  const statusColor = player.isWinner
    ? Color4.create(1, 0.84, 0, 1)
    : player.statusLabel === 'SURVIVED'
      ? Color4.create(0.22, 1, 0.08, 1)
      : Color4.create(1, 0.2, 0.2, 1)
  const rowColor = player.isLocal
    ? Color4.create(0.13, 0.18, 0.26, 0.95)
    : Color4.create(0.12, 0.12, 0.18, 0.85)
  const name = player.displayName || player.shortAddress
  const compactName = player.displayName.length > 12
    ? `${player.displayName.slice(0, 12)}...`
    : player.displayName

  return h(UiEntity, {
    key: `resultPlayer-${index}`,
    uiTransform: {
      width: '100%',
      height: rowHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: compact ? { left: 10, right: 10 } : { left: 14, right: 14 },
      margin: { bottom: 4 },
    },
    uiBackground: { color: rowColor },
  }, compact ? [
    h(Label, {
      key: 'rank',
      value: `#${player.rank}`,
      fontSize: 15,
      color: player.isWinner ? Color4.create(1, 0.84, 0, 1) : Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-left',
      uiTransform: { width: '7%', height: rowHeight },
    }),
    h(UiEntity, {
      key: 'nameCol',
      uiTransform: {
        width: '34%',
        height: rowHeight,
        flexDirection: 'column',
        justifyContent: 'center',
      },
    }, [
      h(Label, {
        key: 'name',
        value: compactName,
        fontSize: 15,
        color: Color4.White(),
        uiTransform: { width: '100%', height: 21, overflow: 'hidden' },
      }),
    ]),
    h(Label, {
      key: 'bonks',
      value: `${player.bonks} Bonks`,
      fontSize: 14,
      color: Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-center',
      uiTransform: { width: '23%', height: rowHeight, overflow: 'hidden' },
    }),
    h(UiEntity, {
      key: 'reticleGutter',
      uiTransform: { width: '7%', height: rowHeight },
    }),
    h(Label, {
      key: 'status',
      value: player.statusLabel,
      fontSize: 13,
      color: statusColor,
      textAlign: 'middle-right',
      uiTransform: { width: '29%', height: rowHeight },
    }),
  ] : [
    h(Label, {
      key: 'rank',
      value: `#${player.rank}`,
      fontSize: 13,
      color: player.isWinner ? Color4.create(1, 0.84, 0, 1) : Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-left',
      uiTransform: { width: 42, height: 24 },
    }),
    h(Label, {
      key: 'name',
      value: name,
      fontSize: 13,
      color: Color4.White(),
      uiTransform: { width: 166, height: 24, overflow: 'hidden' },
    }),
    h(Label, {
      key: 'bonks',
      value: `${player.bonks} Bonks`,
      fontSize: 12,
      color: Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-center',
      uiTransform: { width: 80, height: 24 },
    }),
    h(Label, {
      key: 'status',
      value: player.statusLabel,
      fontSize: 12,
      color: statusColor,
      textAlign: 'middle-right',
      uiTransform: { width: 90, height: 24 },
    }),
  ])
}

function renderLobbyHowToUI() {
  const compact = isMobile()
  const canExportLeaderboard = isLeaderboardExportAdmin()
  const width = compact ? 320 : 560
  const scale = compact ? 1 : 1.35
  const s = (n: number) => Math.round(n * scale)
  const panelPosition: { left?: number; top?: string; right?: number; bottom?: number | string } = compact
    ? { right: 104, bottom: '38%' }
    : { right: 34, bottom: 34 }
  const panelMargin = { top: 0 }
  const titleFontSize = compact ? 21 : s(22)
  const bodyFontSize = compact ? 15 : s(15)
  const titleHeight = compact ? 26 : s(30)
  const lineGap = compact ? 6 : s(6)

  const GOLD = Color4.create(1, 0.84, 0, 1)
  const PINK = Color4.create(1, 0.18, 0.59, 1)
  const WHITE = Color4.create(0.86, 0.86, 0.9, 1)

  const panel = h(UiEntity, {
    key: 'lobbyHowToPanel',
    uiTransform: {
      width,
      height: 'auto',
      positionType: 'absolute',
      position: panelPosition,
      margin: panelMargin,
      flexDirection: 'column',
      padding: {
        top: s(16),
        bottom: s(16),
        left: s(18),
        right: s(18),
      },
    },
    uiBackground: { color: Color4.create(0, 0, 0, 0.9) },
  }, [
    h(Label, {
      key: 'title',
      value: 'HOW TO PLAY',
      fontSize: titleFontSize,
      color: PINK,
      textAlign: 'middle-left',
      uiTransform: { width: '100%', height: titleHeight, margin: { bottom: compact ? 8 : s(10) } },
    }),
    h(Label, {
      key: 'rule1',
      value: '1/ Click the Doge head to create or join a room.',
      fontSize: bodyFontSize,
      color: WHITE,
      textAlign: 'middle-left',
      uiTransform: { width: '100%', height: 'auto', margin: { bottom: lineGap } },
    }),
    h(Label, {
      key: 'rule2',
      value: '2/ Ready up, then host starts the game.',
      fontSize: bodyFontSize,
      color: WHITE,
      textAlign: 'middle-left',
      uiTransform: { width: '100%', height: 'auto', margin: { bottom: lineGap } },
    }),
    h(Label, {
      key: 'rule3',
      value: '3/ All Doges look identical. BONK suspicious Doges to eliminate real players.',
      fontSize: bodyFontSize,
      color: WHITE,
      textAlign: 'middle-left',
      uiTransform: { width: '100%', height: 'auto', margin: { bottom: lineGap } },
    }),
    h(Label, {
      key: 'rule5',
      value: 'Win: last real player standing.',
      fontSize: bodyFontSize,
      color: GOLD,
      textAlign: 'middle-left',
      uiTransform: { width: '100%', height: 'auto', margin: { bottom: lineGap } },
    }),
    ...(canExportLeaderboard ? [
      h(Button, {
        key: 'exportLeaderboardBtn',
        value: 'EXPORT CSV',
        variant: 'secondary',
        uiTransform: {
          width: compact ? 102 : s(128),
          height: compact ? 30 : s(30),
          alignSelf: compact ? 'flex-start' : 'center',
        },
        fontSize: compact ? 11 : s(11),
        onMouseDown: () => {
          requestLeaderboardCsvExport()
        },
      }),
    ] : []),
  ])

  if (compact) {
    return h(ScreenInsetArea, {
      key: 'lobbyHowToSafeArea',
      uiTransform: { width: '100%', height: '100%' },
    }, [panel])
  }

  return h(UiEntity, {
    key: 'lobbyHowToRoot',
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
    },
  }, [panel])
}

function renderPlayerListPager(
  key: string,
  currentPage: number,
  pageCount: number,
  onPageChange: (page: number) => void,
  compact: boolean
) {
  const showPager = compact || pageCount > 1
  const controlWidth = compact ? 38 : 34

  return h(UiEntity, {
    key,
    uiTransform: {
      width: '100%',
      height: compact ? 38 : 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: { bottom: compact ? 8 : 8 },
    },
  }, showPager ? [
    h(UiEntity, {
      key: 'previous',
      uiTransform: {
        width: controlWidth,
        height: compact ? 34 : 28,
        margin: { right: 12 },
        alignItems: 'center',
        justifyContent: 'center',
      },
      uiBackground: {
        color: currentPage === 0
          ? Color4.create(0.48, 0.48, 0.54, 0.7)
          : Color4.create(1, 0.84, 0, 1),
        textureMode: 'stretch',
        texture: { src: 'assets/images/PageArrowLeft.png' },
      },
      ...(currentPage > 0 ? { onMouseDown: () => onPageChange(currentPage - 1) } : {}),
    }),
    h(Label, {
      key: 'pageLabel',
      value: `Page ${currentPage + 1}/${pageCount}`,
      fontSize: compact ? 15 : 14,
      color: Color4.create(0.82, 0.82, 0.86, 1),
      textAlign: 'middle-center',
      uiTransform: { width: compact ? 108 : 96, height: compact ? 34 : 28 },
    }),
    h(UiEntity, {
      key: 'next',
      uiTransform: {
        width: controlWidth,
        height: compact ? 34 : 28,
        margin: { left: 12 },
        alignItems: 'center',
        justifyContent: 'center',
      },
      uiBackground: {
        color: currentPage >= pageCount - 1
          ? Color4.create(0.48, 0.48, 0.54, 0.7)
          : Color4.create(1, 0.84, 0, 1),
        textureMode: 'stretch',
        texture: { src: 'assets/images/PageArrowRight.png' },
      },
      ...(currentPage < pageCount - 1 ? { onMouseDown: () => onPageChange(currentPage + 1) } : {}),
    }),
  ] : [])
}

function isLeaderboardExportAdmin(): boolean {
  const identity = PlayerIdentityData.getOrNull(engine.PlayerEntity)
  const player = getPlayer()
  const candidates = [
    { source: 'PlayerIdentityData.address', address: identity?.address ?? '' },
    { source: 'getPlayer.userId', address: player?.userId ?? '' },
  ]
  const match = candidates.find((candidate) => candidate.address && isDogeHuntAdmin(candidate.address))
  const firstResolved = match ?? candidates.find((candidate) => candidate.address)
  const isAdmin = match !== undefined
  const logKey = `${isMobile()}|${isAdmin}|${firstResolved?.source ?? 'none'}|${firstResolved?.address ?? 'none'}|${player?.isGuest === true}`

  if (logKey !== lastAdminResolutionLog) {
    lastAdminResolutionLog = logKey
    console.log(
      `[Admin] mobile=${isMobile()} admin=${isAdmin} source=${firstResolved?.source ?? 'none'} address=${firstResolved?.address ? getShortAddress(firstResolved.address) : 'none'} guest=${player?.isGuest === true}`,
    )
  }

  return isAdmin
}

function displayNameOrAddress(displayName: string, address: string): string {
  const normalizedName = displayName.trim()
  if (normalizedName && normalizedName.toLowerCase() !== 'player' && normalizedName.toLowerCase() !== 'you') {
    return normalizedName
  }

  return getShortAddress(address) || 'Player'
}

function waitingRoomPlayerLabel(displayName: string, address: string): string {
  const normalizedName = displayName.trim()
  const isUsableName = normalizedName
    && normalizedName.toLowerCase() !== 'player'
    && normalizedName.toLowerCase() !== 'you'
  const walletPrefix = address.length > 6 ? `${address.slice(0, 6)}...` : address
  const label = isUsableName ? normalizedName : walletPrefix || 'Player'
  return label.length > 18 ? `${label.slice(0, 17)}...` : label
}

function renderLeaderboardRulesUI() {
  const compact = isMobile()
  const WHITE = Color4.White()
  const GOLD = Color4.create(1, 0.84, 0, 1)
  const MUTED = Color4.create(0.78, 0.8, 0.86, 1)
  const CYAN = Color4.create(0, 0.96, 1, 1)
  const bodyFontSize = compact ? 16 : 18
  const lineHeight = compact ? 26 : 30

  return h(UiEntity, {
    key: 'leaderboardRulesOverlay',
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'leaderboardRulesBackdrop',
      uiTransform: {
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { left: 0, top: 0 },
        zIndex: 0,
      },
      uiBackground: { color: Color4.create(0, 0, 0, 0.76) },
    }),
    h(UiEntity, {
      key: 'leaderboardRulesModal',
      uiTransform: {
        width: compact ? '70.4%' : 620,
        height: compact ? '88%' : 610,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: compact
          ? { top: 20, bottom: 18, left: 20, right: 20 }
          : { top: 28, bottom: 24, left: 36, right: 36 },
        zIndex: 1,
      },
      uiBackground: { color: Color4.create(0.06, 0.07, 0.11, 0.98) },
    }, [
      h(Label, {
        key: 'title',
        value: 'WEEKLY RANKING RULES',
        fontSize: compact ? 26 : 30,
        color: GOLD,
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: compact ? 34 : 42,
          margin: { bottom: compact ? 8 : 12 },
        },
      }),
      h(Label, {
        key: 'weeklyReset',
        value: 'The leaderboard resets every Monday at 00:00 UTC.',
        fontSize: compact ? 16 : 17,
        color: MUTED,
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: compact ? 'auto' : 30,
          minHeight: compact ? 42 : undefined,
          margin: { bottom: compact ? 12 : 18 },
        },
      }),
      h(Label, {
        key: 'soloTitle',
        value: 'SOLO',
        fontSize: compact ? 21 : 22,
        color: CYAN,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: lineHeight },
      }),
      h(Label, {
        key: 'soloPoints',
        value: 'Win by eliminating all NPC Doges: +1 point.',
        fontSize: bodyFontSize,
        color: WHITE,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: lineHeight },
      }),
      h(Label, {
        key: 'soloCap',
        value: 'Daily solo limit: 10 points.',
        fontSize: bodyFontSize,
        color: MUTED,
        textAlign: 'middle-left',
        uiTransform: {
          width: '100%',
          height: lineHeight,
          margin: { bottom: compact ? 12 : 18 },
        },
      }),
      h(Label, {
        key: 'multiTitle',
        value: 'MULTIPLAYER',
        fontSize: compact ? 21 : 22,
        color: CYAN,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: lineHeight },
      }),
      h(Label, {
        key: 'multiPoints',
        value: '1st: +20   2nd: +10   3rd: +5   4th: +3',
        fontSize: bodyFontSize,
        color: WHITE,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: lineHeight },
      }),
      h(Label, {
        key: 'multiCap',
        value: 'Daily multiplayer limit: 100 points.',
        fontSize: bodyFontSize,
        color: MUTED,
        textAlign: 'middle-left',
        uiTransform: {
          width: '100%',
          height: lineHeight,
          margin: { bottom: compact ? 12 : 18 },
        },
      }),
      h(Label, {
        key: 'rankingTitle',
        value: 'HOW MULTIPLAYER RANKING WORKS',
        fontSize: compact ? 19 : 20,
        color: GOLD,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: lineHeight },
      }),
      h(Label, {
        key: 'rankingRule1',
        value: 'The winner ranks first. Survivors rank above eliminated players.',
        fontSize: compact ? 16 : 17,
        color: WHITE,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: compact ? 'auto' : lineHeight, minHeight: compact ? 44 : undefined },
      }),
      h(Label, {
        key: 'rankingRule2',
        value: 'Survivors rank by Bonks. Eliminated players rank by survival time.',
        fontSize: compact ? 16 : 17,
        color: WHITE,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: compact ? 'auto' : lineHeight, minHeight: compact ? 44 : undefined },
      }),
      h(Label, {
        key: 'rankingRule3',
        value: 'Leaving a match counts as elimination.',
        fontSize: compact ? 16 : 17,
        color: MUTED,
        textAlign: 'middle-left',
        uiTransform: {
          width: '100%',
          height: lineHeight,
          margin: { bottom: compact ? 12 : 18 },
        },
      }),
      h(Button, {
        key: 'closeLeaderboardRules',
        value: 'CLOSE',
        variant: 'primary',
        fontSize: compact ? 18 : 18,
        uiTransform: {
          width: compact ? 144 : 220,
          height: compact ? 44 : 48,
          alignSelf: 'center',
        },
        onMouseDown: () => {
          uiState.showLeaderboardRules = false
        },
      }),
    ]),
  ])
}

/** Render HUD (in-game stats and instructions) */
function renderHUD() {
  const data = getHudData
    ? getHudData()
    : {
        bonks: 0,
        alive: 0,
        total: 11,
        timeLeft: 180,
        roundOver: false,
        realPlayersAlive: null,
        serverPublicLabel: '',
        localPlayerStatus: 'active',
        localStatusLabel: 'ACTIVE',
        canAct: true,
        isWatcher: false,
      }
  
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }
  
  const WHITE = Color4.create(0.8, 0.8, 0.8, 1)
  const GOLD = Color4.create(1, 0.84, 0, 1)
  const PINK = Color4.create(1, 0.18, 0.59, 1)
  const CYAN = Color4.create(0, 0.96, 1, 1)
  const RED = Color4.create(1, 0.2, 0.2, 1)
  const GREEN = Color4.create(0.22, 1, 0.08, 1)
  const BG = Color4.create(0, 0, 0, 0.75)
  const DIVIDER = Color4.create(1, 1, 1, 0.2)
  const BUTTON_BG = Color4.create(0.08, 0.08, 0.12, 0.9)
  
  const SCALE = 1.2
  const s = (n: number) => Math.round(n * SCALE)
  const E_HINT_SCALE = 1.35
  const es = (n: number) => Math.round(n * SCALE * E_HINT_SCALE)
  
  const timeColor = (data.timeLeft <= 30 && !data.roundOver) ? RED : CYAN
  const aliveColor = data.alive <= 3 ? RED : data.alive <= 6 ? GOLD : GREEN
  const isSpectating = data.canAct === false
    || data.localPlayerStatus === 'spectator'
    || data.localPlayerStatus === 'out'
  const handleSpectatorReturnToLobby = () => {
    console.log('[UI] Spectator Return to Lobby clicked')
    if (onReturnToLobby) {
      onReturnToLobby()
      return
    }
    requestServerRoomLeave('spectator-return-to-lobby')
  }
  const rockHudState = getTurnToRockHudState()
  const rockIsReady = rockHudState.statusLabel === 'Ready'
  const rockIsActive = rockHudState.statusLabel.startsWith('Active:')
  const rockStatusColor = isSpectating ? CYAN : rockIsReady ? GREEN : rockIsActive ? GREEN : GOLD
  const rockStatusLabel = isSpectating
    ? 'Actions locked'
    : rockHudState.enabled
      ? ''
      : rockHudState.buttonLabel
  const actionButtonSize = es(68)
  const rockButtonSize = isMobile() ? actionButtonSize : actionButtonSize * 2
  const rockButtonHeight = rockButtonSize + es(22)
  const rockButtonDisabled = isSpectating || !rockHudState.enabled
  const rockButtonImageSrc = rockIsActive
    ? 'assets/images/Rockin.png'
    : 'assets/images/Rock.png'
  const rockButtonImageColor = (isSpectating || (!rockHudState.enabled && !rockIsActive))
    ? Color4.create(1, 1, 1, 0.55)
    : Color4.White()
  const mobileActions = isMobile()
  // Mobile stacks Bonk over Rock on one fixed-width axis. This avoids the
  // immutable Explorer controls at the lower-right while preserving equal art.
  const mobileActionGroupWidth = actionButtonSize
  const mobileActionGroupHeight = actionButtonSize + es(14) + rockButtonHeight
  
  const panel = h(UiEntity, {
    key: 'hudPanel',
    uiTransform: {
      width: s(320),
      height: s(374),
      positionType: 'absolute',
      position: { left: s(42), top: '50%' },
      margin: { top: -s(187) },
      flexDirection: 'column',
      padding: { top: s(12), bottom: s(12), left: s(16), right: s(16) },
    },
    uiBackground: { color: BG },
  }, [
    h(UiEntity, {
      key: 'titleBlock',
      uiTransform: { height: s(48), flexDirection: 'column', margin: { bottom: s(6) } },
    }, [
      h(Label, {
        key: 'title',
        value: 'DOGE HUNT',
        fontSize: s(20),
        color: GOLD,
        uiTransform: { height: s(24), margin: { bottom: s(2) } },
      }),
      h(Label, {
        key: 'subtitle',
        value: 'Proof of Concept (Visual and gameplay enhancements coming in future updates.)',
        fontSize: s(11),
        color: GOLD,
        uiTransform: { height: s(18) },
      }),
    ]),
    h(Label, {
      key: 'timer',
      value: data.roundOver ? 'ROUND OVER' : formatTime(data.timeLeft),
      fontSize: s(18),
      color: timeColor,
      uiTransform: { height: s(24), margin: { bottom: s(8) } },
    }),
    h(Label, {
      key: 'stats',
      value: `Alive: ${data.alive}/${data.total}    Bonks: ${data.bonks}`,
      fontSize: s(13),
      color: aliveColor,
      uiTransform: { height: s(20), margin: { bottom: s(4) } },
    }),
    ...(data.serverPublicLabel ? [h(Label, {
      key: 'serverPublic',
      value: data.serverPublicLabel,
      fontSize: s(10),
      color: GREEN,
      uiTransform: { height: s(16), margin: { bottom: s(8) } },
    })] : []),
    ...(isSpectating ? [h(Label, {
      key: 'spectatorStatus',
      value: data.localStatusLabel ?? 'SPECTATING',
      fontSize: s(16),
      color: CYAN,
      textAlign: 'middle-center',
      uiTransform: { height: s(24), margin: { bottom: s(8) } },
    })] : []),
    h(UiEntity, {
      key: 'divider',
      uiTransform: { height: 1, width: '100%', margin: { bottom: s(10) } },
      uiBackground: { color: DIVIDER },
    }),
    h(Label, {
      key: 'h2p',
      value: 'HOW TO PLAY',
      fontSize: s(14),
      color: PINK,
      uiTransform: { height: s(18), margin: { bottom: s(6) } },
    }),
    h(Label, {
      key: 'r1',
      value: '• Players and NPCs look identical.',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18), margin: { bottom: s(2) } },
    }),
    h(Label, {
      key: 'r2',
      value: '• Click a Doge to BONK (eliminate).',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18), margin: { bottom: s(2) } },
    }),
    h(Label, {
      key: 'r3',
      value: '• BONKed real players are OUT.',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18), margin: { bottom: s(2) } },
    }),
    h(Label, {
      key: 'r4',
      value: 'Last real player standing wins.',
      fontSize: s(12),
      color: GOLD,
      uiTransform: { height: s(18), margin: { bottom: s(4) } },
    }),
    h(Label, {
      key: 'r5',
      value: '• Round ends at 0:00 — time up: most Bonks wins.',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18) },
    }),
  ])

  const compactHud = isMobile()
  // Results can take a frame to replace the HUD after the server settles. Do
  // not show a competing mobile "ROUND OVER" banner during that hand-off.
  const showGameTimer = !compactHud || !data.roundOver
  const canUseAdminControls = isLeaderboardExportAdmin()
  const timerWidth = compactHud ? 200 : 260
  const timerHeight = compactHud ? 56 : 68
  const timerFontSize = 40
  const timerOutlineOffsets = [
    { left: -1, top: -1 },
    { left: 0, top: -1 },
    { left: 1, top: -1 },
    { left: -1, top: 0 },
    { left: 1, top: 0 },
    { left: -1, top: 1 },
    { left: 0, top: 1 },
    { left: 1, top: 1 },
  ]
  const timer = h(UiEntity, {
    key: 'gameTimer',
    uiTransform: {
      width: timerWidth,
      height: timerHeight,
      positionType: 'absolute',
      position: { left: '50%', top: compactHud ? 16 : 24 },
      margin: { left: -Math.round(timerWidth / 2) },
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    ...timerOutlineOffsets.map((offset, index) => h(Label, {
      key: `timerTextOutline${index}`,
      value: data.roundOver ? 'ROUND OVER' : formatTime(data.timeLeft),
      fontSize: timerFontSize,
      color: Color4.Black(),
      textAlign: 'middle-center',
      uiTransform: {
        width: '100%',
        height: timerHeight,
        positionType: 'absolute',
        position: offset,
      },
    })),
    h(Label, {
      key: 'timerText',
      value: data.roundOver ? 'ROUND OVER' : formatTime(data.timeLeft),
      fontSize: timerFontSize,
      color: timeColor,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: timerHeight },
    }),
  ])

  const realPlayersAlive = data.realPlayersAlive
  const realPlayersAliveLabel = realPlayersAlive === null || realPlayersAlive === undefined
    ? ''
    : `${realPlayersAlive} REAL PLAYER${realPlayersAlive === 1 ? '' : 'S'} ALIVE`
  const playerCountFontSize = compactHud ? 15 : 17
  const playerCountWidth = compactHud ? 250 : 300
  const playerCountHeight = compactHud ? 24 : 28
  const playerCountTop = compactHud ? 74 : 98
  const playerCountOutlineOffsets = [
    { left: -1, top: -1 }, { left: 0, top: -1 }, { left: 1, top: -1 },
    { left: -1, top: 0 }, { left: 1, top: 0 },
    { left: -1, top: 1 }, { left: 0, top: 1 }, { left: 1, top: 1 },
  ]
  const realPlayersCounter = realPlayersAlive === null || realPlayersAlive === undefined
    ? null
    : h(UiEntity, {
    key: 'realPlayersAliveCounter',
    uiTransform: {
      width: playerCountWidth,
      height: playerCountHeight,
      positionType: 'absolute',
      position: { left: '50%', top: playerCountTop },
      margin: { left: -Math.round(playerCountWidth / 2) },
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    ...playerCountOutlineOffsets.map((offset, index) => h(Label, {
      key: `realPlayersAliveOutline${index}`,
      value: realPlayersAliveLabel,
      fontSize: playerCountFontSize,
      color: Color4.Black(),
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: playerCountHeight, positionType: 'absolute', position: offset },
    })),
    h(Label, {
      key: 'realPlayersAliveText',
      value: realPlayersAliveLabel,
      fontSize: playerCountFontSize,
      color: GREEN,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: playerCountHeight },
    }),
  ])

  const actionButtons = h(UiEntity, {
    key: 'actionWrap',
    uiTransform: {
      positionType: 'absolute',
      position: mobileActions
        ? { left: '50%', bottom: es(8) }
        : { left: 0, right: 0, bottom: es(18) },
      width: mobileActions ? mobileActionGroupWidth : '100%',
      height: mobileActions ? mobileActionGroupHeight : rockButtonHeight,
      margin: mobileActions ? { left: -Math.round(mobileActionGroupWidth / 2) + es(130) } : undefined,
      flexDirection: mobileActions ? 'column' : 'row',
      alignItems: mobileActions ? 'center' : 'flex-end',
      justifyContent: mobileActions ? 'flex-end' : 'center',
    },
  }, [
    ...(isMobile() ? [h(UiEntity, {
      key: 'mobileBonkButton',
      uiTransform: {
        width: actionButtonSize,
        height: actionButtonSize,
        position: mobileActions ? { left: es(30) } : undefined,
        // Pull BONK 20px toward Rock while the fixed-height stack keeps Rock anchored.
        margin: { bottom: es(-6) },
      },
      uiBackground: {
        textureMode: 'stretch',
        texture: { src: 'assets/images/Bonk.png' },
      },
      onMouseDown: !isSpectating ? () => triggerPlayerBonkAttack() : undefined,
    }, [
      ...(isSpectating ? [h(UiEntity, {
        key: 'mobileBonkDisabledOverlay',
        uiTransform: { width: '100%', height: '100%' },
        uiBackground: { color: Color4.create(0, 0, 0, 0.5) },
      })] : []),
    ])] : []),
    h(UiEntity, {
      key: 'rockButtonWrap',
      uiTransform: {
        width: rockButtonSize,
        height: rockButtonHeight,
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
      },
    }, [
      h(UiEntity, {
        key: 'rockButtonStatus',
        uiTransform: {
          width: '100%',
          height: es(18),
          margin: { bottom: es(2) },
        },
      }, [
        ...[
          { left: -1, top: 0 },
          { left: 1, top: 0 },
          { left: 0, top: -1 },
          { left: 0, top: 1 },
        ].map((offset, index) => h(Label, {
          key: `rockButtonStatusOutline${index}`,
          value: rockStatusLabel,
          fontSize: es(10),
          color: Color4.Black(),
          textAlign: 'middle-center',
          uiTransform: {
            width: '100%',
            height: 34,
            positionType: 'absolute',
            position: offset,
          },
        })),
        h(Label, {
          key: 'rockButtonStatusText',
          value: rockStatusLabel,
          fontSize: es(10),
          color: rockStatusColor,
          textAlign: 'middle-center',
          uiTransform: { width: '100%', height: '100%' },
        }),
      ]),
      h(UiEntity, {
        key: 'rockButton',
        uiTransform: {
          width: rockButtonSize,
          height: rockButtonSize,
        },
        uiBackground: {
          color: rockButtonImageColor,
          textureMode: 'stretch',
          texture: { src: rockButtonImageSrc },
        },
        onMouseDown: !rockButtonDisabled ? () => triggerTurnToRock() : undefined,
      }),
    ]),
  ])

  const safeActionButtons = actionButtons && mobileActions
    ? h(ScreenInsetArea, {
        key: 'mobileActionSafeArea',
        uiTransform: { width: '100%', height: '100%' },
      }, [actionButtons])
    : actionButtons

  const watcherModeIndicator = data.isWatcher === true
    ? h(UiEntity, {
        key: 'watcherMode',
        uiTransform: {
          width: 260,
          height: 82,
          positionType: 'absolute',
          position: { left: '50%', bottom: compactHud ? 36 : 30 },
          margin: { left: -130 },
          alignItems: 'center',
          justifyContent: 'center',
        },
      }, [
        h(UiEntity, {
          key: 'watcherModeLabelLayer',
          uiTransform: {
            width: '100%',
            height: 34,
            positionType: 'absolute',
            position: { left: 0, top: 0 },
          },
        }, [
          ...[
            { left: -1, top: -1 },
            { left: 0, top: -1 },
            { left: 1, top: -1 },
            { left: -1, top: 0 },
            { left: 1, top: 0 },
            { left: -1, top: 1 },
            { left: 0, top: 1 },
            { left: 1, top: 1 },
          ].map((offset, index) => h(Label, {
            key: `watcherModeOutline${index}`,
            value: 'SPECTATOR MODE',
            fontSize: compactHud ? 19 : 18,
            color: Color4.Black(),
            textAlign: 'middle-center',
            uiTransform: {
              width: '100%',
              height: '100%',
              positionType: 'absolute',
              position: offset,
            },
          })),
          h(Label, {
            key: 'watcherModeText',
            value: 'SPECTATOR MODE',
            fontSize: compactHud ? 19 : 18,
            color: CYAN,
            textAlign: 'middle-center',
            uiTransform: { width: '100%', height: '100%' },
          }),
        ]),
        h(Button, {
          key: 'watcherReturnToLobby',
          value: 'RETURN TO LOBBY',
          variant: 'secondary',
          uiTransform: {
            width: compactHud ? 190 : 190,
            height: 36,
            positionType: 'absolute',
            position: { left: 35, top: 42 },
          },
          fontSize: compactHud ? 14 : 14,
          onMouseDown: handleSpectatorReturnToLobby,
        }),
      ])
    : null

  const npcFreezeButtonLabel = areServerNpcsFrozen()
    ? 'RESUME NPCs'
    : 'FREEZE NPCs'

  // DEBUG: Server-owned NPC controls (center-top)
  const debugButton = h(UiEntity, {
    key: 'debugButtonWrap',
    uiTransform: {
      positionType: 'absolute',
      position: { left: '50%', top: compactHud ? 116 : 140 },
      margin: { left: compactHud ? -240 : -460 },
      width: compactHud ? 480 : 920,
      height: compactHud ? 44 : 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(Button, {
      key: 'markOutBtn',
      value: 'OUT (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: compactHud ? 100 : 140, height: compactHud ? 44 : 50, margin: { right: compactHud ? 6 : 10 } },
      fontSize: compactHud ? 10 : 13,
      onMouseDown: () => {
        console.log('[DEBUG][T] Server mark out button clicked')
        requestServerDebugMarkLocalOut()
      },
    }),
    h(Button, {
      key: 'killAllBtn',
      value: 'KILL ALL (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: compactHud ? 120 : 180, height: compactHud ? 44 : 50, margin: { right: compactHud ? 6 : 10 } },
      fontSize: compactHud ? 10 : 14,
      onMouseDown: () => {
        console.log('[DEBUG][S] Server Kill All button clicked')
        requestServerDebugEliminateAllDoges()
      },
    }),
    h(Button, {
      key: 'forceEndBtn',
      value: 'END ROUND (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: compactHud ? 130 : 210, height: compactHud ? 44 : 50, margin: { right: compactHud ? 6 : 10 } },
      fontSize: compactHud ? 10 : 13,
      onMouseDown: () => {
        console.log('[DEBUG][T] Server force round end button clicked')
        requestServerDebugForceRoundEnd()
      },
    }),
    h(Button, {
      key: 'npcFreezeBtn',
      value: npcFreezeButtonLabel,
      variant: 'secondary',
      uiTransform: { width: compactHud ? 112 : 250, height: compactHud ? 44 : 50 },
      fontSize: compactHud ? 10 : 13,
      onMouseDown: () => {
        console.log(`[DEBUG][Admin] ${npcFreezeButtonLabel} button clicked`)
        requestServerDebugToggleNpcFreeze()
      },
    }),
  ])

  const children = showGameTimer ? [timer] : []
  if (realPlayersCounter) children.push(realPlayersCounter)
  const eliminationChoice = renderEliminationChoice(compactHud)
  if (eliminationChoice) children.push(eliminationChoice)
  const feedbackTop = compactHud
    ? 136
    : DEBUG_CONTROLS_ENABLED && canUseAdminControls
      ? 210
      : 136
  const feedback = renderGameplayFeedback(compactHud, feedbackTop)
  if (feedback) children.push(feedback)
  if (!isSpectating && safeActionButtons) children.push(safeActionButtons)
  if (watcherModeIndicator) children.push(watcherModeIndicator)
  if (!eliminationChoice && DEBUG_CONTROLS_ENABLED && canUseAdminControls) {
    children.push(debugButton)
  }
  if (!compactHud) {
    children.push(h(UiEntity, {
      key: 'desktopGameplayHint',
      uiTransform: {
        width: 290,
        height: 'auto',
        positionType: 'absolute',
        position: { right: 34, bottom: es(18) },
        flexDirection: 'column',
        padding: { top: 16, bottom: 16, left: 20, right: 20 },
        zIndex: 2,
      },
      uiBackground: { color: Color4.create(0, 0, 0, 0.9) },
    }, [
      h(Label, {
        key: 'bonkHint',
        value: 'Click and Bonk Doges.',
        fontSize: 20,
        color: Color4.White(),
        uiTransform: { width: '100%', height: 'auto', margin: { bottom: 6 } },
      }),
      h(Label, {
        key: 'rockHint',
        value: 'Use "Rock" skill to hide.',
        fontSize: 20,
        color: Color4.White(),
        uiTransform: { width: '100%', height: 'auto' },
      }),
    ]))
  }

  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
    },
  }, children)
}

function renderEliminationChoice(compact: boolean) {
  if (!isEliminationChoicePending()) return null

  const width = compact ? '62.4%' : 420
  const height = compact ? 222 : 238
  const handleSpectate = () => {
    resolveEliminationChoice()
    setLocalEliminatedSpectatingMode(true)
    console.log('[UI] Eliminated player chose spectator mode')
  }
  const handleReturnToLobby = () => {
    resolveEliminationChoice()
    console.log('[UI] Eliminated player chose return to lobby')
    if (onReturnToLobby) {
      onReturnToLobby()
      return
    }
    requestServerRoomLeave('eliminated-return-to-lobby')
  }

  return h(UiEntity, {
    key: 'eliminationChoiceOverlay',
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
      zIndex: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'eliminationChoicePanel',
      uiTransform: {
        width,
        height,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact
          ? { top: 16, bottom: 16, left: 18, right: 18 }
          : { top: 18, bottom: 18, left: 24, right: 24 },
      },
      uiBackground: { color: Color4.create(0.06, 0.06, 0.1, 0.96) },
    }, [
      h(Label, {
        key: 'eliminationChoiceTitle',
        value: 'ELIMINATED',
        fontSize: compact ? 30 : 34,
        color: Color4.create(1, 0.2, 0.2, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compact ? 42 : 46 },
      }),
      h(Label, {
        key: 'eliminationChoiceDetail',
        value: getEliminationChoiceDetail(),
        fontSize: compact ? 16 : 17,
        color: Color4.create(0.9, 0.9, 0.94, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compact ? 28 : 30, margin: { bottom: compact ? 12 : 14 } },
      }),
      h(Button, {
        key: 'eliminationSpectate',
        value: 'SPECTATE',
        variant: 'primary',
        uiTransform: { width: compact ? '86%' : 280, height: compact ? 46 : 48, margin: { bottom: 10 } },
        fontSize: compact ? 18 : 18,
        onMouseDown: handleSpectate,
      }),
      h(Button, {
        key: 'eliminationReturnToLobby',
        value: 'RETURN TO LOBBY',
        variant: 'secondary',
        uiTransform: { width: compact ? '86%' : 280, height: compact ? 42 : 44 },
        fontSize: compact ? 15 : 16,
        onMouseDown: handleReturnToLobby,
      }),
    ]),
  ])
}

function renderGameplayFeedback(compact: boolean, top: number) {
  const feedback = getGameplayFeedback()
  if (!feedback) return null

  const isEliminated = feedback.kind === 'eliminated'
  const color = isEliminated
    ? Color4.create(1, 0.2, 0.2, 1)
    : feedback.kind === 'player-eliminated'
      ? Color4.create(1, 0.84, 0, 1)
      : Color4.create(0, 0.96, 1, 1)
  const width = compact ? 300 : 360

  return h(UiEntity, {
    key: 'gameplayFeedback',
    uiTransform: {
      width,
      height: isEliminated ? 92 : 68,
      positionType: 'absolute',
      position: { left: '50%', top },
      margin: { left: -Math.round(width / 2) },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: { top: 6, bottom: 6, left: 12, right: 12 },
    },
    uiBackground: { color: Color4.create(0.05, 0.05, 0.08, isEliminated ? 0.9 : 0.78) },
  }, [
    h(Label, {
      key: 'title',
      value: feedback.title,
      fontSize: isEliminated ? (compact ? 30 : 32) : (compact ? 22 : 24),
      color,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: isEliminated ? 42 : 32 },
    }),
    h(Label, {
      key: 'detail',
      value: feedback.detail,
      fontSize: compact ? 14 : 15,
      color: Color4.create(0.9, 0.9, 0.94, 1),
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: 24 },
    }),
  ])
}
