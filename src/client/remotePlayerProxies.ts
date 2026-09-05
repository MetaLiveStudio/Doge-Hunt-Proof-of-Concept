import {
  Animator,
  Billboard,
  BillboardMode,
  engine,
  Entity,
  GltfContainer,
  ColliderLayer,
  MeshCollider,
  PlayerIdentityData,
  TextShape,
  Transform,
  type TransformType,
  VisibilityComponent,
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import type { PublicDogeVisualState } from '../localMatchState'
import type { ServerPublicPlayerState } from '../shared/serverPublicState'
import {
  getLocalServerAddress,
  isLocalSpectatorPresentation,
  getServerPublicMatchSnapshot,
} from './serverPublicStateClient'
import {
  PLAYER_ATTACK_ANIMATION_SPEED,
  PLAYER_ATTACK_TOTAL_DURATION,
} from '../player'

type RemotePlayerProxy = {
  root: Entity
  dogeVisual: Entity
  rockVisual: Entity
  nameLabel: Entity
  playerHitbox: Entity
  publicDogeId: string
  playerHitboxEnabled: boolean
  address: string
  lastVisualState: PublicDogeVisualState | 'hidden'
  eliminationVisualState: 'none' | 'squash' | 'small' | 'done'
  eliminationTimer: number
  eliminationSmallTimer: number
  wasTransformVisible: boolean
  missingTransformLogCooldown: number
  lastPosition: Vector3 | null
  planarSpeed: number
  jumpTimer: number
  bonkTimer: number
  bonks: number
  lastBonkActionEventId: string
  currentAnimation: string
  lastPoseVersion: number
  poseStartPosition: Vector3
  poseStartRotation: Quaternion
  poseTargetPosition: Vector3
  poseTargetRotation: Quaternion
  poseBlendElapsed: number
  lastMovementRotation: Quaternion
  keepMovementFacing: boolean
}

type RemoteTransform = {
  position: Vector3
  rotation: Quaternion
  source?: 'peer' | 'server'
}

const DESKTOP_DOGE_MODEL = 'models/Muscledoge.glb'
const MOBILE_DOGE_MODEL = 'models/MuscledogeMobile2.glb'
const ROCK_MODEL = 'models/Moonstone.glb'
const DEAD_DOGE_MODEL = 'models/SmallDoge.glb'
const DESKTOP_DOGE_SCALE = Vector3.create(1.5, 1.5, 1.5)
const MOBILE_DOGE_SCALE = Vector3.create(1.05, 1.05, 1.05)
const ROCK_SCALE = Vector3.create(1, 1, 1)
const DEAD_DOGE_SCALE = Vector3.create(0.5, 0.5, 0.5)
const ROCK_OFFSET = Vector3.create(0, -0.3, 0)
const HIDDEN_POSITION = Vector3.create(0, -20, 0)
const MISSING_TRANSFORM_LOG_SECONDS = 2

function getDogeModelSrc(): string {
  return isMobile() ? MOBILE_DOGE_MODEL : DESKTOP_DOGE_MODEL
}

function getDogeScale(): Vector3 {
  return isMobile() ? MOBILE_DOGE_SCALE : DESKTOP_DOGE_SCALE
}

function disableGltfCollision(entity: Entity): void {
  if (!GltfContainer.has(entity)) return

  const gltf = GltfContainer.getMutable(entity)
  gltf.visibleMeshesCollisionMask = ColliderLayer.CL_NONE
  gltf.invisibleMeshesCollisionMask = ColliderLayer.CL_NONE
}

const REMOTE_ATTACK_ANIMATION_SECONDS = PLAYER_ATTACK_TOTAL_DURATION
const REMOTE_JUMP_ANIMATION_SECONDS = 0.6
const REMOTE_IDLE_SPEED_THRESHOLD = 0.15
const REMOTE_RUN_SPEED_THRESHOLD = 8
const REMOTE_SPEED_SMOOTHING = 12
const REMOTE_POSE_INTERPOLATION_SECONDS = 0.2
const REMOTE_LIVE_POSE_FOLLOW_SPEED = 30
const REMOTE_TELEPORT_DISTANCE = 6
// Per-frame presentation movement is small at normal frame rates. Keep this
// below a gentle player step so the final heading is never discarded.
const REMOTE_MOVEMENT_FACING_MIN_DISTANCE = 0.001
const REMOTE_JUMP_MIN_DELTA_Y = 0.06
const REMOTE_JUMP_MIN_VERTICAL_SPEED = 0.45
const REMOTE_ELIMINATION_SQUASH_SECONDS = 0.25
const REMOTE_ELIMINATION_SMALL_DOGE_SECONDS = 0.55
const REMOTE_ELIMINATION_MIN_HEIGHT_SCALE = 0.2
const REMOTE_ELIMINATION_FLATTEN_SCALE = 1.35
const REMOTE_PLAYER_HITBOX_POSITION = Vector3.create(0, 1.75, 0)
const REMOTE_PLAYER_HITBOX_SCALE = Vector3.create(1.45, 3.1, 1.45)

const PLAYER_IDLE_CLIP = 'idel'
const PLAYER_WALK_CLIP = 'walk'
const PLAYER_RUN_CLIP = 'run'
const PLAYER_JUMP_CLIP = 'jump'
const PLAYER_ATTACK_CLIP = 'Bonk'
const remoteProxies = new Map<string, RemotePlayerProxy>()

export function syncRemotePlayerProxies(dt: number): void {
  const snapshot = getServerPublicMatchSnapshot()
  if (!snapshot) {
    hideAllRemotePlayerProxies()
    return
  }

  const localAddress = getLocalServerAddress()
  const activeRemoteAddresses = new Set<string>()

  for (const player of snapshot.players) {
    const address = normalizeAddress(player.address)
    if (!address) continue
    if (localAddress && address === localAddress) continue

    activeRemoteAddresses.add(address)
    const proxy = getOrCreateRemotePlayerProxy(player)
    const remoteTransform = findRemotePlayerTransform(player)
    if (isRemotePlayerEliminated(player)) {
      updateRemotePlayerElimination(proxy, remoteTransform, dt)
      continue
    }

    const visualState = getRemotePlayerVisualState(player)

    if (!remoteTransform || visualState === 'hidden') {
      hideRemotePlayerProxy(proxy)
      logMissingRemoteTransform(proxy, dt, remoteTransform, visualState)
      continue
    }

    const rootTransform = Transform.getMutable(proxy.root)
    updateRemotePresentationTransform(proxy, rootTransform, remoteTransform, snapshot.version, dt)

    updateRemoteProxyMotion(proxy, player, {
      position: rootTransform.position,
      rotation: rootTransform.rotation,
    }, dt)
    showRemotePlayerProxy(proxy, visualState)
  }

  for (const [address, proxy] of remoteProxies.entries()) {
    if (!activeRemoteAddresses.has(address)) {
      hideRemotePlayerProxy(proxy)
    }
  }
}

export function cleanupRemotePlayerProxies(): void {
  for (const proxy of remoteProxies.values()) {
    engine.removeEntity(proxy.dogeVisual)
    engine.removeEntity(proxy.rockVisual)
    engine.removeEntity(proxy.nameLabel)
    engine.removeEntity(proxy.playerHitbox)
    engine.removeEntity(proxy.root)
  }

  remoteProxies.clear()
}

export function playRemotePlayerBonkAction(address: string, eventId: string): boolean {
  const normalizedAddress = normalizeAddress(address)
  const proxy = getRemotePlayerProxyByAddress(normalizedAddress)
  if (!proxy) {
    console.log(`[Client][W3f] remote proxy bonk-start ignored missing-proxy address=${normalizedAddress} eventId=${eventId}`)
    return false
  }

  if (eventId && proxy.lastBonkActionEventId === eventId) return false

  proxy.lastBonkActionEventId = eventId
  triggerRemoteBonkAnimation(proxy)
  console.log(`[Client][W3f] remote proxy bonk-start address=${normalizedAddress} eventId=${eventId}`)
  return true
}

/** Maps the current raycast hitbox back to an authoritative public Doge ID. */
export function getRemotePlayerDogeIdByHitbox(hitboxId: number): string | null {
  for (const proxy of remoteProxies.values()) {
    if ((proxy.playerHitbox as unknown as number) === hitboxId && proxy.playerHitboxEnabled) {
      return proxy.publicDogeId
    }
  }

  return null
}

export type RemotePlayerBonkCandidate = {
  publicDogeId: string
  distance: number
}

/**
 * Finds the nearest active remote player inside the same body-forward melee
 * envelope used by local NPC candidate selection. The server still validates
 * the returned exact player against its authoritative Transform.
 */
export function findBestRemotePlayerBonkCandidate(
  origin: Vector3,
  forward: Vector3,
  minForward: number,
  range: number,
  radius: number
): RemotePlayerBonkCandidate | null {
  let bestCandidate: RemotePlayerBonkCandidate | null = null

  for (const proxy of remoteProxies.values()) {
    if (!proxy.playerHitboxEnabled || proxy.lastVisualState === 'hidden') continue

    const transform = Transform.getOrNull(proxy.root)
    if (!transform) continue

    const toPlayer = Vector3.subtract(transform.position, origin)
    const flatToPlayer = Vector3.create(toPlayer.x, 0, toPlayer.z)
    const forwardDistance = Vector3.dot(flatToPlayer, forward)
    if (forwardDistance < minForward || forwardDistance > range) continue

    const projected = Vector3.scale(forward, forwardDistance)
    const lateralOffset = Vector3.subtract(flatToPlayer, projected)
    if (Vector3.length(lateralOffset) > radius) continue

    const distance = Vector3.length(flatToPlayer)
    if (!bestCandidate || distance < bestCandidate.distance) {
      bestCandidate = {
        publicDogeId: proxy.publicDogeId,
        distance,
      }
    }
  }

  return bestCandidate
}

function getOrCreateRemotePlayerProxy(player: ServerPublicPlayerState): RemotePlayerProxy {
  const address = normalizeAddress(player.address)
  const existing = remoteProxies.get(address)
  if (existing) {
    existing.publicDogeId = player.publicDogeId
    return existing
  }

  const root = engine.addEntity()
  Transform.create(root, {
    position: HIDDEN_POSITION,
  })

  const dogeVisual = engine.addEntity()
  Transform.create(dogeVisual, {
    parent: root,
    position: Vector3.Zero(),
    scale: getDogeScale(),
  })
  GltfContainer.create(dogeVisual, {
    src: getDogeModelSrc(),
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE,
  })
  disableGltfCollision(dogeVisual)
  VisibilityComponent.create(dogeVisual, { visible: false })

  const nameLabel = engine.addEntity()
  Transform.create(nameLabel, {
    parent: root,
    position: Vector3.create(0, isMobile() ? 3.1 : 4.1, 0),
  })
  TextShape.create(nameLabel, {
    text: player.displayName,
    fontSize: isMobile() ? 1.5 : 1.8,
    textColor: Color4.create(0, 0.96, 1, 1),
    outlineColor: Color4.Black(),
    outlineWidth: 0.2,
  })
  Billboard.create(nameLabel, { billboardMode: BillboardMode.BM_Y })
  VisibilityComponent.create(nameLabel, { visible: false })

  const playerHitbox = engine.addEntity()
  Transform.create(playerHitbox, {
    parent: root,
    position: REMOTE_PLAYER_HITBOX_POSITION,
    scale: REMOTE_PLAYER_HITBOX_SCALE,
  })
  Animator.create(dogeVisual, {
    states: [
      {
        clip: PLAYER_IDLE_CLIP,
        playing: true,
        loop: true,
        speed: 1,
        weight: 1.0,
      },
      {
        clip: PLAYER_WALK_CLIP,
        playing: false,
        loop: true,
        speed: 1,
        weight: 1.0,
      },
      {
        clip: PLAYER_RUN_CLIP,
        playing: false,
        loop: true,
        speed: 1.15,
        weight: 1.0,
      },
      {
        clip: PLAYER_JUMP_CLIP,
        playing: false,
        loop: false,
        speed: 1,
        weight: 1.0,
      },
      {
        clip: PLAYER_ATTACK_CLIP,
        playing: false,
        loop: false,
        speed: PLAYER_ATTACK_ANIMATION_SPEED,
        weight: 1.0,
      },
    ],
  })

  const rockVisual = engine.addEntity()
  Transform.create(rockVisual, {
    parent: root,
    position: ROCK_OFFSET,
    scale: ROCK_SCALE,
  })
  GltfContainer.create(rockVisual, {
    src: ROCK_MODEL,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE,
  })
  disableGltfCollision(rockVisual)
  VisibilityComponent.create(rockVisual, { visible: false })

  const proxy: RemotePlayerProxy = {
    root,
    dogeVisual,
    rockVisual,
    nameLabel,
    playerHitbox,
    publicDogeId: player.publicDogeId,
    playerHitboxEnabled: false,
    address,
    lastVisualState: 'hidden',
    eliminationVisualState: 'none',
    eliminationTimer: 0,
    eliminationSmallTimer: 0,
    wasTransformVisible: false,
    missingTransformLogCooldown: 0,
    lastPosition: null,
    planarSpeed: 0,
    jumpTimer: 0,
    bonkTimer: 0,
    bonks: player.bonks,
    lastBonkActionEventId: '',
    currentAnimation: '',
    lastPoseVersion: -1,
    poseStartPosition: HIDDEN_POSITION,
    poseStartRotation: Quaternion.Identity(),
    poseTargetPosition: HIDDEN_POSITION,
    poseTargetRotation: Quaternion.Identity(),
    poseBlendElapsed: REMOTE_POSE_INTERPOLATION_SECONDS,
    lastMovementRotation: Quaternion.Identity(),
    keepMovementFacing: false,
  }
  remoteProxies.set(address, proxy)
  console.log(`[Client][W3d] remote proxy created address=${address} doge=${player.publicDogeId}`)

  return proxy
}

function getRemotePlayerVisualState(player: ServerPublicPlayerState): PublicDogeVisualState | 'hidden' {
  const snapshot = getServerPublicMatchSnapshot()
  const publicDoge = snapshot?.publicDoges.find((doge) => doge.publicDogeId === player.publicDogeId)

  if (!player.isAlive || player.status !== 'active') return 'hidden'
  if (!publicDoge || publicDoge.isEliminated) return 'hidden'

  return publicDoge.visualState
}

function isRemotePlayerEliminated(player: ServerPublicPlayerState): boolean {
  const snapshot = getServerPublicMatchSnapshot()
  const publicDoge = snapshot?.publicDoges.find((doge) => doge.publicDogeId === player.publicDogeId)

  return !player.isAlive ||
    player.status !== 'active' ||
    Boolean(publicDoge?.isEliminated) ||
    publicDoge?.visualState === 'eliminated'
}

function showRemotePlayerProxy(
  proxy: RemotePlayerProxy,
  visualState: PublicDogeVisualState
): void {
  resetRemoteEliminationVisual(proxy)
  const showRock = visualState === 'rock'
  const showDoge = visualState === 'doge'

  VisibilityComponent.createOrReplace(proxy.dogeVisual, { visible: showDoge })
  VisibilityComponent.createOrReplace(proxy.rockVisual, { visible: showRock })
  VisibilityComponent.createOrReplace(proxy.nameLabel, { visible: isLocalSpectatorPresentation() })
  setRemotePlayerHitboxEnabled(proxy, true)

  if (showDoge) {
    const dogeTransform = Transform.getMutable(proxy.dogeVisual)
    dogeTransform.scale = getDogeScale()
    syncRemoteDogeAnimation(proxy)
  }

  if (!proxy.wasTransformVisible || proxy.lastVisualState !== visualState) {
    console.log(`[Client][W3d] remote proxy visible address=${proxy.address} visual=${visualState}`)
  }

  proxy.wasTransformVisible = true
  proxy.lastVisualState = visualState
  proxy.missingTransformLogCooldown = 0
}

function hideRemotePlayerProxy(proxy: RemotePlayerProxy): void {
  if (proxy.eliminationVisualState !== 'none' && proxy.eliminationVisualState !== 'done') return

  const rootTransform = Transform.getMutable(proxy.root)
  rootTransform.position = HIDDEN_POSITION
  VisibilityComponent.createOrReplace(proxy.dogeVisual, { visible: false })
  VisibilityComponent.createOrReplace(proxy.rockVisual, { visible: false })
  VisibilityComponent.createOrReplace(proxy.nameLabel, { visible: false })
  setRemotePlayerHitboxEnabled(proxy, false)

  proxy.wasTransformVisible = false
  proxy.lastVisualState = 'hidden'
  proxy.lastPosition = null
  proxy.planarSpeed = 0
  proxy.jumpTimer = 0
  proxy.bonkTimer = 0
}

function updateRemotePlayerElimination(
  proxy: RemotePlayerProxy,
  remoteTransform: RemoteTransform | null,
  dt: number
): void {
  if (proxy.eliminationVisualState === 'none') {
    startRemotePlayerElimination(proxy, remoteTransform)
  }

  if (proxy.eliminationVisualState === 'squash') {
    proxy.eliminationTimer = Math.max(0, proxy.eliminationTimer - dt)
    const progress = 1 - proxy.eliminationTimer / REMOTE_ELIMINATION_SQUASH_SECONDS
    applyRemoteEliminationSquash(proxy, progress)
    if (proxy.eliminationTimer <= 0) {
      showRemoteSmallDoge(proxy)
    }
    return
  }

  if (proxy.eliminationVisualState === 'small') {
    proxy.eliminationSmallTimer = Math.max(0, proxy.eliminationSmallTimer - dt)
    if (proxy.eliminationSmallTimer <= 0) {
      proxy.eliminationVisualState = 'done'
      hideRemotePlayerProxy(proxy)
    }
  }
}

function startRemotePlayerElimination(proxy: RemotePlayerProxy, remoteTransform: RemoteTransform | null): void {
  setRemotePlayerHitboxEnabled(proxy, false)
  const rootTransform = Transform.getMutable(proxy.root)
  if (remoteTransform) {
    rootTransform.position = Vector3.create(
      remoteTransform.position.x,
      remoteTransform.position.y,
      remoteTransform.position.z
    )
    rootTransform.rotation = remoteTransform.rotation
  }

  if (GltfContainer.has(proxy.dogeVisual)) {
    const gltf = GltfContainer.getMutable(proxy.dogeVisual)
    gltf.src = getDogeModelSrc()
    disableGltfCollision(proxy.dogeVisual)
  }

  VisibilityComponent.createOrReplace(proxy.dogeVisual, { visible: true })
  VisibilityComponent.createOrReplace(proxy.rockVisual, { visible: false })
  if (Animator.has(proxy.dogeVisual)) {
    Animator.stopAllAnimations(proxy.dogeVisual)
  }

  proxy.eliminationVisualState = 'squash'
  proxy.eliminationTimer = REMOTE_ELIMINATION_SQUASH_SECONDS
  proxy.eliminationSmallTimer = 0
  proxy.bonkTimer = 0
  proxy.jumpTimer = 0
  proxy.currentAnimation = ''
  proxy.wasTransformVisible = true
  proxy.lastVisualState = 'eliminated'
  applyRemoteEliminationSquash(proxy, 0)
  console.log(`[Client][W3i] remote proxy elimination visual started address=${proxy.address}`)
}

function setRemotePlayerHitboxEnabled(proxy: RemotePlayerProxy, enabled: boolean): void {
  if (proxy.playerHitboxEnabled === enabled) return

  if (enabled) {
    MeshCollider.setBox(proxy.playerHitbox, ColliderLayer.CL_POINTER)
  } else {
    MeshCollider.deleteFrom(proxy.playerHitbox)
  }

  proxy.playerHitboxEnabled = enabled
}

function applyRemoteEliminationSquash(proxy: RemotePlayerProxy, progress: number): void {
  const clamped = Math.min(1, Math.max(0, progress))
  const heightScale = 1 - (1 - REMOTE_ELIMINATION_MIN_HEIGHT_SCALE) * clamped
  const widthScale = 1 + (REMOTE_ELIMINATION_FLATTEN_SCALE - 1) * clamped
  const transform = Transform.getMutable(proxy.dogeVisual)
  const baseScale = getDogeScale()
  transform.scale = Vector3.create(
    baseScale.x * widthScale,
    baseScale.y * heightScale,
    baseScale.z * widthScale
  )
  transform.position = Vector3.Zero()
}

function showRemoteSmallDoge(proxy: RemotePlayerProxy): void {
  if (GltfContainer.has(proxy.dogeVisual)) {
    const gltf = GltfContainer.getMutable(proxy.dogeVisual)
    gltf.src = DEAD_DOGE_MODEL
    disableGltfCollision(proxy.dogeVisual)
  }

  const transform = Transform.getMutable(proxy.dogeVisual)
  transform.scale = DEAD_DOGE_SCALE
  transform.position = Vector3.Zero()
  proxy.eliminationVisualState = 'small'
  proxy.eliminationSmallTimer = REMOTE_ELIMINATION_SMALL_DOGE_SECONDS
  console.log(`[Client][W3i] remote proxy small doge shown address=${proxy.address}`)
}

function resetRemoteEliminationVisual(proxy: RemotePlayerProxy): void {
  if (proxy.eliminationVisualState === 'none') return

  proxy.eliminationVisualState = 'none'
  proxy.eliminationTimer = 0
  proxy.eliminationSmallTimer = 0
  const dogeTransform = Transform.getMutable(proxy.dogeVisual)
  dogeTransform.position = Vector3.Zero()
  dogeTransform.scale = getDogeScale()
  if (GltfContainer.has(proxy.dogeVisual)) {
    const gltf = GltfContainer.getMutable(proxy.dogeVisual)
    gltf.src = getDogeModelSrc()
    disableGltfCollision(proxy.dogeVisual)
  }
  proxy.currentAnimation = ''
}

function hideAllRemotePlayerProxies(): void {
  for (const proxy of remoteProxies.values()) {
    hideRemotePlayerProxy(proxy)
  }
}

function logMissingRemoteTransform(
  proxy: RemotePlayerProxy,
  dt: number,
  transform: RemoteTransform | null,
  visualState: PublicDogeVisualState | 'hidden'
): void {
  if (visualState === 'hidden') return
  if (transform) return

  proxy.missingTransformLogCooldown = Math.max(0, proxy.missingTransformLogCooldown - dt)
  if (proxy.missingTransformLogCooldown > 0) return

  proxy.missingTransformLogCooldown = MISSING_TRANSFORM_LOG_SECONDS
  console.log(`[Client][W3d] remote proxy missing transform address=${proxy.address}`)
}

function findRemotePlayerTransform(player: ServerPublicPlayerState): RemoteTransform | null {
  // The local runtime's replicated player entity updates more frequently than
  // the server's public snapshot. Use it for presentation, while retaining the
  // server pose as the fallback when a peer has not reached this client yet.
  const targetAddress = normalizeAddress(player.address)

  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    if (normalizeAddress(identity.address) !== targetAddress) continue

    const transform = Transform.getOrNull(entity)
    if (!transform) continue

    return {
      position: transform.position,
      rotation: transform.rotation,
      source: 'peer',
    }
  }

  if (player.pose) {
    return {
      position: Vector3.create(
        player.pose.position.x,
        player.pose.position.y,
        player.pose.position.z
      ),
      rotation: Quaternion.create(
        player.pose.rotation.x,
        player.pose.rotation.y,
        player.pose.rotation.z,
        player.pose.rotation.w
      ),
      source: 'server',
    }
  }

  return null
}

