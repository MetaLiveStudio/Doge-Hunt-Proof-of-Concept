/**
 * uiManager.ts — Unified UI renderer for all game screens
 */
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { triggerPlayerBonkAttack } from './combat'
import { triggerTurnToRock, getTurnToRockHudState } from './skills'
import { leaveLocalRoom } from './localRoom'
import type { LocalMatchConfig } from './localMatch'
import {
  getServerRoomClientStatus,
  getServerRoomSnapshot,
  getServerRoomStatusLabel,
  requestServerMatchStart,
  requestServerRoomReady,
  requestServerRoomJoin,
  requestServerRoomLeave,
  requestServerRoomSnapshot,
} from './client/serverRoomClient'
import {
  requestServerDebugEliminateAllDoges,
  requestServerDebugForceRoundEnd,
  requestServerDebugMarkLocalOut,
} from './client/serverGameplayClient'
import type {
  ServerResultRevealPlayer,
  ServerResultsRevealData,
} from './client/serverPublicStateClient'
import { getShortAddress } from './shared/serverRoom'

const h = ReactEcs.createElement
const DEBUG_CONTROLS_ENABLED = true

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
  revealData?: ServerResultsRevealData | null
}

export type HudData = {
  bonks: number
  alive: number
  total: number
  timeLeft: number
  roundOver: boolean
  serverPublicLabel?: string
  localPlayerStatus?: string
  localStatusLabel?: string
  canAct?: boolean
}

