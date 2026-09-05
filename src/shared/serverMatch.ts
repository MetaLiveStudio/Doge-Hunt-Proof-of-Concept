import type { LocalMatchConfig, LocalMatchPlayerSlot } from '../localMatch'
import type {
  LocalMatchRuntimeSeed,
  PrivateDogeIdentityState,
  PrivatePlayerState,
  PublicDogeState,
} from '../localMatchState'

export type ServerMatchStartPayload = {
  matchConfig: LocalMatchConfig
  runtimeSeed: LocalMatchRuntimeSeed
  recipientAddress: string
  serverMatchId: string
  version: number
  isSpectator?: boolean
  isResume?: boolean
}

export const SERVER_MIN_TOTAL_DOGES = 12
export const LOCAL_RUNTIME_PLAYER_ID = 'local-player'

export function getServerTotalDoges(playerCount: number): number {
  const activePlayers = Math.max(1, Math.floor(playerCount))
  return Math.max(SERVER_MIN_TOTAL_DOGES, activePlayers * 2)
}

export function parseServerMatchStartPayload(payloadJson: string): ServerMatchStartPayload | null {
  try {
    return JSON.parse(payloadJson) as ServerMatchStartPayload
  } catch (error) {
    console.log('[Client][Q] Failed to parse matchStarted payload:', error)
    return null
  }
}

export function createServerPublicDoges(matchId: string, totalDoges = SERVER_MIN_TOTAL_DOGES): PublicDogeState[] {
  const doges: PublicDogeState[] = []

  for (let i = 0; i < totalDoges; i++) {
    doges.push({
      publicDogeId: `${matchId}-doge-${i + 1}`,
      label: `Doge ${i + 1}`,
      visualState: 'doge',
      isEliminated: false,
    })
  }

  return doges
}

export function createPrivatePlayerSeed(
  playerSlot: LocalMatchPlayerSlot,
  publicDogeId: string
): PrivatePlayerState {
  return {
    playerId: playerSlot.playerId,
    displayName: playerSlot.displayName,
    isLocal: playerSlot.isLocal,
    isHost: playerSlot.isHost,
    isSimulated: playerSlot.isSimulated,
    publicDogeId,
    isAlive: true,
    isSpectator: false,
    bonks: 0,
    turnToRock: {
      isActive: false,
      cooldownSeconds: 0,
    },
  }
}

export function createPresentationDogeIdentities(
  publicDoges: PublicDogeState[],
  playerCount: number,
  localPlayerPublicDogeId: string,
  localPlayerId = LOCAL_RUNTIME_PLAYER_ID
): PrivateDogeIdentityState[] {
  const identities: PrivateDogeIdentityState[] = [
    {
      publicDogeId: localPlayerPublicDogeId,
      kind: 'player',
      ownerPlayerId: localPlayerId,
    },
  ]

  for (let i = playerCount; i < publicDoges.length; i++) {
    identities.push({
      publicDogeId: publicDoges[i].publicDogeId,
      kind: 'decoy',
    })
  }

  return identities
}
