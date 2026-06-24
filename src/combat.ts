/**
 * combat.ts — Tap-to-swing melee combat
 * A tap starts a short attack window. NPCs only die if they are inside
 * the player's forward hit zone during that swing.
 */
import {
  engine, Entity, Transform, InputAction,
  PointerEventType, inputSystem,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { NpcPatrol, aliveCount, startNpcElimination } from './npc'
import { addKillFeedMessage } from './ui'
import {
  playPlayerAttackAnimation,
  PLAYER_ATTACK_IMPACT_TIME,
  PLAYER_ATTACK_TOTAL_DURATION,
} from './player'

const KILL_MESSAGES = [
  'Such eliminate. Very dead. Wow.',
  'Bonk! That Doge is no more.',
  'RIP Doge. You trusted no one and still lost.',
  'Doge down! Was it a player? ...it was an NPC.',
  'Critical bonk! Much damage.',
  'That Doge had a family. Had.',
  'Bonk heard around the world.',
  'Another one bites the bonk.',
  'Doge eliminated. Or was it a decoy?',
  'WASTED. Doge edition.',
]

export let totalBonks = 0

const ATTACK_MIN_FORWARD = 0.25
const ATTACK_RANGE = 2.9
const ATTACK_RADIUS = 1.92
const ATTACK_HIT_WINDOW_SECONDS = 0.12
const COMBAT_START_INPUT_GRACE_SECONDS = 0.2

let attackElapsed = PLAYER_ATTACK_TOTAL_DURATION
let hasHitThisSwing = false
let startInputGraceTimer = 0

/** Reset combat state */
export function resetCombat(): void {
  totalBonks = 0
  attackElapsed = PLAYER_ATTACK_TOTAL_DURATION
  hasHitThisSwing = false
  startInputGraceTimer = COMBAT_START_INPUT_GRACE_SECONDS
}

export function triggerPlayerBonkAttack(): boolean {
  if (startInputGraceTimer > 0) return false

  attackElapsed = 0
  hasHitThisSwing = false
  playPlayerAttackAnimation()
  return true
}

/** Knockback an NPC and swap to dead model */
function knockbackNpc(npcRoot: Entity, hitOrigin: Vector3): void {
  const patrol = NpcPatrol.get(npcRoot)
  if (patrol.isKnockedOut || patrol.isBeingEliminated) return

  startNpcElimination(npcRoot, hitOrigin)

  // Update counters
  totalBonks++

  // Kill feed
  const msg = KILL_MESSAGES[Math.floor(Math.random() * KILL_MESSAGES.length)]
  addKillFeedMessage(msg)
  
  // One NPC is already in the death pipeline, so <= 1 means this hit clears the board.
  if (aliveCount <= 1) {
    addKillFeedMessage('🎉 ALL DOGES ELIMINATED! 🎉')
  }
}
function tryGetAttackPose(): { origin: Vector3; forward: Vector3 } | null {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return null

  const origin = Vector3.create(
    playerTransform.position.x,
    0,
    playerTransform.position.z
  )

  const rawForward = Vector3.rotate(Vector3.Forward(), playerTransform.rotation)
  const flatForward = Vector3.create(rawForward.x, 0, rawForward.z)
  const flatForwardLength = Vector3.length(flatForward)
  const forward = flatForwardLength > 0.001
    ? Vector3.normalize(flatForward)
    : Vector3.Forward()

  return { origin, forward }
}

function tryHitNpcInFront(origin: Vector3, forward: Vector3): boolean {
  let bestTarget: Entity | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [entity] of engine.getEntitiesWith(NpcPatrol, Transform)) {
    const patrol = NpcPatrol.get(entity)
    if (patrol.isKnockedOut || patrol.isBeingEliminated) continue

    const npcTransform = Transform.get(entity)
    const toNpc = Vector3.subtract(npcTransform.position, origin)
    const flatToNpc = Vector3.create(toNpc.x, 0, toNpc.z)

    const forwardDistance = Vector3.dot(flatToNpc, forward)
    if (forwardDistance < ATTACK_MIN_FORWARD || forwardDistance > ATTACK_RANGE) continue

    const projected = Vector3.scale(forward, forwardDistance)
    const lateralOffset = Vector3.subtract(flatToNpc, projected)
    const lateralDistance = Vector3.length(lateralOffset)
    if (lateralDistance > ATTACK_RADIUS) continue

    const planarDistance = Vector3.length(flatToNpc)
    if (planarDistance < bestDistance) {
      bestDistance = planarDistance
      bestTarget = entity as Entity
    }
  }

  if (!bestTarget) return false

  knockbackNpc(bestTarget, origin)
  return true
}

/** Combat system — tap anywhere to swing, hit only when an NPC is inside the attack zone */
export function combatSystem(dt: number): void {
  if (startInputGraceTimer > 0) {
    startInputGraceTimer = Math.max(0, startInputGraceTimer - dt)
    return
  }

  if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
    triggerPlayerBonkAttack()
  }

  if (attackElapsed >= PLAYER_ATTACK_TOTAL_DURATION) return
  attackElapsed += dt
  if (hasHitThisSwing) return

  if (attackElapsed < PLAYER_ATTACK_IMPACT_TIME) return
  if (attackElapsed > PLAYER_ATTACK_IMPACT_TIME + ATTACK_HIT_WINDOW_SECONDS) return

  const attackPose = tryGetAttackPose()
  if (!attackPose) return

  if (tryHitNpcInFront(attackPose.origin, attackPose.forward)) {
    hasHitThisSwing = true
  }
}
