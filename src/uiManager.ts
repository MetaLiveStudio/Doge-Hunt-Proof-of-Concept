/**
 * uiManager.ts — Unified UI renderer for all game screens
 */
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { killAllNpcs } from './npc'
import { triggerPlayerBonkAttack } from './combat'
import { triggerTurnToRock, getTurnToRockHudState } from './skills'
import {
  addLocalFakePlayer,
  createLocalRoom,
  getLocalRoomSnapshot,
  leaveLocalRoom,
  removeLocalFakePlayer,
  startLocalRoomMatch,
} from './localRoom'
import { startLocalMatch } from './localMatch'
import type { LocalMatchConfig } from './localMatch'

const h = ReactEcs.createElement

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
export let getGameStats: (() => { bonks: number; alive: number; total: number; time: string }) | null = null
export let getHudData: (() => { bonks: number; alive: number; total: number; timeLeft: number; roundOver: boolean }) | null = null

export function setCallbacks(callbacks: {
  onStartLocalMatch?: (matchConfig: LocalMatchConfig) => void
  onReturnToLobby?: () => void
  getGameStats?: () => { bonks: number; alive: number; total: number; time: string }
  getHudData?: () => { bonks: number; alive: number; total: number; timeLeft: number; roundOver: boolean }
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
    
    return null
  }

  ReactEcsRenderer.setUiRenderer(uiComponent)
}

/** Render local room entry UI */
function renderRoomEntryUI() {
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
        value: 'No active room',
        fontSize: 18,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { height: 30, margin: { bottom: 8 } },
      }),
      h(Label, {
        key: 'description',
        value: 'Create a room to start the current match.',
        fontSize: 15,
        color: Color4.create(0.8, 0.8, 0.8, 1),
        uiTransform: { height: 28, margin: { bottom: 24 } },
      }),
      h(Button, {
        key: 'createRoom',
        value: 'CREATE ROOM',
        variant: 'primary',
        uiTransform: { width: 300, height: 60, margin: { bottom: 20 } },
        fontSize: 18,
        onMouseDown: () => {
          console.log('[UI] Create local room clicked')
          createLocalRoom()
          uiState.showRoomEntry = false
          uiState.showWaitingRoom = true
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
          uiState.showRoomEntry = false
        },
      }),
    ]),
  ])
}

/** Render local waiting room UI */
function renderWaitingRoomUI() {
  const room = getLocalRoomSnapshot()
  const playerRows = room.players.map((player, index) => {
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
        value: player.isSimulated ? `${player.displayName} (SIM)` : player.displayName,
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
        value: `Players ${room.playerCount}/${room.maxPlayers}`,
        fontSize: 20,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { height: 32, margin: { bottom: 8 } },
      }),
      h(Label, {
        key: 'host',
        value: `Host: ${room.hostDisplayName || 'None'}`,
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
      h(UiEntity, {
        key: 'fakePlayerControls',
        uiTransform: {
          width: '100%',
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          margin: { bottom: 18 },
        },
      }, [
        h(Button, {
          key: 'addFakePlayer',
          value: 'ADD FAKE',
          variant: 'secondary',
          disabled: !room.canAddFakePlayer,
          uiTransform: { width: 210, height: 44, margin: { right: 12 } },
          fontSize: 15,
          onMouseDown: () => {
            if (!room.canAddFakePlayer) return
            console.log('[UI] Add local fake player clicked')
            addLocalFakePlayer()
          },
        }),
        h(Button, {
          key: 'removeFakePlayer',
          value: 'REMOVE FAKE',
          variant: 'secondary',
          disabled: !room.canRemoveFakePlayer,
          uiTransform: { width: 210, height: 44 },
          fontSize: 15,
          onMouseDown: () => {
            if (!room.canRemoveFakePlayer) return
            console.log('[UI] Remove local fake player clicked')
            removeLocalFakePlayer()
          },
        }),
      ]),
      h(Button, {
        key: 'start',
        value: 'START',
        variant: 'primary',
        disabled: !room.canHostStart,
        uiTransform: { width: 300, height: 58, margin: { bottom: 14 } },
        fontSize: 18,
        onMouseDown: () => {
          if (!room.canHostStart) return
          console.log('[UI] Start local room match clicked')
          const activeRoom = startLocalRoomMatch()
          const matchConfig = startLocalMatch(activeRoom)
          uiState.showWaitingRoom = false
          if (onStartLocalMatch) onStartLocalMatch(matchConfig)
        },
      }),
      h(Button, {
        key: 'leave',
        value: 'LEAVE',
        variant: 'secondary',
        uiTransform: { width: 220, height: 50 },
        fontSize: 16,
        onMouseDown: () => {
          console.log('[UI] Leave local room clicked')
          leaveLocalRoom()
          uiState.showWaitingRoom = false
        },
      }),
    ]),
  ])
}

