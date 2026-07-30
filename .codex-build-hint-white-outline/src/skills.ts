/**
 * skills.ts — Player skills
 * "Rock Solid": Press E or tap the HUD button to transform into a rock.
 * Lasts 5 seconds, 15 second cooldown.
 */
import {
  engine, Entity, Transform, InputAction,
  PointerEventType, inputSystem,
  GltfContainer,
  TextShape, Billboard, BillboardMode,
  VisibilityComponent,
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { setSkillMovementLocked } from './player'
import {
  recordLocalTurnToRockActivated,
  recordLocalTurnToRockCooldown,
  recordLocalTurnToRockEnded,
} from './localMatchState'
import { requestTurnToRock, setGameplayResolvers } from './gameResolvers'
import type { TurnToRockRequest, TurnToRockResult } from './gameResolvers'
import {
  canLocalServerPlayerAct,
  getLocalServerPlayerStatus,
} from './client/serverPublicStateClient'

const CX = 48
const CZ = 48

// Skill state
let isDisguised = false
let disguiseTimer = 0
let cooldownTimer = 0
const DISGUISE_DURATION = 5
const COOLDOWN_DURATION = 15
const SKILL_STATUS_Y = 4.2
const ROCK_VISUAL_Y_OFFSET = -0.3

// References set during init
let dogeBodyEntity: Entity | undefined
let pillarDisguiseEntity: Entity | undefined
let skillStatusEntity: Entity | undefined
let disguiseReturnPosition: Vector3 | null = null
let nextCooldownDuration = COOLDOWN_DURATION

const LOCAL_PLAYER_ID = 'local-player'

export type TurnToRockHudState = {
  buttonLabel: string
  statusLabel: string
  enabled: boolean
}

export function setupSkills(dogeBody: number): void {
  dogeBodyEntity = dogeBody as Entity

  // Create hidden rock disguise entity (invisible by default)
  pillarDisguiseEntity = engine.addEntity()
  Transform.create(pillarDisguiseEntity, {
    position: Vector3.create(0, -10, 0), // hidden below ground
    scale: Vector3.create(1, 1, 1),
  })
  GltfContainer.create(pillarDisguiseEntity, {
    src: 'models/Moonstone.glb',
  })
  VisibilityComponent.create(pillarDisguiseEntity, { visible: false })

  skillStatusEntity = engine.addEntity()
  Transform.create(skillStatusEntity, {
    position: Vector3.create(CX, 0.5, CZ + 20),
  })
  TextShape.create(skillStatusEntity, {
    text: '',
    fontSize: 2,
    textColor: Color4.create(0, 0.96, 1, 0.8),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.1,
  })
  Billboard.create(skillStatusEntity, { billboardMode: BillboardMode.BM_Y })
}

export function skillSystem(dt: number): void {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return
  const playerPos = playerTransform.position

  if (skillStatusEntity) {
    if (!Transform.getOrNull(skillStatusEntity)) {
      skillStatusEntity = undefined
      return
    }
    const statusTransform = Transform.getMutable(skillStatusEntity)
    statusTransform.position = Vector3.create(playerPos.x, SKILL_STATUS_Y, playerPos.z)

    const statusText = TextShape.getMutable(skillStatusEntity)
    if (isDisguised) {
      const timeLeft = Math.ceil(disguiseTimer)
      statusText.text = `HIDING... ${timeLeft}s`
      statusText.textColor = Color4.create(0.22, 1, 0.08, 0.9)
    } else {
      statusText.text = ''
    }
  }

  // Handle disguise timer
  if (isDisguised) {
    syncLocalDisguiseVisual(playerTransform)
    disguiseTimer -= dt
    if (disguiseTimer <= 0) {
      endDisguise()
    }
    return
  }

  // Handle cooldown
  if (cooldownTimer > 0) {
    cooldownTimer -= dt
    recordLocalTurnToRockCooldown(LOCAL_PLAYER_ID, Math.max(0, cooldownTimer))
    return
  }

  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
    triggerTurnToRock()
  }
}

export function triggerTurnToRock(): boolean {
  if (!canLocalServerPlayerAct()) {
    console.log(`[Client][T] turnToRock input blocked localStatus=${getLocalServerPlayerStatus()}`)
    return false
  }

  const result = requestTurnToRock({ playerId: LOCAL_PLAYER_ID })
  return applyTurnToRockResult(result)
}

function resolveLocalTurnToRock(request: TurnToRockRequest): TurnToRockResult {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) {
    return {
      outcome: 'rejected',
      reason: 'missing-player-transform',
      request,
    }
  }

  if (isDisguised) {
    return {
      outcome: 'rejected',
      reason: 'already-active',
      request,
    }
  }

  if (cooldownTimer > 0) {
    return {
      outcome: 'rejected',
      reason: 'cooldown',
      request,
    }
  }

  return {
    outcome: 'activated',
    request,
    position: playerTransform.position,
    yawDegrees: getYawFromRotation(playerTransform.rotation),
    durationSeconds: DISGUISE_DURATION,
    cooldownSeconds: COOLDOWN_DURATION,
  }
}

setGameplayResolvers({ resolveTurnToRock: resolveLocalTurnToRock })

function applyTurnToRockResult(result: TurnToRockResult): boolean {
  if (result.outcome === 'pending') return true
  if (result.outcome === 'rejected') return false

  recordLocalTurnToRockActivated(result.request.playerId)
  startDisguise(result.position, result.yawDegrees, result.durationSeconds, result.cooldownSeconds)
  return true
}

