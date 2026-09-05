import type { Entity } from '@dcl/sdk/ecs'
import type { Vector3 } from '@dcl/sdk/math'
import { recordLocalRoundEnded } from './localMatchState'
import type { LocalRoundEndReason, LocalRoundState } from './localMatchState'

export type BonkRequest = {
  attackerPlayerId: string
  origin: Vector3
  forward: Vector3
  candidatePublicDogeId?: string
  candidateTargetNpc?: Entity
  aimedPlayerPublicDogeId?: string
  aimForward?: Vector3
}

export type BonkActionStartRequest = {
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
      outcome: 'pending'
      request: BonkRequest
      requestId: string
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
      outcome: 'pending'
      request: TurnToRockRequest
      requestId: string
    }
  | {
      outcome: 'rejected'
      reason: 'missing-player-transform' | 'already-active' | 'cooldown' | 'pending-server-result' | 'server-rejected'
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
      outcome: 'pending'
      request: RoundEndRequest
      requestId: string
    }
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
  notifyBonkActionStart: (request: BonkActionStartRequest) => void
  resolveBonk: (request: BonkRequest) => BonkResult
  resolveTurnToRock: (request: TurnToRockRequest) => TurnToRockResult
  resolveRoundEnd: (request: RoundEndRequest) => RoundEndResult
}

let gameplayResolvers: GameplayResolvers = {
  notifyBonkActionStart: notifyMissingBonkActionStart,
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

export function notifyBonkActionStart(request: BonkActionStartRequest): void {
  gameplayResolvers.notifyBonkActionStart(request)
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

function notifyMissingBonkActionStart(_request: BonkActionStartRequest): void {
  // Local fallback has no remote peers to notify.
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
