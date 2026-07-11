/**
 * player.ts — Player disguise system
 * Hides the real player avatar, replaces with Muscledoge model (includes bat).
 */
import {
  engine, Transform, Entity,
  AvatarLocomotionSettings,
  AvatarModifierArea, AvatarModifierType,
  GltfContainer, Animator, InputModifier,
  InputAction, PointerEventType, inputSystem,
} from '@dcl/sdk/ecs'
import { getPlatform } from '@dcl/sdk/platform'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isPlayerDisguised } from './skills'

const CX = 48
const CZ = 48
const ARENA_SIZE = 92
const AVATAR_HIDE_REFRESH_X = 1000
const AVATAR_HIDE_REFRESH_Y = -100
const AVATAR_HIDE_REFRESH_Z = 1000
const AVATAR_HIDE_RELEASE_DELAY_SECONDS = 0.75

// Exported so skills.ts can reference it
export let dogeBodyEntity: number = 0
let modifierEntity: Entity | null = null
let followSystemInitialized = false
let modifierCleanupSystemInitialized = false
let modifierReleaseTimer = 0
let attackAnimationSystemInitialized = false
let attackAnimationTimer = 0
let attackMovementLockTimer = 0
let attackMovementLocked = false
let skillMovementLocked = false
let jumpSystemInitialized = false
let jumpElapsed = 0
let jumpActive = false
let currentPlayerAnimation: string | null = null
let lastPlayerPosition: Vector3 | null = null
let mobilePlanarSpeed = 0
let spectatorVisualHidden = false
const PLAYER_ATTACK_CLIP = 'Bonk'
const PLAYER_IDLE_CLIP = 'idel'
const PLAYER_JUMP_CLIP = 'jump'
const PLAYER_WALK_CLIP = 'walk'
const PLAYER_RUN_CLIP = 'run'
const PLAYER_DOGE_MODEL = 'models/Muscledoge.glb'
const PLAYER_DEAD_DOGE_MODEL = 'models/SmallDoge.glb'
const PLAYER_DOGE_SCALE = Vector3.create(1.5, 1.5, 1.5)
const PLAYER_DEAD_DOGE_SCALE = Vector3.create(0.5, 0.5, 0.5)
const PLAYER_ELIMINATION_SQUASH_DURATION = 0.25
const PLAYER_ELIMINATION_SMALL_DOGE_SECONDS = 0.55
const PLAYER_ELIMINATION_MIN_HEIGHT_SCALE = 0.2
const PLAYER_ELIMINATION_FLATTEN_SCALE = 1.35
export const PLAYER_ATTACK_ANIMATION_SPEED = 2.25
export const PLAYER_ATTACK_IMPACT_TIME = 0.18
export const PLAYER_ATTACK_TOTAL_DURATION = 1.02
const PLAYER_ATTACK_MOVE_LOCK_DURATION = 0.75
const PLAYER_JUMP_DURATION = 1.433
const PLAYER_JUMP_HEIGHT = 1.15
const PLAYER_TURN_SPEED_DEGREES = 240
const PLAYER_JUMP_ANIMATION_SPEED = 1
const PLAYER_WALK_ANIMATION_SPEED = 1
const PLAYER_RUN_ANIMATION_SPEED = 1.15
export const PLAYER_WALK_SPEED = 6
export const PLAYER_JOG_SPEED = 6
export const PLAYER_RUN_SPEED = 10
const PLAYER_MOBILE_IDLE_SPEED_THRESHOLD = 0.15
const PLAYER_MOBILE_RUN_SPEED_THRESHOLD = 8
const PLAYER_MOBILE_SPEED_SMOOTHING = 12

type SpectatorEliminationVisualState = 'none' | 'squash' | 'small' | 'hidden'
let spectatorEliminationVisualState: SpectatorEliminationVisualState = 'none'
let spectatorEliminationTimer = 0
let spectatorEliminationSmallTimer = 0

function applyGameplayInputRestrictions(): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableAll: skillMovementLocked,
      disableDoubleJump: true,
      disableGliding: true,
    }),
  })
}

