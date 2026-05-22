/**
 * gameOverUI.ts — Game over screen trigger
 */
import { GameState, setState } from './gameState'
import { uiState } from './uiManager'
import { hideHud } from './hud'

export function showGameOverUI(): void {
  console.log('[GameOver] Showing game over UI')
  hideHud()  // Hide HUD first!
  uiState.showGameOver = true
  setState(GameState.GAME_OVER)
}

export function hideGameOverUI(): void {
  console.log('[GameOver] Hiding game over UI')
  uiState.showGameOver = false
}
