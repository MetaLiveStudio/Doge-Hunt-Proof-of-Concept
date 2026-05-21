/**
 * lobby.ts — Lobby system with start button
 */
import {
  engine, Entity, Transform,
  MeshRenderer, MeshCollider, Material,
  pointerEventsSystem, InputAction,
  TextShape, Billboard, BillboardMode,
} from '@dcl/sdk/ecs'
import { Vector3, Color3, Color4 } from '@dcl/sdk/math'
import { GameState, setState } from './gameState'
import { startGame } from './index'
import { cleanupGame, resetGameState } from './gameReset'
import { uiState } from './uiManager'
import { hideHud } from './hud'

// Lobby position
const LOBBY_X = 8
const LOBBY_Z = 8

let startButtonEntity: Entity | null = null

/** Create the lobby area with start button */
export function createLobby(): void {
  console.log('[Lobby] Creating lobby...')
  
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
  Transform.create(startButtonEntity, { position: Vector3.create(LOBBY_X, 1.5, LOBBY_Z) })
  MeshRenderer.setBox(startButtonEntity)
  MeshCollider.setBox(startButtonEntity)
  
  console.log('[Lobby] Start button entity created:', startButtonEntity)

  // Register click handler
  pointerEventsSystem.onPointerDown(
    {
      entity: startButtonEntity,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText: 'START GAME',
        maxDistance: 10
      }
    },
    (event) => {
      console.log('[Lobby] ✅ BUTTON CLICKED!', event)
      uiState.showModeSelection = true
      console.log('[Lobby] showModeSelection set to:', uiState.showModeSelection)
    }
  )
  
  console.log('[Lobby] Click handler registered')
  
  // Add material
  Material.setPbrMaterial(startButtonEntity, {
    albedoColor: Color4.create(0, 0.96, 1, 1),
    emissiveColor: Color3.create(0, 0.96, 1),
    emissiveIntensity: 5,
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
}

/** Start single player game (called from UI) */
export function startSinglePlayer(): void {
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
  uiState.showModeSelection = false
  uiState.showGameOver = false
  hideHud()
}
