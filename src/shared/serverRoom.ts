export type ServerRoomPhase = 'empty' | 'waiting' | 'starting' | 'active' | 'settling'

export type ServerRoomPlayer = {
  id: string
  address: string
  displayName: string
  isHost: boolean
  isReady: boolean
  isSimulated: boolean
}

export type ServerRoomSpectator = {
  address: string
  displayName: string
}

export type ServerRoomSnapshot = {
  roomId: string
  phase: ServerRoomPhase
  recipientAddress: string
  isLocalPlayerInRoom: boolean
  isLocalSpectator: boolean
  localPlayerIsHost: boolean
  localPlayerIsReady: boolean
  players: ServerRoomPlayer[]
  spectatorCount: number
  maxSpectators: number
  playerCount: number
  maxPlayers: number
  simulatedPlayerCount: number
  hostAddress: string
  hostDisplayName: string
  canHostStart: boolean
  canHostStartSolo: boolean
  startCountdownSeconds: number
  canAddFakePlayer: boolean
  canRemoveFakePlayer: boolean
  settlingSecondsRemaining: number
  version: number
}

export const SERVER_ROOM_ID = 'doge-server-room'
export const SERVER_ROOM_MAX_PLAYERS = 10
export const SERVER_ROOM_MAX_SPECTATORS = 5

export function createEmptyServerRoomSnapshot(): ServerRoomSnapshot {
  return {
    roomId: SERVER_ROOM_ID,
    phase: 'empty',
    recipientAddress: '',
    isLocalPlayerInRoom: false,
    isLocalSpectator: false,
    localPlayerIsHost: false,
    localPlayerIsReady: false,
    players: [],
    spectatorCount: 0,
    maxSpectators: SERVER_ROOM_MAX_SPECTATORS,
    playerCount: 0,
    maxPlayers: SERVER_ROOM_MAX_PLAYERS,
    simulatedPlayerCount: 0,
    hostAddress: '',
    hostDisplayName: '',
    canHostStart: false,
    canHostStartSolo: false,
    startCountdownSeconds: 0,
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
