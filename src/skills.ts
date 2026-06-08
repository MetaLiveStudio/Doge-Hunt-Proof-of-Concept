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

const CX = 48
const CZ = 48

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

// Pillar positions (must match arena.ts floating slabs)
const pillarPositions = [
  { x: CX - 10, z: CZ - 10, rot: 45 },
  { x: CX + 10, z: CZ + 10, rot: 45 },
  { x: CX - 10, z: CZ + 10, rot: -45 },
  { x: CX + 10, z: CZ - 10, rot: -45 },
  { x: CX - 22, z: CZ, rot: 0 },
  { x: CX + 22, z: CZ, rot: 0 },
  { x: CX, z: CZ - 22, rot: 90 },
  { x: CX, z: CZ + 22, rot: 90 },
]

export function setupSkills(dogeBody: number): void {
  dogeBodyEntity = dogeBody

  // Create hidden pillar disguise entity (invisible by default)
  // Match the new Meier White slab style
  pillarDisguiseEntity = engine.addEntity() as number
  Transform.create(pillarDisguiseEntity, {
    position: Vector3.create(0, -10, 0), // hidden below ground
    scale: Vector3.create(4.0, 4.0, 1.2),
  })
  MeshRenderer.setBox(pillarDisguiseEntity)
  MeshCollider.setBox(pillarDisguiseEntity)
  Material.setPbrMaterial(pillarDisguiseEntity, {
    albedoColor: Color4.create(0.9, 0.9, 0.92, 1),
    metallic: 0.3,
    roughness: 0.2,
  })

  skillStatusEntity = engine.addEntity() as number
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

// Find the nearest slab and return its distance and rotation
function nearestPillarInfo(pos: Vector3): { dist: number, rot: number } {
  let minDist = Infinity
  let nearestRot = 0
  for (const p of pillarPositions) {
    const dx = pos.x - p.x
    const dz = pos.z - p.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < minDist) {
      minDist = dist
      nearestRot = p.rot
    }
  }
  return { dist: minDist, rot: nearestRot }
}

export function skillSystem(dt: number): void {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return

  const playerPos = playerTransform.position

  if (skillStatusEntity) {
    if (!Transform.getOrNull(skillStatusEntity as Entity)) {
      skillStatusEntity = 0
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
    const info = nearestPillarInfo(playerPos)
    if (info.dist <= PILLAR_RANGE) {
      startDisguise(playerPos, info.rot)
    }
  }
}

function startDisguise(pos: Vector3, rot: number): void {
  isDisguised = true
  disguiseTimer = DISGUISE_DURATION

  // Hide doge body
  if (dogeBodyEntity && Transform.getOrNull(dogeBodyEntity as Entity)) {
    const dogeTransform = Transform.getMutable(dogeBodyEntity)
    dogeTransform.position = Vector3.create(0, -10, 0)
    dogeTransform.scale = Vector3.create(0, 0, 0)
  }

  // Show slab at player position, rotated to match the cover they are hiding near
  if (pillarDisguiseEntity && Transform.getOrNull(pillarDisguiseEntity as Entity)) {
    const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
    pillarTransform.position = Vector3.create(pos.x, 2, pos.z)
    pillarTransform.rotation = Quaternion.fromEulerDegrees(0, rot, 0)
  }
}

function endDisguise(): void {
  isDisguised = false
  cooldownTimer = COOLDOWN_DURATION

  // Hide pillar
  if (pillarDisguiseEntity && Transform.getOrNull(pillarDisguiseEntity as Entity)) {
    const pillarTransform = Transform.getMutable(pillarDisguiseEntity)
    pillarTransform.position = Vector3.create(0, -10, 0)
  }

  // Restore doge body (will be updated by follow system next frame)
  if (dogeBodyEntity && Transform.getOrNull(dogeBodyEntity as Entity)) {
    const dogeTransform = Transform.getMutable(dogeBodyEntity)
    dogeTransform.scale = Vector3.create(1.5, 1.5, 1.5)
  }
}

/** Check if player is currently disguised (used by player follow system) */
export function isPlayerDisguised(): boolean {
  return isDisguised
}

/** Clean up skill entities and reset skill state */
export function cleanupSkills(): void {
  if (pillarDisguiseEntity) {
    engine.removeEntity(pillarDisguiseEntity as Entity)
    pillarDisguiseEntity = 0
  }

  if (skillStatusEntity) {
    engine.removeEntity(skillStatusEntity as Entity)
    skillStatusEntity = 0
  }

  dogeBodyEntity = 0
  isDisguised = false
  disguiseTimer = 0
  cooldownTimer = 0
}
