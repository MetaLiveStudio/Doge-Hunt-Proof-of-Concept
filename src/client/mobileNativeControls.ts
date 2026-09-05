import { engine, InputAction, TouchScreenControls } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

const HIDDEN_ACTIONS = [
  InputAction.IA_POINTER,
  InputAction.IA_PRIMARY,
  InputAction.IA_SECONDARY,
  InputAction.IA_ACTION_3,
  InputAction.IA_ACTION_4,
  InputAction.IA_ACTION_5,
  InputAction.IA_ACTION_6,
]

let lastConfiguration = ''
let lastEligibility = ''

// Keep native controls untouched outside an active match. The mobile Explorer
// currently ignores the component's hide list, but game-only scope remains the
// intended behavior if/when that client capability becomes available.
const HIDE_NATIVE_GAMEPAD_ON_SCENE_ENTRY = false

function hasExpectedGameplayControls(): boolean {
  const controls = TouchScreenControls.getOrNull(engine.RootEntity)
  if (!controls || controls.mainAction !== InputAction.IA_JUMP || controls.hideJoystick) {
    return false
  }

  return HIDDEN_ACTIONS.every((action) =>
    controls.touchInputs.some((input) => input.inputAction === action && input.hide)
  )
}

function applyGameplayControls(): void {
  // Use the SDK helpers so every write is made to the RootEntity and merged with
  // Explorer's current controls state. This is more resilient to mobile resume/HMR.
  TouchScreenControls.showJoystick()
  TouchScreenControls.showCrosshair()
  TouchScreenControls.showAll()
  TouchScreenControls.setMainAction(InputAction.IA_JUMP)
  TouchScreenControls.hide(HIDDEN_ACTIONS)

  const controls = TouchScreenControls.getOrNull(engine.RootEntity)
  const hiddenActions = controls?.touchInputs
    .filter((input) => input.hide)
    .map((input) => input.inputAction)
    .join(',') ?? 'none'
  console.log(`[MobileControls] Applied gameplay config root=${TouchScreenControls.has(engine.RootEntity)} main=${controls?.mainAction ?? 'none'} hidden=${hiddenActions}`)
}

export function hasNativeMobileGameplayControls(): boolean {
  return isMobile()
    && lastConfiguration.startsWith('gameplay:')
    && TouchScreenControls.has(engine.RootEntity)
}

/**
 * Use Explorer's native mobile gamepad only for an active player in a round.
 * Removing the component restores the platform's untouched default layout.
 */
export type MobileControlsContext = {
  isPlaying: boolean
  canAct: boolean
  playerStatus: string
  isSpectating: boolean
}

export function updateMobileNativeGameplayControls(context: MobileControlsContext): void {
  const mobile = isMobile()
  const isActivePlayerInMatch = context.isPlaying && context.canAct
  const shouldHideNativeGamepad = HIDE_NATIVE_GAMEPAD_ON_SCENE_ENTRY || isActivePlayerInMatch
  const eligibility = [
    `mobile=${mobile}`,
    `playing=${context.isPlaying}`,
    `canAct=${context.canAct}`,
    `status=${context.playerStatus}`,
    `spectating=${context.isSpectating}`,
    `active=${isActivePlayerInMatch}`,
    `sceneEntryHide=${HIDE_NATIVE_GAMEPAD_ON_SCENE_ENTRY}`,
    `apply=${shouldHideNativeGamepad}`,
    `root=${TouchScreenControls.has(engine.RootEntity)}`,
  ].join(' ')
  if (eligibility !== lastEligibility) {
    lastEligibility = eligibility
    console.log(`[MobileControls] Eligibility ${eligibility}`)
  }

  if (!mobile) return

  if (!shouldHideNativeGamepad) {
    if (lastConfiguration !== 'default') {
      if (TouchScreenControls.has(engine.RootEntity)) {
        TouchScreenControls.deleteFrom(engine.RootEntity)
      }
      lastConfiguration = 'default'
      console.log('[MobileControls] Explorer default touch controls restored.')
    }
    return
  }

  const configuration = HIDE_NATIVE_GAMEPAD_ON_SCENE_ENTRY
    ? 'scene-entry:custom-actions'
    : 'gameplay:custom-actions'
  if (lastConfiguration === configuration && hasExpectedGameplayControls()) return

  applyGameplayControls()
  lastConfiguration = configuration
  console.log('[MobileControls] Native gamepad actions hidden. joystick+jump kept; scene Rock/BONK bindings enabled.')
}
