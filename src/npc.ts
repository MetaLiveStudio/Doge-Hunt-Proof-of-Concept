/**
 * npc.ts — NPC Doge spawning and patrol system
 * NPCs use Muscledoge.glb model. When killed, swap to SmallDoge.glb.
 * Each NPC has a floating "?" label above its head.
 */
import {
  engine, Entity, Transform, Schemas,
  GltfContainer, MeshCollider, TextShape, Billboard, BillboardMode,
  PointerEvents, PointerEventType, InputAction,
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'

// --- Custom components ---

/** NPC patrol state */
export const NpcPatrol = engine.defineComponent('npcPatrol', {
  waypointIndex: Schemas.Int,
  speed: Schemas.Float,
  isKnockedOut: Schemas.Boolean,
  knockoutTimer: Schemas.Float,
  labelEntity: Schemas.Int,
  visualEntity: Schemas.Int,
})

/** Stores the patrol waypoints per NPC (stored as flat array: x1,z1,x2,z2,...) */
export const NpcWaypoints = engine.defineComponent('npcWaypoints', {
  points: Schemas.Array(Schemas.Float),
  count: Schemas.Int,
})

export const NpcHitbox = engine.defineComponent('npcHitbox', {
  rootEntity: Schemas.Int,
})

// --- Model paths ---
export const DOGE_MODEL = 'models/Muscledoge.glb'
export const DEAD_DOGE_MODEL = 'models/SmallDoge.glb'

export const NPC_VISUAL_SCALE = Vector3.create(1.5, 1.5, 1.5)
export const NPC_HITBOX_OFFSET = Vector3.create(0, 1.2, 0)
export const NPC_HITBOX_SCALE = Vector3.create(2.4, 2.6, 2.4)
export const NPC_DEAD_VISUAL_SCALE = Vector3.create(0.5, 0.5, 0.5)

// --- Arena bounds ---
const CX = 24
const CZ = 24
const ARENA_HALF = 20
const NPC_LABEL_Y = 3.8
const NPC_LABEL_FONT_SIZE = 3

// --- Alive tracking ---
export let aliveCount = 0
export let NPC_TOTAL = 0

/** Generate random waypoints within the arena */
function generateWaypoints(count: number): number[] {
  const points: number[] = []
  for (let i = 0; i < count; i++) {
    const x = CX + (Math.random() - 0.5) * 2 * ARENA_HALF
    const z = CZ + (Math.random() - 0.5) * 2 * ARENA_HALF
    points.push(x, z)
  }
  return points
}

function createLabel(x: number, z: number): Entity {
  const label = engine.addEntity()
  Transform.create(label, {
    position: Vector3.create(x, NPC_LABEL_Y, z),
  })
  TextShape.create(label, {
    text: 'NPC or Player?',
    fontSize: NPC_LABEL_FONT_SIZE,
    textColor: Color4.create(1, 0.84, 0, 0.9),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.2,
  })
  Billboard.create(label, { billboardMode: BillboardMode.BM_Y })
  return label
}

/** Spawn a single NPC Doge */
function spawnNpc(id: number): Entity {
  const root = engine.addEntity()

  const startX = CX + (Math.random() - 0.5) * 2 * ARENA_HALF
  const startZ = CZ + (Math.random() - 0.5) * 2 * ARENA_HALF

  Transform.create(root, {
    position: Vector3.create(startX, 0, startZ),
  })

  const visual = engine.addEntity()
  Transform.create(visual, {
    parent: root,
    scale: NPC_VISUAL_SCALE,
  })
  GltfContainer.create(visual, { src: DOGE_MODEL })

  const hitbox = engine.addEntity()
  Transform.create(hitbox, {
    parent: root,
    position: NPC_HITBOX_OFFSET,
    scale: NPC_HITBOX_SCALE,
  })
  MeshCollider.setBox(hitbox)
  NpcHitbox.create(hitbox, { rootEntity: root as number })

  // Make clickable — "BONK!" interaction
  PointerEvents.create(hitbox, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: 'BONK!',
          maxDistance: 5,
          showFeedback: true,
        },
      },
    ],
  })

  const label = createLabel(startX, startZ)

  // Patrol data
  const waypoints = generateWaypoints(5)
  NpcWaypoints.create(root, {
    points: waypoints,
    count: 5,
  })

  NpcPatrol.create(root, {
    waypointIndex: 0,
    speed: 1.0 + Math.random() * 0.8,
    isKnockedOut: false,
    knockoutTimer: 0,
    labelEntity: label as number,
    visualEntity: visual as number,
  })

  aliveCount++
  return root
}

/** Spawn all NPC Doges */
export function spawnAllNpcs(count: number = 8): Entity[] {
  NPC_TOTAL = count
  const npcs: Entity[] = []
  for (let i = 0; i < count; i++) {
    npcs.push(spawnNpc(i))
  }
  return npcs
}

/** Decrement alive count (called from combat) */
export function decrementAlive(): void {
  aliveCount = Math.max(0, aliveCount - 1)
}

/** NPC patrol system — moves NPCs between waypoints, updates label position */
export function npcPatrolSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(NpcPatrol, NpcWaypoints, Transform)) {
    const patrol = NpcPatrol.getMutable(entity)
    const waypoints = NpcWaypoints.get(entity)
    const transform = Transform.getMutable(entity)

    // If knocked out, stay down permanently
    if (patrol.isKnockedOut) {
      continue
    }

    const idx = patrol.waypointIndex
    if (idx >= waypoints.count) {
      patrol.waypointIndex = 0
      continue
    }

    const targetX = waypoints.points[idx * 2]
    const targetZ = waypoints.points[idx * 2 + 1]
    const target = Vector3.create(targetX, 0, targetZ)

    const current = transform.position
    const direction = Vector3.subtract(target, current)
    const distance = Vector3.length(direction)

    if (distance < 0.3) {
      patrol.waypointIndex = (idx + 1) % waypoints.count
    } else {
      const normalized = Vector3.normalize(direction)
      const step = patrol.speed * dt
      transform.position = Vector3.create(
        current.x + normalized.x * step,
        0,
        current.z + normalized.z * step
      )

      // Face movement direction
      const angle = Math.atan2(normalized.x, normalized.z)
      transform.rotation = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }
    }

    // Update label position to follow NPC
    if (patrol.labelEntity) {
      const labelTransform = Transform.getMutable(patrol.labelEntity as Entity)
      labelTransform.position = Vector3.create(
        transform.position.x,
        NPC_LABEL_Y,
        transform.position.z
      )
    }
  }
}
