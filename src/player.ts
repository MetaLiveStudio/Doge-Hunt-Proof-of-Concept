/**
 * player.ts — Player disguise system
 * Hides the real player avatar, replaces with Muscledoge model (includes bat).
 */
import {
  engine, Transform,
  AvatarModifierArea, AvatarModifierType,
  GltfContainer,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isPlayerDisguised } from './skills'

const CX = 24
const CZ = 24

// Exported so skills.ts can reference it
export let dogeBodyEntity: number = 0

/** Set up the player's Doge disguise */
export function setupPlayerDisguise(): void {
  // 1. AvatarModifierArea — hides real player avatar in the arena
  const modifierEntity = engine.addEntity()
  Transform.create(modifierEntity, {
    position: Vector3.create(CX, 2, CZ),
  })
  AvatarModifierArea.create(modifierEntity, {
    area: Vector3.create(48, 8, 48),
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

  // 3. System — make the Doge body follow the player each frame
  engine.addSystem(() => {
    // Don't follow when disguised as pillar
    if (isPlayerDisguised()) return

    const playerTransform = Transform.getOrNull(engine.PlayerEntity)
    if (!playerTransform) return

    const dogeTransform = Transform.getMutable(dogeBody)
    dogeTransform.position = Vector3.create(
      playerTransform.position.x,
      0,
      playerTransform.position.z
    )
    dogeTransform.rotation = playerTransform.rotation
  })
}