function updateRemotePresentationTransform(
  proxy: RemotePlayerProxy,
  rootTransform: TransformType,
  remoteTransform: RemoteTransform,
  poseVersion: number,
  dt: number
): void {
  const previousPosition = rootTransform.position
  const distance = Vector3.distance(rootTransform.position, remoteTransform.position)
  const shouldSnap = !proxy.wasTransformVisible || !proxy.lastPosition || distance >= REMOTE_TELEPORT_DISTANCE

  if (shouldSnap) {
    rootTransform.position = Vector3.create(
      remoteTransform.position.x,
      remoteTransform.position.y,
      remoteTransform.position.z
    )
    rootTransform.rotation = remoteTransform.rotation
    proxy.poseStartPosition = rootTransform.position
    proxy.poseStartRotation = rootTransform.rotation
    proxy.poseTargetPosition = rootTransform.position
    proxy.poseTargetRotation = rootTransform.rotation
    proxy.poseBlendElapsed = REMOTE_POSE_INTERPOLATION_SECONDS
    proxy.lastPoseVersion = poseVersion
    return
  }

  if (remoteTransform.source === 'peer') {
    const targetDeltaX = remoteTransform.position.x - rootTransform.position.x
    const targetDeltaZ = remoteTransform.position.z - rootTransform.position.z
    const targetPlanarDistance = Math.sqrt(targetDeltaX * targetDeltaX + targetDeltaZ * targetDeltaZ)
    if (targetPlanarDistance >= REMOTE_MOVEMENT_FACING_MIN_DISTANCE) {
      setRemoteMovementFacing(proxy, targetDeltaX, targetDeltaZ)
    }

    const liveAlpha = Math.min(1, dt * REMOTE_LIVE_POSE_FOLLOW_SPEED)
    rootTransform.position = Vector3.lerp(rootTransform.position, remoteTransform.position, liveAlpha)
    rootTransform.rotation = Quaternion.slerp(rootTransform.rotation, remoteTransform.rotation, liveAlpha)
    proxy.poseStartPosition = rootTransform.position
    proxy.poseStartRotation = rootTransform.rotation
    proxy.poseTargetPosition = remoteTransform.position
    proxy.poseTargetRotation = remoteTransform.rotation
    proxy.poseBlendElapsed = REMOTE_POSE_INTERPOLATION_SECONDS
    proxy.lastPoseVersion = poseVersion

    const movedThisFrame = orientRemoteProxyToMovement(proxy, rootTransform, previousPosition)
    if (!movedThisFrame && proxy.keepMovementFacing) {
      rootTransform.rotation = proxy.lastMovementRotation
    }
    return
  }

  if (proxy.lastPoseVersion !== poseVersion) {
    const previousTargetPosition = proxy.poseTargetPosition
    const targetDeltaX = remoteTransform.position.x - previousTargetPosition.x
    const targetDeltaZ = remoteTransform.position.z - previousTargetPosition.z
    const targetPlanarDistance = Math.sqrt(targetDeltaX * targetDeltaX + targetDeltaZ * targetDeltaZ)
    proxy.lastPoseVersion = poseVersion
    proxy.poseStartPosition = rootTransform.position
    proxy.poseStartRotation = rootTransform.rotation
    proxy.poseTargetPosition = remoteTransform.position
    proxy.poseTargetRotation = remoteTransform.rotation
    proxy.poseBlendElapsed = 0

    if (targetPlanarDistance >= REMOTE_MOVEMENT_FACING_MIN_DISTANCE) {
      setRemoteMovementFacing(proxy, targetDeltaX, targetDeltaZ)
      proxy.keepMovementFacing = true
    }
  }

  proxy.poseBlendElapsed = Math.min(REMOTE_POSE_INTERPOLATION_SECONDS, proxy.poseBlendElapsed + dt)
  const alpha = proxy.poseBlendElapsed / REMOTE_POSE_INTERPOLATION_SECONDS
  rootTransform.position = Vector3.lerp(proxy.poseStartPosition, proxy.poseTargetPosition, alpha)
  rootTransform.rotation = Quaternion.slerp(proxy.poseStartRotation, proxy.poseTargetRotation, alpha)
  const movedThisFrame = orientRemoteProxyToMovement(proxy, rootTransform, previousPosition)
  if (!movedThisFrame && proxy.keepMovementFacing) {
    rootTransform.rotation = proxy.lastMovementRotation
  }
}

