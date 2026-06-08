/**
 * lobby.ts — Lobby system with start button
 */
import {
  engine, Entity, Transform,
  MeshCollider,
  GltfContainer, ColliderLayer, VisibilityComponent,
  pointerEventsSystem, InputAction,
  TextShape, Billboard, BillboardMode,
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { GameState, setState } from './gameState'
import { startGame } from './index'
import { cleanupGame, resetGameState } from './gameReset'
import { uiState } from './uiManager'
import { hideHud } from './hud'
import { enableFollowCamera, disableFollowCamera } from './cameraRig'

// Lobby position
const LOBBY_X = 48
const LOBBY_Z = 48
const LOBBY_HIDDEN_X = 1000
const LOBBY_HIDDEN_Y = -100
const LOBBY_HIDDEN_Z = 1000
const PLAYER_SPAWN_Y = 1.2

let lobbyRoot: Entity | null = null
let lobbyModelEntity: Entity | null = null
let startButtonEntity: Entity | null = null
let lobbyLabelEntity: Entity | null = null

function setLobbyVisible(visible: boolean): void {
  if (lobbyRoot) {
    const rootTransform = Transform.getMutable(lobbyRoot)
    rootTransform.position = Vector3.create(
      visible ? LOBBY_X : LOBBY_HIDDEN_X,
      visible ? 0 : LOBBY_HIDDEN_Y,
      visible ? LOBBY_Z : LOBBY_HIDDEN_Z
    )
  }

  if (lobbyModelEntity) {
    VisibilityComponent.createOrReplace(lobbyModelEntity, { visible })
  }
  if (startButtonEntity) {
    VisibilityComponent.createOrReplace(startButtonEntity, { visible })
  }
  if (lobbyLabelEntity) {
    VisibilityComponent.createOrReplace(lobbyLabelEntity, { visible })
  }
}

/** Create the lobby area with start button */
export function createLobby(): void {
  console.log('[Lobby] Creating lobby...')

  lobbyRoot = engine.addEntity()
  Transform.create(lobbyRoot, {
    position: Vector3.create(LOBBY_X, 0, LOBBY_Z),
  })

  // Replace the old flat platform with the MoonLobby model.
  lobbyModelEntity = engine.addEntity()
  Transform.create(lobbyModelEntity, {
    parent: lobbyRoot,
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(1, 1, 1),
  })
  GltfContainer.create(lobbyModelEntity, {
    src: 'models/MoonLobby1.glb',
  })
  VisibilityComponent.create(lobbyModelEntity, { visible: true })

  // Start button model
  startButtonEntity = engine.addEntity()
  Transform.create(startButtonEntity, {
    parent: lobbyRoot,
    position: Vector3.create(0, 1.55, 0),
    scale: Vector3.create(1.6, 1.6, 1.6),
  })
  MeshCollider.setBox(startButtonEntity)
  GltfContainer.create(startButtonEntity, {
    src: 'models/roblox_doge_hat.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
  })
  
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
  
  // Floating label
  lobbyLabelEntity = engine.addEntity()
  Transform.create(lobbyLabelEntity, {
    parent: lobbyRoot,
    position: Vector3.create(0, 4.2, 0),
  })
  TextShape.create(lobbyLabelEntity, {
    text: 'DOGE HUNT\nClick to Start',
    fontSize: 5,
    textColor: Color4.create(1, 0.84, 0, 1),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.5,
  })
  Billboard.create(lobbyLabelEntity, { billboardMode: BillboardMode.BM_Y })
  VisibilityComponent.create(lobbyLabelEntity, { visible: true })
  VisibilityComponent.create(startButtonEntity, { visible: true })

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

  // Build gameplay space first, then flip into PLAYING so systems don't see a half-initialized round.
  startGame()
  setState(GameState.PLAYING)
  setLobbyVisible(false)
  movePlayerTo({
    newRelativePosition: { x: 48, y: PLAYER_SPAWN_Y, z: 48 },
  })
  enableFollowCamera()
}

/** Return to lobby */
export function returnToLobby(): void {
  console.log('[Lobby] ========== RETURNING TO LOBBY ==========')
  
  // Clean up game entities
  console.log('[Lobby] Step 1: Cleaning up game entities...')
  cleanupGame()
  
  // Reset game state variables
  console.log('[Lobby] Step 2: Resetting game state...')
  resetGameState()
  
  // Teleport player back to lobby
  console.log('[Lobby] Step 3: Teleporting player to lobby...')
  setLobbyVisible(true)
  disableFollowCamera()
  movePlayerTo({
    newRelativePosition: { x: LOBBY_X, y: PLAYER_SPAWN_Y, z: LOBBY_Z },
  })
  console.log('[Lobby] Player moved back to lobby center')

  // Reset state
  console.log('[Lobby] Step 4: Resetting UI state...')
  setState(GameState.LOBBY)
  uiState.showModeSelection = false
  uiState.showGameOver = false
  hideHud()
  
  console.log('[Lobby] ========== RETURN TO LOBBY COMPLETE ==========')
}
