import { getDogeRoom } from '../shared/messages'
import { applyServerNpcSnapshot } from '../npc'
import { parseServerNpcSnapshotPayload } from '../shared/serverNpcSnapshot'
import {
  parseServerPublicMatchSnapshot,
  type ServerPublicMatchSnapshot,
  type ServerPlayerStatus,
  type ServerPublicPlayerState,
} from '../shared/serverPublicState'
import { rankServerPlayers } from '../shared/leaderboardRanking'
import type { LocalMatchStats } from '../localMatchState'

export type ServerResultOutcome = {
  isWin: boolean
  title: string
  subtitle: string
}

export type ServerResultRevealPlayer = {
  rank: number
  displayName: string
  shortAddress: string
  dogeLabel: string
  statusLabel: string
  bonks: number
  isLocal: boolean
  isWinner: boolean
  eliminationOrder: number
}

export type ServerResultsRevealData = {
  endReasonLabel: string
  winnerLabel: string
  players: ServerResultRevealPlayer[]
  decoyCount: number
  decoyAlive: number
  decoyEliminated: number
}

let publicStateClientStarted = false
let latestSnapshot: ServerPublicMatchSnapshot | null = null
let localServerAddress = ''

export function setupServerPublicStateClient(): void {
  if (publicStateClientStarted) return
  publicStateClientStarted = true

  getDogeRoom().onMessage('publicStateSnapshot', (data) => {
    const parsed = parseServerPublicMatchSnapshot(data.snapshotJson)

    if (!parsed) {
      console.log('[Client][R] publicStateSnapshot ignored invalid payload.')
      return
    }

    latestSnapshot = parsed
    console.log(`[Client][R] publicStateSnapshot received matchId=${parsed.matchId} reason=${parsed.reason} version=${parsed.version} targetAlive=${parsed.targetDogesAlive}/${parsed.targetDogesTotal} timeLeft=${parsed.timeLeftSeconds} end=${parsed.endReason || 'none'} winner=${parsed.winnerAddress || 'none'}`)
  })

  getDogeRoom().onMessage('npcStateSnapshot', (data) => {
    const parsed = parseServerNpcSnapshotPayload(data.payloadJson)
    if (!parsed) {
      console.log('[Client][W2] npcStateSnapshot ignored invalid payload.')
      return
    }

    applyServerNpcSnapshot(parsed)
  })
}

export function resetServerPublicMatchSnapshot(): void {
  latestSnapshot = null
  localServerAddress = ''
}

export function setServerPublicLocalAddress(address: string): void {
  localServerAddress = normalizeAddress(address)
  console.log(`[Client][T] local server address set address=${localServerAddress}`)
}

export function getLocalServerAddress(): string {
  return localServerAddress
}

export function getServerPublicMatchSnapshot(matchId?: string): ServerPublicMatchSnapshot | null {
  if (!latestSnapshot) return null
  if (matchId && latestSnapshot.matchId !== matchId) return null

  return latestSnapshot
}

export function getLocalServerPublicPlayer(): ServerPublicPlayerState | null {
  if (!latestSnapshot) return null

  if (localServerAddress) {
    const byAddress = latestSnapshot.players.find((player) => normalizeAddress(player.address) === localServerAddress)
    if (byAddress) return byAddress
  }

  return latestSnapshot.players.length === 1 ? latestSnapshot.players[0] : null
}

export function getLocalServerPlayerStatus(): ServerPlayerStatus | 'unknown' {
  return getLocalServerPublicPlayer()?.status ?? 'unknown'
}

export function canLocalServerPlayerAct(): boolean {
  const player = getLocalServerPublicPlayer()
  if (!player) return true

  return player.isAlive && player.status === 'active'
}

export function getLocalServerPlayerStatusLabel(): string {
  const player = getLocalServerPublicPlayer()
  if (!player) return 'ACTIVE'
  if (player.status === 'active' && player.isAlive) return 'ACTIVE'
  if (player.status === 'spectator') return 'SPECTATING'

  return 'OUT'
}

export function getServerResultsRevealData(matchId: string): ServerResultsRevealData | null {
  const snapshot = getServerPublicMatchSnapshot(matchId)
  if (!snapshot || !snapshot.roundOver) return null

  const winnerAddress = normalizeAddress(snapshot.winnerAddress)
  const playerDogeIds = new Set(snapshot.players.map((player) => player.publicDogeId))
  const decoys = snapshot.publicDoges.filter((doge) => !playerDogeIds.has(doge.publicDogeId))
  const decoyAlive = decoys.filter((doge) => !doge.isEliminated).length

  const winnerPlayer = snapshot.players.find((player) => normalizeAddress(player.address) === winnerAddress)
  const winnerLabel = winnerPlayer
    ? `${winnerPlayer.displayName || 'Player'} as ${shortDogeId(winnerPlayer.publicDogeId)}`
    : 'No winner'

  const revealPlayers = rankServerPlayers(snapshot.players, snapshot.winnerAddress).map((player) => {
    const sourcePlayer = snapshot.players.find((entry) => normalizeAddress(entry.address) === normalizeAddress(player.address))
    const normalizedAddress = normalizeAddress(player.address)
    const isLocal = Boolean(localServerAddress && normalizedAddress === localServerAddress)

    return {
      rank: player.rank,
      displayName: isLocal ? 'You' : player.displayName,
      shortAddress: shortAddress(player.address),
      dogeLabel: shortDogeId(sourcePlayer?.publicDogeId ?? ''),
      statusLabel: player.isWinner
        ? 'WINNER'
        : sourcePlayer?.status === 'active' && sourcePlayer?.isAlive
          ? 'SURVIVED'
          : 'ELIMINATED',
      bonks: player.bonks,
      isLocal,
      isWinner: player.isWinner,
      eliminationOrder: player.eliminationOrder,
    }
  })

  return {
    endReasonLabel: snapshot.endReason ? formatEndReason(snapshot.endReason) : 'Round ended',
    winnerLabel,
    players: revealPlayers,
    decoyCount: decoys.length,
    decoyAlive,
    decoyEliminated: Math.max(0, decoys.length - decoyAlive),
  }
}