function applyPlayerLocomotionSettings(lockMovement: boolean): void {
  AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
    walkSpeed: lockMovement ? 0 : PLAYER_WALK_SPEED,
    jogSpeed: lockMovement ? 0 : PLAYER_JOG_SPEED,
    runSpeed: lockMovement ? 0 : PLAYER_RUN_SPEED,
  })
}

function syncPlayerMovementRestrictions(): void {
  applyGameplayInputRestrictions()
  applyPlayerLocomotionSettings(attackMovementLocked || skillMovementLocked)
}

function setAttackMovementLocked(locked: boolean): void {
  if (attackMovementLocked === locked && AvatarLocomotionSettings.has(engine.PlayerEntity)) return
  attackMovementLocked = locked
  syncPlayerMovementRestrictions()
}

export function setSkillMovementLocked(locked: boolean): void {
  if (
    skillMovementLocked === locked &&
    AvatarLocomotionSettings.has(engine.PlayerEntity) &&
    InputModifier.has(engine.PlayerEntity)
  ) return

  skillMovementLocked = locked
  syncPlayerMovementRestrictions()
}

/** Set up the player's Doge disguise */
export function setupPlayerDisguise(): void {
  forceRemoveAvatarHideModifierArea('setup')
  setAttackMovementLocked(false)
  setSkillMovementLocked(false)
  spectatorVisualHidden = false
  spectatorEliminationVisualState = 'none'
  spectatorEliminationTimer = 0
  spectatorEliminationSmallTimer = 0
  lastPlayerPosition = null
  mobilePlanarSpeed = 0
  syncPlayerMovementRestrictions()

  // 1. AvatarModifierArea — hides real player avatar in the arena only
  modifierEntity = engine.addEntity()
  Transform.create(modifierEntity, {
    position: Vector3.create(CX, 2, CZ),
  })
  AvatarModifierArea.create(modifierEntity, {
    area: Vector3.create(ARENA_SIZE, 8, ARENA_SIZE), // Only arena area, not lobby
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
    excludeIds: [],
  })
  modifierReleaseTimer = 0
  ensureModifierCleanupSystem()

  // 2. Doge body (with bat) — Muscledoge.glb follows the player
  const dogeBody = engine.addEntity()
  dogeBodyEntity = dogeBody as number
  Transform.create(dogeBody, {
    position: Vector3.create(CX, 0, CZ),
    scale: PLAYER_DOGE_SCALE,
  })
  GltfContainer.create(dogeBody, { src: PLAYER_DOGE_MODEL })
  Animator.create(dogeBody, {
    states: [
      {
        clip: PLAYER_IDLE_CLIP,
        playing: true,
        loop: true,
        speed: 1,
        weight: 1.0,
      },
      {
        clip: PLAYER_ATTACK_CLIP,
        playing: false,
        loop: false,
        speed: PLAYER_ATTACK_ANIMATION_SPEED,
        weight: 1.0,
      },
      {
        clip: PLAYER_JUMP_CLIP,
        playing: false,
        loop: false,
        speed: PLAYER_JUMP_ANIMATION_SPEED,
        weight: 1.0,
      },
      {
        clip: PLAYER_WALK_CLIP,
        playing: false,
        loop: true,
        speed: PLAYER_WALK_ANIMATION_SPEED,
        weight: 1.0,
      },
      {
        clip: PLAYER_RUN_CLIP,
        playing: false,
        loop: true,
        speed: PLAYER_RUN_ANIMATION_SPEED,
        weight: 1.0,
      },
    ],
  })
  currentPlayerAnimation = PLAYER_IDLE_CLIP

  // 3. System — make the Doge body follow the player each frame
  if (!followSystemInitialized) {
    followSystemInitialized = true
    engine.addSystem((dt) => {
      if (!dogeBodyEntity) return

      // Don't follow when disguised as pillar
      if (isPlayerDisguised()) return
      if (spectatorVisualHidden) {
        updateSpectatorEliminationVisual(dt)
        return
      }

      const playerTransform = Transform.getOrNull(engine.PlayerEntity)
      if (!playerTransform) return

      const dogeTransform = Transform.getOrNull(dogeBodyEntity as Entity)
      if (!dogeTransform) return

      const mutableTransform = Transform.getMutable(dogeBodyEntity as Entity)
      updatePlayerPlanarSpeed(playerTransform.position, dt)
      // Follow the real player's height so the Doge visual stays glued to curved terrain.
      mutableTransform.position = Vector3.create(
        playerTransform.position.x,
        playerTransform.position.y,
        playerTransform.position.z
      )

      const currentYaw = getYawFromRotation(mutableTransform.rotation)
      const targetYaw = getYawFromRotation(playerTransform.rotation)
      const maxYawStep = PLAYER_TURN_SPEED_DEGREES * dt
      const nextYaw = approachAngle(currentYaw, targetYaw, maxYawStep)
      mutableTransform.rotation = Quaternion.fromEulerDegrees(0, nextYaw, 0)
      syncPlayerAnimation()
    })
  }

  if (!attackAnimationSystemInitialized) {
    attackAnimationSystemInitialized = true
    engine.addSystem((dt) => {
      if (attackAnimationTimer <= 0) return
      if (!dogeBodyEntity) {
        attackAnimationTimer = 0
        attackMovementLockTimer = 0
        setAttackMovementLocked(false)
        return
      }
      if (!Animator.has(dogeBodyEntity as Entity)) {
        attackAnimationTimer = 0
        attackMovementLockTimer = 0
        setAttackMovementLocked(false)
        return
      }

      attackAnimationTimer = Math.max(0, attackAnimationTimer - dt)
      attackMovementLockTimer = Math.max(0, attackMovementLockTimer - dt)
      if (attackMovementLockTimer <= 0) {
        setAttackMovementLocked(false)
      }
    })
  }

  if (!jumpSystemInitialized) {
    jumpSystemInitialized = true
    engine.addSystem((dt) => {
      if (inputSystem.isTriggered(InputAction.IA_JUMP, PointerEventType.PET_DOWN)) {
        jumpActive = true
        jumpElapsed = 0
        playSinglePlayerAnimation(PLAYER_JUMP_CLIP)
      }

      if (!jumpActive) return

      jumpElapsed = Math.min(PLAYER_JUMP_DURATION, jumpElapsed + dt)
      if (jumpElapsed >= PLAYER_JUMP_DURATION) {
        jumpActive = false
        jumpElapsed = 0
      }
    })
  }
}

