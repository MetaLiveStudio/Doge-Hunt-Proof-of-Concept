/**
 * index.ts — Doge Hunt MVP Scene Entry Point
 *
 * Scene: Neon-noir arena (3x3 parcels, 48m x 48m)
 * Features:
 *   - Lobby system with local room entry
 *   - Dark arena with neon-lit walls, pillars, corridors
 *   - Small Doge field for focused multiplayer testing
 *   - Player disguised as Doge
 *   - Click-to-bonk: knockback + permanent knockout
 *   - Meme-style kill feed
 *   - Round timer (3 min), alive counter, bonk counter
 *   - Rock Solid skill: press E near pillar to hide
 */
import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'

import { GameState, isPlaying } from './gameState'
import { createLobby, startLocalMatchFromLobby, returnToLobby } from './lobby'
import { buildArena } from './arena'
import { spawnAllNpcs, npcPatrolSystem, aliveCount, resetNpcCounters, NPC_TOTAL } from './npc'
import { combatSystem, totalBonks, resetCombat } from './combat'
import {
  killFeedSystem,
  createBonkCounter,
  updateBonkCounter,
  createRoundTimer,
  resetRoundTimer,
  roundTimerSystem,
  createAliveCounter,
  updateAliveCounter,
  roundTimeLeft,
  roundOver,
} from './ui'
import { setupPlayerDisguise, dogeBodyEntity, setPlayerSpectatorVisualHidden } from './player'
import { setupSkills, skillSystem } from './skills'
import { setupHud } from './hud'
import { showGameOverUI } from './gameOverUI'
import { setupUI, setCallbacks } from './uiManager'
import { requestRoundEnd } from './gameResolvers'
import { getFallbackLocalMatchConfig } from './localMatch'
import type { LocalMatchConfig } from './localMatch'
import {
  getLocalPresentationMatchState,
  initializeLocalMatchRuntimeState,
  type LocalMatchRuntimeSeed,
} from './localMatchState'
import { setupO4ClientDiagnostics, setupO4ServerDiagnostics } from './authDiagnostics'
import { setupServerLobby } from './server/serverLobby'
import { setServerMatchStartHandler, setupServerRoomClient } from './client/serverRoomClient'
import {
  canLocalServerPlayerAct,
  getLocalServerPlayerStatus,
  getLocalServerPlayerStatusLabel,
  getServerResultsRevealLines,
  getServerResultsRevealData,
  getServerPublicHudLabel,
  getServerResultOutcome,
  mergeServerPublicStats,
  setupServerPublicStateClient,
} from './client/serverPublicStateClient'
import { setupServerGameplayClient } from './client/serverGameplayClient'
import { syncRemotePlayerProxies } from './client/remotePlayerProxies'

let activeMatchConfig: LocalMatchConfig = getFallbackLocalMatchConfig()
let gameInitialized = false
let skillsInitialized = false
let gameOverTriggered = false
let pendingGameOverDelay = 0
const ROUND_END_VISUAL_DELAY_SECONDS = 0.35

function readLocalMatchStats() {
  const localStats = getLocalPresentationMatchState({
    bonks: totalBonks,
    alive: aliveCount,
    total: activeMatchConfig.decoyNpcCount,
    timeLeft: roundTimeLeft,
    roundOver,
  }).stats

  return mergeServerPublicStats(activeMatchConfig.matchId, localStats)
}

function formatElapsedTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/** Reset game over flag (called from gameReset) */
export function resetGameOverFlag(): void {
  gameOverTriggered = false
  gameInitialized = false
  skillsInitialized = false
  pendingGameOverDelay = 0
  console.log('[Game] Game flags reset (gameOver, gameInitialized, skillsInitialized)')
}

/** Start the game (called from lobby) */
export function startGame(
  matchConfig: LocalMatchConfig = getFallbackLocalMatchConfig(),
  runtimeSeed?: LocalMatchRuntimeSeed
) {
  if (gameInitialized) {
    console.log('[Game] Already initialized, skipping...')
    return
  }

  activeMatchConfig = matchConfig
  const runtimeState = initializeLocalMatchRuntimeState(activeMatchConfig, runtimeSeed)
  const presentationState = getLocalPresentationMatchState()
  console.log('[Game] Starting game...', activeMatchConfig)
  console.log('[Game] Local match state initialized:', {
    publicDoges: runtimeState.publicDoges.length,
    privatePlayer: runtimeState.privatePlayer.playerId,
  })

  // Ensure stale values from a previous round don't trip game-over on start.
  resetNpcCounters()
  resetRoundTimer()
  resetGameOverFlag()
  resetCombat()

  // 1. Build the arena
  buildArena()

  // 2. Spawn NPC Doges
  spawnAllNpcs(activeMatchConfig.decoyNpcCount, presentationState.decoyPublicDogeIds)

  // 3. Disguise the player as a Doge
  setupPlayerDisguise()

  // 4. Setup UI
  setupHud()

  gameInitialized = true
}

