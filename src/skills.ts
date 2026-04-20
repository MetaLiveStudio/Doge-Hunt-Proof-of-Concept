/**
 * skills.ts — Player skills
 * "Rock Solid": Press E near a pillar to transform into a pillar.
 * Lasts 5 seconds, 15 second cooldown.
 */
import {
  engine, Transform, InputAction,
  PointerEventType, inputSystem,
  MeshRenderer, MeshCollider, Material,
  GltfContainer,
  TextShape, Billboard, BillboardMode,
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3 } from '@dcl/sdk/math'

const CX = 24
const CZ = 24

// Skill state
let isDisguised = false
let disguiseTimer = 0
let cooldownTimer = 0
const DISGUISE_DURATION = 5
const COOLDOWN_DURATION = 15
const PILLAR_RANGE = 6 // must be within 6m of a pillar
const SKILL_STATUS_Y = 4.2

// References set during init
let dogeBodyEntity: number = 0
let pillarDisguiseEntity: number = 0
let skillStatusEntity: number = 0

// Pillar positions (must match arena.ts)
const pillarPositions = [
  { x: CX - 8, z: CZ - 8 },
  { x: CX + 8, z: CZ - 8 },
  { x: CX - 8, z: CZ + 8 },
  { x: CX + 8, z: CZ + 8 },
  { x: CX - 16, z: CZ },
  { x: CX + 16, z: CZ },
  { x: CX, z: CZ - 16 },
  { x: CX, z: CZ + 16 },
]

export function setupSkills(dogeBody: number): void {
  dogeBodyEntity = dogeBody

  // Create hidden pillar disguise entity (invisible by default)
  pillarDisguiseEntity = engine.addEntity() as number
  Transform.create(pillarDisguiseEntity, {
    position: Vector3.create(0, -10, 0), // hidden below ground
    scale: Vector3.create(1.4, 4, 1.4),
  })
  MeshRenderer.setCylinder(pillarDisguiseEntity)
  MeshCollider.setCylinder(pillarDisguiseEntity)
  Material.setPbrMaterial(pillarDisguiseEntity, {
    albedoColor: Color4.create(0.08, 0.08, 0.12, 1),
    metallic: 0.3,
    roughness: 0.6,
  })

  skillStatusEntity = engine.addEntity() as number
  Transform.create(skillStatusEntity, {
    position: Vector3.create(CX, 0.5, CZ + 20),
  })
  TextShape.create(skillStatusEntity, {
    text: '[E] Rock Solid - Hide as Pillar',
    fontSize: 2,
    textColor: Color4.create(0, 0.96, 1, 0.8),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.1,
  })
  Billboard.create(skillStatusEntity, { billboardMode: BillboardMode.BM_Y })
}

/** Find the nearest pillar and return distance */
function nearestPillarDistance(pos: Vector3): number {
  let minDist = Infinity
  for (const p of pillarPositions) {
    const dx = pos.x - p.x
    const dz = pos.z - p.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

export function skillSystem(dt: number): void {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return

  const playerPos = playerTransform.position

  if (skillStatusEntity) {
    const statusTransform = Transform.getMutable(skillStatusEntity)
    statusTransform.position = Vector3.create(playerPos.x, SKILL_STATUS_Y, playerPos.z)

    const statusText = TextShape.getMutable(skillStatusEntity)
    if (isDisguised) {
      const timeLeft = Math.ceil(disguiseTimer)
      statusText.text = `HIDING... ${timeLeft}s`
      statusText.textColor = Color4.create(0.22, 1, 0.08, 0.9)
    } else if (cooldownTimer > 0) {
      const cdLeft = Math.ceil(cooldownTimer)
      statusText.text = `Rock Solid cooldown: ${cdLeft}s`
      statusText.textColor = Color4.create(1, 0.2, 0.2, 0.8)
    } else {
      const dist = nearestPillarDistance(playerPos)
      if (dist <= PILLAR_RANGE) {
        statusText.text = '[E] Rock Solid - READY!'
        statusText.textColor = Color4.create(0, 0.96, 1, 1)
      } else {
        statusText.text = '[E] Rock Solid (get near a pillar)'
        statusText.textColor = Color4.create(0, 0.96, 1, 0.5)
      }
    }
  }

  // Handle disguise timer
  if (isDisguised) {
    disguiseTimer -= dt
    if (disguiseTimer <= 0) {
      endDisguise()
    }
    return
  }

  // Handle cooldown
  if (cooldownTimer > 0) {
    cooldownTimer -= dt
    return
  }

  // Check for E key press
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
    const dist = nearestPillarDistance(playerPos)
    if (dist <= PILLAR_RANGE) {
      startDisguise(playerPos)
    }
  }
}

function startDisguise(pos: Vector3): void {
  isDisguised = true
  disguiseTimer = DISGUISE_DURATION

  // Hide doge body
  if (dogeBodyEntity) {
    const dogeTransform = Transform.getMutable(dogeBodyEntity)
    dogeTransform.position = Vector3.create(0, -10, 0)
    dogeTransform.scale = Vector3.create(0, 0, 0)
  }

  // Show pillar at player position
  if (pillarDisguiseEntity) {
    const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
    pillarTransform.position = Vector3.create(pos.x, 2, pos.z)
  }
}

function endDisguise(): void {
  isDisguised = false
  cooldownTimer = COOLDOWN_DURATION

  // Hide pillar
  if (pillarDisguiseEntity) {
    const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
    pillarTransform.position = Vector3.create(0, -10, 0)
  }

  // Restore doge body (will be updated by follow system next frame)
  if (dogeBodyEntity) {
    const dogeTransform = Transform.getMutable(dogeBodyEntity)
    dogeTransform.scale = Vector3.create(1.5, 1.5, 1.5)
  }
}

/** Check if player is currently disguised (used by player follow system) */
export function isPlayerDisguised(): boolean {
  return isDisguised
}