export function setPlayerSpectatorVisualHidden(hidden: boolean): void {
  if (spectatorVisualHidden === hidden) return

  spectatorVisualHidden = hidden
  if (hidden) {
    attackAnimationTimer = 0
    attackMovementLockTimer = 0
    setAttackMovementLocked(false)
    startSpectatorEliminationVisual()
    console.log('[Client][T] spectator visual hidden')
    return
  }

  resetDogeBodyModel()
  spectatorEliminationVisualState = 'none'
  spectatorEliminationTimer = 0
  spectatorEliminationSmallTimer = 0
  showDogeBodyVisual()
  console.log('[Client][T] spectator visual restored')
}

export function releasePlayerAvatarVisibility(): void {
  releaseAvatarHideModifierArea()
}

function ensureModifierCleanupSystem(): void {
  if (modifierCleanupSystemInitialized) return

  modifierCleanupSystemInitialized = true
  engine.addSystem((dt) => {
    if (!modifierEntity || modifierReleaseTimer <= 0) return

    modifierReleaseTimer = Math.max(0, modifierReleaseTimer - dt)
    if (modifierReleaseTimer > 0) return

    forceRemoveAvatarHideModifierArea('delayed-release')
  })
}

function releaseAvatarHideModifierArea(): void {
  if (!modifierEntity) return

  if (Transform.has(modifierEntity)) {
    const transform = Transform.getMutable(modifierEntity)
    transform.position = Vector3.create(
      AVATAR_HIDE_REFRESH_X,
      AVATAR_HIDE_REFRESH_Y,
      AVATAR_HIDE_REFRESH_Z
    )
  }

  if (AvatarModifierArea.has(modifierEntity)) {
    AvatarModifierArea.createOrReplace(modifierEntity, {
      area: Vector3.create(0.1, 0.1, 0.1),
      modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
      excludeIds: [],
    })
  }

  modifierReleaseTimer = AVATAR_HIDE_RELEASE_DELAY_SECONDS
  ensureModifierCleanupSystem()
  console.log('[Player] Avatar visibility modifier moved away for refresh')
}

