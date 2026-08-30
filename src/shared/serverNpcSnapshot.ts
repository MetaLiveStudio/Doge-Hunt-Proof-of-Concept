import type { PublicDogeVisualState } from '../localMatchState'

export type ServerNpcSnapshotEntry = {
  publicDogeId: string
  x: number
  z: number
  yawDegrees: number
  action: ServerNpcPresentationAction | 'eliminated'
  isEliminated: boolean
  visualState: PublicDogeVisualState
}

export type ServerNpcSnapshotPayload = {
  source: 'server'
  matchId: string
  version: number
  elapsedSeconds: number
  isFrozen: boolean
  npcs: ServerNpcSnapshotEntry[]
}

type SeededRng = {
  state: number
}

export type ServerNpcPresentationAction = 'idle' | 'walk' | 'run' | 'jump' | 'bonk'

type ServerNpcActionPlan = {
  primaryAction: ServerNpcPresentationAction
  primaryDuration: number
  primarySpeed: number
}

const CX = 48
const CZ = 48
const NPC_ACTIVITY_RADIUS = 36
const WAYPOINT_COUNT = 5
const WALK_SPEED = 6
const RUN_SPEED = 10
const ACTION_CYCLE_SECONDS = 3

export function createServerNpcSnapshot(input: {
  matchId: string
  version: number
  elapsedSeconds: number
  isFrozen: boolean
  publicDoges: {
    publicDogeId: string
    isEliminated: boolean
    visualState: PublicDogeVisualState
  }[]
}): ServerNpcSnapshotPayload {
  return {
    source: 'server',
    matchId: input.matchId,
    version: input.version,
    elapsedSeconds: input.elapsedSeconds,
    isFrozen: input.isFrozen,
    npcs: input.publicDoges.map((doge, index) => {
      const transform = getServerNpcTransform(doge.publicDogeId, index, input.elapsedSeconds)

      return {
        publicDogeId: doge.publicDogeId,
        x: transform.x,
        z: transform.z,
        yawDegrees: transform.yawDegrees,
        action: doge.isEliminated
          ? 'eliminated'
          : input.isFrozen
            ? 'idle'
          : getServerNpcPresentationAction(doge.publicDogeId, index, input.elapsedSeconds),
        isEliminated: doge.isEliminated,
        visualState: doge.visualState,
      }
    }),
  }
}

export function parseServerNpcSnapshotPayload(payloadJson: string): ServerNpcSnapshotPayload | null {
  try {
    const parsed = JSON.parse(payloadJson) as Partial<ServerNpcSnapshotPayload>
    if (!isRecord(parsed)) return null
    if (parsed.source !== 'server') return null
    if (typeof parsed.matchId !== 'string') return null
    if (typeof parsed.version !== 'number') return null
    if (typeof parsed.elapsedSeconds !== 'number') return null
    if (typeof parsed.isFrozen !== 'boolean') return null
    if (!Array.isArray(parsed.npcs)) return null

    const npcs: ServerNpcSnapshotEntry[] = []
    for (const entry of parsed.npcs) {
      if (!isRecord(entry)) return null
      if (typeof entry.publicDogeId !== 'string') return null
      if (typeof entry.x !== 'number') return null
      if (typeof entry.z !== 'number') return null
      if (typeof entry.yawDegrees !== 'number') return null
      if (!isServerNpcSnapshotAction(entry.action)) return null
      if (typeof entry.isEliminated !== 'boolean') return null
      if (!isPublicDogeVisualState(entry.visualState)) return null

      npcs.push({
        publicDogeId: entry.publicDogeId,
        x: entry.x,
        z: entry.z,
        yawDegrees: entry.yawDegrees,
        action: entry.action,
        isEliminated: entry.isEliminated,
        visualState: entry.visualState,
      })
    }

    return {
      source: 'server',
      matchId: parsed.matchId,
      version: parsed.version,
      elapsedSeconds: parsed.elapsedSeconds,
      isFrozen: parsed.isFrozen,
      npcs,
    }
  } catch (error) {
    console.log('[Shared][W2] Failed to parse NPC snapshot:', error)
    return null
  }
}

export function getServerNpcTransform(publicDogeId: string, fallbackId: number, elapsedSeconds: number): {
  x: number
  z: number
  yawDegrees: number
} {
  const rng: SeededRng = { state: createNpcSeed(publicDogeId, fallbackId) }
  const start = randomPoint(rng)
  const waypoints = [start]

  for (let i = 0; i < WAYPOINT_COUNT; i++) {
    waypoints.push(randomPoint(rng))
  }

  let routeLength = 0
  for (let i = 0; i < waypoints.length; i++) {
    const from = waypoints[i]
    const to = waypoints[(i + 1) % waypoints.length]
    const dx = to.x - from.x
    const dz = to.z - from.z
    routeLength += Math.max(0.001, Math.sqrt(dx * dx + dz * dz))
  }

  let remainingDistance = getServerNpcTravelDistance(publicDogeId, fallbackId, elapsedSeconds) % routeLength
  for (let i = 0; i < waypoints.length; i++) {
    const from = waypoints[i]
    const to = waypoints[(i + 1) % waypoints.length]
    const dx = to.x - from.x
    const dz = to.z - from.z
    const segmentLength = Math.max(0.001, Math.sqrt(dx * dx + dz * dz))

    if (remainingDistance <= segmentLength) {
      const t = remainingDistance / segmentLength
      return {
        x: from.x + dx * t,
        z: from.z + dz * t,
        yawDegrees: Math.atan2(dx, dz) * (180 / Math.PI),
      }
    }

    remainingDistance -= segmentLength
  }

  return {
    x: start.x,
    z: start.z,
    yawDegrees: 0,
  }
}