function orientRemoteProxyToMovement(
  proxy: RemotePlayerProxy,
  rootTransform: TransformType,
  previousPosition: Vector3
): boolean {
  const deltaX = rootTransform.position.x - previousPosition.x
  const deltaZ = rootTransform.position.z - previousPosition.z
  const planarDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)
  if (planarDistance < REMOTE_MOVEMENT_FACING_MIN_DISTANCE) return false

  const yawDegrees = Math.atan2(deltaX, deltaZ) * 180 / Math.PI
  setRemoteMovementFacing(proxy, deltaX, deltaZ)
  rootTransform.rotation = proxy.lastMovementRotation
  return true
}

function setRemoteMovementFacing(proxy: RemotePlayerProxy, deltaX: number, deltaZ: number): void {
  const yawDegrees = Math.atan2(deltaX, deltaZ) * 180 / Math.PI
  proxy.lastMovementRotation = Quaternion.fromEulerDegrees(0, yawDegrees, 0)
  proxy.keepMovementFacing = true
}

function updateRemoteProxyMotion(
  proxy: RemotePlayerProxy,
  player: ServerPublicPlayerState,
  remoteTransform: RemoteTransform,
  dt: number
): void {
  proxy.bonkTimer = Math.max(0, proxy.bonkTimer - dt)
  proxy.jumpTimer = Math.max(0, proxy.jumpTimer - dt)

  if (player.bonks > proxy.bonks) {
    const previousBonks = proxy.bonks
    proxy.bonks = player.bonks
    if (proxy.bonkTimer <= 0) {
      triggerRemoteBonkAnimation(proxy)
      console.log(`[Client][W3d] remote proxy bonk animation address=${proxy.address} bonks=${previousBonks}->${proxy.bonks}`)
    } else {
      console.log(`[Client][W3f] remote proxy bonk count synced during action address=${proxy.address} bonks=${previousBonks}->${proxy.bonks}`)
    }
  } else if (player.bonks < proxy.bonks) {
    proxy.bonks = player.bonks
  }

  if (!proxy.lastPosition || dt <= 0) {
    proxy.lastPosition = Vector3.create(
      remoteTransform.position.x,
      remoteTransform.position.y,
      remoteTransform.position.z
    )
    proxy.planarSpeed = 0
    return
  }

  const deltaX = remoteTransform.position.x - proxy.lastPosition.x
  const deltaY = remoteTransform.position.y - proxy.lastPosition.y
  const deltaZ = remoteTransform.position.z - proxy.lastPosition.z
  const instantPlanarSpeed = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) / dt
  const smoothingAlpha = Math.min(1, dt * REMOTE_SPEED_SMOOTHING)
  proxy.planarSpeed += (instantPlanarSpeed - proxy.planarSpeed) * smoothingAlpha

  const verticalSpeed = deltaY / dt
  if (deltaY > REMOTE_JUMP_MIN_DELTA_Y || verticalSpeed > REMOTE_JUMP_MIN_VERTICAL_SPEED) {
    proxy.jumpTimer = REMOTE_JUMP_ANIMATION_SECONDS
  }

  proxy.lastPosition = Vector3.create(
    remoteTransform.position.x,
    remoteTransform.position.y,
    remoteTransform.position.z
  )
}

