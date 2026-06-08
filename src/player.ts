/**
 * player.ts — Player disguise system
 * Hides the real player avatar, replaces with Muscledoge model (includes bat).
 */
import {
  engine, Transform, Entity,
  AvatarLocomotionSettings,
  AvatarModifierArea, AvatarModifierType,
  GltfContainer, Animator,
  InputAction, PointerEventType, inputSystem,
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isPlayerDisguised } from './skills'

const CX = 48
const CZ = 48
const ARENA_SIZE = 92

// Exported so skills.ts can reference it
export let dogeBodyEntity: number = 0
let modifierEntity: Entity | null = null
let followSystemInitialized = false
let attackAnimationSystemInitialized = false
let attackAnimationTimer = 0
let jumpSystemInitialized = false
let jumpElapsed = 0
let jumpActive = false
let currentPlayerAnimation: string | null = null
const PLAYER_ATTACK_CLIP = 'Bonk'
const PLAYER_IDLE_CLIP = 'idel'
const PLAYER_JUMP_CLIP = 'jump'
const PLAYER_WALK_CLIP = 'walk'
const PLAYER_RUN_CLIP = 'run'
export const PLAYER_ATTACK_ANIMATION_SPEED = 1.82
export const PLAYER_ATTACK_IMPACT_TIME = 0.25
export const PLAYER_ATTACK_TOTAL_DURATION = 1.26
const PLAYER_JUMP_DURATION = 1.933
const PLAYER_JUMP_HEIGHT = 1.15
const PLAYER_TURN_SPEED_DEGREES = 240
const PLAYER_JUMP_ANIMATION_SPEED = 1
const PLAYER_WALK_ANIMATION_SPEED = 1
const PLAYER_RUN_ANIMATION_SPEED = 1.15
export const PLAYER_WALK_SPEED = 6
export const PLAYER_JOG_SPEED = 6
export const PLAYER_RUN_SPEED = 10

/** Set up the player's Doge disguise */
export function setupPlayerDisguise(): void {
  AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
    walkSpeed: PLAYER_WALK_SPEED,
    jogSpeed: PLAYER_JOG_SPEED,
    runSpeed: PLAYER_RUN_SPEED,
  })

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

  // 2. Doge body (with bat) — Muscledoge.glb follows the player
  const dogeBody = engine.addEntity()
  dogeBodyEntity = dogeBody as number
  Transform.create(dogeBody, {
    position: Vector3.create(CX, 0, CZ),
    scale: Vector3.create(1.5, 1.5, 1.5),
  })
  GltfContainer.create(dogeBody, { src: 'models/Muscledoge.glb' })
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

      const playerTransform = Transform.getOrNull(engine.PlayerEntity)
      if (!playerTransform) return

      const dogeTransform = Transform.getOrNull(dogeBodyEntity as Entity)
      if (!dogeTransform) return

      const mutableTransform = Transform.getMutable(dogeBodyEntity as Entity)
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
        return
      }
      if (!Animator.has(dogeBodyEntity as Entity)) {
        attackAnimationTimer = 0
        return
      }

      attackAnimationTimer = Math.max(0, attackAnimationTimer - dt)
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
  if (!isMovementPressed()) return PLAYER_IDLE_CLIP
  return inputSystem.isPressed(InputAction.IA_MODIFIER) ? PLAYER_RUN_CLIP : PLAYER_WALK_CLIP
}

function isMovementPressed(): boolean {
  return (
    inputSystem.isPressed(InputAction.IA_FORWARD) ||
    inputSystem.isPressed(InputAction.IA_BACKWARD) ||
    inputSystem.isPressed(InputAction.IA_LEFT) ||
    inputSystem.isPressed(InputAction.IA_RIGHT)
  )
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
  playSinglePlayerAnimation(PLAYER_ATTACK_CLIP)
}

/** Clean up player disguise (called when returning to lobby) */
export function cleanupPlayerDisguise(): void {
  console.log('[Player] Cleaning up player disguise...')

  AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)
  
  // Remove AvatarModifierArea
  if (modifierEntity) {
    engine.removeEntity(modifierEntity)
    modifierEntity = null
  }
  
  // Remove Doge body
  if (dogeBodyEntity) {
    attackAnimationTimer = 0
    jumpActive = false
    jumpElapsed = 0
    returnToIdlePose()
    engine.removeEntity(dogeBodyEntity as Entity)
    dogeBodyEntity = 0
  }
  
  console.log('[Player] Player disguise cleaned up')
}
