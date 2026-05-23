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
      key: 'gameOverModal',
      uiTransform: {
        width: 600,
        height: 500,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { top: 40, bottom: 40, left: 40, right: 40 },
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
        onMouseDown: () => {
          console.log('[UI] ========== BUTTON CLICKED ==========')
          uiState.showGameOver = false
          if (onReturnToLobby) {
            onReturnToLobby()
          }
        },
      }),
    ]),
  ])
}
