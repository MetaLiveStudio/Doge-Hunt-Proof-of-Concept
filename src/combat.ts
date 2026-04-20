/**
 * combat.ts — Bat swing, hit detection, knockback, knockout
 * On bonk: swap Muscledoge → SmallDoge model, knockback, permanent death.
 */
import {
  engine, Entity, Transform, InputAction,
  PointerEventType, inputSystem,
  GltfContainer, TextShape,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { NpcHitbox, NpcPatrol, DEAD_DOGE_MODEL, decrementAlive, NPC_DEAD_VISUAL_SCALE } from './npc'
import { addKillFeedMessage } from './ui'

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

/** Knockback an NPC and swap to dead model */
function knockbackNpc(npcRoot: Entity, hitOrigin: Vector3): void {
  const transform = Transform.getMutable(npcRoot)
  const patrol = NpcPatrol.getMutable(npcRoot)

  // Knockback direction (away from player)
  const npcPos = transform.position
  const direction = Vector3.subtract(npcPos, hitOrigin)
  const len = Vector3.length(direction)
  const normalized = len > 0.01
    ? Vector3.normalize(direction)
    : Vector3.create(0, 0, 1)

  const KNOCKBACK_FORCE = 3
  const newX = npcPos.x + normalized.x * KNOCKBACK_FORCE
  const newZ = npcPos.z + normalized.z * KNOCKBACK_FORCE

  // Move to knockback position
  transform.position = Vector3.create(newX, 0, newZ)

  // Swap model: Muscledoge → SmallDoge (dead), shrink to 50%
  const visualEntity = patrol.visualEntity as Entity
  const gltf = GltfContainer.getMutable(visualEntity)
  gltf.src = DEAD_DOGE_MODEL
  const visualTransform = Transform.getMutable(visualEntity)
  visualTransform.scale = NPC_DEAD_VISUAL_SCALE
  // Change label from "?" to "X" (dead)
  if (patrol.labelEntity) {
    const labelText = TextShape.getMutable(patrol.labelEntity as Entity)
    labelText.text = 'ELIMINATED'
    // Move label to final position
    const labelTransform = Transform.getMutable(patrol.labelEntity as Entity)
    labelTransform.position = Vector3.create(newX, 1.5, newZ)
  }

  // Mark as permanently dead
  patrol.isKnockedOut = true
  patrol.knockoutTimer = -1

  // Update counters
  totalBonks++
  decrementAlive()

  // Kill feed
  const msg = KILL_MESSAGES[Math.floor(Math.random() * KILL_MESSAGES.length)]
  addKillFeedMessage(msg)
}

/** Combat system — detect clicks on NPCs */
export function combatSystem(_dt: number): void {
  for (const [hitbox] of engine.getEntitiesWith(NpcHitbox, Transform)) {
    const { rootEntity } = NpcHitbox.get(hitbox)
    const entity = rootEntity as Entity
    if (!NpcPatrol.has(entity)) continue

    const patrol = NpcPatrol.get(entity)
    if (patrol.isKnockedOut) continue

    if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN, hitbox)) {
      const cmd = inputSystem.getInputCommand(
        InputAction.IA_POINTER,
        PointerEventType.PET_DOWN,
        hitbox
      )

      let hitOrigin = Vector3.create(24, 0, 24)
      if (cmd && cmd.hit && cmd.hit.globalOrigin) {
        hitOrigin = Vector3.create(
          cmd.hit.globalOrigin.x,
          cmd.hit.globalOrigin.y,
          cmd.hit.globalOrigin.z
        )
      }

      knockbackNpc(entity, hitOrigin)
    }
  }
}