// UI state
export const uiState = {
  showRoomEntry: false,
  showWaitingRoom: false,
  showGameOver: false,
  showHud: false,
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
    ? 'GAME IN PROGRESS'
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
    ? 'A match is already running. Please wait for the next round.'
    : localInRoom
    ? 'You are already in this room.'
    : roomExists
      ? `Join ${room.hostDisplayName || 'host'} ${getShortAddress(room.hostAddress)}`
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
    uiBackground: { color: Color4.create(0, 0, 0, 0.85) },
  }, [
    h(UiEntity, {
      key: 'modal',
      uiTransform: {
        width: 520,
        height: 340,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { top: 30, bottom: 30, left: 40, right: 40 },
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: 'DOGE HUNT ROOM',
        fontSize: 24,
        color: Color4.create(1, 0.84, 0, 1),
        uiTransform: { height: 40, margin: { bottom: 14 } },
      }),
      h(Label, {
        key: 'status',
        value: getServerRoomStatusLabel(),
        fontSize: 18,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { height: 30, margin: { bottom: 8 } },
      }),
      h(Label, {
        key: 'description',
        value: entryDescription,
        fontSize: 15,
        color: Color4.create(0.8, 0.8, 0.8, 1),
        uiTransform: { height: 28, margin: { bottom: 24 } },
      }),
      h(Button, {
        key: 'createRoom',
        value: entryActionLabel,
        variant: 'primary',
        disabled: matchSettling || matchInProgress || roomRequestBusy,
        uiTransform: { width: 300, height: 60, margin: { bottom: 20 } },
        fontSize: 18,
        onMouseDown: () => {
          if (serverError) {
            console.log('[UI] Retry match server clicked')
            requestServerRoomSnapshot()
            return
          }
          if (matchSettling) return
          if (roomRequestBusy) return
          if (matchInProgress) return
          if (localInRoom) {
            console.log('[UI] Open existing server room clicked')
            uiState.showRoomEntry = false
            uiState.showWaitingRoom = true
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
        uiTransform: { width: 200, height: 50 },
        fontSize: 16,
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
  const room = getServerRoomSnapshot()
  const roomStatus = getServerRoomClientStatus()
  const statusLabel = getServerRoomStatusLabel()
  const localInRoom = room.isLocalPlayerInRoom
  const localIsHost = room.localPlayerIsHost
  const localIsReady = room.localPlayerIsReady
  const canStartMatch = roomStatus === 'joined' && localIsHost && room.canHostStart
  const canReady = roomStatus === 'joined' && localInRoom && !localIsHost && !localIsReady
  const primaryButtonLabel = localIsHost
    ? (roomStatus === 'starting' ? 'STARTING' : 'START')
    : 'READY'
  const primaryButtonDisabled = localIsHost
    ? !canStartMatch
    : !canReady
  const startHint = roomStatus === 'starting'
    ? 'Starting match on server'
    : localIsHost
      ? room.canHostStart
        ? 'Host: ready to start'
        : 'Host: waiting for players to be ready'
      : localInRoom
        ? localIsReady
          ? 'Ready. Waiting for host to start'
          : 'Press Ready when you are prepared'
        : statusLabel
  const playerRows = room.players.map((player, index) => {
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
      key: `player-${player.id}-${index}`,
      uiTransform: {
        width: '100%',
        height: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: { left: 18, right: 18 },
        margin: { bottom: 8 },
      },
      uiBackground: { color: Color4.create(0.12, 0.12, 0.18, 0.95) },
    }, [
      h(Label, {
        key: 'name',
        value: player.address
          ? `${isLocalPlayer ? 'You' : player.displayName} ${getShortAddress(player.address)}`
          : `${isLocalPlayer ? 'You' : player.displayName}`,
        fontSize: 16,
        color: Color4.White(),
        uiTransform: { width: 220, height: 28 },
      }),
      h(Label, {
        key: 'status',
        value: statusText,
        fontSize: 14,
        color: statusColor,
        textAlign: 'middle-right',
        uiTransform: { width: 120, height: 28 },
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
    uiBackground: { color: Color4.create(0, 0, 0, 0.85) },
  }, [
    h(UiEntity, {
      key: 'modal',
      uiTransform: {
        width: 600,
        height: 590,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { top: 28, bottom: 28, left: 40, right: 40 },
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: 'WAITING ROOM',
        fontSize: 24,
        color: Color4.create(1, 0.84, 0, 1),
        uiTransform: { height: 38, margin: { bottom: 8 } },
      }),
      h(Label, {
        key: 'players',
        value: roomStatus === 'joined'
          ? `Players ${room.playerCount}/${room.maxPlayers}`
          : statusLabel,
        fontSize: 20,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { height: 32, margin: { bottom: 8 } },
      }),
      h(Label, {
        key: 'host',
        value: room.hostDisplayName
          ? `Host: ${room.hostDisplayName} ${getShortAddress(room.hostAddress)}`
          : 'Host: waiting for server',
        fontSize: 14,
        color: Color4.create(0.8, 0.8, 0.8, 1),
        uiTransform: { height: 24, margin: { bottom: 16 } },
      }),
      h(UiEntity, {
        key: 'playerList',
        uiTransform: {
          width: '100%',
          height: 200,
          flexDirection: 'column',
          margin: { bottom: 16 },
        },
      }, playerRows),
      h(Label, {
        key: 'serverStatus',
        value: statusLabel,
        fontSize: 14,
        color: roomStatus === 'error'
          ? Color4.create(1, 0.2, 0.2, 1)
          : Color4.create(0.22, 1, 0.08, 1),
        uiTransform: { height: 28, margin: { bottom: 8 } },
      }),
      h(Label, {
        key: 'startHint',
        value: startHint,
        fontSize: 14,
        color: localIsHost
          ? Color4.create(0.22, 1, 0.08, 1)
          : Color4.create(0.8, 0.8, 0.8, 1),
        uiTransform: { height: 28, margin: { bottom: 10 } },
      }),
      h(Button, {
        key: 'start',
        value: primaryButtonLabel,
        variant: 'primary',
        disabled: primaryButtonDisabled,
        uiTransform: { width: 300, height: 58, margin: { bottom: 14 } },
        fontSize: 18,
        onMouseDown: () => {
          if (localIsHost) {
            if (!canStartMatch) return
            console.log('[UI] Request server match start clicked')
            requestServerMatchStart()
            return
          }

          if (!canReady) return
          console.log('[UI] Ready server room clicked')
          requestServerRoomReady(true)
        },
      }),
      h(Button, {
        key: 'leave',
        value: 'LEAVE',
        variant: 'secondary',
        uiTransform: { width: 220, height: 50 },
        fontSize: 16,
        onMouseDown: () => {
          console.log('[UI] Leave server room clicked')
          requestServerRoomLeave()
          leaveLocalRoom()
          uiState.showWaitingRoom = false
        },
      }),
    ]),
  ])
}

/** Render game over UI */
function renderGameOverUI() {
  const stats = getGameStats
    ? getGameStats()
    : { bonks: 0, alive: 0, total: 11, time: '0:00', identityRevealLines: [], localStatusLabel: 'ACTIVE' }
  const isWin = stats.isWin ?? stats.alive === 0
  const titleText = stats.resultTitle ?? (isWin ? 'Round Complete' : 'GAME OVER')
  const subtitleText = stats.resultSubtitle ?? (isWin ? 'You Win' : 'You Lose')
  const localStatus = stats.localStatusLabel ?? 'ACTIVE'
  const resultStatus = getResultStatusLabel(localStatus)
  const reasonText = revealDataReasonLabel(stats.revealData, titleText)
  const showReason = reasonText.toLowerCase() !== subtitleText.toLowerCase()
  const outcomeLabel = isWin
    ? 'VICTORY'
    : localStatus === 'OUT' || localStatus === 'SPECTATING'
      ? 'ELIMINATED'
      : 'ROUND OVER'
  const titleColor = isWin ? Color4.create(0.22, 1, 0.08, 1) : Color4.create(1, 0.2, 0.2, 1)
  const revealData = stats.revealData ?? null
  const revealLines = stats.identityRevealLines ?? []
  const room = getServerRoomSnapshot()
  const compactResultLayout = isMobile()
  const roomCloseSeconds = room.phase === 'settling'
    ? Math.ceil(room.settlingSecondsRemaining)
    : 0
  const roomCloseLabel = roomCloseSeconds > 0
    ? `Room closes in ${roomCloseSeconds}s`
    : ''
  const handleReturnToLobby = () => {
    console.log('[UI] Return to Lobby button clicked')
    console.log('[UI] onReturnToLobby exists?', !!onReturnToLobby)
    uiState.showGameOver = false

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
      key: 'gameOverBackdrop',
      uiTransform: {
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { left: 0, top: 0 },
        zIndex: 0,
      },
      uiBackground: { color: Color4.create(0, 0, 0, 0.78) },
    }),
    h(UiEntity, {
      key: 'gameOverModal',
      uiTransform: {
        width: compactResultLayout ? '92%' : 600,
        height: compactResultLayout ? '88%' : 620,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: compactResultLayout
          ? { top: 14, bottom: 14, left: 14, right: 14 }
          : { top: 24, bottom: 24, left: 30, right: 30 },
        zIndex: 1,
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: outcomeLabel,
        fontSize: compactResultLayout ? 24 : 34,
        color: titleColor,
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? 30 : 40 },
      }),
      h(Label, {
        key: 'subtitle',
        value: subtitleText,
        fontSize: compactResultLayout ? 14 : 18,
        color: Color4.create(1, 0.84, 0, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? 22 : 26 },
      }),
      h(Label, {
        key: 'reason',
        value: showReason ? `Reason: ${reasonText}` : '',
        fontSize: compactResultLayout ? 11 : 14,
        color: Color4.create(0.82, 0.82, 0.86, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: showReason ? compactResultLayout ? 18 : 22 : 6,
          margin: { bottom: compactResultLayout ? 6 : 10 },
        },
      }),
      h(UiEntity, {
        key: 'statsRow',
        uiTransform: {
          width: '100%',
          height: compactResultLayout ? 54 : 66,
          flexDirection: 'row',
          justifyContent: 'space-between',
          margin: { bottom: compactResultLayout ? 8 : 12 },
        },
      }, [
        renderResultStatBox('statStatus', 'YOUR STATUS', resultStatus, titleColor, compactResultLayout),
        renderResultStatBox('statBonks', 'BONKS', `${stats.bonks}`, Color4.create(0, 0.96, 1, 1), compactResultLayout),
        renderResultStatBox('statTime', 'TIME', stats.time, Color4.create(1, 0.84, 0, 1), compactResultLayout),
      ]),
      h(Label, {
        key: 'revealTitle',
        value: 'FINAL REVEAL',
        fontSize: compactResultLayout ? 15 : 18,
        color: Color4.create(1, 0.84, 0, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? 20 : 24, margin: { bottom: 2 } },
      }),
      h(Label, {
        key: 'winner',
        value: revealData ? `Winner: ${revealData.winnerLabel}` : 'Winner: pending',
        fontSize: compactResultLayout ? 12 : 14,
        color: Color4.create(0.85, 0.85, 0.9, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? 18 : 22, margin: { bottom: compactResultLayout ? 4 : 6 } },
      }),
      ...(revealData ? [
        ...revealData.players.slice(0, 4).map((player, index) => renderResultPlayerRow(player, index, compactResultLayout)),
        h(Label, {
          key: 'decoySummary',
          value: `Decoys: ${revealData.decoyEliminated} eliminated, ${revealData.decoyAlive} survived`,
          fontSize: compactResultLayout ? 10 : 13,
          color: Color4.create(0.82, 0.82, 0.86, 1),
          textAlign: 'middle-center',
          uiTransform: { width: '100%', height: compactResultLayout ? 16 : 20, margin: { top: 0, bottom: compactResultLayout ? 4 : 8 } },
        }),
      ] : revealLines.length > 0 ? [
        h(Label, {
          key: 'fallbackRevealTitle',
          value: 'Match details',
          fontSize: 14,
          color: Color4.create(0.85, 0.85, 0.85, 1),
          textAlign: 'middle-center',
          uiTransform: { width: '100%', height: 20 },
        }),
        ...revealLines.slice(0, 5).map((line, index) => h(Label, {
          key: `reveal-${index}`,
          value: line,
          fontSize: 13,
          color: Color4.create(0.85, 0.85, 0.85, 1),
          textAlign: 'middle-center',
          uiTransform: {
            width: '100%',
            height: 18,
            margin: { bottom: index === Math.min(revealLines.length, 5) - 1 ? 8 : 2 },
          },
        })),
      ] : []),
      h(Label, {
        key: 'roomCloseCountdown',
        value: roomCloseLabel,
        fontSize: compactResultLayout ? 11 : 13,
        color: Color4.create(0.85, 0.85, 0.9, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: compactResultLayout ? 18 : 22,
          positionType: 'absolute',
          position: { bottom: compactResultLayout ? 72 : 84 },
        },
      }),
      h(UiEntity, {
        key: 'returnBtn',
        uiTransform: {
          width: compactResultLayout ? '82%' : 320,
          height: compactResultLayout ? 46 : 52,
          positionType: 'absolute',
          position: { bottom: compactResultLayout ? 18 : 24 },
          alignItems: 'center',
          justifyContent: 'center',
        },
        uiBackground: { color: Color4.create(1, 0.2, 0.45, 1) },
        uiText: {
          value: 'RETURN TO LOBBY',
          fontSize: compactResultLayout ? 14 : 18,
          color: Color4.create(1, 1, 1, 1),
          textAlign: 'middle-center',
        },
        onMouseDown: handleReturnToLobby,
      }),
    ]),
  ])
}

function getResultStatusLabel(status: string): string {
  if (status === 'SPECTATING' || status === 'OUT') return 'ELIMINATED'
  return status
}

function revealDataReasonLabel(revealData: ServerResultsRevealData | null | undefined, fallback: string): string {
  return revealData?.endReasonLabel ?? fallback
}

function renderResultStatBox(key: string, label: string, value: string, valueColor: Color4, compact = false) {
  return h(UiEntity, {
    key,
    uiTransform: {
      width: compact ? '31%' : 172,
      height: compact ? 54 : 66,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact
        ? { top: 4, bottom: 4, left: 4, right: 4 }
        : { top: 6, bottom: 6, left: 8, right: 8 },
    },
    uiBackground: { color: Color4.create(0.12, 0.12, 0.18, 0.92) },
  }, [
    h(Label, {
      key: 'label',
      value: label,
      fontSize: compact ? 8 : 11,
      color: Color4.create(0.75, 0.75, 0.8, 1),
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: compact ? 16 : 18 },
    }),
    h(Label, {
      key: 'value',
      value,
      fontSize: compact ? 12 : 16,
      color: valueColor,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: compact ? 24 : 30 },
    }),
  ])
}