function syncRemoteDogeAnimation(proxy: RemotePlayerProxy): void {
  if (!Animator.has(proxy.dogeVisual)) return

  const desiredAnimation = getRemoteDesiredAnimation(proxy)
  if (desiredAnimation === proxy.currentAnimation) return

  if (desiredAnimation === PLAYER_ATTACK_CLIP || desiredAnimation === PLAYER_JUMP_CLIP) {
    playRemoteSingleAnimation(proxy, desiredAnimation)
    logRemoteAnimationChange(proxy, desiredAnimation)
    return
  }

  playRemoteLoopAnimation(proxy, desiredAnimation)
  logRemoteAnimationChange(proxy, desiredAnimation)
}

function triggerRemoteBonkAnimation(proxy: RemotePlayerProxy): void {
  proxy.bonkTimer = REMOTE_ATTACK_ANIMATION_SECONDS
  proxy.currentAnimation = ''
  syncRemoteDogeAnimation(proxy)
}

function getRemotePlayerProxyByAddress(address: string): RemotePlayerProxy | null {
  const normalizedAddress = normalizeAddress(address)
  const existing = remoteProxies.get(normalizedAddress)
  if (existing) return existing

  const localAddress = getLocalServerAddress()
  if (localAddress && normalizedAddress === localAddress) return null

  const snapshot = getServerPublicMatchSnapshot()
  const player = snapshot?.players.find((entry) => normalizeAddress(entry.address) === normalizedAddress)
  return player ? getOrCreateRemotePlayerProxy(player) : null
}