/** Render game over UI */
function renderGameOverUI() {
  const stats = getGameStats ? getGameStats() : { bonks: 0, alive: 0, total: 12, time: '0:00' }
  const isWin = stats.alive === 0
  const titleText = isWin ? 'Round Complete' : 'GAME OVER'
  const subtitleText = isWin ? 'You Win' : 'You Lose'
  const titleColor = isWin ? Color4.create(0.22, 1, 0.08, 1) : Color4.create(1, 0.2, 0.2, 1)
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
      uiBackground: { color: Color4.create(0, 0, 0, 0.7) },
    }),
    h(UiEntity, {
      key: 'gameOverModal',
      uiTransform: {
        width: 600,
        height: 500,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { top: 40, bottom: 40, left: 40, right: 40 },
        zIndex: 1,
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: titleText,
        fontSize: 48,
        color: titleColor,
        uiTransform: { margin: { bottom: 20 } },
      }),
      h(Label, {
        key: 'subtitle',
        value: subtitleText,
        fontSize: 24,
        color: Color4.create(1, 0.84, 0, 1),
        uiTransform: { margin: { bottom: 30 } },
      }),
      h(Label, {
        key: 'bonks',
        value: `Total Bonks: ${stats.bonks}`,
        fontSize: 26,
        color: Color4.create(0, 0.96, 1, 1),
        uiTransform: { margin: { bottom: 15 } },
      }),
      h(Label, {
        key: 'survived',
        value: `Doges Remaining: ${stats.alive}/${stats.total}`,
        fontSize: 26,
        color: Color4.create(0.22, 1, 0.08, 1),
        uiTransform: { margin: { bottom: 15 } },
      }),
      h(Label, {
        key: 'time',
        value: `Time: ${stats.time}`,
        fontSize: 26,
        color: Color4.create(1, 0.84, 0, 1),
        uiTransform: { margin: { bottom: 30 } },
      }),
      h(UiEntity, {
        key: 'returnBtn',
        uiTransform: {
          width: 350,
          height: 70,
          margin: { top: 10 },
          alignItems: 'center',
          justifyContent: 'center',
        },
        uiBackground: { color: Color4.create(1, 0.2, 0.45, 1) },
        uiText: {
          value: 'RETURN TO LOBBY',
          fontSize: 22,
          color: Color4.create(1, 1, 1, 1),
          textAlign: 'middle-center',
        },
        onMouseDown: handleReturnToLobby,
      }),
    ]),
  ])
}

/** Render HUD (in-game stats and instructions) */
function renderHUD() {
  const data = getHudData ? getHudData() : { bonks: 0, alive: 0, total: 12, timeLeft: 180, roundOver: false }
  
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
  const rockHudState = getTurnToRockHudState()
  const rockIsReady = rockHudState.statusLabel === 'Ready'
  const rockIsActive = rockHudState.statusLabel.startsWith('Active:')
  const rockButtonBg = rockIsReady
    ? Color4.create(0.14, 0.14, 0.2, 0.95)
    : rockIsActive
      ? Color4.create(0.08, 0.28, 0.12, 0.95)
      : Color4.create(0.28, 0.18, 0.08, 0.95)
  const rockStatusColor = rockIsReady ? GREEN : rockIsActive ? GREEN : GOLD
  
  const panel = h(UiEntity, {
    key: 'hudPanel',
    uiTransform: {
      width: s(320),
      height: s(320),
      positionType: 'absolute',
      position: { left: s(42), top: '50%' },
      margin: { top: -s(160) },
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
      uiTransform: { height: s(20), margin: { bottom: s(10) } },
    }),
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
      value: 'BONK',
      variant: 'primary',
      fontSize: es(16),
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
      onMouseDown: rockHudState.enabled ? () => {
        triggerTurnToRock()
      } : undefined,
    }, [
      h(Label, {
        key: 'rockButtonTitle',
        value: rockHudState.enabled
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
        value: rockHudState.enabled
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
      position: { left: '50%', top: 20 },
      margin: { left: -90 },  // Half of button width
    },
  }, [
    h(Button, {
      key: 'killAllBtn',
      value: 'KILL ALL (DEBUG)',
      variant: 'secondary',
      uiTransform: { width: 180, height: 50 },
      fontSize: 14,
      onMouseDown: () => {
        console.log('[DEBUG] Kill All button clicked')
        killAllNpcs()
      },
    }),
  ])

  const children = [panel]
  children.push(actionButtons)
  children.push(debugButton)

  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
    },
  }, children)
}
