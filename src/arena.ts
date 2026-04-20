/**
 * arena.ts — Neon-noir arena construction
 * Dark floor, glowing walls, pillars, corridors for line-of-sight blocking.
 * 3x3 parcels = 48m x 48m
 */
import {
  engine, Entity, Transform,
  MeshRenderer, MeshCollider, Material
} from '@dcl/sdk/ecs'
import { Vector3, Color3, Color4 } from '@dcl/sdk/math'

// --- Color palette (matches pitch deck) ---
const NEON_CYAN = Color3.create(0, 0.96, 1)
const NEON_PINK = Color3.create(1, 0.18, 0.59)
const NEON_YELLOW = Color3.create(1, 0.84, 0)
const NEON_GREEN = Color3.create(0.22, 1, 0.08)
const DARK_FLOOR = Color4.create(0.04, 0.04, 0.04, 1)
const WALL_COLOR = Color4.create(0.08, 0.08, 0.12, 1)

function createBox(
  pos: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: Color4,
  emissive?: Color3,
  emissiveIntensity?: number
): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(pos.x, pos.y, pos.z),
    scale: Vector3.create(scale.x, scale.y, scale.z),
  })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    emissiveColor: emissive ?? Color3.create(0, 0, 0),
    emissiveIntensity: emissiveIntensity ?? 0,
    metallic: 0.1,
    roughness: 0.8,
  })
  return entity
}

function createNeonStrip(
  pos: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: Color3,
  intensity: number = 5
): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(pos.x, pos.y, pos.z),
    scale: Vector3.create(scale.x, scale.y, scale.z),
  })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(color.r, color.g, color.b, 1),
    emissiveColor: color,
    emissiveIntensity: intensity,
    metallic: 0,
    roughness: 0.2,
  })
  return entity
}