function forceRemoveAvatarHideModifierArea(reason: string): void {
  if (!modifierEntity) return

  if (AvatarModifierArea.has(modifierEntity)) {
    AvatarModifierArea.deleteFrom(modifierEntity)
  }
  engine.removeEntity(modifierEntity)
  modifierEntity = null
  modifierReleaseTimer = 0
  console.log(`[Player] Avatar visibility modifier removed reason=${reason}`)
}

function hideDogeBodyVisual(): void {
  if (!dogeBodyEntity) return
  const dogeEntity = dogeBodyEntity as Entity
  if (!Transform.has(dogeEntity)) return

  const transform = Transform.getMutable(dogeEntity)
  transform.position = Vector3.create(0, -10, 0)
  transform.scale = Vector3.create(0, 0, 0)
}

function showDogeBodyVisual(): void {
  if (!dogeBodyEntity) return
  const dogeEntity = dogeBodyEntity as Entity
  if (!Transform.has(dogeEntity)) return

  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  const transform = Transform.getMutable(dogeEntity)
  transform.scale = PLAYER_DOGE_SCALE

  if (playerTransform) {
    transform.position = Vector3.create(
      playerTransform.position.x,
      playerTransform.position.y,
      playerTransform.position.z
    )
  }

  currentPlayerAnimation = null
  returnToIdlePose()
}

function resetDogeBodyModel(): void {
  if (!dogeBodyEntity) return
  const dogeEntity = dogeBodyEntity as Entity
  if (GltfContainer.has(dogeEntity)) {
    const gltf = GltfContainer.getMutable(dogeEntity)
    gltf.src = PLAYER_DOGE_MODEL
  }
}

function startSpectatorEliminationVisual(): void {
  if (!dogeBodyEntity) return
  const dogeEntity = dogeBodyEntity as Entity
  if (!Transform.has(dogeEntity)) return

  resetDogeBodyModel()
  if (Animator.has(dogeEntity)) {
    Animator.stopAllAnimations(dogeEntity)
  }

  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  const transform = Transform.getMutable(dogeEntity)
  if (playerTransform) {
    transform.position = Vector3.create(
      playerTransform.position.x,
      playerTransform.position.y,
      playerTransform.position.z
    )
    transform.rotation = playerTransform.rotation
  }
  transform.scale = PLAYER_DOGE_SCALE

  spectatorEliminationVisualState = 'squash'
  spectatorEliminationTimer = PLAYER_ELIMINATION_SQUASH_DURATION
  spectatorEliminationSmallTimer = 0
  applySpectatorEliminationSquash(0)
}

function updateSpectatorEliminationVisual(dt: number): void {
  if (!dogeBodyEntity) return

  if (spectatorEliminationVisualState === 'squash') {
    spectatorEliminationTimer = Math.max(0, spectatorEliminationTimer - dt)
    const progress = 1 - spectatorEliminationTimer / PLAYER_ELIMINATION_SQUASH_DURATION
    applySpectatorEliminationSquash(progress)
    if (spectatorEliminationTimer <= 0) {
      showSpectatorSmallDoge()
    }
    return
  }

  if (spectatorEliminationVisualState === 'small') {
    spectatorEliminationSmallTimer = Math.max(0, spectatorEliminationSmallTimer - dt)
    if (spectatorEliminationSmallTimer <= 0) {
      spectatorEliminationVisualState = 'hidden'
      hideDogeBodyVisual()
    }
    return
  }

  if (spectatorEliminationVisualState === 'hidden') {
    hideDogeBodyVisual()
  }
}

