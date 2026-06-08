/**
 * gameReset.ts — Game reset utilities
 * Cleans up entities and resets state when returning to lobby
 */
import { engine, Entity } from '@dcl/sdk/ecs'
import { NpcPatrol, NpcWaypoints, resetNpcCounters } from './npc'
import { resetCombat } from './combat'
import { cleanupWorldUi, resetRoundTimer } from './ui'
import { resetGameOverFlag } from './index'
import { cleanupPlayerDisguise } from './player'
import { cleanupSkills } from './skills'

let spawnedNpcs: Entity[] = []
let arenaEntities: Entity[] = []

/** Track spawned NPCs */
export function trackNpc(entity: Entity): void {
  spawnedNpcs.push(entity)
}

/** Track arena entities */
export function trackArenaEntity(entity: Entity): void {
  arenaEntities.push(entity)
}

/** Clean up all game entities */
export function cleanupGame(): void {
  console.log('[Reset] Cleaning up game entities...')

  // Remove all NPCs
  for (const npc of spawnedNpcs) {
    // Remove NPC components
    if (NpcPatrol.has(npc)) {
      const patrol = NpcPatrol.get(npc)
      // Remove label entity
      if (patrol.labelEntity) {
        engine.removeEntity(patrol.labelEntity as Entity)
      }
      // Remove visual entity
      if (patrol.visualEntity) {
        engine.removeEntity(patrol.visualEntity as Entity)
      }
    }
    // Remove waypoints
    if (NpcWaypoints.has(npc)) {
      NpcWaypoints.deleteFrom(npc)
    }
    // Remove patrol component
    if (NpcPatrol.has(npc)) {
      NpcPatrol.deleteFrom(npc)
    }
    // Remove root entity
    engine.removeEntity(npc)
  }
  spawnedNpcs = []

  // Remove arena entities
  for (const entity of arenaEntities) {
    engine.removeEntity(entity)
  }
  arenaEntities = []

  // Clean up player disguise
  cleanupWorldUi()
  cleanupSkills()
  cleanupPlayerDisguise()

  console.log('[Reset] Cleanup complete')
}

/** Reset game state variables */
export function resetGameState(): void {
  console.log('[Reset] Resetting game state...')
  
  // Reset counters
  resetCombat()
  resetNpcCounters()
  resetRoundTimer()
  resetGameOverFlag()
  
  console.log('[Reset] State reset complete')
}
