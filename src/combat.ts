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
import {
  NpcPatrol,
  aliveCount,
  applyNpcPublicDogePresentation,
  getNpcEntityByPublicDogeId,
  getNpcPublicDogeId,
  startNpcElimination,
} from './npc'
import { addKillFeedMessage } from './ui'
import { recordLocalBonkHit } from './localMatchState'
import { notifyBonkActionStart, requestBonk, setGameplayResolvers } from './gameResolvers'
import type { BonkRequest, BonkResult } from './gameResolvers'
import {
  playPlayerAttackAnimation,
  PLAYER_ATTACK_IMPACT_TIME,
  PLAYER_ATTACK_TOTAL_DURATION,
} from './player'
import {
  canLocalServerPlayerAct,
  getLocalServerPlayerStatus,
} from './client/serverPublicStateClient'

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

const ATTACK_MIN_FORWARD = 0.15
const ATTACK_RANGE = 3.6
const ATTACK_RADIUS = 2.45
const ATTACK_HIT_WINDOW_SECONDS = 0.16
const COMBAT_START_INPUT_GRACE_SECONDS = 0.2

let attackElapsed = PLAYER_ATTACK_TOTAL_DURATION
let hasHitThisSwing = false
let startInputGraceTimer = 0

const LOCAL_PLAYER_ID = 'local-player'

/** Reset combat state */
export function resetCombat(): void {
  totalBonks = 0
  attackElapsed = PLAYER_ATTACK_TOTAL_DURATION
  hasHitThisSwing = false
  startInputGraceTimer = COMBAT_START_INPUT_GRACE_SECONDS
}

export function triggerPlayerBonkAttack(): boolean {
  if (startInputGraceTimer > 0) return false
  if (!canLocalServerPlayerAct()) {
    console.log(`[Client][T] bonk input blocked localStatus=${getLocalServerPlayerStatus()}`)
    return false
  }

  attackElapsed = 0
  hasHitThisSwing = false

  const attackPose = tryGetAttackPose()
  if (attackPose) {
    notifyBonkActionStart({
      attackerPlayerId: LOCAL_PLAYER_ID,
      origin: attackPose.origin,
      forward: attackPose.forward,
    })
  }

  playPlayerAttackAnimation()
  return true
}

/** Apply the visual/counter side effects for an accepted BONK result. */
function applyNpcBonkPresentation(npcRoot: Entity, hitOrigin: Vector3, publicDogeId: string | null): boolean {
  const patrol = NpcPatrol.get(npcRoot)
  if (patrol.isKnockedOut || patrol.isBeingEliminated) return false

  if (!applyNpcPublicDogePresentation(publicDogeId, hitOrigin)) {
    startNpcElimination(npcRoot, hitOrigin)
  }

  // Update counters
  totalBonks++

  // Kill feed
  const msg = KILL_MESSAGES[Math.floor(Math.random() * KILL_MESSAGES.length)]
  addKillFeedMessage(msg)
  
  // One NPC is already in the death pipeline, so <= 1 means this hit clears the board.
  if (aliveCount <= 1) {
    addKillFeedMessage('🎉 ALL DOGES ELIMINATED! 🎉')
  }
  return true
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

function resolveLocalBonk(request: BonkRequest): BonkResult {
  const targetNpc = request.candidateTargetNpc ?? findBestNpcInFront(request.origin, request.forward)

  if (!targetNpc) {
    return {
      outcome: 'miss',
      request,
    }
  }

  return {
    outcome: 'hit-npc',
    request,
    targetNpc,
  }
}

setGameplayResolvers({ resolveBonk: resolveLocalBonk })

function applyBonkResult(result: BonkResult): boolean {
  if (result.outcome === 'pending') return true
  if (result.outcome === 'miss') return false

  const publicDogeId = getNpcPublicDogeId(result.targetNpc)
  recordLocalBonkHit(publicDogeId)
  return applyNpcBonkPresentation(result.targetNpc, result.request.origin, publicDogeId)
}

export function applyServerBonkAccepted(publicDogeId: string, hitOrigin: Vector3): boolean {
  const targetNpc = getNpcEntityByPublicDogeId(publicDogeId)
  if (!targetNpc) {
    console.log(`[Client][S] bonkResult accepted but local NPC is missing publicDogeId=${publicDogeId}`)
    return false
  }

  recordLocalBonkHit(publicDogeId)
  return applyNpcBonkPresentation(targetNpc, hitOrigin, publicDogeId)
}

function findBestNpcInFront(origin: Vector3, forward: Vector3): Entity | null {
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

  return bestTarget
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

  const candidateTargetNpc = findBestNpcInFront(attackPose.origin, attackPose.forward)
  const candidatePublicDogeId = candidateTargetNpc
    ? getNpcPublicDogeId(candidateTargetNpc) ?? ''
    : ''

  const bonkResult = requestBonk({
    attackerPlayerId: LOCAL_PLAYER_ID,
    origin: attackPose.origin,
    forward: attackPose.forward,
    candidatePublicDogeId,
    candidateTargetNpc: candidateTargetNpc ?? undefined,
  })

  if (applyBonkResult(bonkResult)) {
    hasHitThisSwing = true
  }
}