export function main() {
  if (isServer()) {
    console.log('[Server] Doge Hunt authoritative server entry loaded.')
    setupO4ServerDiagnostics()
    setupServerLobby()
    return
  }

  console.log('[Client] Doge Hunt client entry loaded.')
  setupO4ClientDiagnostics()
  setupServerRoomClient()
  setupServerPublicStateClient()
  setupServerGameplayClient()
  setServerMatchStartHandler(startLocalMatchFromLobby)
  console.log('Doge Hunt Proof of Concept loaded. Trust No Doge.')

  // 1. Setup unified UI renderer
  setupUI()
  
  // 2. Set UI callbacks
  setCallbacks({
    onStartLocalMatch: startLocalMatchFromLobby,
    onReturnToLobby: returnToLobby,
    getGameStats: () => {
      const stats = readLocalMatchStats()
      const outcome = getServerResultOutcome(activeMatchConfig.matchId, stats.alive)
      return {
        bonks: stats.bonks,
        alive: stats.alive,
        total: stats.total,
        time: formatElapsedTime(stats.elapsedSeconds),
        identityRevealLines: getServerResultsRevealLines(activeMatchConfig.matchId),
        revealData: getServerResultsRevealData(activeMatchConfig.matchId),
        localStatusLabel: getLocalServerPlayerStatusLabel(),
        isWin: outcome?.isWin,
        resultTitle: outcome?.title,
        resultSubtitle: outcome?.subtitle,
      }
    },
    getHudData: () => {
      const stats = readLocalMatchStats()
      return {
        bonks: stats.bonks,
        alive: stats.alive,
        total: stats.total,
        timeLeft: stats.timeLeft,
        roundOver: stats.roundOver,
        serverPublicLabel: getServerPublicHudLabel(activeMatchConfig.matchId),
        localPlayerStatus: getLocalServerPlayerStatus(),
        localStatusLabel: getLocalServerPlayerStatusLabel(),
        canAct: canLocalServerPlayerAct(),
      }
    },
  })

  // 3. Create lobby
  createLobby()

  // 4. Register game systems (only run when playing)
  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    npcPatrolSystem(dt)
  })

  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    combatSystem(dt)
  })

  engine.addSystem(() => {
    if (!isPlaying()) return
    setPlayerSpectatorVisualHidden(!canLocalServerPlayerAct())
  })

  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    syncRemotePlayerProxies(dt)
  })

  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    roundTimerSystem(dt)
  })

  // 5. Skills init + system
  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    if (!skillsInitialized && dogeBodyEntity) {
      setupSkills(dogeBodyEntity)
      skillsInitialized = true
    }
    if (skillsInitialized) {
      skillSystem(dt)
    }
  })

  // 6. Game over detection
  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    if (!gameInitialized) return
    if (NPC_TOTAL <= 0) return
    
    const stats = readLocalMatchStats()
    const isServerMatch = activeMatchConfig.matchId.startsWith('server-match-')
    const shouldEnd = stats.roundOver || (!isServerMatch && stats.alive <= 0)

    if (!shouldEnd) {
      pendingGameOverDelay = 0
      return
    }
    
    if (shouldEnd && !gameOverTriggered) {
      if (pendingGameOverDelay <= 0) {
        pendingGameOverDelay = ROUND_END_VISUAL_DELAY_SECONDS
        console.log(`[Game] Round end detected; waiting ${ROUND_END_VISUAL_DELAY_SECONDS}s for elimination visuals.`)
      }

      pendingGameOverDelay = Math.max(0, pendingGameOverDelay - dt)
      if (pendingGameOverDelay > 0) return

      gameOverTriggered = true
      const endReason = stats.roundEndReason ?? (stats.alive <= 0 ? 'all-doges-eliminated' : 'time-up')
      requestRoundEnd({
        reason: endReason,
        bonks: stats.bonks,
        aliveDoges: stats.alive,
        totalDoges: stats.total,
        timeLeftSeconds: stats.timeLeft,
        elapsedSeconds: stats.elapsedSeconds,
      })
      console.log('[Game] Game over! Reason:', endReason)
      console.log('[Game] Stats - Bonks:', stats.bonks, 'Alive:', stats.alive, 'Time left:', stats.timeLeft)
      showGameOverUI()
    }
  })
}
