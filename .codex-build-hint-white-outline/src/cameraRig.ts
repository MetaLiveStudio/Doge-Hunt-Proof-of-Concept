import {
  engine,
  Entity,
  MainCamera,
  Transform,
  VirtualCamera,
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

const CAMERA_BACK_DISTANCE = 7.2
const CAMERA_HEIGHT = 5.2
const CAMERA_SIDE_OFFSET = 0
const CAMERA_LOOK_AHEAD = 4.2
const CAMERA_LOOK_HEIGHT = 1.8
const CAMERA_TRANSITION_SPEED = 20
const CAMERA_POSITION_SMOOTHING = 5
const CAMERA_ROTATION_SMOOTHING = 3.2

let followCameraEntity: Entity | null = null
let followCameraSystemInitialized = false
let followCameraActive = false
let smoothedLookTarget: Vector3 | null = null

function ensureFollowCamera(): void {
  if (!followCameraEntity) {
    followCameraEntity = engine.addEntity()
    Transform.create(followCameraEntity, {
      position: Vector3.create(48, 4, 42),
    })
    VirtualCamera.create(followCameraEntity, {
      defaultTransition: {
        transitionMode: VirtualCamera.Transition.Speed(CAMERA_TRANSITION_SPEED),
      },
    })
  }

  if (followCameraSystemInitialized) return

  followCameraSystemInitialized = true
  engine.addSystem((dt) => {
    if (!followCameraActive || !followCameraEntity) return

    const playerTransform = Transform.getOrNull(engine.PlayerEntity)
    if (!playerTransform) return

    const backOffset = Vector3.rotate(
      Vector3.create(CAMERA_SIDE_OFFSET, CAMERA_HEIGHT, -CAMERA_BACK_DISTANCE),
      playerTransform.rotation
    )
    const cameraPosition = Vector3.add(playerTransform.position, backOffset)

    const lookOffset = Vector3.rotate(
      Vector3.create(0, CAMERA_LOOK_HEIGHT, CAMERA_LOOK_AHEAD),
      playerTransform.rotation
    )
    const lookTarget = Vector3.add(playerTransform.position, lookOffset)
    const lookDirection = Vector3.subtract(lookTarget, cameraPosition)
    const lookDirectionLength = Vector3.length(lookDirection)
    if (lookDirectionLength <= 0.001) return

    const cameraTransform = Transform.getMutable(followCameraEntity)
    const positionLerp = Math.min(1, dt * CAMERA_POSITION_SMOOTHING)
    const rotationLerp = Math.min(1, dt * CAMERA_ROTATION_SMOOTHING)

    cameraTransform.position = Vector3.lerp(
      cameraTransform.position,
      cameraPosition,
      positionLerp
    )

    if (!smoothedLookTarget) {
      smoothedLookTarget = lookTarget
    } else {
      smoothedLookTarget = Vector3.lerp(
        smoothedLookTarget,
        lookTarget,
        rotationLerp
      )
    }

    const smoothedLookDirection = Vector3.subtract(
      smoothedLookTarget,
      cameraTransform.position
    )
    const smoothedLookDirectionLength = Vector3.length(smoothedLookDirection)
    if (smoothedLookDirectionLength <= 0.001) return

    cameraTransform.rotation = Quaternion.lookRotation(
      Vector3.normalize(smoothedLookDirection)
    )
  })
}

export function enableFollowCamera(): void {
  ensureFollowCamera()
  if (!followCameraEntity) return

  followCameraActive = true
  smoothedLookTarget = null
  MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = followCameraEntity
}

export function disableFollowCamera(): void {
  followCameraActive = false
  smoothedLookTarget = null
  MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = undefined
}
