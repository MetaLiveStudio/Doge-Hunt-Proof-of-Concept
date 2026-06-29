import type { LocalMatchConfig, LocalMatchPlayerSlot } from './localMatch'

export type PublicDogeVisualState = 'doge' | 'rock' | 'eliminated'

export type PublicDogeState = {
  publicDogeId: string
  label: string
  visualState: PublicDogeVisualState
  isEliminated: boolean
}

export type PrivateDogeKind = 'player' | 'decoy'

export type PrivateDogeIdentityState = {
  publicDogeId: string
  kind: PrivateDogeKind
  ownerPlayerId?: string
}

export type PrivatePlayerState = {
  playerId: string
  displayName: string
  isLocal: boolean
  isHost: boolean
  isSimulated: boolean
  publicDogeId: string
  isAlive: boolean
  bonks: number
  turnToRock: {
    isActive: boolean
    cooldownSeconds: number
  }
}

export type LocalRoundEndReason = 'all-doges-eliminated' | 'time-up'

export type LocalRoundState = {
  phase: 'active' | 'ended'
  endReason: LocalRoundEndReason | null
  timeLeftSeconds: number
  elapsedSeconds: number
  finalBonks: number
  finalAliveDoges: number
  totalDoges: number
  winnerPlayerId?: string
}

export type LocalMatchRuntimeState = {
  matchId: string
  totalDoges: number
  playerCount: number
  decoyNpcCount: number
  playerSlots: LocalMatchPlayerSlot[]
  publicDoges: PublicDogeState[]
  privatePlayers: PrivatePlayerState[]
  privatePlayer: PrivatePlayerState
  round: LocalRoundState
}

export type LocalMatchStatsFallback = {
  bonks?: number
  alive?: number
  total?: number
  timeLeft?: number
  roundOver?: boolean
}

export type LocalMatchStats = {
  bonks: number
  alive: number
  total: number
  timeLeft: number
  elapsedSeconds: number
  roundOver: boolean
  roundEndReason: LocalRoundEndReason | null
  playerCount: number
  decoyNpcCount: number
  publicAliveDoges: number
  localPlayerBonks: number
  localPlayerId: string
}

export type LocalPublicMatchState = {
  matchId: string
  totalDoges: number
  playerCount: number
  decoyNpcCount: number
  publicDoges: PublicDogeState[]
  round: LocalRoundState
}

export type LocalPrivateMatchState = {
  localPlayer: PrivatePlayerState
  players: PrivatePlayerState[]
  dogeIdentities: PrivateDogeIdentityState[]
}

export type LocalPresentationMatchState = {
  decoyPublicDogeIds: string[]
  stats: LocalMatchStats
}

const LOCAL_PLAYER_ID = 'local-player'
const ROUND_DURATION_SECONDS = 180

let runtimeState: LocalMatchRuntimeState | null = null
let privateDogeIdentities: PrivateDogeIdentityState[] = []

export function initializeLocalMatchRuntimeState(matchConfig: LocalMatchConfig): LocalMatchRuntimeState {
  const playerSlots = getRuntimePlayerSlots(matchConfig)
  const publicDoges = createPublicDogeStates(matchConfig)
  const localPlayerDogeId = publicDoges[0]?.publicDogeId ?? `${matchConfig.matchId}-doge-1`
  const privatePlayers = playerSlots.map((playerSlot, index) => {
    const publicDogeId = publicDoges[index]?.publicDogeId ?? localPlayerDogeId

    return createPrivatePlayerState(playerSlot, publicDogeId)
  })
  const localPrivatePlayer = privatePlayers.find((player) => player.playerId === LOCAL_PLAYER_ID)
    ?? privatePlayers[0]

  privateDogeIdentities = publicDoges.map((doge, index) => {
    const playerSlot = playerSlots[index]

    if (playerSlot) {
      return {
        publicDogeId: doge.publicDogeId,
        kind: 'player',
        ownerPlayerId: playerSlot.playerId,
      }
    }

    return {
      publicDogeId: doge.publicDogeId,
      kind: 'decoy',
    }
  })

  runtimeState = {
    matchId: matchConfig.matchId,
    totalDoges: matchConfig.totalDoges,
    playerCount: matchConfig.playerCount,
    decoyNpcCount: matchConfig.decoyNpcCount,
    playerSlots,
    publicDoges,
    privatePlayers,
    privatePlayer: localPrivatePlayer,
    round: createActiveRoundState(matchConfig.decoyNpcCount),
  }

  return runtimeState
}

