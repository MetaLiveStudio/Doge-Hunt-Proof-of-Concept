export type LocalRoomPhase = 'empty' | 'waiting' | 'active'

export type LocalRoomPlayer = {
  id: string
  displayName: string
  isHost: boolean
  isReady: boolean
  isSimulated: boolean
}

export type LocalRoomSnapshot = {
  phase: LocalRoomPhase
  players: LocalRoomPlayer[]
  playerCount: number
  maxPlayers: number
  simulatedPlayerCount: number
  hostDisplayName: string
  canHostStart: boolean
  canAddFakePlayer: boolean
  canRemoveFakePlayer: boolean
}

const LOCAL_PLAYER_ID = 'local-player'
const MAX_PLAYERS = 10
const FAKE_PLAYER_NAMES = ['Luna', 'Nova', 'Cosmo', 'Stella', 'Orion', 'Milo', 'Pixel', 'Comet', 'Mochi']

let phase: LocalRoomPhase = 'empty'
let players: LocalRoomPlayer[] = []
let nextFakePlayerIndex = 0

export function createLocalRoom(): LocalRoomSnapshot {
  phase = 'waiting'
  nextFakePlayerIndex = 0
  players = [
    {
      id: LOCAL_PLAYER_ID,
      displayName: 'You',
      isHost: true,
      isReady: true,
      isSimulated: false,
    },
  ]

  return getLocalRoomSnapshot()
}

export function leaveLocalRoom(): void {
  phase = 'empty'
  players = []
  nextFakePlayerIndex = 0
}

export function addLocalFakePlayer(): LocalRoomSnapshot {
  if (!canAddLocalFakePlayer()) {
    return getLocalRoomSnapshot()
  }

  const fakePlayerNumber = nextFakePlayerIndex + 1
  const displayName = FAKE_PLAYER_NAMES[nextFakePlayerIndex] ?? `Doge ${fakePlayerNumber + 1}`
  players.push({
    id: `fake-player-${fakePlayerNumber}`,
    displayName,
    isHost: false,
    isReady: true,
    isSimulated: true,
  })
  nextFakePlayerIndex += 1

  return getLocalRoomSnapshot()
}

export function removeLocalFakePlayer(): LocalRoomSnapshot {
  if (!canRemoveLocalFakePlayer()) {
    return getLocalRoomSnapshot()
  }

  const fakePlayerIndex = findLastFakePlayerIndex()
  if (fakePlayerIndex >= 0) {
    players.splice(fakePlayerIndex, 1)
  }
  nextFakePlayerIndex = players.filter((player) => player.isSimulated).length

  return getLocalRoomSnapshot()
}

export function startLocalRoomMatch(): LocalRoomSnapshot {
  if (!canStartLocalRoomMatch()) {
    return getLocalRoomSnapshot()
  }

  phase = 'active'
  return getLocalRoomSnapshot()
}

export function canStartLocalRoomMatch(): boolean {
  if (phase !== 'waiting') return false
  if (players.length < 1) return false

  const host = players.find((player) => player.isHost)
  if (!host) return false

  return players.every((player) => player.isHost || player.isReady)
}

export function canAddLocalFakePlayer(): boolean {
  return phase === 'waiting' && players.length < MAX_PLAYERS
}

export function canRemoveLocalFakePlayer(): boolean {
  return phase === 'waiting' && findLastFakePlayerIndex() >= 0
}

export function getLocalRoomSnapshot(): LocalRoomSnapshot {
  const host = players.find((player) => player.isHost)
  const simulatedPlayerCount = players.filter((player) => player.isSimulated).length

  return {
    phase,
    players,
    playerCount: players.length,
    maxPlayers: MAX_PLAYERS,
    simulatedPlayerCount,
    hostDisplayName: host ? host.displayName : '',
    canHostStart: canStartLocalRoomMatch(),
    canAddFakePlayer: canAddLocalFakePlayer(),
    canRemoveFakePlayer: canRemoveLocalFakePlayer(),
  }
}

function findLastFakePlayerIndex(): number {
  for (let i = players.length - 1; i >= 0; i--) {
    if (players[i].isSimulated) return i
  }

  return -1
}
