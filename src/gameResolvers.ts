import type { Entity } from '@dcl/sdk/ecs'
import type { Vector3 } from '@dcl/sdk/math'
import { recordLocalRoundEnded } from './localMatchState'
import type { LocalRoundEndReason, LocalRoundState } from './localMatchState'

export type BonkRequest = {
  attackerPlayerId: string
  origin: Vector3
  forward: Vector3
}

export type BonkResult =
  | {
      outcome: 'miss'
      request: BonkRequest
    }
  | {
      outcome: 'hit-npc'
      request: BonkRequest
      targetNpc: Entity
    }

export type TurnToRockRequest = {
  playerId: string
}

export type TurnToRockResult =
  | {
      outcome: 'rejected'
      reason: 'missing-player-transform' | 'already-active' | 'cooldown'
      request: TurnToRockRequest
    }
  | {
      outcome: 'activated'
      request: TurnToRockRequest
      position: Vector3
      yawDegrees: number
      durationSeconds: number
      cooldownSeconds: number
    }

export type RoundEndRequest = {
  reason: LocalRoundEndReason
  bonks: number
  aliveDoges: number
  totalDoges: number
  timeLeftSeconds: number
  elapsedSeconds: number
}

export type RoundEndResult =
  | {
      outcome: 'recorded'
      request: RoundEndRequest
      round: LocalRoundState
    }
  | {
      outcome: 'ignored'
      reason: 'missing-runtime-state'
      request: RoundEndRequest
    }

export type GameplayResolvers = {
  resolveBonk: (request: BonkRequest) => BonkResult
  resolveTurnToRock: (request: TurnToRockRequest) => TurnToRockResult
  resolveRoundEnd: (request: RoundEndRequest) => RoundEndResult
}

let gameplayResolvers: GameplayResolvers = {
  resolveBonk: resolveMissingBonk,
  resolveTurnToRock: resolveMissingTurnToRock,
  resolveRoundEnd: resolveLocalRoundEnd,
}

export function setGameplayResolvers(resolvers: Partial<GameplayResolvers>): void {
  gameplayResolvers = {
    ...gameplayResolvers,
    ...resolvers,
  }
}

export function requestBonk(request: BonkRequest): BonkResult {
  return gameplayResolvers.resolveBonk(request)
}

export function requestTurnToRock(request: TurnToRockRequest): TurnToRockResult {
  return gameplayResolvers.resolveTurnToRock(request)
}

export function requestRoundEnd(request: RoundEndRequest): RoundEndResult {
  return gameplayResolvers.resolveRoundEnd(request)
}

function resolveMissingBonk(request: BonkRequest): BonkResult {
  return {
    outcome: 'miss',
    request,
  }
}

function resolveMissingTurnToRock(request: TurnToRockRequest): TurnToRockResult {
  return {
    outcome: 'rejected',
    reason: 'missing-player-transform',
    request,
  }
}

function resolveLocalRoundEnd(request: RoundEndRequest): RoundEndResult {
  const round = recordLocalRoundEnded(request)

  if (!round) {
    return {
      outcome: 'ignored',
      reason: 'missing-runtime-state',
      request,
    }
  }

  return {
    outcome: 'recorded',
    request,
    round,
  }
}