function getRemoteDesiredAnimation(proxy: RemotePlayerProxy): string {
  if (proxy.bonkTimer > 0) return PLAYER_ATTACK_CLIP
  if (proxy.jumpTimer > 0) return PLAYER_JUMP_CLIP
  if (proxy.planarSpeed >= REMOTE_RUN_SPEED_THRESHOLD) return PLAYER_RUN_CLIP
  if (proxy.planarSpeed >= REMOTE_IDLE_SPEED_THRESHOLD) return PLAYER_WALK_CLIP

  return PLAYER_IDLE_CLIP
}

function logRemoteAnimationChange(proxy: RemotePlayerProxy, animation: string): void {
  console.log(`[Client][W3h] remote proxy animation address=${proxy.address} animation=${animation} speed=${formatNumber(proxy.planarSpeed)} jump=${proxy.jumpTimer > 0 ? 'yes' : 'no'} bonk=${proxy.bonkTimer > 0 ? 'yes' : 'no'}`)
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a'
}

function stopRemoteDogeAnimations(proxy: RemotePlayerProxy): void {
  Animator.stopAllAnimations(proxy.dogeVisual)
  const animator = Animator.getMutable(proxy.dogeVisual)
  for (const state of animator.states) {
    state.playing = false
  }
}

function playRemoteLoopAnimation(proxy: RemotePlayerProxy, clipName: string): void {
  stopRemoteDogeAnimations(proxy)

  const animator = Animator.getMutable(proxy.dogeVisual)
  const clip = animator.states.find((state) => state.clip === clipName)
  if (!clip) return

  clip.playing = true
  clip.loop = true
  clip.weight = 1.0
  proxy.currentAnimation = clipName
}

function playRemoteSingleAnimation(proxy: RemotePlayerProxy, clipName: string): void {
  stopRemoteDogeAnimations(proxy)

  const animator = Animator.getMutable(proxy.dogeVisual)
  const clip = animator.states.find((state) => state.clip === clipName)
  if (!clip) return

  clip.playing = false
  clip.loop = false
  clip.weight = 1.0
  Animator.playSingleAnimation(proxy.dogeVisual, clipName, true)
  proxy.currentAnimation = clipName
}

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}
