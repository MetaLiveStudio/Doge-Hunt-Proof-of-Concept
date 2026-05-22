/**
 * index.ts — Doge Hunt MVP Scene Entry Point
 *
 * Scene: Neon-noir arena (3x3 parcels, 48m x 48m)
 * Features:
 *   - Lobby system with mode selection
 *   - Dark arena with neon-lit walls, pillars, corridors
 *   - 12 NPC Doges patrolling with "?" labels
 *   - Player disguised as Doge
 *   - Click-to-bonk: knockback + permanent knockout
 *   - Meme-style kill feed
 *   - Round timer (3 min), alive counter, bonk counter
 *   - Rock Solid skill: press E near pillar to hide
 */
import { engine } from '@dcl/sdk/ecs'

import { GameState, isPlaying } from './gameState'
import { createLobby, startSinglePlayer, returnToLobby } from './lobby'
import { buildArena } from './arena'
import { spawnAllNpcs, npcPatrolSystem, aliveCount } from './npc'
import { combatSystem, totalBonks } from './combat'
import {
  killFeedSystem,
  createBonkCounter,
  updateBonkCounter,
  createRoundTimer,
  roundTimerSystem,
  createAliveCounter,
  updateAliveCounter,
  roundTimeLeft,
  roundOver,
} from './ui'
import { setupPlayerDisguise, dogeBodyEntity } from './player'
import { setupSkills, skillSystem } from './skills'
import { setupHud } from './hud'
import { showGameOverUI } from './gameOverUI'
import { setupUI, setCallbacks } from './uiManager'

const NPC_COUNT = 12

let gameInitialized = false
let skillsInitialized = false
let gameOverTriggered = false

/** Reset game over flag (called from gameReset) */
export function resetGameOverFlag(): void {
  gameOverTriggered = false
  gameInitialized = false
  skillsInitialized = false
  console.log('[Game] Game flags reset (gameOver, gameInitialized, skillsInitialized)')
}

/** Start the game (called from lobby) */
export function startGame() {
  if (gameInitialized) {
    console.log('[Game] Already initialized, skipping...')
    return
  }

  console.log('[Game] Starting game...')

  // 1. Build the arena
  buildArena()

  // 2. Spawn NPC Doges
  spawnAllNpcs(NPC_COUNT)

  // 3. Disguise the player as a Doge
  setupPlayerDisguise()

  // 4. Setup UI
  createBonkCounter()
  createRoundTimer()
  createAliveCounter(NPC_COUNT)
  setupHud()

  gameInitialized = true
}

export function main() {
  console.log('Doge Hunt Proof of Concept loaded. Trust No Doge.')

  // 1. Setup unified UI renderer
  setupUI()
  
  // 2. Set UI callbacks
  setCallbacks({
    onStartSinglePlayer: startSinglePlayer,
    onReturnToLobby: returnToLobby,
    getGameStats: () => {
      const survivalTime = 180 - roundTimeLeft
      const m = Math.floor(survivalTime / 60)
      const s = Math.floor(survivalTime % 60)
      const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`
      return {
        bonks: totalBonks,
        alive: aliveCount,
        total: NPC_COUNT,
        time: timeStr,
      }
    },
    getHudData: () => {
      return {
        bonks: totalBonks,
        alive: aliveCount,
        total: NPC_COUNT,
        timeLeft: roundTimeLeft,
        roundOver: roundOver,
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

  engine.addSystem((dt: number) => {
    if (!isPlaying()) return
    killFeedSystem(dt)
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

  // 6. UI update system
  let lastBonks = 0
  let lastAlive = NPC_COUNT
  engine.addSystem(() => {
    if (!isPlaying()) return
    if (totalBonks !== lastBonks) {
      lastBonks = totalBonks
      updateBonkCounter(totalBonks)
    }
    if (aliveCount !== lastAlive) {
      lastAlive = aliveCount
      updateAliveCounter(aliveCount)
    }
  })

  // 7. Game over detection
  engine.addSystem(() => {
    if (!isPlaying()) return
    
    // Check if game should end
    const shouldEnd = roundOver || aliveCount === 0
    
    if (shouldEnd && !gameOverTriggered) {
      gameOverTriggered = true
      console.log('[Game] Game over! Reason:', roundOver ? 'Time up' : 'All NPCs eliminated')
      console.log('[Game] Stats - Bonks:', totalBonks, 'Alive:', aliveCount, 'Time left:', roundTimeLeft)
      showGameOverUI()
    }
  })
}