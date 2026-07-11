import type { PublicDogeVisualState } from '../localMatchState'

export type ServerNpcSnapshotEntry = {
  publicDogeId: string
  x: number
  z: number
  yawDegrees: number
  action: 'walk' | 'eliminated'
  isEliminated: boolean
  visualState: PublicDogeVisualState
}

export type ServerNpcSnapshotPayload = {
  source: 'server'
  matchId: string
  version: number
  elapsedSeconds: number
  npcs: ServerNpcSnapshotEntry[]
}

type SeededRng = {
  state: number
}

const CX = 48
const CZ = 48
const ARENA_HALF = 42
const WAYPOINT_COUNT = 5
const WALK_SPEED = 6

export function createServerNpcSnapshot(input: {
  matchId: string
  version: number
  elapsedSeconds: number
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
    npcs: input.publicDoges.map((doge, index) => {
      const transform = getDeterministicNpcTransform(doge.publicDogeId, index, input.elapsedSeconds)

      return {
        publicDogeId: doge.publicDogeId,
        x: transform.x,
        z: transform.z,
        yawDegrees: transform.yawDegrees,
        action: doge.isEliminated ? 'eliminated' : 'walk',
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
    if (!Array.isArray(parsed.npcs)) return null

    const npcs: ServerNpcSnapshotEntry[] = []
    for (const entry of parsed.npcs) {
      if (!isRecord(entry)) return null
      if (typeof entry.publicDogeId !== 'string') return null
      if (typeof entry.x !== 'number') return null
      if (typeof entry.z !== 'number') return null
      if (typeof entry.yawDegrees !== 'number') return null
      if (entry.action !== 'walk' && entry.action !== 'eliminated') return null
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
      npcs,
    }
  } catch (error) {
    console.log('[Shared][W2] Failed to parse NPC snapshot:', error)
    return null
  }
}

function getDeterministicNpcTransform(publicDogeId: string, fallbackId: number, elapsedSeconds: number): {
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

  let remainingDistance = Math.max(0, elapsedSeconds) * WALK_SPEED
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

function randomPoint(rng: SeededRng): { x: number; z: number } {
  return {
    x: CX + (nextRandom(rng) - 0.5) * 2 * ARENA_HALF,
    z: CZ + (nextRandom(rng) - 0.5) * 2 * ARENA_HALF,
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
