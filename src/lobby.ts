/**
 * lobby.ts — Lobby system with start button and mode selection UI
 */
import {
  engine, Entity, Transform,
  MeshRenderer, MeshCollider, Material,
  PointerEvents, PointerEventType, InputAction,
  PointerEventsResult,
  TextShape, Billboard, BillboardMode,
} from '@dcl/sdk/ecs'
import { Vector3, Color3, Color4 } from '@dcl/sdk/math'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { GameState, setState } from './gameState'
import { startGame } from './index'
import { cleanupGame, resetGameState } from './gameReset'

const h = ReactEcs.createElement

// Lobby position
const LOBBY_X = 8
const LOBBY_Z = 8

let startButtonEntity: Entity | null = null
let showModeSelection = false

/** Create the lobby area with start button */
export function createLobby(): void {
  // Floor platform
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(LOBBY_X, 0, LOBBY_Z),
    scale: Vector3.create(8, 0.2, 8),
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform)
  Material.setPbrMaterial(platform, {
    albedoColor: Color4.create(0.1, 0.1, 0.15, 1),
    metallic: 0.3,
    roughness: 0.7,
  })

  // Glowing start button (cube)
  startButtonEntity = engine.addEntity()
  Transform.create(startButtonEntity, {
    position: Vector3.create(LOBBY_X, 1.5, LOBBY_Z),
    scale: Vector3.create(1.2, 1.2, 1.2),
  })
  MeshRenderer.setBox(startButtonEntity)
  MeshCollider.setBox(startButtonEntity)
  Material.setPbrMaterial(startButtonEntity, {
    albedoColor: Color4.create(0, 0.96, 1, 1),
    emissiveColor: Color3.create(0, 0.96, 1),
    emissiveIntensity: 5,
    metallic: 0,
    roughness: 0.2,
  })

  // Make button clickable
  PointerEvents.create(startButtonEntity, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: 'START GAME',
          maxDistance: 10,
          showFeedback: true,
        },
      },
    ],
  })

  // Floating label
  const label = engine.addEntity()
  Transform.create(label, {
    position: Vector3.create(LOBBY_X, 3, LOBBY_Z),
  })
  TextShape.create(label, {
    text: 'DOGE HUNT\nClick to Start',
    fontSize: 4,
    textColor: Color4.create(1, 0.84, 0, 1),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.2,
  })
  Billboard.create(label, { billboardMode: BillboardMode.BM_Y })

  // Rotating animation system
  engine.addSystem((dt: number) => {
    if (startButtonEntity) {
      const transform = Transform.getMutable(startButtonEntity)
      const currentRotation = transform.rotation
      const angle = Math.atan2(2 * (currentRotation.w * currentRotation.y), 1 - 2 * currentRotation.y * currentRotation.y)
      const newAngle = angle + dt * 0.5
      transform.rotation = {
        x: 0,
        y: Math.sin(newAngle / 2),
        z: 0,
        w: Math.cos(newAngle / 2),
      }
    }
  })

  // Setup UI
  setupLobbyUI()
}

/** Check for button clicks */
export function lobbySystem(): void {
  if (!startButtonEntity) return

  // Check if button was clicked using PointerEventsResult
  const result = PointerEventsResult.getOrNull(startButtonEntity)
  if (result && result.hit) {
    console.log('[Lobby] Start button clicked!')
    showModeSelection = true
    // Remove the result component so it doesn't trigger again
    PointerEventsResult.deleteFrom(startButtonEntity)
  }
}

/** Mode selection UI */
function setupLobbyUI(): void {
  const uiComponent = () => {
    if (!showModeSelection) return null

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
            showModeSelection = false
            startSinglePlayer()
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
            showModeSelection = false
          },
        }),
      ]),
    ])
  }

  ReactEcsRenderer.setUiRenderer(uiComponent)
}

/** Start single player game */
function startSinglePlayer(): void {
  console.log('[Lobby] Starting single player game...')
  
  // Teleport player to arena
  const playerTransform = Transform.getMutable(engine.PlayerEntity)
  playerTransform.position = Vector3.create(24, 0, 24)

  // Change state and start game
  setState(GameState.PLAYING)
  startGame()
}

/** Return to lobby */
export function returnToLobby(): void {
  console.log('[Lobby] Returning to lobby...')
  
  // Clean up game entities
  cleanupGame()
  
  // Reset game state variables
  resetGameState()
  
  // Teleport player back to lobby
  const playerTransform = Transform.getMutable(engine.PlayerEntity)
  playerTransform.position = Vector3.create(LOBBY_X, 0, LOBBY_Z)

  // Reset state
  setState(GameState.LOBBY)
  showModeSelection = false
}
