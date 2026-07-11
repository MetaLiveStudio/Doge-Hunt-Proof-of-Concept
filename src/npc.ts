/**
 * npc.ts — NPC Doge spawning and patrol system
 * NPCs use Muscledoge.glb model. When killed, swap to SmallDoge.glb.
 * Each NPC has a floating "?" label above its head.
 */
import {
  engine, Entity, Transform, Schemas,
  GltfContainer, MeshCollider, TextShape, Billboard, BillboardMode,
  ColliderLayer, Raycast, RaycastQueryType, RaycastResult, Animator,
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { trackNpc } from './gameReset'
import { PLAYER_RUN_SPEED, PLAYER_WALK_SPEED } from './player'
import { getLocalPublicDogeState, recordLocalDogeEliminated } from './localMatchState'
import type { ServerNpcSnapshotPayload } from './shared/serverNpcSnapshot'

// --- Custom components ---

/** NPC patrol state */
export const NpcPatrol = engine.defineComponent('npcPatrol', {
  waypointIndex: Schemas.Int,
  baseSpeed: Schemas.Float,
  speed: Schemas.Float,
  isKnockedOut: Schemas.Boolean,
  isBeingEliminated: Schemas.Boolean,
  knockoutTimer: Schemas.Float,
  eliminationTimer: Schemas.Float,
  eliminationDuration: Schemas.Float,
  eliminationTargetX: Schemas.Float,
  eliminationTargetZ: Schemas.Float,
  labelEntity: Schemas.Int,
  visualEntity: Schemas.Int,
  currentAction: Schemas.Int,
  actionTimer: Schemas.Float,
  actionDuration: Schemas.Float,
  animationState: Schemas.Int,
  jumpHeight: Schemas.Float,
  obstacleProbeEntity: Schemas.Int,
  obstacleBlockedCooldown: Schemas.Float,
  rngState: Schemas.Int,
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
export const NPC_HITBOX_OFFSET = Vector3.create(0, 1.3, 0)
export const NPC_HITBOX_SCALE = Vector3.create(3.2, 3.2, 3.2)
export const NPC_DEAD_VISUAL_SCALE = Vector3.create(0.5, 0.5, 0.5)
const NPC_GROUND_RAY_OFFSET = Vector3.create(0, 6, 0)
const NPC_GROUND_RAY_MAX_DISTANCE = 20
const NPC_OBSTACLE_PROBE_OFFSET = Vector3.create(0, 1.15, 0)
const NPC_OBSTACLE_RAY_MAX_DISTANCE = 1.5
const NPC_OBSTACLE_BLOCK_DISTANCE = 1.1
const NPC_OBSTACLE_REROUTE_COOLDOWN = 0.35
const NPC_IDLE_CLIP = 'idel'
const NPC_WALK_CLIP = 'walk'
const NPC_RUN_CLIP = 'run'
const NPC_JUMP_CLIP = 'jump'
const NPC_BONK_CLIP = 'Bonk'
const NPC_WALK_ANIMATION_SPEED = 0.95
const NPC_RUN_ANIMATION_SPEED = 1.15
const NPC_BONK_ANIMATION_SPEED = 1.55
const NPC_JUMP_ANIMATION_SPEED = 1.05
const NPC_WAYPOINT_REACHED_DISTANCE = 0.3
const NPC_VISUAL_JUMP_MOVE_SPEED = 1.2
const DEAD_DOGE_ANIMATION_CLIP = 'Animation'
const NPC_ELIMINATION_SQUASH_DURATION = 0.25
const NPC_ELIMINATION_MIN_HEIGHT_SCALE = 0.2
const NPC_ELIMINATION_FLATTEN_SCALE = 1.35
const enum NpcAction {
  Idle = 0,
  Walk = 1,
  Run = 2,
  Bonk = 3,
  Jump = 4,
}

// --- Arena bounds ---
const CX = 48
const CZ = 48
const ARENA_HALF = 42
const NPC_LABEL_Y = 3.8
const NPC_LABEL_FONT_SIZE = 3

// --- Alive tracking ---
export let aliveCount = 0
export let NPC_TOTAL = 0

const npcPublicDogeIds = new Map<Entity, string>()

/** Reset NPC counters */
export function resetNpcCounters(): void {
  aliveCount = 0
  NPC_TOTAL = 0
  npcPublicDogeIds.clear()
}

export function getNpcPublicDogeId(entity: Entity): string | null {
  return npcPublicDogeIds.get(entity) ?? null
}

export function getAliveNpcPublicDogeIds(): string[] {
  const ids: string[] = []

  for (const [entity, publicDogeId] of npcPublicDogeIds.entries()) {
    if (!NpcPatrol.has(entity)) continue

    const patrol = NpcPatrol.get(entity)
    if (patrol.isKnockedOut || patrol.isBeingEliminated) continue

    ids.push(publicDogeId)
  }

  return ids
}

export function applyNpcPublicDogePresentation(publicDogeId: string | null, hitOrigin: Vector3): boolean {
  if (!publicDogeId) return false

  const publicDoge = getLocalPublicDogeState(publicDogeId)
  if (!publicDoge || publicDoge.visualState !== 'eliminated') return false

  const npcRoot = getNpcByPublicDogeId(publicDogeId)
  if (!npcRoot || !NpcPatrol.has(npcRoot)) return false

  const patrol = NpcPatrol.get(npcRoot)
  if (patrol.isKnockedOut || patrol.isBeingEliminated) return false

  startNpcElimination(npcRoot, hitOrigin)
  return true
}

export function applyServerNpcSnapshot(payload: ServerNpcSnapshotPayload): void {
  let eliminated = 0
  let stateOnly = 0

  for (const entry of payload.npcs) {
    const npc = getNpcByPublicDogeId(entry.publicDogeId)
    if (!npc || !NpcPatrol.has(npc) || !Transform.has(npc)) continue

    const patrol = NpcPatrol.get(npc)
    const transform = Transform.getMutable(npc)

    if (entry.isEliminated || entry.visualState === 'eliminated') {
      if (!patrol.isKnockedOut && !patrol.isBeingEliminated) {
        recordLocalDogeEliminated(entry.publicDogeId)
        startNpcElimination(npc, transform.position)
        eliminated += 1
      }
      continue
    }

    if (!patrol.isKnockedOut && !patrol.isBeingEliminated) {
      stateOnly += 1
    }
  }

  if (stateOnly > 0 || eliminated > 0) {
    console.log(`[Client][W2] npcStateSnapshot state-only matchId=${payload.matchId} version=${payload.version} observed=${stateOnly} eliminated=${eliminated}`)
  }
}

/** Generate random waypoints within the arena */
function generateWaypoints(count: number, rng: SeededRng): number[] {
  const points: number[] = []
  for (let i = 0; i < count; i++) {
    const x = CX + (nextRandom(rng) - 0.5) * 2 * ARENA_HALF
    const z = CZ + (nextRandom(rng) - 0.5) * 2 * ARENA_HALF
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
    text: '',
    fontSize: NPC_LABEL_FONT_SIZE,
    textColor: Color4.create(1, 0.84, 0, 0.9),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.2,
  })
  Billboard.create(label, { billboardMode: BillboardMode.BM_Y })
  return label
}

type SeededRng = {
  state: number
}

function randomRange(rng: SeededRng, min: number, max: number): number {
  return min + nextRandom(rng) * (max - min)
}

function randomRangeForNpc(entity: Entity, min: number, max: number): number {
  const patrol = NpcPatrol.getMutable(entity)
  const rng: SeededRng = { state: patrol.rngState }
  const value = randomRange(rng, min, max)
  patrol.rngState = rng.state
  return value
}

function nextRandom(rng: SeededRng): number {
  rng.state = (rng.state * 1664525 + 1013904223) >>> 0
  return rng.state / 0x100000000
}

function createNpcSeed(publicDogeId: string, fallbackId: number): number {
  const source = publicDogeId || `local-npc-${fallbackId}`
  let hash = 2166136261

  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createNpcObstacleProbe(root: Entity): Entity {
  const probe = engine.addEntity()
  Transform.create(probe, {
    parent: root,
    position: NPC_OBSTACLE_PROBE_OFFSET,
  })
  Raycast.create(probe, {
    originOffset: Vector3.create(0, 0, 0),
    direction: { $case: 'globalDirection', globalDirection: Vector3.Forward() },
    maxDistance: NPC_OBSTACLE_RAY_MAX_DISTANCE,
    queryType: RaycastQueryType.RQT_HIT_FIRST,
    continuous: true,
    collisionMask: ColliderLayer.CL_PHYSICS,
  })
  return probe
}

function createNpcAnimator(visual: Entity): void {
  Animator.create(visual, {
    states: [
      { clip: NPC_IDLE_CLIP, playing: true, loop: true, speed: 1, weight: 1.0 },
      { clip: NPC_WALK_CLIP, playing: false, loop: true, speed: NPC_WALK_ANIMATION_SPEED, weight: 1.0 },
      { clip: NPC_RUN_CLIP, playing: false, loop: true, speed: NPC_RUN_ANIMATION_SPEED, weight: 1.0 },
      { clip: NPC_BONK_CLIP, playing: false, loop: false, speed: NPC_BONK_ANIMATION_SPEED, weight: 1.0 },
      { clip: NPC_JUMP_CLIP, playing: false, loop: false, speed: NPC_JUMP_ANIMATION_SPEED, weight: 1.0 },
    ],
  })
}

function stopNpcAnimations(visualEntity: Entity): void {
  Animator.stopAllAnimations(visualEntity)
  const animator = Animator.getMutable(visualEntity)
  for (const state of animator.states) {
    state.playing = false
  }
}

function playLoopNpcAnimation(visualEntity: Entity, clipName: string): void {
  stopNpcAnimations(visualEntity)
  const animator = Animator.getMutable(visualEntity)
  const clip = animator.states.find((state) => state.clip === clipName)
  if (!clip) return

  clip.playing = true
  clip.loop = true
  clip.weight = 1.0
}

function playSingleNpcAnimation(visualEntity: Entity, clipName: string): void {
  stopNpcAnimations(visualEntity)
  const animator = Animator.getMutable(visualEntity)
  const clip = animator.states.find((state) => state.clip === clipName)
  if (!clip) return

  clip.playing = false
  clip.loop = false
  clip.weight = 1.0
  Animator.playSingleAnimation(visualEntity, clipName, true)
}

function syncNpcAnimation(entity: Entity): void {
  const patrol = NpcPatrol.getMutable(entity)
  if (!patrol.visualEntity) return

  const visualEntity = patrol.visualEntity as Entity
  if (!Animator.has(visualEntity)) return
  if (patrol.animationState === patrol.currentAction) return
  if (patrol.isBeingEliminated || patrol.isKnockedOut) return

  switch (patrol.currentAction) {
    case NpcAction.Walk:
      playLoopNpcAnimation(visualEntity, NPC_WALK_CLIP)
      break
    case NpcAction.Run:
      playLoopNpcAnimation(visualEntity, NPC_RUN_CLIP)
      break
    case NpcAction.Bonk:
      playSingleNpcAnimation(visualEntity, NPC_BONK_CLIP)
      break
    case NpcAction.Jump:
      playSingleNpcAnimation(visualEntity, NPC_JUMP_CLIP)
      break
    case NpcAction.Idle:
    default:
      playLoopNpcAnimation(visualEntity, NPC_IDLE_CLIP)
      break
  }

  patrol.animationState = patrol.currentAction
}

function setNpcAction(entity: Entity, action: NpcAction, duration: number, speed: number): void {
  const patrol = NpcPatrol.getMutable(entity)
  patrol.currentAction = action
  patrol.actionTimer = duration
  patrol.actionDuration = duration
  patrol.speed = speed
  syncNpcAnimation(entity)
}

function chooseNpcAction(entity: Entity, distanceToTarget: number): void {
  const patrol = NpcPatrol.getMutable(entity)
  const rng: SeededRng = { state: patrol.rngState }
  const roll = nextRandom(rng)
  patrol.rngState = rng.state

  if (distanceToTarget > 12) {
    if (roll < 0.58) {
      setNpcAction(entity, NpcAction.Walk, randomRangeForNpc(entity, 2.1, 4.2), PLAYER_WALK_SPEED)
      return
    }
    if (roll < 0.9) {
      setNpcAction(entity, NpcAction.Run, randomRangeForNpc(entity, 1.4, 2.6), PLAYER_RUN_SPEED)
      return
    }
    if (roll < 0.96) {
      setNpcAction(entity, NpcAction.Jump, randomRangeForNpc(entity, 0.9, 1.15), PLAYER_WALK_SPEED)
      return
    }
    if (roll < 0.985) {
      setNpcAction(entity, NpcAction.Idle, randomRangeForNpc(entity, 0.35, 0.75), 0)
      return
    }

    setNpcAction(entity, NpcAction.Bonk, randomRangeForNpc(entity, 0.45, 0.8), 0)
    return
  }

  if (distanceToTarget > 4) {
    if (roll < 0.42) {
      setNpcAction(entity, NpcAction.Walk, randomRangeForNpc(entity, 1.6, 3.2), PLAYER_WALK_SPEED)
      return
    }
    if (roll < 0.64) {
      setNpcAction(entity, NpcAction.Run, randomRangeForNpc(entity, 1.0, 1.9), PLAYER_RUN_SPEED)
      return
    }
    if (roll < 0.79) {
      setNpcAction(entity, NpcAction.Idle, randomRangeForNpc(entity, 0.45, 1.2), 0)
      return
    }
    if (roll < 0.9) {
      setNpcAction(entity, NpcAction.Bonk, randomRangeForNpc(entity, 0.45, 0.85), 0)
      return
    }

    setNpcAction(entity, NpcAction.Jump, randomRangeForNpc(entity, 0.85, 1.1), PLAYER_WALK_SPEED)
    return
  }

  if (roll < 0.42) {
    setNpcAction(entity, NpcAction.Idle, randomRangeForNpc(entity, 0.55, 1.6), 0)
    return
  }
  if (roll < 0.62) {
    setNpcAction(entity, NpcAction.Bonk, randomRangeForNpc(entity, 0.45, 0.9), 0)
    return
  }
  if (roll < 0.8) {
    setNpcAction(entity, NpcAction.Jump, randomRangeForNpc(entity, 0.85, 1.15), PLAYER_WALK_SPEED)
    return
  }
  if (roll < 0.94) {
    setNpcAction(entity, NpcAction.Walk, randomRangeForNpc(entity, 0.9, 1.8), PLAYER_WALK_SPEED)
    return
  }

  setNpcAction(entity, NpcAction.Run, randomRangeForNpc(entity, 0.7, 1.2), PLAYER_RUN_SPEED)
}

function updateNpcVisualOffset(entity: Entity): void {
  const patrol = NpcPatrol.get(entity)
  if (!patrol.visualEntity) return

  const visualTransform = Transform.getMutable(patrol.visualEntity as Entity)
  let offsetY = 0
  let scale = NPC_VISUAL_SCALE

  if (patrol.isBeingEliminated && patrol.eliminationDuration > 0.001) {
    const progress = 1 - Math.max(0, patrol.eliminationTimer) / patrol.eliminationDuration
    const clamped = Math.min(1, Math.max(0, progress))
    const heightScale = 1 - (1 - NPC_ELIMINATION_MIN_HEIGHT_SCALE) * clamped
    const widthScale = 1 + (NPC_ELIMINATION_FLATTEN_SCALE - 1) * clamped
    scale = Vector3.create(
      NPC_VISUAL_SCALE.x * widthScale,
      NPC_VISUAL_SCALE.y * heightScale,
      NPC_VISUAL_SCALE.z * widthScale
    )
    offsetY = NPC_VISUAL_SCALE.y * (1 - heightScale) * 0.5
  }

  visualTransform.scale = scale
  visualTransform.position = Vector3.create(0, offsetY, 0)
}

export function startNpcElimination(npcRoot: Entity, hitOrigin: Vector3): void {
  const patrol = NpcPatrol.getMutable(npcRoot)
  if (patrol.isKnockedOut || patrol.isBeingEliminated) return

  const transform = Transform.getMutable(npcRoot)
  const npcPos = transform.position
  const direction = Vector3.subtract(npcPos, hitOrigin)
  const len = Vector3.length(direction)
  const normalized = len > 0.01
    ? Vector3.normalize(direction)
    : Vector3.create(0, 0, 1)

  const KNOCKBACK_FORCE = 3
  patrol.isBeingEliminated = true
  patrol.eliminationDuration = NPC_ELIMINATION_SQUASH_DURATION
  patrol.eliminationTimer = NPC_ELIMINATION_SQUASH_DURATION
  patrol.eliminationTargetX = npcPos.x + normalized.x * KNOCKBACK_FORCE
  patrol.eliminationTargetZ = npcPos.z + normalized.z * KNOCKBACK_FORCE
  patrol.speed = 0
  patrol.currentAction = NpcAction.Idle
  patrol.actionTimer = 0
  patrol.actionDuration = 0

  if (patrol.visualEntity && Animator.has(patrol.visualEntity as Entity)) {
    Animator.stopAllAnimations(patrol.visualEntity as Entity)
  }
  updateNpcVisualOffset(npcRoot)
}

export function finalizeNpcElimination(npcRoot: Entity): void {
  const transform = Transform.getMutable(npcRoot)
  const patrol = NpcPatrol.getMutable(npcRoot)
  if (!patrol.visualEntity) return

  transform.position = Vector3.create(
    patrol.eliminationTargetX,
    0,
    patrol.eliminationTargetZ
  )

  const visualEntity = patrol.visualEntity as Entity
  const gltf = GltfContainer.getMutable(visualEntity)
  gltf.src = DEAD_DOGE_MODEL
  const visualTransform = Transform.getMutable(visualEntity)
  visualTransform.scale = NPC_DEAD_VISUAL_SCALE
  visualTransform.position = Vector3.create(0, 0, 0)
  if (Animator.has(visualEntity)) {
    Animator.stopAllAnimations(visualEntity)
    Animator.deleteFrom(visualEntity)
  }
  Animator.create(visualEntity, {
    states: [
      { clip: DEAD_DOGE_ANIMATION_CLIP, playing: true, loop: false, speed: 1 },
    ],
  })

  patrol.isBeingEliminated = false
  patrol.isKnockedOut = true
  patrol.knockoutTimer = -1
  patrol.eliminationTimer = 0
  patrol.currentAction = NpcAction.Idle
  patrol.animationState = NpcAction.Idle

  if (patrol.labelEntity) {
    const labelText = TextShape.getMutable(patrol.labelEntity as Entity)
    labelText.text = ''
    const labelTransform = Transform.getMutable(patrol.labelEntity as Entity)
    labelTransform.position = Vector3.create(
      patrol.eliminationTargetX,
      1.5,
      patrol.eliminationTargetZ
    )
  }

  decrementAlive()
}

/** Spawn a single NPC Doge */
function spawnNpc(id: number, publicDogeId: string): Entity {
  const root = engine.addEntity()
  const rng: SeededRng = { state: createNpcSeed(publicDogeId, id) }

  const startX = CX + (nextRandom(rng) - 0.5) * 2 * ARENA_HALF
  const startZ = CZ + (nextRandom(rng) - 0.5) * 2 * ARENA_HALF

  Transform.create(root, {
    position: Vector3.create(startX, 0, startZ),
  })
  Raycast.create(root, {
    originOffset: NPC_GROUND_RAY_OFFSET,
    direction: { $case: 'globalDirection', globalDirection: Vector3.Down() },
    maxDistance: NPC_GROUND_RAY_MAX_DISTANCE,
    queryType: RaycastQueryType.RQT_HIT_FIRST,
    continuous: true,
    collisionMask: ColliderLayer.CL_PHYSICS,
  })

  const visual = engine.addEntity()
  Transform.create(visual, {
    parent: root,
    scale: NPC_VISUAL_SCALE,
  })
  GltfContainer.create(visual, { src: DOGE_MODEL })
  createNpcAnimator(visual)

  const obstacleProbe = createNpcObstacleProbe(root)

  const hitbox = engine.addEntity()
  Transform.create(hitbox, {
    parent: root,
    position: NPC_HITBOX_OFFSET,
    scale: NPC_HITBOX_SCALE,
  })
  MeshCollider.setBox(hitbox, ColliderLayer.CL_POINTER)
  NpcHitbox.create(hitbox, { rootEntity: root as number })

  const label = createLabel(startX, startZ)

  // Patrol data
  const waypoints = generateWaypoints(5, rng)
  NpcWaypoints.create(root, {
    points: waypoints,
    count: 5,
  })

  const baseSpeed = randomRange(rng, 1.15, 1.45)
  const initialIdleDuration = randomRange(rng, 0.4, 1.1)
  NpcPatrol.create(root, {
    waypointIndex: 0,
    baseSpeed,
    speed: 0,
    isKnockedOut: false,
    isBeingEliminated: false,
    knockoutTimer: 0,
    eliminationTimer: 0,
    eliminationDuration: 0,
    eliminationTargetX: startX,
    eliminationTargetZ: startZ,
    labelEntity: label as number,
    visualEntity: visual as number,
    currentAction: NpcAction.Idle,
    actionTimer: initialIdleDuration,
    actionDuration: initialIdleDuration,
    animationState: -1,
    jumpHeight: randomRange(rng, 0.8, 1.1),
    obstacleProbeEntity: obstacleProbe as number,
    obstacleBlockedCooldown: 0,
    rngState: rng.state,
  })
  syncNpcAnimation(root)

  aliveCount++
  trackNpc(root)
  return root
}

/** Spawn all NPC Doges */
export function spawnAllNpcs(count: number = 8, publicDogeIds: string[] = []): Entity[] {
  NPC_TOTAL = count
  npcPublicDogeIds.clear()
  const npcs: Entity[] = []
  for (let i = 0; i < count; i++) {
    const publicDogeId = publicDogeIds[i]
    const npc = spawnNpc(i, publicDogeId ?? '')
    if (publicDogeId) {
      npcPublicDogeIds.set(npc, publicDogeId)
    }
    npcs.push(npc)
  }
  return npcs
}

/** Decrement alive count (called from combat) */
export function decrementAlive(): void {
  aliveCount = Math.max(0, aliveCount - 1)
}

/** DEBUG: Kill all NPCs instantly */
export function killAllNpcs(): void {
  console.log('[DEBUG] Killing all NPCs...')
  for (const [entity] of engine.getEntitiesWith(NpcPatrol, Transform)) {
    const patrol = NpcPatrol.getMutable(entity)
    if (patrol.isKnockedOut) continue
    recordLocalDogeEliminated(getNpcPublicDogeId(entity as Entity))
    
    // Mark as dead
    patrol.isBeingEliminated = false
    patrol.isKnockedOut = true
    patrol.knockoutTimer = -1
    
    // Swap model
    if (patrol.visualEntity) {
      const gltf = GltfContainer.getMutable(patrol.visualEntity as Entity)
      gltf.src = DEAD_DOGE_MODEL
      const visualTransform = Transform.getMutable(patrol.visualEntity as Entity)
      visualTransform.scale = NPC_DEAD_VISUAL_SCALE
      visualTransform.position = Vector3.create(0, 0, 0)
    }
    
    // Update label
    if (patrol.labelEntity) {
      const labelText = TextShape.getMutable(patrol.labelEntity as Entity)
      labelText.text = ''
    }
    
    // Decrement counter
    aliveCount = Math.max(0, aliveCount - 1)
  }
  console.log('[DEBUG] All NPCs killed. Alive count:', aliveCount)
}

/** NPC patrol system — moves NPCs between waypoints, updates label position */
export function getNpcEntityByPublicDogeId(publicDogeId: string): Entity | null {
  for (const [entity, mappedPublicDogeId] of npcPublicDogeIds.entries()) {
    if (mappedPublicDogeId === publicDogeId) {
      return entity
    }
  }

  return null
}

function getNpcByPublicDogeId(publicDogeId: string): Entity | null {
  return getNpcEntityByPublicDogeId(publicDogeId)
}

export function npcPatrolSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(NpcPatrol, NpcWaypoints, Transform)) {
    const patrol = NpcPatrol.getMutable(entity)
    const waypoints = NpcWaypoints.get(entity)
    const transform = Transform.getMutable(entity)

    // If knocked out, stay down permanently
    if (patrol.isKnockedOut) {
      continue
    }

    if (patrol.isBeingEliminated) {
      patrol.eliminationTimer = Math.max(0, patrol.eliminationTimer - dt)
      updateNpcVisualOffset(entity)

      if (patrol.eliminationTimer <= 0) {
        finalizeNpcElimination(entity)
      }
    }

    if (patrol.isKnockedOut) {
      continue
    }

    if (patrol.isBeingEliminated) {
      if (patrol.labelEntity) {
        const labelTransform = Transform.getMutable(patrol.labelEntity as Entity)
        labelTransform.position = Vector3.create(
          transform.position.x,
          transform.position.y + NPC_LABEL_Y,
          transform.position.z
        )
      }
      continue
    }

    const idx = patrol.waypointIndex
    if (idx >= waypoints.count) {
      patrol.waypointIndex = 0
      continue
    }

    const targetX = waypoints.points[idx * 2]
    const targetZ = waypoints.points[idx * 2 + 1]
    const target = Vector3.create(targetX, transform.position.y, targetZ)

    const current = transform.position
    const groundedY = getGroundHeight(entity)
    const groundedCurrent = Vector3.create(current.x, groundedY ?? current.y, current.z)
    if (groundedY !== null) {
      transform.position = groundedCurrent
    }
    const direction = Vector3.subtract(target, groundedCurrent)
    const distance = Vector3.length(direction)
    patrol.obstacleBlockedCooldown = Math.max(0, patrol.obstacleBlockedCooldown - dt)

    patrol.actionTimer = Math.max(0, patrol.actionTimer - dt)
    if (patrol.actionTimer <= 0) {
      chooseNpcAction(entity, distance)
    }

    const canMove =
      patrol.currentAction === NpcAction.Walk ||
      patrol.currentAction === NpcAction.Run ||
      patrol.currentAction === NpcAction.Jump

    if (distance < NPC_WAYPOINT_REACHED_DISTANCE) {
      patrol.waypointIndex = (idx + 1) % waypoints.count
      chooseNpcAction(entity, 0)
    } else if (canMove && patrol.speed > 0.01) {
      const normalized = Vector3.normalize(direction)
      updateNpcObstacleProbeDirection(entity, normalized)
      const obstacleDistance = getObstacleDistance(entity)
      if (obstacleDistance !== null && obstacleDistance <= NPC_OBSTACLE_BLOCK_DISTANCE) {
        if (patrol.obstacleBlockedCooldown <= 0) {
          patrol.obstacleBlockedCooldown = NPC_OBSTACLE_REROUTE_COOLDOWN
          patrol.waypointIndex = (idx + 1) % waypoints.count
          chooseNpcAction(entity, 0)
        }
        updateNpcVisualOffset(entity)
        continue
      }

      const step = patrol.speed * dt
      const nextPosition = Vector3.create(
        groundedCurrent.x + normalized.x * step,
        groundedCurrent.y,
        groundedCurrent.z + normalized.z * step
      )
      transform.position = Vector3.create(
        nextPosition.x,
        groundedY ?? groundedCurrent.y,
        nextPosition.z
      )

      // Face movement direction
      const angle = Math.atan2(normalized.x, normalized.z)
      transform.rotation = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }
    }

    // Tiny forward bob during jumps helps the move read better on mobile.
    if (patrol.currentAction === NpcAction.Jump && patrol.speed < NPC_VISUAL_JUMP_MOVE_SPEED && distance > 1.5) {
      patrol.speed = Math.min(NPC_VISUAL_JUMP_MOVE_SPEED, PLAYER_WALK_SPEED)
    }

    updateNpcVisualOffset(entity)

    // Update label position to follow NPC
    if (patrol.labelEntity) {
      const labelTransform = Transform.getMutable(patrol.labelEntity as Entity)
      labelTransform.position = Vector3.create(
        transform.position.x,
        transform.position.y + NPC_LABEL_Y,
        transform.position.z
      )
    }
  }
}

function getGroundHeight(entity: Entity): number | null {
  const result = RaycastResult.getOrNull(entity)
  if (!result || result.hits.length === 0) return null
  const hit = result.hits[0]
  if (!hit || !hit.position) return null
  return hit.position.y
}

function updateNpcObstacleProbeDirection(entity: Entity, normalizedDirection: Vector3): void {
  const patrol = NpcPatrol.get(entity)
  if (!patrol.obstacleProbeEntity) return
  if (!Raycast.has(patrol.obstacleProbeEntity as Entity)) return

  const probeRaycast = Raycast.getMutable(patrol.obstacleProbeEntity as Entity)
  probeRaycast.direction = {
    $case: 'globalDirection',
    globalDirection: Vector3.create(normalizedDirection.x, 0, normalizedDirection.z),
  }
}

function getObstacleDistance(entity: Entity): number | null {
  const patrol = NpcPatrol.get(entity)
  if (!patrol.obstacleProbeEntity) return null

  const result = RaycastResult.getOrNull(patrol.obstacleProbeEntity as Entity)
  if (!result || result.hits.length === 0) return null
  const hit = result.hits[0]
  if (!hit) return null
  return hit.length
}
