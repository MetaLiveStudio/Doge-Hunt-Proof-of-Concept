/**
 * hud.ts — HUD trigger (actual rendering in uiManager.ts)
 */
import { uiState } from './uiManager'

export function setupHud(): void {
  console.log('[HUD] Enabling HUD display')
  uiState.showHud = true
}

export function hideHud(): void {
  console.log('[HUD] Hiding HUD display')
  uiState.showHud = false
}
