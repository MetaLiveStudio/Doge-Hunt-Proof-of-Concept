import {
  ColliderLayer,
  engine,
  Entity,
  GltfContainer,
  MeshCollider,
  PrimaryPointerInfo,
  Raycast,
  RaycastQueryType,
  RaycastResult,
  Transform,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import {
  findBestRemotePlayerBonkCandidate,
  getRemotePlayerDogeIdByHitbox,
} from './remotePlayerProxies'

export type PlayerBonkAim = {
  publicDogeId: string
  forward: Vector3
  rayLength: number
  source: 'ray' | 'attack-envelope'
}

export type PlayerBonkAttackEnvelope = {
  origin: Vector3
  forward: Vector3
  minForward: number
  range: number
  radius: number
}

const PLAYER_AIM_RAY_DISTANCE = 5
const CAMERA_FALLBACK_HEIGHT = 1.6
const RAY_OBSTRUCTION_TOLERANCE = 0.02

const aimRayEntity = engine.addEntity()
Transform.create(aimRayEntity, { position: Vector3.Zero() })

let latestAim: PlayerBonkAim | null = null
let latestAimDiagnostics = 'ray=unavailable'

/**
 * Updates the single continuous aim ray. Querying all hits lets a real-player
 * hitbox be selected even when an unrelated pointer-only object shares the ray,
 * while physical scenery still blocks targets behind it.
 */
export function updatePlayerBonkTargeting(): void {
  const rayPose = getCurrentAimRayPose()
  const rayTransform = Transform.getMutable(aimRayEntity)
  rayTransform.position = rayPose.origin

  Raycast.createOrReplace(aimRayEntity, {
    direction: {
      $case: 'globalDirection',
      globalDirection: rayPose.forward,
    },
    maxDistance: PLAYER_AIM_RAY_DISTANCE,
    queryType: RaycastQueryType.RQT_QUERY_ALL,
    continuous: true,
    collisionMask: ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS,
  })

  const result = RaycastResult.getOrNull(aimRayEntity)
  const hits = [...(result?.hits ?? [])].sort((left, right) => left.length - right.length)
  const playerHit = hits.find((hit) => {
    return hit.entityId !== undefined && getRemotePlayerDogeIdByHitbox(hit.entityId) !== null
  })

  if (!playerHit || playerHit.entityId === undefined) {
    latestAim = null
    latestAimDiagnostics = `hits=${hits.length} player=none`
    return
  }

  const publicDogeId = getRemotePlayerDogeIdByHitbox(playerHit.entityId)
  const blockingHit = hits.find((hit) => {
    return hit.length + RAY_OBSTRUCTION_TOLERANCE < playerHit.length && isPhysicalBlocker(hit.entityId)
  })
  if (!publicDogeId || blockingHit) {
    latestAim = null
    latestAimDiagnostics = blockingHit
      ? `hits=${hits.length} player=${publicDogeId ?? 'none'} blockedAt=${blockingHit.length.toFixed(2)} playerAt=${playerHit.length.toFixed(2)}`
      : `hits=${hits.length} player=none`
    return
  }

  latestAim = {
    publicDogeId,
    forward: normalizeFlatDirection(result?.direction ?? rayPose.forward),
    rayLength: playerHit.length,
    source: 'ray',
  }
  latestAimDiagnostics = `source=ray hits=${hits.length} player=${publicDogeId} distance=${playerHit.length.toFixed(2)}`
}

/** Freeze the current cross-platform aim at swing start, before the impact frame. */
export function capturePlayerBonkAim(envelope: PlayerBonkAttackEnvelope | null): PlayerBonkAim | null {
  updatePlayerBonkTargeting()
  if (!latestAim && envelope) {
    const candidate = findBestRemotePlayerBonkCandidate(
      envelope.origin,
      envelope.forward,
      envelope.minForward,
      envelope.range,
      envelope.radius
    )
    if (candidate) {
      latestAim = {
        publicDogeId: candidate.publicDogeId,
        forward: normalizeFlatDirection(envelope.forward),
        rayLength: candidate.distance,
        source: 'attack-envelope',
      }
      latestAimDiagnostics = `source=attack-envelope player=${candidate.publicDogeId} distance=${candidate.distance.toFixed(2)} range=${envelope.range.toFixed(2)} radius=${envelope.radius.toFixed(2)}`
    }
  }

  console.log(`[Client][RayBonk] target-acquire ${latestAimDiagnostics}`)
  if (!latestAim) return null

  return {
    publicDogeId: latestAim.publicDogeId,
    forward: Vector3.create(latestAim.forward.x, latestAim.forward.y, latestAim.forward.z),
    rayLength: latestAim.rayLength,
    source: latestAim.source,
  }
}

function isPhysicalBlocker(entityId: number | undefined): boolean {
  if (entityId === undefined) return false

  const entity = entityId as Entity

  const meshCollider = MeshCollider.getOrNull(entity)
  if (meshCollider && ((meshCollider.collisionMask ?? ColliderLayer.CL_NONE) & ColliderLayer.CL_PHYSICS) !== 0) {
    return true
  }

  const gltf = GltfContainer.getOrNull(entity)
  if (!gltf) return false

  return ((gltf.visibleMeshesCollisionMask ?? ColliderLayer.CL_NONE) & ColliderLayer.CL_PHYSICS) !== 0 ||
    ((gltf.invisibleMeshesCollisionMask ?? ColliderLayer.CL_NONE) & ColliderLayer.CL_PHYSICS) !== 0
}

function getCurrentAimRayPose(): { origin: Vector3; forward: Vector3 } {
  const cameraTransform = Transform.getOrNull(engine.CameraEntity)
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  const pointerInfo = PrimaryPointerInfo.getOrNull(engine.RootEntity)
  const pointerDirection = pointerInfo?.worldRayDirection

  const origin = cameraTransform
    ? Vector3.create(cameraTransform.position.x, cameraTransform.position.y, cameraTransform.position.z)
    : playerTransform
      ? Vector3.create(playerTransform.position.x, playerTransform.position.y + CAMERA_FALLBACK_HEIGHT, playerTransform.position.z)
      : Vector3.create(48, CAMERA_FALLBACK_HEIGHT, 48)

  const cameraForward = cameraTransform
    ? Vector3.rotate(Vector3.Forward(), cameraTransform.rotation)
    : playerTransform
      ? Vector3.rotate(Vector3.Forward(), playerTransform.rotation)
      : Vector3.Forward()

  const forward = pointerDirection
    ? Vector3.create(pointerDirection.x, pointerDirection.y, pointerDirection.z)
    : cameraForward

  return {
    origin,
    forward: normalizeDirection(forward),
  }
}

function normalizeDirection(direction: Vector3): Vector3 {
  return Vector3.length(direction) > 0.001 ? Vector3.normalize(direction) : Vector3.Forward()
}

function normalizeFlatDirection(direction: Vector3): Vector3 {
  const flat = Vector3.create(direction.x, 0, direction.z)
  return Vector3.length(flat) > 0.001 ? Vector3.normalize(flat) : Vector3.Forward()
}
