export type ServerRoomPhase = 'empty' | 'waiting' | 'active' | 'settling'

export type ServerRoomPlayer = {
  id: string
  address: string
  displayName: string
  isHost: boolean
  isReady: boolean
  isSimulated: boolean
}

export type ServerRoomSnapshot = {
  roomId: string
  phase: ServerRoomPhase
  recipientAddress: string
  isLocalPlayerInRoom: boolean
  localPlayerIsHost: boolean
  localPlayerIsReady: boolean
  players: ServerRoomPlayer[]
  playerCount: number
  maxPlayers: number
  simulatedPlayerCount: number
  hostAddress: string
  hostDisplayName: string
  canHostStart: boolean
  canAddFakePlayer: boolean
  canRemoveFakePlayer: boolean
  settlingSecondsRemaining: number
  version: number
}

export const SERVER_ROOM_ID = 'doge-server-room'
export const SERVER_ROOM_MAX_PLAYERS = 4

export function createEmptyServerRoomSnapshot(): ServerRoomSnapshot {
  return {
    roomId: SERVER_ROOM_ID,
    phase: 'empty',
    recipientAddress: '',
    isLocalPlayerInRoom: false,
    localPlayerIsHost: false,
    localPlayerIsReady: false,
    players: [],
    playerCount: 0,
    maxPlayers: SERVER_ROOM_MAX_PLAYERS,
    simulatedPlayerCount: 0,
    hostAddress: '',
    hostDisplayName: '',
    canHostStart: false,
    canAddFakePlayer: false,
    canRemoveFakePlayer: false,
    settlingSecondsRemaining: 0,
    version: 0,
  }
}

export function parseServerRoomSnapshot(snapshotJson: string): ServerRoomSnapshot | null {
  try {
    return JSON.parse(snapshotJson) as ServerRoomSnapshot
  } catch (error) {
    console.log('[Client][P] Failed to parse server room snapshot:', error)
    return null
  }
}

export function getShortAddress(address: string): string {
  if (!address) return ''
  if (address.length <= 12) return address

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
