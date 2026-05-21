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
import { createLobby } from './lobby'
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
import { setupGameOverUI, showGameOverUI } from './gameOverUI'

const NPC_COUNT = 12

let gameInitialized = false
let skillsInitialized = false

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

  // 1. Create lobby
  createLobby()

  // 2. Setup game over UI
  setupGameOverUI()

  // 3. Register game systems (only run when playing)
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

  // 4. Skills init + system
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

  // 5. UI update system
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

  // 6. Game over detection
  let gameOverTriggered = false
  engine.addSystem(() => {
    if (!isPlaying()) return
    if (roundOver && !gameOverTriggered) {
      gameOverTriggered = true
      console.log('[Game] Round over! Showing game over UI...')
      showGameOverUI()
    }
  })
}