export function resetLocalMatchRuntimeState(): void {
  runtimeState = null
  privateDogeIdentities = []
}

export function getLocalMatchRuntimeState(): LocalMatchRuntimeState | null {
  return runtimeState
}

export function getLocalPublicDogeStates(): PublicDogeState[] {
  return runtimeState ? runtimeState.publicDoges : []
}

export function getLocalPrivatePlayerState(): PrivatePlayerState | null {
  return runtimeState ? runtimeState.privatePlayer : null
}

export function getLocalPrivatePlayerStates(): PrivatePlayerState[] {
  return runtimeState ? runtimeState.privatePlayers : []
}

export function getLocalPrivateDogeIdentities(): PrivateDogeIdentityState[] {
  return privateDogeIdentities
}

export function getLocalPublicMatchState(): LocalPublicMatchState | null {
  if (!runtimeState) return null

  return {
    matchId: runtimeState.matchId,
    totalDoges: runtimeState.totalDoges,
    playerCount: runtimeState.playerCount,
    decoyNpcCount: runtimeState.decoyNpcCount,
    publicDoges: [...runtimeState.publicDoges],
    round: runtimeState.round,
  }
}

export function getLocalPrivateMatchState(): LocalPrivateMatchState | null {
  if (!runtimeState) return null

  return {
    localPlayer: runtimeState.privatePlayer,
    players: [...runtimeState.privatePlayers],
    dogeIdentities: [...privateDogeIdentities],
  }
}

export function getLocalPresentationMatchState(
  fallback: LocalMatchStatsFallback = {}
): LocalPresentationMatchState {
  return {
    decoyPublicDogeIds: getLocalDecoyPublicDogeIds(),
    stats: getLocalMatchStats(fallback),
  }
}

export function getLocalPublicDogeState(publicDogeId: string): PublicDogeState | null {
  return findPublicDoge(publicDogeId)
}

export function getLocalDecoyPublicDogeIds(): string[] {
  if (!runtimeState) return []

  return runtimeState.publicDoges
    .slice(runtimeState.playerCount, runtimeState.playerCount + runtimeState.decoyNpcCount)
    .map((doge) => doge.publicDogeId)
}

export function getLocalMatchStats(fallback: LocalMatchStatsFallback = {}): LocalMatchStats {
  const round = runtimeState?.round
  const roundHasEnded = round?.phase === 'ended'
  const fallbackTimeLeft = fallback.timeLeft ?? ROUND_DURATION_SECONDS
  const timeLeft = roundHasEnded
    ? round.timeLeftSeconds
    : clampSeconds(fallbackTimeLeft)

  const publicAliveDoges = getAlivePublicDecoyCount()
  const runtimeBonks = runtimeState?.privatePlayer.bonks ?? 0
  const runtimeTotal = runtimeState?.decoyNpcCount ?? fallback.total ?? 0

  return {
    bonks: fallback.bonks ?? runtimeBonks,
    alive: fallback.alive ?? publicAliveDoges,
    total: fallback.total ?? runtimeTotal,
    timeLeft,
    elapsedSeconds: roundHasEnded
      ? round.elapsedSeconds
      : Math.max(0, ROUND_DURATION_SECONDS - timeLeft),
    roundOver: Boolean(fallback.roundOver) || roundHasEnded,
    roundEndReason: round?.endReason ?? null,
    playerCount: runtimeState?.playerCount ?? 1,
    decoyNpcCount: runtimeState?.decoyNpcCount ?? runtimeTotal,
    publicAliveDoges,
    localPlayerBonks: runtimeBonks,
    localPlayerId: runtimeState?.privatePlayer.playerId ?? LOCAL_PLAYER_ID,
  }
}

export function recordLocalBonkHit(publicDogeId: string | null): void {
  if (!runtimeState) return

  runtimeState.privatePlayer.bonks += 1
  recordLocalDogeEliminated(publicDogeId)
}

export function recordLocalDogeEliminated(publicDogeId: string | null): void {
  if (!runtimeState || !publicDogeId) return

  const publicDoge = findPublicDoge(publicDogeId)
  if (!publicDoge) return

  publicDoge.isEliminated = true
  publicDoge.visualState = 'eliminated'
}