export function applyServerTurnToRockActivated(input: {
  playerId: string
  position: Vector3
  yawDegrees: number
  durationSeconds: number
  cooldownSeconds: number
}): boolean {
  if (isDisguised || cooldownTimer > 0) {
    console.log(`[Client][S] turnToRockResult activated but local skill is busy playerId=${input.playerId}`)
    return false
  }

  recordLocalTurnToRockActivated(input.playerId)
  startDisguise(input.position, input.yawDegrees, input.durationSeconds, input.cooldownSeconds)
  return true
}

function startDisguise(
  pos: Vector3,
  rot: number,
  durationSeconds = DISGUISE_DURATION,
  cooldownSeconds = COOLDOWN_DURATION
): void {
  isDisguised = true
  disguiseTimer = durationSeconds
  nextCooldownDuration = cooldownSeconds
  disguiseReturnPosition = Vector3.create(pos.x, pos.y, pos.z)
  setSkillMovementLocked(true)

  // Hide doge body
  if (dogeBodyEntity && Transform.getOrNull(dogeBodyEntity)) {
    const dogeTransform = Transform.getMutable(dogeBodyEntity)
    dogeTransform.position = Vector3.create(0, -10, 0)
    dogeTransform.scale = Vector3.create(0, 0, 0)
  }

  // Show slab at player position, rotated to match the cover they are hiding near
  if (pillarDisguiseEntity && Transform.getOrNull(pillarDisguiseEntity)) {
    const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
    pillarTransform.position = Vector3.create(pos.x, pos.y + ROCK_VISUAL_Y_OFFSET, pos.z)
    pillarTransform.rotation = Quaternion.fromEulerDegrees(0, rot, 0)
    pillarTransform.scale = Vector3.create(1, 1, 1)
    VisibilityComponent.createOrReplace(pillarDisguiseEntity, { visible: true })
  }

  console.log(`[Client][S] local rock visual shown x=${pos.x.toFixed(2)} y=${pos.y.toFixed(2)} z=${pos.z.toFixed(2)}`)
}

function getYawFromRotation(rotation: Quaternion): number {
  const forward = Vector3.rotate(Vector3.Forward(), rotation)
  return Math.atan2(forward.x, forward.z) * (180 / Math.PI)
}

function endDisguise(): void {
  const returnPosition = disguiseReturnPosition
  isDisguised = false
  cooldownTimer = nextCooldownDuration
  recordLocalTurnToRockEnded(LOCAL_PLAYER_ID, nextCooldownDuration)

  // Hide pillar
  if (pillarDisguiseEntity && Transform.getOrNull(pillarDisguiseEntity)) {
    const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
    pillarTransform.position = Vector3.create(0, -10, 0)
    VisibilityComponent.createOrReplace(pillarDisguiseEntity, { visible: false })
  }

  // Restore doge body (will be updated by follow system next frame)
  if (dogeBodyEntity && Transform.getOrNull(dogeBodyEntity)) {
    const dogeTransform = Transform.getMutable(dogeBodyEntity)
    if (returnPosition) {
      dogeTransform.position = Vector3.create(returnPosition.x, returnPosition.y, returnPosition.z)
    }
    dogeTransform.scale = Vector3.create(1.5, 1.5, 1.5)
  }

  if (returnPosition) {
    movePlayerTo({
      newRelativePosition: {
        x: returnPosition.x,
        y: returnPosition.y,
        z: returnPosition.z,
      },
    })
  }

  disguiseReturnPosition = null
  setSkillMovementLocked(false)
}

function syncLocalDisguiseVisual(playerTransform: { position: Vector3 }): void {
  if (!pillarDisguiseEntity || !Transform.getOrNull(pillarDisguiseEntity)) return

  const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
  const sourcePosition = disguiseReturnPosition ?? playerTransform.position
  pillarTransform.position = Vector3.create(
    sourcePosition.x,
    sourcePosition.y + ROCK_VISUAL_Y_OFFSET,
    sourcePosition.z
  )
  pillarTransform.scale = Vector3.create(1, 1, 1)
  VisibilityComponent.createOrReplace(pillarDisguiseEntity, { visible: true })
}

/** Check if player is currently disguised (used by player follow system) */
export function isPlayerDisguised(): boolean {
  return isDisguised
}

export function getTurnToRockHudState(): TurnToRockHudState {
  if (isDisguised) {
    const secondsLeft = Math.max(0, Math.ceil(disguiseTimer))
    return {
      buttonLabel: `Hiding ${secondsLeft}s`,
      statusLabel: `Active: ${secondsLeft}s remaining`,
      enabled: false,
    }
  }

  if (cooldownTimer > 0) {
    const secondsLeft = Math.max(0, Math.ceil(cooldownTimer))
    return {
      buttonLabel: `Rock CD ${secondsLeft}s`,
      statusLabel: `Cooldown: ${secondsLeft}s`,
      enabled: false,
    }
  }

  return {
    buttonLabel: 'Turn to Rock',
    statusLabel: 'Ready',
    enabled: true,
  }
}

/** Clean up skill entities and reset skill state */
export function cleanupSkills(): void {
  setSkillMovementLocked(false)

  if (pillarDisguiseEntity) {
    VisibilityComponent.createOrReplace(pillarDisguiseEntity, { visible: false })
    engine.removeEntity(pillarDisguiseEntity)
    pillarDisguiseEntity = undefined
  }

  if (skillStatusEntity) {
    engine.removeEntity(skillStatusEntity)
    skillStatusEntity = undefined
  }

  dogeBodyEntity = undefined
  isDisguised = false
  disguiseTimer = 0
  cooldownTimer = 0
  nextCooldownDuration = COOLDOWN_DURATION
  disguiseReturnPosition = null
}