function applySpectatorEliminationSquash(progress: number): void {
  if (!dogeBodyEntity) return
  const dogeEntity = dogeBodyEntity as Entity
  if (!Transform.has(dogeEntity)) return

  const clamped = Math.min(1, Math.max(0, progress))
  const heightScale = 1 - (1 - PLAYER_ELIMINATION_MIN_HEIGHT_SCALE) * clamped
  const widthScale = 1 + (PLAYER_ELIMINATION_FLATTEN_SCALE - 1) * clamped
  const transform = Transform.getMutable(dogeEntity)
  transform.scale = Vector3.create(
    PLAYER_DOGE_SCALE.x * widthScale,
    PLAYER_DOGE_SCALE.y * heightScale,
    PLAYER_DOGE_SCALE.z * widthScale
  )
}

function showSpectatorSmallDoge(): void {
  if (!dogeBodyEntity) return
  const dogeEntity = dogeBodyEntity as Entity
  if (!Transform.has(dogeEntity)) return

  if (GltfContainer.has(dogeEntity)) {
    const gltf = GltfContainer.getMutable(dogeEntity)
    gltf.src = PLAYER_DEAD_DOGE_MODEL
  }

  const transform = Transform.getMutable(dogeEntity)
  transform.scale = PLAYER_DEAD_DOGE_SCALE
  spectatorEliminationVisualState = 'small'
  spectatorEliminationSmallTimer = PLAYER_ELIMINATION_SMALL_DOGE_SECONDS
}

function getYawFromRotation(rotation: Quaternion): number {
  const forward = Vector3.rotate(Vector3.Forward(), rotation)
  return Math.atan2(forward.x, forward.z) * (180 / Math.PI)
}

function approachAngle(current: number, target: number, maxDelta: number): number {
  const delta = wrapAngleDegrees(target - current)
  if (Math.abs(delta) <= maxDelta) {
    return current + delta
  }

  return current + Math.sign(delta) * maxDelta
}

function wrapAngleDegrees(angle: number): number {
  let wrapped = angle
  while (wrapped > 180) wrapped -= 360
  while (wrapped < -180) wrapped += 360
  return wrapped
}

function syncPlayerAnimation(): void {
  if (!dogeBodyEntity) return
  if (!Animator.has(dogeBodyEntity as Entity)) return

  const desiredAnimation = getDesiredPlayerAnimation()
  if (desiredAnimation === currentPlayerAnimation) return

  if (!desiredAnimation) {
    returnToIdlePose()
    return
  }

  if (desiredAnimation === PLAYER_ATTACK_CLIP || desiredAnimation === PLAYER_JUMP_CLIP) {
    playSinglePlayerAnimation(desiredAnimation)
    return
  }

  playLoopPlayerAnimation(desiredAnimation)
}

function getDesiredPlayerAnimation(): string | null {
  if (attackAnimationTimer > 0) return PLAYER_ATTACK_CLIP
  if (jumpActive) return PLAYER_JUMP_CLIP
  return getLocomotionAnimationForCurrentPlatform()
}

function getLocomotionAnimationForCurrentPlatform(): string {
  return getPlatform() === 'mobile'
    ? getMobileLocomotionAnimation()
    : getDesktopLocomotionAnimation()
}

function getDesktopLocomotionAnimation(): string {
  if (!isMovementPressed()) return PLAYER_IDLE_CLIP
  return inputSystem.isPressed(InputAction.IA_MODIFIER) ? PLAYER_RUN_CLIP : PLAYER_WALK_CLIP
}

function getMobileLocomotionAnimation(): string {
  if (mobilePlanarSpeed < PLAYER_MOBILE_IDLE_SPEED_THRESHOLD) return PLAYER_IDLE_CLIP
  if (mobilePlanarSpeed >= PLAYER_MOBILE_RUN_SPEED_THRESHOLD) return PLAYER_RUN_CLIP
  return PLAYER_WALK_CLIP
}