export function recordLocalTurnToRockActivated(playerId: string): void {
  const privatePlayer = findPrivatePlayer(playerId)
  if (!privatePlayer) return

  privatePlayer.turnToRock.isActive = true
  privatePlayer.turnToRock.cooldownSeconds = 0
  setPublicDogeVisualState(privatePlayer.publicDogeId, 'rock')
}

export function recordLocalTurnToRockEnded(playerId: string, cooldownSeconds: number): void {
  const privatePlayer = findPrivatePlayer(playerId)
  if (!privatePlayer) return

  privatePlayer.turnToRock.isActive = false
  privatePlayer.turnToRock.cooldownSeconds = Math.max(0, cooldownSeconds)
  setPublicDogeVisualState(privatePlayer.publicDogeId, 'doge')
}

export function recordLocalTurnToRockCooldown(playerId: string, cooldownSeconds: number): void {
  const privatePlayer = findPrivatePlayer(playerId)
  if (!privatePlayer) return

  privatePlayer.turnToRock.cooldownSeconds = Math.max(0, cooldownSeconds)
}

export function recordLocalRoundEnded(input: {
  reason: LocalRoundEndReason
  bonks: number
  aliveDoges: number
  totalDoges: number
  timeLeftSeconds: number
  elapsedSeconds: number
}): LocalRoundState | null {
  if (!runtimeState) return null
  if (runtimeState.round.phase === 'ended') return runtimeState.round

  runtimeState.round = {
    phase: 'ended',
    endReason: input.reason,
    timeLeftSeconds: clampSeconds(input.timeLeftSeconds),
    elapsedSeconds: Math.max(0, input.elapsedSeconds),
    finalBonks: Math.max(0, input.bonks),
    finalAliveDoges: Math.max(0, input.aliveDoges),
    totalDoges: Math.max(0, input.totalDoges),
    winnerPlayerId: input.reason === 'all-doges-eliminated'
      ? runtimeState.privatePlayer.playerId
      : undefined,
  }

  return runtimeState.round
}

function getRuntimePlayerSlots(matchConfig: LocalMatchConfig): LocalMatchPlayerSlot[] {
  if (matchConfig.playerSlots.length > 0) {
    return matchConfig.playerSlots
  }

  return [
    {
      playerId: LOCAL_PLAYER_ID,
      displayName: 'You',
      isLocal: true,
      isHost: true,
      isSimulated: false,
    },
  ]
}

function createPrivatePlayerState(
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
    bonks: 0,
    turnToRock: {
      isActive: false,
      cooldownSeconds: 0,
    },
  }
}

function createActiveRoundState(totalDoges: number): LocalRoundState {
  return {
    phase: 'active',
    endReason: null,
    timeLeftSeconds: ROUND_DURATION_SECONDS,
    elapsedSeconds: 0,
    finalBonks: 0,
    finalAliveDoges: totalDoges,
    totalDoges,
  }
}

function createPublicDogeStates(matchConfig: LocalMatchConfig): PublicDogeState[] {
  const doges: PublicDogeState[] = []

  for (let i = 0; i < matchConfig.totalDoges; i++) {
    doges.push({
      publicDogeId: `${matchConfig.matchId}-doge-${i + 1}`,
      label: `Doge ${i + 1}`,
      visualState: 'doge',
      isEliminated: false,
    })
  }

  return doges
}

function findPrivatePlayer(playerId: string): PrivatePlayerState | null {
  if (!runtimeState) return null

  return runtimeState.privatePlayers.find((player) => player.playerId === playerId) ?? null
}

function findPublicDoge(publicDogeId: string): PublicDogeState | null {
  if (!runtimeState) return null

  return runtimeState.publicDoges.find((doge) => doge.publicDogeId === publicDogeId) ?? null
}

function setPublicDogeVisualState(publicDogeId: string, visualState: PublicDogeVisualState): void {
  const publicDoge = findPublicDoge(publicDogeId)
  if (!publicDoge || publicDoge.isEliminated) return

  publicDoge.visualState = visualState
}

function getAlivePublicDecoyCount(): number {
  if (!runtimeState) return 0

  const decoyPublicDogeIds = new Set(
    privateDogeIdentities
      .filter((identity) => identity.kind === 'decoy')
      .map((identity) => identity.publicDogeId)
  )

  return runtimeState.publicDoges.filter((doge) => {
    return decoyPublicDogeIds.has(doge.publicDogeId) && !doge.isEliminated
  }).length
}

function clampSeconds(seconds: number): number {
  return Math.max(0, seconds)
}
