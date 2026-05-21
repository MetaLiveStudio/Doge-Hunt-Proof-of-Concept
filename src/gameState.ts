/**
 * gameState.ts — Game state management
 * Controls game flow: LOBBY → PLAYING → GAME_OVER → LOBBY
 */

export enum GameState {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export let currentState: GameState = GameState.LOBBY

export function setState(newState: GameState): void {
  console.log(`[GameState] ${currentState} → ${newState}`)
  currentState = newState
}

export function isPlaying(): boolean {
  return currentState === GameState.PLAYING
}

export function isInLobby(): boolean {
  return currentState === GameState.LOBBY
}

export function isGameOver(): boolean {
  return currentState === GameState.GAME_OVER
}