export function getServerResultsRevealLines(matchId: string): string[] {
  const snapshot = getServerPublicMatchSnapshot(matchId)
  if (!snapshot || !snapshot.roundOver) return []

  const revealLines: string[] = []
  if (snapshot.endReason) {
    revealLines.push(`End: ${formatEndReason(snapshot.endReason)}`)
  }

  if (snapshot.winnerAddress) {
    revealLines.push(`Winner: ${snapshot.winnerDisplayName || 'Player'} ${shortDogeId(snapshot.winnerPublicDogeId)}`)
  }

  const playerLines = snapshot.players.map((player) => {
    const status = player.status === 'active' && player.isAlive ? 'active' : 'out'
    return `${player.displayName} ${shortDogeId(player.publicDogeId)} (${status})`
  })

  const playerDogeIds = new Set(snapshot.players.map((player) => player.publicDogeId))
  const decoyLabels = snapshot.publicDoges
    .filter((doge) => !playerDogeIds.has(doge.publicDogeId))
    .map((doge) => shortDogeId(doge.publicDogeId))

  if (playerLines.length > 0) {
    revealLines.push(`Players: ${playerLines.join(', ')}`)
  }

  for (let i = 0; i < decoyLabels.length; i += 4) {
    revealLines.push(`Decoys: ${decoyLabels.slice(i, i + 4).join(', ')}`)
  }

  return revealLines
}

export function mergeServerPublicStats(matchId: string, localStats: LocalMatchStats): LocalMatchStats {
  const snapshot = getServerPublicMatchSnapshot(matchId)
  if (!snapshot) return localStats

  return {
    ...localStats,
    alive: Math.min(localStats.alive, snapshot.targetDogesAlive),
    total: snapshot.targetDogesTotal,
    timeLeft: snapshot.timeLeftSeconds,
    elapsedSeconds: snapshot.elapsedSeconds,
    roundOver: localStats.roundOver || snapshot.roundOver,
    roundEndReason: snapshot.endReason || localStats.roundEndReason,
    publicAliveDoges: snapshot.publicAliveDoges,
    decoyNpcCount: snapshot.targetDogesTotal,
  }
}

export function getServerPublicHudLabel(matchId: string): string {
  const snapshot = getServerPublicMatchSnapshot(matchId)
  if (!snapshot) return ''

  const activePlayers = snapshot.players.filter((player) => player.isAlive && player.status === 'active').length
  return `Server public v${snapshot.version} | ${snapshot.timeLeftSeconds}s | players ${activePlayers}/${snapshot.players.length}`
}

export function getServerResultOutcome(matchId: string, fallbackAlive: number): ServerResultOutcome | null {
  const snapshot = getServerPublicMatchSnapshot(matchId)
  if (!snapshot || !snapshot.roundOver) return null

  const localPlayer = getLocalServerPublicPlayer()
  const localIsWinner = Boolean(
    snapshot.winnerAddress &&
    localPlayer &&
    normalizeAddress(snapshot.winnerAddress) === normalizeAddress(localPlayer.address)
  )

  if (snapshot.endReason === 'final-survivor') {
    return {
      isWin: localIsWinner,
      title: localIsWinner ? 'Round Complete' : 'GAME OVER',
      subtitle: localIsWinner ? 'You Win: Last Doge Standing' : 'You Lose',
    }
  }

  if (snapshot.endReason === 'all-doges-eliminated') {
    return {
      isWin: snapshot.winnerAddress ? localIsWinner : true,
      title: 'Round Complete',
      subtitle: snapshot.winnerAddress && !localIsWinner ? 'Round Complete' : 'You Win',
    }
  }

  if (snapshot.endReason === 'time-up') {
    return {
      isWin: false,
      title: 'GAME OVER',
      subtitle: 'Time Up',
    }
  }

  return {
    isWin: fallbackAlive === 0,
    title: fallbackAlive === 0 ? 'Round Complete' : 'GAME OVER',
    subtitle: fallbackAlive === 0 ? 'You Win' : 'You Lose',
  }
}

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

function shortDogeId(publicDogeId: string): string {
  const match = publicDogeId.match(/doge-(\d+)$/)
  return match ? `Doge ${match[1]}` : publicDogeId
}

function shortAddress(address: string): string {
  if (!address) return ''
  if (address.length <= 12) return address

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatEndReason(reason: string): string {
  if (reason === 'final-survivor') return 'Final survivor'
  if (reason === 'all-doges-eliminated') return 'All Doges eliminated'
  if (reason === 'time-up') return 'Time up'

  return reason
}