export function getServerNpcPresentationAction(
  publicDogeId: string,
  fallbackId: number,
  elapsedSeconds: number
): ServerNpcPresentationAction {
  return getServerNpcMotionState(publicDogeId, fallbackId, elapsedSeconds).action
}

function getServerNpcTravelDistance(
  publicDogeId: string,
  fallbackId: number,
  elapsedSeconds: number
): number {
  const seed = createNpcSeed(publicDogeId, fallbackId)
  const phaseOffset = getNpcActionPhaseOffset(seed)
  const clampedElapsed = Math.max(0, elapsedSeconds)

  return integrateNpcTravelDistance(seed, clampedElapsed + phaseOffset)
    - integrateNpcTravelDistance(seed, phaseOffset)
}

function getServerNpcMotionState(
  publicDogeId: string,
  fallbackId: number,
  elapsedSeconds: number
): { action: ServerNpcPresentationAction; speed: number } {
  const seed = createNpcSeed(publicDogeId, fallbackId)
  const timeline = Math.max(0, elapsedSeconds) + getNpcActionPhaseOffset(seed)
  const cycleIndex = Math.floor(timeline / ACTION_CYCLE_SECONDS)
  const cycleElapsed = timeline - cycleIndex * ACTION_CYCLE_SECONDS
  const plan = getNpcActionPlan(seed, cycleIndex)

  if (cycleElapsed < plan.primaryDuration) {
    return {
      action: plan.primaryAction,
      speed: plan.primarySpeed,
    }
  }

  return {
    action: 'walk',
    speed: WALK_SPEED,
  }
}

function integrateNpcTravelDistance(seed: number, timeline: number): number {
  if (timeline <= 0) return 0

  const fullCycles = Math.floor(timeline / ACTION_CYCLE_SECONDS)
  let distance = 0
  for (let cycleIndex = 0; cycleIndex < fullCycles; cycleIndex++) {
    distance += getNpcActionCycleDistance(getNpcActionPlan(seed, cycleIndex), ACTION_CYCLE_SECONDS)
  }

  const partialSeconds = timeline - fullCycles * ACTION_CYCLE_SECONDS
  distance += getNpcActionCycleDistance(getNpcActionPlan(seed, fullCycles), partialSeconds)
  return distance
}

function getNpcActionCycleDistance(plan: ServerNpcActionPlan, duration: number): number {
  const primarySeconds = Math.min(duration, plan.primaryDuration)
  const walkSeconds = Math.max(0, duration - plan.primaryDuration)
  return primarySeconds * plan.primarySpeed + walkSeconds * WALK_SPEED
}

function getNpcActionPlan(seed: number, cycleIndex: number): ServerNpcActionPlan {
  const rng: SeededRng = {
    state: (seed ^ Math.imul(cycleIndex + 1, 0x9e3779b9)) >>> 0,
  }
  const roll = nextRandom(rng)

  if (roll < 0.18) {
    return { primaryAction: 'bonk', primaryDuration: 0.75, primarySpeed: 0 }
  }
  if (roll < 0.4) {
    return { primaryAction: 'jump', primaryDuration: 1, primarySpeed: WALK_SPEED }
  }
  if (roll < 0.55) {
    return { primaryAction: 'idle', primaryDuration: 0.8, primarySpeed: 0 }
  }
  if (roll < 0.75) {
    return { primaryAction: 'run', primaryDuration: 1.4, primarySpeed: RUN_SPEED }
  }

  return { primaryAction: 'walk', primaryDuration: ACTION_CYCLE_SECONDS, primarySpeed: WALK_SPEED }
}

function getNpcActionPhaseOffset(seed: number): number {
  return ((seed >>> 8) % 1000) / 1000 * ACTION_CYCLE_SECONDS
}

function randomPoint(rng: SeededRng): { x: number; z: number } {
  const angle = nextRandom(rng) * Math.PI * 2
  const radius = Math.sqrt(nextRandom(rng)) * NPC_ACTIVITY_RADIUS

  return {
    x: CX + Math.cos(angle) * radius,
    z: CZ + Math.sin(angle) * radius,
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPublicDogeVisualState(value: unknown): value is PublicDogeVisualState {
  return value === 'doge' || value === 'rock' || value === 'eliminated'
}

function isServerNpcSnapshotAction(value: unknown): value is ServerNpcSnapshotEntry['action'] {
  return value === 'idle'
    || value === 'walk'
    || value === 'run'
    || value === 'jump'
    || value === 'bonk'
    || value === 'eliminated'
}
