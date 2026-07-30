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
import { getLeaderboardAwardLabel, requestLeaderboardCsvExport } from './client/leaderboardClient'

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
  showLeaderboardRules: false,
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
  const resultScale = compactResultLayout ? 0.7 : 1
  const rs = (value: number) => Math.round(value * resultScale)
  const roomCloseSeconds = room.phase === 'settling'
    ? Math.ceil(room.settlingSecondsRemaining)
    : 0
  const roomCloseLabel = roomCloseSeconds > 0
    ? `Room closes in ${roomCloseSeconds}s`
    : ''
  const leaderboardLabel = getLeaderboardAwardLabel()
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
        width: compactResultLayout ? '64.4%' : 600,
        height: compactResultLayout ? '61.6%' : 620,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: compactResultLayout
          ? { top: rs(14), bottom: rs(14), left: rs(14), right: rs(14) }
          : { top: 24, bottom: 24, left: 30, right: 30 },
        zIndex: 1,
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: outcomeLabel,
        fontSize: compactResultLayout ? rs(24) : 34,
        color: titleColor,
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? rs(30) : 40 },
      }),
      h(Label, {
        key: 'subtitle',
        value: subtitleText,
        fontSize: compactResultLayout ? rs(14) : 18,
        color: Color4.create(1, 0.84, 0, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? rs(22) : 26 },
      }),
      h(Label, {
        key: 'reason',
        value: showReason ? `Reason: ${reasonText}` : '',
        fontSize: compactResultLayout ? rs(11) : 14,
        color: Color4.create(0.82, 0.82, 0.86, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: showReason ? compactResultLayout ? rs(18) : 22 : 6,
          margin: { bottom: compactResultLayout ? rs(6) : 10 },
        },
      }),
      h(Label, {
        key: 'leaderboardAward',
        value: leaderboardLabel,
        fontSize: compactResultLayout ? rs(12) : 15,
        color: Color4.create(0.35, 1, 0.45, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: leaderboardLabel ? compactResultLayout ? rs(20) : 24 : 0,
          margin: { bottom: leaderboardLabel ? compactResultLayout ? rs(6) : 8 : 0 },
        },
      }),
      h(UiEntity, {
        key: 'statsRow',
        uiTransform: {
          width: '100%',
          height: compactResultLayout ? rs(54) : 66,
          flexDirection: 'row',
          justifyContent: 'space-between',
          margin: { bottom: compactResultLayout ? rs(8) : 12 },
        },
      }, [
        renderResultStatBox('statStatus', 'YOUR STATUS', resultStatus, titleColor, compactResultLayout, resultScale),
        renderResultStatBox('statBonks', 'BONKS', `${stats.bonks}`, Color4.create(0, 0.96, 1, 1), compactResultLayout, resultScale),
        renderResultStatBox('statTime', 'TIME', stats.time, Color4.create(1, 0.84, 0, 1), compactResultLayout, resultScale),
      ]),
      h(Label, {
        key: 'revealTitle',
        value: 'FINAL REVEAL',
        fontSize: compactResultLayout ? rs(15) : 18,
        color: Color4.create(1, 0.84, 0, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? rs(20) : 24, margin: { bottom: compactResultLayout ? rs(2) : 2 } },
      }),
      h(Label, {
        key: 'winner',
        value: revealData ? `Winner: ${revealData.winnerLabel}` : 'Winner: pending',
        fontSize: compactResultLayout ? rs(12) : 14,
        color: Color4.create(0.85, 0.85, 0.9, 1),
        textAlign: 'middle-center',
        uiTransform: { width: '100%', height: compactResultLayout ? rs(18) : 22, margin: { bottom: compactResultLayout ? rs(4) : 6 } },
      }),
      ...(revealData ? [
        ...revealData.players.slice(0, 4).map((player, index) => renderResultPlayerRow(player, index, compactResultLayout, resultScale)),
        h(Label, {
          key: 'decoySummary',
          value: `Decoys: ${revealData.decoyEliminated} eliminated, ${revealData.decoyAlive} survived`,
          fontSize: compactResultLayout ? rs(10) : 13,
          color: Color4.create(0.82, 0.82, 0.86, 1),
          textAlign: 'middle-center',
          uiTransform: { width: '100%', height: compactResultLayout ? rs(16) : 20, margin: { top: 0, bottom: compactResultLayout ? rs(4) : 8 } },
        }),
      ] : revealLines.length > 0 ? [
        h(Label, {
          key: 'fallbackRevealTitle',
          value: 'Match details',
          fontSize: rs(14),
          color: Color4.create(0.85, 0.85, 0.85, 1),
          textAlign: 'middle-center',
          uiTransform: { width: '100%', height: rs(20) },
        }),
        ...revealLines.slice(0, 5).map((line, index) => h(Label, {
          key: `reveal-${index}`,
          value: line,
          fontSize: rs(13),
          color: Color4.create(0.85, 0.85, 0.85, 1),
          textAlign: 'middle-center',
          uiTransform: {
            width: '100%',
            height: rs(18),
            margin: { bottom: index === Math.min(revealLines.length, 5) - 1 ? rs(8) : rs(2) },
          },
        })),
      ] : []),
      h(Label, {
        key: 'roomCloseCountdown',
        value: roomCloseLabel,
        fontSize: compactResultLayout ? rs(11) : 13,
        color: Color4.create(0.85, 0.85, 0.9, 1),
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: compactResultLayout ? rs(18) : 22,
          positionType: 'absolute',
          position: { bottom: compactResultLayout ? rs(72) : 84 },
        },
      }),
      h(UiEntity, {
        key: 'returnBtn',
        uiTransform: {
          width: compactResultLayout ? '82%' : 320,
          height: compactResultLayout ? rs(46) : 52,
          positionType: 'absolute',
          position: { bottom: compactResultLayout ? rs(18) : 24 },
          alignItems: 'center',
          justifyContent: 'center',
        },
        uiBackground: { color: Color4.create(1, 0.2, 0.45, 1) },
        uiText: {
          value: 'RETURN TO LOBBY',
          fontSize: compactResultLayout ? rs(14) : 18,
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

function renderResultStatBox(key: string, label: string, value: string, valueColor: Color4, compact = false, scale = 1) {
  const rs = (size: number) => Math.round(size * scale)

  return h(UiEntity, {
    key,
    uiTransform: {
      width: compact ? '31%' : 172,
      height: compact ? rs(54) : 66,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact
        ? { top: rs(4), bottom: rs(4), left: rs(4), right: rs(4) }
        : { top: 6, bottom: 6, left: 8, right: 8 },
    },
    uiBackground: { color: Color4.create(0.12, 0.12, 0.18, 0.92) },
  }, [
    h(Label, {
      key: 'label',
      value: label,
      fontSize: compact ? rs(8) : 11,
      color: Color4.create(0.75, 0.75, 0.8, 1),
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: compact ? rs(16) : 18 },
    }),
    h(Label, {
      key: 'value',
      value,
      fontSize: compact ? rs(12) : 16,
      color: valueColor,
      textAlign: 'middle-center',
      uiTransform: { width: '100%', height: compact ? rs(24) : 30 },
    }),
  ])
}

function renderResultPlayerRow(player: ServerResultRevealPlayer, index: number, compact = false, scale = 1) {
  const rs = (size: number) => Math.round(size * scale)
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
      height: compact ? rs(42) : 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: compact ? { left: rs(8), right: rs(8) } : { left: 14, right: 14 },
      margin: { bottom: compact ? rs(3) : 4 },
    },
    uiBackground: { color: rowColor },
  }, compact ? [
    h(Label, {
      key: 'rank',
      value: `#${player.rank}`,
      fontSize: rs(11),
      color: player.isWinner ? Color4.create(1, 0.84, 0, 1) : Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-left',
      uiTransform: { width: rs(28), height: rs(22) },
    }),
    h(UiEntity, {
      key: 'nameCol',
      uiTransform: {
        width: rs(120),
        height: rs(34),
        flexDirection: 'column',
        justifyContent: 'center',
      },
    }, [
      h(Label, {
        key: 'name',
        value: `${compactName} ${player.shortAddress}`,
        fontSize: rs(11),
        color: Color4.White(),
        uiTransform: { width: '100%', height: rs(17) },
      }),
      h(Label, {
        key: 'doge',
        value: player.dogeLabel,
        fontSize: rs(10),
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { width: '100%', height: rs(15) },
      }),
    ]),
    h(Label, {
      key: 'bonks',
      value: `${player.bonks}`,
      fontSize: rs(11),
      color: Color4.create(0.85, 0.85, 0.85, 1),
      textAlign: 'middle-center',
      uiTransform: { width: rs(42), height: rs(22) },
    }),
    h(Label, {
      key: 'status',
      value: player.statusLabel,
      fontSize: rs(10),
      color: statusColor,
      textAlign: 'middle-right',
      uiTransform: { width: rs(66), height: rs(22) },
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
      uiBackground: { color: Color4.create(0, 0, 0, 0.9) },
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
        uiTransform: { width: '100%', height: lineHeight, margin: { bottom: compact ? 6 : s(10) } },
      }),
      h(Button, {
        key: 'exportLeaderboardBtn',
        value: 'EXPORT CSV',
        variant: 'secondary',
        uiTransform: {
          width: compact ? 128 : s(128),
          height: compact ? 30 : s(30),
          alignSelf: 'center',
        },
        fontSize: compact ? 11 : s(11),
        onMouseDown: () => {
          requestLeaderboardCsvExport()
        },
      }),
    ]),
  ])
}