function renderResultPlayerRow(player: ServerResultRevealPlayer, index: number, compact = false) {
  const statusColor = player.isWinner
    ? Color4.create(1, 0.84, 0, 1)
    : player.statusLabel === 'SURVIVED'
      ? Color4.create(0.22, 1, 0.08, 1)
      : Color4.create(1, 0.2, 0.2, 1)
  const rowColor = player.isLocal
    ? Color4.create(0.13, 0.18, 0.26, 0.95)
    : Color4.create(0.12, 0.12, 0.18, 0.85)
  const name = `${player.displayName} ${player.shortAddress}`
  const compactName = player.displayName.length > 12
    ? `${player.displayName.slice(0, 12)}...`
    : player.displayName

  return h(UiEntity, {
    key: `resultPlayer-${index}`,
    uiTransform: {
      width: '100%',
      height: compact ? 42 : 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: compact ? { left: 8, right: 8 } : { left: 14, right: 14 },
      margin: { bottom: compact ? 3 : 4 },
    },
    uiBackground: { color: rowColor },
  }, compact ? [
    h(Label, {
      key: 'rank',
      value: `#${player.rank}`,
      fontSize: 11,
      color: player.isWinner ? Color4.create(1, 0.84, 0, 1) : Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-left',
      uiTransform: { width: 28, height: 22 },
    }),
    h(UiEntity, {
      key: 'nameCol',
      uiTransform: {
        width: 120,
        height: 34,
        flexDirection: 'column',
        justifyContent: 'center',
      },
    }, [
      h(Label, {
        key: 'name',
        value: `${compactName} ${player.shortAddress}`,
        fontSize: 11,
        color: Color4.White(),
        uiTransform: { width: '100%', height: 17 },
      }),
      h(Label, {
        key: 'doge',
        value: player.dogeLabel,
        fontSize: 10,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { width: '100%', height: 15 },
      }),
    ]),
    h(Label, {
      key: 'bonks',
      value: `${player.bonks}`,
      fontSize: 11,
      color: Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-center',
      uiTransform: { width: 42, height: 22 },
    }),
    h(Label, {
      key: 'status',
      value: player.statusLabel,
      fontSize: 10,
      color: statusColor,
      textAlign: 'middle-right',
      uiTransform: { width: 66, height: 22 },
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
      uiTransform: { width: 166, height: 24 },
    }),
    h(Label, {
      key: 'doge',
      value: player.dogeLabel,
      fontSize: 13,
      color: Color4.create(0, 0.96, 1, 1),
      textAlign: 'middle-center',
      uiTransform: { width: 90, height: 24 },
    }),
    h(Label, {
      key: 'bonks',
      value: `${player.bonks} bonks`,
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
  const width = compact ? 320 : 560
  const height = compact ? 286 : 370
  const left = compact ? 16 : 50
  const top = '50%'
  const marginTop = compact ? -143 : -215
  const scale = compact ? 1 : 1.35
  const s = (n: number) => Math.round(n * scale)
  const panelPosition: { left?: number; top?: string; right?: number; bottom?: number } = compact
    ? { left, top }
    : { right: 34, bottom: 34 }
  const panelMargin = compact ? { top: marginTop } : { top: 0 }
  const titleFontSize = compact ? 19 : s(22)
  const bodyFontSize = compact ? 13 : s(15)
  const titleHeight = compact ? 26 : s(30)
  const lineHeight = compact ? 21 : s(24)
  const sectionGap = compact ? 9 : s(14)

  const GOLD = Color4.create(1, 0.84, 0, 1)
  const PINK = Color4.create(1, 0.18, 0.59, 1)
  const WHITE = Color4.create(0.86, 0.86, 0.9, 1)
  const CYAN = Color4.create(0, 0.96, 1, 1)

  return h(UiEntity, {
    key: 'lobbyHowToRoot',
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
    },
  }, [
    h(UiEntity, {
      key: 'lobbyHowToPanel',
      uiTransform: {
        width,
        height,
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
      uiBackground: { color: Color4.create(0, 0, 0, 0.62) },
    }, [
      h(Label, {
        key: 'title',
        value: 'HOW TO PLAY',
        fontSize: titleFontSize,
        color: PINK,
        uiTransform: { width: '100%', height: titleHeight, margin: { bottom: compact ? 8 : s(10) } },
      }),
      h(Label, {
        key: 'rule1',
        value: 'Click the Doge head to create or join a room.',
        fontSize: bodyFontSize,
        color: WHITE,
        uiTransform: { width: '100%', height: lineHeight, margin: { bottom: compact ? 3 : s(4) } },
      }),
      h(Label, {
        key: 'rule2',
        value: 'Ready up, then host starts the game.',
        fontSize: bodyFontSize,
        color: WHITE,
        uiTransform: { width: '100%', height: lineHeight, margin: { bottom: sectionGap } },
      }),
      h(Label, {
        key: 'rule3',
        value: 'All Doges look identical.',
        fontSize: bodyFontSize,
        color: WHITE,
        uiTransform: { width: '100%', height: lineHeight, margin: { bottom: compact ? 3 : s(4) } },
      }),
      h(Label, {
        key: 'rule4',
        value: 'BONK suspicious Doges to eliminate real players.',
        fontSize: bodyFontSize,
        color: WHITE,
        uiTransform: { width: '100%', height: lineHeight, margin: { bottom: sectionGap } },
      }),
      h(Label, {
        key: 'rule5',
        value: 'Win: last real player standing.',
        fontSize: bodyFontSize,
        color: GOLD,
        uiTransform: { width: '100%', height: lineHeight, margin: { bottom: compact ? 3 : s(4) } },
      }),
      h(Label, {
        key: 'rule6',
        value: 'Solo: clear all NPCs. Time up: most Bonks wins.',
        fontSize: bodyFontSize,
        color: CYAN,
        uiTransform: { width: '100%', height: lineHeight },
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
        serverPublicLabel: '',
        localPlayerStatus: 'active',
        localStatusLabel: 'ACTIVE',
        canAct: true,
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
  const rockHudState = getTurnToRockHudState()
  const rockIsReady = rockHudState.statusLabel === 'Ready'
  const rockIsActive = rockHudState.statusLabel.startsWith('Active:')
  const rockButtonBg = isSpectating
    ? Color4.create(0.08, 0.08, 0.12, 0.9)
    : rockIsReady
      ? Color4.create(0.14, 0.14, 0.2, 0.95)
      : rockIsActive
        ? Color4.create(0.08, 0.28, 0.12, 0.95)
        : Color4.create(0.28, 0.18, 0.08, 0.95)
  const rockStatusColor = isSpectating ? CYAN : rockIsReady ? GREEN : rockIsActive ? GREEN : GOLD
  
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
  const timerWidth = compactHud ? 156 : 210
  const timerHeight = compactHud ? 48 : 56
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
    uiBackground: { color: Color4.create(0, 0, 0, 0.56) },
  }, [
    h(Label, {
      key: 'timerText',
      value: data.roundOver ? 'ROUND OVER' : formatTime(data.timeLeft),
      fontSize: compactHud ? 24 : 30,
      color: timeColor,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: timerHeight },
    }),
  ])

  const actionButtons = h(UiEntity, {
    key: 'actionWrap',
    uiTransform: {
      positionType: 'absolute',
      position: { left: 0, right: 0, bottom: es(18) },
      height: es(84),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    ...(isMobile() ? [h(Button, {
      key: 'mobileBonkButton',
      value: isSpectating ? 'SPECTATING' : 'BONK',
      variant: 'primary',
      fontSize: es(16),
      disabled: isSpectating,
      uiTransform: {
        width: es(168),
        height: es(54),
        margin: { right: es(8) },
      },
      onMouseDown: () => {
        triggerPlayerBonkAttack()
      },
    })] : []),
    h(UiEntity, {
      key: 'rockButton',
      uiTransform: {
        width: es(220),
        height: es(64),
        padding: { top: es(8), bottom: es(8), left: es(10), right: es(10) },
        justifyContent: 'center',
        alignItems: 'center',
      },
      uiBackground: { color: rockButtonBg },
      onMouseDown: !isSpectating && rockHudState.enabled ? () => {
        triggerTurnToRock()
      } : undefined,
    }, [
      h(Label, {
        key: 'rockButtonTitle',
        value: isSpectating
          ? 'SPECTATING'
          : rockHudState.enabled
          ? (isMobile() ? 'Turn to Rock' : 'Turn to Rock [E]')
          : rockHudState.buttonLabel,
        fontSize: es(12),
        color: Color4.White(),
        uiTransform: {
          width: '100%',
          height: es(20),
          margin: { bottom: es(2) },
        },
        textAlign: 'middle-center',
      }),
      h(Label, {
        key: 'rockButtonStatus',
        value: isSpectating
          ? 'Actions locked'
          : rockHudState.enabled
          ? 'Ready'
          : rockHudState.statusLabel,
        fontSize: es(10),
        color: rockStatusColor,
        uiTransform: {
          width: '100%',
          height: es(16),
        },
        textAlign: 'middle-center',
      }),
    ]),
  ])

  // DEBUG: Kill All button (center-top)
  const debugButton = h(UiEntity, {
    key: 'debugButtonWrap',
    uiTransform: {
      positionType: 'absolute',
      position: { left: '50%', top: 92 },
      margin: { left: -310 },
      width: 620,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(Button, {
      key: 'markOutBtn',
      value: 'OUT (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: 140, height: 50, margin: { right: 10 } },
      fontSize: 13,
      onMouseDown: () => {
        console.log('[DEBUG][T] Server mark out button clicked')
        requestServerDebugMarkLocalOut()
      },
    }),
    h(Button, {
      key: 'killAllBtn',
      value: 'KILL ALL (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: 180, height: 50, margin: { right: 10 } },
      fontSize: 14,
      onMouseDown: () => {
        console.log('[DEBUG][S] Server Kill All button clicked')
        requestServerDebugEliminateAllDoges()
      },
    }),
    h(Button, {
      key: 'forceEndBtn',
      value: 'END ROUND (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: 210, height: 50 },
      fontSize: 13,
      onMouseDown: () => {
        console.log('[DEBUG][T] Server force round end button clicked')
        requestServerDebugForceRoundEnd()
      },
    }),
  ])

  const children = [timer]
  children.push(actionButtons)
  if (DEBUG_CONTROLS_ENABLED && !compactHud) {
    children.push(debugButton)
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
