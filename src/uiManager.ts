/**
 * uiManager.ts — Unified UI renderer for all game screens
 */
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

const h = ReactEcs.createElement

// UI state
export const uiState = {
  showModeSelection: false,
  showGameOver: false,
  showHud: false,
}

// Callbacks (set by other modules)
export let onStartSinglePlayer: (() => void) | null = null
export let onReturnToLobby: (() => void) | null = null
export let getGameStats: (() => { bonks: number; alive: number; total: number; time: string }) | null = null
export let getHudData: (() => { bonks: number; alive: number; total: number; timeLeft: number; roundOver: boolean }) | null = null

export function setCallbacks(callbacks: {
  onStartSinglePlayer?: () => void
  onReturnToLobby?: () => void
  getGameStats?: () => { bonks: number; alive: number; total: number; time: string }
  getHudData?: () => { bonks: number; alive: number; total: number; timeLeft: number; roundOver: boolean }
}) {
  if (callbacks.onStartSinglePlayer) onStartSinglePlayer = callbacks.onStartSinglePlayer
  if (callbacks.onReturnToLobby) onReturnToLobby = callbacks.onReturnToLobby
  if (callbacks.getGameStats) getGameStats = callbacks.getGameStats
  if (callbacks.getHudData) getHudData = callbacks.getHudData
}

/** Initialize the unified UI renderer */
export function setupUI(): void {
  console.log('[UI] Setting up unified UI renderer...')
  
  const uiComponent = () => {
    // Priority: Game Over > Mode Selection > HUD
    if (uiState.showGameOver) {
      return renderGameOverUI()
    }
    
    if (uiState.showModeSelection) {
      return renderModeSelectionUI()
    }
    
    if (uiState.showHud) {
      return renderHUD()
    }
    
    return null
  }

  ReactEcsRenderer.setUiRenderer(uiComponent)
}

/** Render mode selection UI */
function renderModeSelectionUI() {
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
        width: 500,
        height: 350,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { top: 30, bottom: 30, left: 40, right: 40 },
      },
      uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
    }, [
      h(Label, {
        key: 'title',
        value: 'SELECT GAME MODE',
        fontSize: 24,
        color: Color4.create(1, 0.84, 0, 1),
        uiTransform: { height: 40, margin: { bottom: 30 } },
      }),
      h(Button, {
        key: 'singleplayer',
        value: 'SINGLE PLAYER',
        variant: 'primary',
        uiTransform: { width: 300, height: 60, margin: { bottom: 20 } },
        fontSize: 18,
        onMouseDown: () => {
          console.log('[UI] Single player clicked')
          uiState.showModeSelection = false
          if (onStartSinglePlayer) onStartSinglePlayer()
        },
      }),
      h(Button, {
        key: 'multiplayer',
        value: 'MULTIPLAYER (Coming Soon)',
        variant: 'secondary',
        disabled: true,
        uiTransform: { width: 300, height: 60, margin: { bottom: 20 } },
        fontSize: 18,
      }),
      h(Button, {
        key: 'cancel',
        value: 'CANCEL',
        variant: 'secondary',
        uiTransform: { width: 200, height: 50 },
        fontSize: 16,
        onMouseDown: () => {
          console.log('[UI] Cancel clicked')
          uiState.showModeSelection = false
        },
      }),
    ]),
  ])
}

/** Render game over UI */
function renderGameOverUI() {
  const stats = getGameStats ? getGameStats() : { bonks: 0, alive: 0, total: 12, time: '0:00' }
  
  const modal = h(UiEntity, {
    key: 'gameOverModal',
    uiTransform: {
      width: 600,
      height: 500,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.95) },
  }, [
    h(Label, {
      key: 'title',
      value: 'GAME OVER',
      fontSize: 48,
      color: Color4.create(1, 0.2, 0.2, 1),
      uiTransform: { margin: { bottom: 20 } },
    }),
    h(Label, {
      key: 'subtitle',
      value: 'Round Complete',
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
    h(Button, {
      key: 'returnBtn',
      value: 'RETURN TO LOBBY',
      variant: 'primary',
      uiTransform: { width: 350, height: 70, margin: { top: 10 } },
      fontSize: 22,
      disabled: false,  // Explicitly enable
      onMouseDown: () => {
        console.log('[UI] ========== BUTTON CLICKED ==========')
        console.log('[UI] onReturnToLobby exists?', !!onReturnToLobby)
        uiState.showGameOver = false
        if (onReturnToLobby) {
          console.log('[UI] Calling onReturnToLobby...')
          onReturnToLobby()
        } else {
          console.log('[UI] ERROR: onReturnToLobby is null!')
        }
      },
    }),
  ])
  
  // Wrap in fullscreen container (like Mode Selection does)
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
    uiBackground: { color: Color4.create(0, 0, 0, 0.85) },  // Semi-transparent black background
  }, [modal])
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
  
  const panel = h(UiEntity, {
    uiTransform: {
      width: s(320),
      height: s(320),
      positionType: 'absolute',
      position: { right: s(16), bottom: s(16) },
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

  const eKeyHint = h(UiEntity, {
    key: 'eKeyHintWrap',
    uiTransform: {
      positionType: 'absolute',
      position: { left: 0, right: 0, bottom: es(18) },
      height: es(84),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'eKeyHintPill',
      uiTransform: {
        height: es(76),
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: es(12), right: es(14), top: es(10), bottom: es(10) },
      },
      uiBackground: { color: BG },
    }, [
      h(UiEntity, {
        key: 'eKeyBox',
        uiTransform: {
          width: es(40),
          height: es(40),
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          margin: { right: es(12) },
        },
        uiBackground: { color: BUTTON_BG },
      }, [
        h(Label, {
          key: 'eKeyText',
          value: 'E',
          fontSize: es(18),
          color: CYAN,
          uiTransform: { height: es(22) },
        }),
      ]),
      h(UiEntity, {
        key: 'eKeyCopy',
        uiTransform: { flexDirection: 'column' },
      }, [
        h(Label, {
          key: 'eKeyTitle',
          value: 'Rock Solid — More skills will be released.',
          fontSize: es(12),
          color: CYAN,
          uiTransform: { height: es(18), margin: { bottom: es(3) } },
        }),
        h(Label, {
          key: 'eKeyDesc',
          value: 'Press E near a pillar to hide as a pillar (5s / 15s).',
          fontSize: es(10),
          color: WHITE,
          uiTransform: { height: es(16) },
        }),
      ]),
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
        const { killAllNpcs } = require('./npc')
        killAllNpcs()
      },
    }),
  ])

  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
    },
  }, [panel, eKeyHint, debugButton])
}