function renderLeaderboardRulesUI() {
  const compact = isMobile()
  const WHITE = Color4.White()
  const GOLD = Color4.create(1, 0.84, 0, 1)
  const MUTED = Color4.create(0.78, 0.8, 0.86, 1)
  const CYAN = Color4.create(0, 0.96, 1, 1)
  const bodyFontSize = compact ? 15 : 18
  const lineHeight = compact ? 24 : 30

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
        width: compact ? '88%' : 620,
        height: compact ? '82%' : 610,
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
        fontSize: compact ? 24 : 30,
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
        fontSize: compact ? 14 : 17,
        color: MUTED,
        textAlign: 'middle-center',
        uiTransform: {
          width: '100%',
          height: compact ? 42 : 30,
          margin: { bottom: compact ? 12 : 18 },
        },
      }),
      h(Label, {
        key: 'soloTitle',
        value: 'SOLO',
        fontSize: compact ? 19 : 22,
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
        fontSize: compact ? 19 : 22,
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
        fontSize: compact ? 17 : 20,
        color: GOLD,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: lineHeight },
      }),
      h(Label, {
        key: 'rankingRule1',
        value: 'The winner ranks first. Survivors rank above eliminated players.',
        fontSize: compact ? 14 : 17,
        color: WHITE,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: compact ? 44 : lineHeight },
      }),
      h(Label, {
        key: 'rankingRule2',
        value: 'Survivors rank by Bonks. Eliminated players rank by survival time.',
        fontSize: compact ? 14 : 17,
        color: WHITE,
        textAlign: 'middle-left',
        uiTransform: { width: '100%', height: compact ? 44 : lineHeight },
      }),
      h(Label, {
        key: 'rankingRule3',
        value: 'Leaving a match counts as elimination.',
        fontSize: compact ? 14 : 17,
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
        fontSize: compact ? 16 : 18,
        uiTransform: {
          width: compact ? 180 : 220,
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
  // Includes Bonk's gap plus Rock's mobile-only left offset, so flex never
  // shrinks either square image button to fit the group.
  const mobileActionGroupWidth = actionButtonSize * 2 + es(14) + es(10)
  
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

  const actionButtons = h(UiEntity, {
    key: 'actionWrap',
    uiTransform: {
      positionType: 'absolute',
      position: mobileActions
        ? { right: es(220) + 30, bottom: es(18) }
        : { left: 0, right: 0, bottom: es(18) },
      width: mobileActions ? mobileActionGroupWidth : '100%',
      height: rockButtonHeight,
      flexDirection: mobileActions ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      justifyContent: mobileActions ? 'flex-end' : 'center',
    },
  }, [
    ...(isMobile() ? [h(UiEntity, {
      key: 'mobileBonkButton',
      uiTransform: {
        width: actionButtonSize,
        height: actionButtonSize,
        margin: { right: es(14) },
      },
      uiBackground: {
        textureMode: 'stretch',
        texture: { src: 'assets/images/Bonk.png' },
      },
      onMouseDown: !isSpectating ? () => {
        triggerPlayerBonkAttack()
      } : undefined,
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
        margin: mobileActions ? { right: es(10) } : undefined,
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
            height: '100%',
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
        onMouseDown: !rockButtonDisabled ? () => {
          triggerTurnToRock()
        } : undefined,
      }),
    ]),
  ])

  // DEBUG: Kill All button (center-top)
  const debugButton = h(UiEntity, {
    key: 'debugButtonWrap',
    uiTransform: {
      positionType: 'absolute',
      position: { left: '50%', top: 92 },
      margin: { left: -400 },
      width: 800,
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