export function buildArena(): void {
  const CX = 24 // center of 3x3 parcels
  const CZ = 24
  const ARENA_SIZE = 44 // playable area (48 - 2m margin each side)
  const HALF = ARENA_SIZE / 2
  const WALL_H = 4
  const WALL_THICK = 0.4

  // --- Floor ---
  createBox(
    { x: CX, y: 0, z: CZ },
    { x: ARENA_SIZE, y: 0.1, z: ARENA_SIZE },
    DARK_FLOOR
  )

  // Neon grid lines on floor (X direction)
  for (let i = -HALF; i <= HALF; i += 4) {
    createNeonStrip(
      { x: CX + i, y: 0.06, z: CZ },
      { x: 0.04, y: 0.02, z: ARENA_SIZE },
      NEON_CYAN, 2
    )
  }
  // Neon grid lines on floor (Z direction)
  for (let i = -HALF; i <= HALF; i += 4) {
    createNeonStrip(
      { x: CX, y: 0.06, z: CZ + i },
      { x: ARENA_SIZE, y: 0.02, z: 0.04 },
      NEON_CYAN, 2
    )
  }

  // --- Perimeter walls ---
  // North
  createBox({ x: CX, y: WALL_H / 2, z: CZ + HALF }, { x: ARENA_SIZE, y: WALL_H, z: WALL_THICK }, WALL_COLOR)
  createNeonStrip({ x: CX, y: 0.3, z: CZ + HALF - 0.15 }, { x: ARENA_SIZE, y: 0.08, z: 0.05 }, NEON_PINK, 6)
  // South
  createBox({ x: CX, y: WALL_H / 2, z: CZ - HALF }, { x: ARENA_SIZE, y: WALL_H, z: WALL_THICK }, WALL_COLOR)
  createNeonStrip({ x: CX, y: 0.3, z: CZ - HALF + 0.15 }, { x: ARENA_SIZE, y: 0.08, z: 0.05 }, NEON_PINK, 6)
  // East
  createBox({ x: CX + HALF, y: WALL_H / 2, z: CZ }, { x: WALL_THICK, y: WALL_H, z: ARENA_SIZE }, WALL_COLOR)
  createNeonStrip({ x: CX + HALF - 0.15, y: 0.3, z: CZ }, { x: 0.05, y: 0.08, z: ARENA_SIZE }, NEON_CYAN, 6)
  // West
  createBox({ x: CX - HALF, y: WALL_H / 2, z: CZ }, { x: WALL_THICK, y: WALL_H, z: ARENA_SIZE }, WALL_COLOR)
  createNeonStrip({ x: CX - HALF + 0.15, y: 0.3, z: CZ }, { x: 0.05, y: 0.08, z: ARENA_SIZE }, NEON_CYAN, 6)

  // --- Interior pillars (sparse layout for open feel) ---
  const pillarPositions = [
    // 4 inner pillars
    { x: CX - 8, z: CZ - 8 },
    { x: CX + 8, z: CZ - 8 },
    { x: CX - 8, z: CZ + 8 },
    { x: CX + 8, z: CZ + 8 },
    // 4 outer pillars (cardinal directions)
    { x: CX - 16, z: CZ },
    { x: CX + 16, z: CZ },
    { x: CX, z: CZ - 16 },
    { x: CX, z: CZ + 16 },
  ]
  for (const p of pillarPositions) {
    const pillar = engine.addEntity()
    Transform.create(pillar, {
      position: Vector3.create(p.x, WALL_H / 2, p.z),
      scale: Vector3.create(1.4, WALL_H, 1.4),
    })
    MeshRenderer.setCylinder(pillar)
    MeshCollider.setCylinder(pillar)
    Material.setPbrMaterial(pillar, {
      albedoColor: WALL_COLOR,
      metallic: 0.3,
      roughness: 0.6,
    })

    // Neon ring at base
    const ring = engine.addEntity()
    Transform.create(ring, {
      position: Vector3.create(p.x, 0.15, p.z),
      scale: Vector3.create(1.8, 0.1, 1.8),
    })
    MeshRenderer.setCylinder(ring)
    Material.setPbrMaterial(ring, {
      albedoColor: Color4.create(NEON_YELLOW.r, NEON_YELLOW.g, NEON_YELLOW.b, 1),
      emissiveColor: NEON_YELLOW,
      emissiveIntensity: 4,
    })
  }

  // --- Corridor walls (2 L-shaped walls for cover) ---

  // L-shaped wall (northwest)
  createBox({ x: CX - 12, y: WALL_H / 2, z: CZ + 5 }, { x: 6, y: WALL_H, z: WALL_THICK }, WALL_COLOR)
  createNeonStrip({ x: CX - 12, y: 2.5, z: CZ + 5.15 }, { x: 6, y: 0.06, z: 0.04 }, NEON_GREEN, 4)
  createBox({ x: CX - 9, y: WALL_H / 2, z: CZ + 9 }, { x: WALL_THICK, y: WALL_H, z: 8 }, WALL_COLOR)
  createNeonStrip({ x: CX - 9.15, y: 2.5, z: CZ + 9 }, { x: 0.04, y: 0.06, z: 8 }, NEON_GREEN, 4)

  // L-shaped wall (southeast)
  createBox({ x: CX + 12, y: WALL_H / 2, z: CZ - 5 }, { x: 6, y: WALL_H, z: WALL_THICK }, WALL_COLOR)
  createNeonStrip({ x: CX + 12, y: 2.5, z: CZ - 5.15 }, { x: 6, y: 0.06, z: 0.04 }, NEON_PINK, 4)
  createBox({ x: CX + 9, y: WALL_H / 2, z: CZ - 9 }, { x: WALL_THICK, y: WALL_H, z: 8 }, WALL_COLOR)
  createNeonStrip({ x: CX + 9.15, y: 2.5, z: CZ - 9 }, { x: 0.04, y: 0.06, z: 8 }, NEON_PINK, 4)
}
