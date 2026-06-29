import type { LocalRoomSnapshot } from './localRoom'

export type LocalMatchPhase = 'idle' | 'active'

export type LocalMatchPlayerSlot = {
  playerId: string
  displayName: string
  isLocal: boolean
  isHost: boolean
  isSimulated: boolean
}

export type LocalMatchConfig = {
  matchId: string
  phase: LocalMatchPhase
  totalDoges: number
  playerCount: number
  decoyNpcCount: number
  playerSlots: LocalMatchPlayerSlot[]
}

const DEFAULT_TOTAL_DOGES = 12
const LOCAL_PLAYER_ID = 'local-player'

let currentMatch: LocalMatchConfig | null = null
let nextMatchId = 1

export function startLocalMatch(room: LocalRoomSnapshot): LocalMatchConfig {
  const playerSlots = createPlayerSlots(room)
  const playerCount = Math.max(1, playerSlots.length)
  const totalDoges = DEFAULT_TOTAL_DOGES
  const decoyNpcCount = Math.max(0, totalDoges - playerCount)

  currentMatch = {
    matchId: `local-match-${nextMatchId++}`,
    phase: 'active',
    totalDoges,
    playerCount,
    decoyNpcCount,
    playerSlots,
  }

  return currentMatch
}

export function endLocalMatch(): void {
  currentMatch = null
}

export function getCurrentLocalMatch(): LocalMatchConfig | null {
  return currentMatch
}

export function getFallbackLocalMatchConfig(): LocalMatchConfig {
  return {
    matchId: 'local-match-fallback',
    phase: 'active',
    totalDoges: DEFAULT_TOTAL_DOGES,
    playerCount: 1,
    decoyNpcCount: DEFAULT_TOTAL_DOGES - 1,
    playerSlots: [
      {
        playerId: LOCAL_PLAYER_ID,
        displayName: 'You',
        isLocal: true,
        isHost: true,
        isSimulated: false,
      },
    ],
  }
}

function createPlayerSlots(room: LocalRoomSnapshot): LocalMatchPlayerSlot[] {
  const roomPlayers = room.players.length > 0
    ? room.players
    : [
        {
          id: LOCAL_PLAYER_ID,
          displayName: 'You',
          isHost: true,
          isReady: true,
          isSimulated: false,
        },
      ]

  return roomPlayers.map((player) => ({
    playerId: player.id,
    displayName: player.displayName,
    isLocal: player.id === LOCAL_PLAYER_ID,
    isHost: player.isHost,
    isSimulated: player.isSimulated,
  }))
}
