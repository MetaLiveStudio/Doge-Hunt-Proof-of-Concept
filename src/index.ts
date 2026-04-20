/**
 * index.ts — Doge Hunt MVP Scene Entry Point
 *
 * Scene: Neon-noir arena (3x3 parcels, 48m x 48m)
 * Features:
 *   - Dark arena with neon-lit walls, pillars, corridors
 *   - 12 NPC Doges patrolling with "?" labels
 *   - Player disguised as Doge
 *   - Click-to-bonk: knockback + permanent knockout
 *   - Meme-style kill feed
 *   - Round timer (3 min), alive counter, bonk counter
 *   - Rock Solid skill: press E near pillar to hide
 */
import { engine } from '@dcl/sdk/ecs'

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
} from './ui'
import { setupPlayerDisguise, dogeBodyEntity } from './player'
import { setupSkills, skillSystem } from './skills'
import { setupHud } from './hud'

const NPC_COUNT = 12

export function main() {
  // 1. Build the arena
  buildArena()

  // 2. Spawn NPC Doges
  spawnAllNpcs(NPC_COUNT)

  // 3. Disguise the player as a Doge
  setupPlayerDisguise()

  // 4. Setup skills (Rock Solid)
  // Delay by 1 frame so dogeBodyEntity is set
  let skillsInitialized = false

  createBonkCounter()
  createRoundTimer()
  createAliveCounter(NPC_COUNT)
  setupHud()

  // 5. Register game systems
  engine.addSystem(npcPatrolSystem)
  engine.addSystem(combatSystem)
  engine.addSystem(killFeedSystem)
  engine.addSystem(roundTimerSystem)

  // 6. Skills init + system
  engine.addSystem((dt: number) => {
    if (!skillsInitialized && dogeBodyEntity) {
      setupSkills(dogeBodyEntity)
      skillsInitialized = true
    }
    if (skillsInitialized) {
      skillSystem(dt)
    }
  })

  let lastBonks = 0
  let lastAlive = NPC_COUNT
  engine.addSystem(() => {
    if (totalBonks !== lastBonks) {
      lastBonks = totalBonks
      updateBonkCounter(totalBonks)
    }
    if (aliveCount !== lastAlive) {
      lastAlive = aliveCount
      updateAliveCounter(aliveCount)
    }
  })

  console.log('Doge Hunt Proof of Concept loaded. Trust No Doge.')
}