function isMovementPressed(): boolean {
  return (
    inputSystem.isPressed(InputAction.IA_FORWARD) ||
    inputSystem.isPressed(InputAction.IA_BACKWARD) ||
    inputSystem.isPressed(InputAction.IA_LEFT) ||
    inputSystem.isPressed(InputAction.IA_RIGHT)
  )
}

function updatePlayerPlanarSpeed(position: Vector3, dt: number): void {
  if (dt <= 0) return

  if (!lastPlayerPosition) {
    lastPlayerPosition = Vector3.create(position.x, position.y, position.z)
    mobilePlanarSpeed = 0
    return
  }

  const deltaX = position.x - lastPlayerPosition.x
  const deltaZ = position.z - lastPlayerPosition.z
  const instantPlanarSpeed = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) / dt
  const smoothingAlpha = Math.min(1, dt * PLAYER_MOBILE_SPEED_SMOOTHING)
  mobilePlanarSpeed += (instantPlanarSpeed - mobilePlanarSpeed) * smoothingAlpha
  lastPlayerPosition = Vector3.create(position.x, position.y, position.z)
}

function stopPlayerAnimations(): void {
  if (!dogeBodyEntity) return
  Animator.stopAllAnimations(dogeBodyEntity as Entity)
  const animator = Animator.getMutable(dogeBodyEntity as Entity)
  for (const state of animator.states) {
    state.playing = false
  }
}

function returnToIdlePose(): void {
  playLoopPlayerAnimation(PLAYER_IDLE_CLIP)
}

function playLoopPlayerAnimation(clipName: string): void {
  if (!dogeBodyEntity) return
  stopPlayerAnimations()

  const animator = Animator.getMutable(dogeBodyEntity as Entity)
  const clip = animator.states.find((state) => state.clip === clipName)
  if (!clip) return

  clip.playing = true
  clip.loop = true
  clip.weight = 1.0
  currentPlayerAnimation = clipName
}

function playSinglePlayerAnimation(clipName: string): void {
  if (!dogeBodyEntity) return
  stopPlayerAnimations()

  const animator = Animator.getMutable(dogeBodyEntity as Entity)
  const clip = animator.states.find((state) => state.clip === clipName)
  if (!clip) return

  clip.playing = false
  clip.loop = false
  clip.weight = 1.0
  Animator.playSingleAnimation(dogeBodyEntity as Entity, clipName, true)
  currentPlayerAnimation = clipName
}

/** Play or immediately restart the player's attack animation */
export function playPlayerAttackAnimation(): void {
  if (!dogeBodyEntity) return
  if (!Animator.has(dogeBodyEntity as Entity)) return

  attackAnimationTimer = PLAYER_ATTACK_TOTAL_DURATION
  attackMovementLockTimer = PLAYER_ATTACK_MOVE_LOCK_DURATION
  setAttackMovementLocked(true)
  playSinglePlayerAnimation(PLAYER_ATTACK_CLIP)
}

/** Clean up player disguise (called when returning to lobby) */
export function cleanupPlayerDisguise(): void {
  console.log('[Player] Cleaning up player disguise...')

  attackAnimationTimer = 0
  attackMovementLockTimer = 0
  attackMovementLocked = false
  skillMovementLocked = false
  spectatorVisualHidden = false
  spectatorEliminationVisualState = 'none'
  spectatorEliminationTimer = 0
  spectatorEliminationSmallTimer = 0
  jumpActive = false
  jumpElapsed = 0
  lastPlayerPosition = null
  mobilePlanarSpeed = 0
  AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)
  InputModifier.deleteFrom(engine.PlayerEntity)
  
  // Remove AvatarModifierArea
  releaseAvatarHideModifierArea()
  
  // Remove Doge body
  if (dogeBodyEntity) {
    returnToIdlePose()
    engine.removeEntity(dogeBodyEntity as Entity)
    dogeBodyEntity = 0
  }
  
  console.log('[Player] Player disguise cleaned up')
}
