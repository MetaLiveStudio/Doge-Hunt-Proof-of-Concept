import type { ServerPublicPlayerState } from './serverPublicState'

export type RankedServerPlayer = {
  rank: number
  address: string
  displayName: string
  bonks: number
  isWinner: boolean
  eliminationOrder: number
}

type RankablePlayer = Pick<
  ServerPublicPlayerState,
  'address' | 'displayName' | 'bonks' | 'status' | 'isAlive' | 'eliminationOrder'
>

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

function compareRankablePlayers(
  a: { isWinner: boolean; eliminationOrder: number; bonks: number },
  b: { isWinner: boolean; eliminationOrder: number; bonks: number }
): number {
  if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1

  const aEliminated = a.eliminationOrder > 0
  const bEliminated = b.eliminationOrder > 0
  if (aEliminated !== bEliminated) return aEliminated ? 1 : -1
  if (aEliminated && bEliminated) return b.eliminationOrder - a.eliminationOrder

  return b.bonks - a.bonks
}

export function rankServerPlayers(
  players: RankablePlayer[],
  winnerAddress: string
): RankedServerPlayer[] {
  const normalizedWinner = normalizeAddress(winnerAddress)

  return players
    .map((player) => {
      const isWinner = Boolean(normalizedWinner && normalizeAddress(player.address) === normalizedWinner)

      return {
        rank: 0,
        address: player.address,
        displayName: player.displayName || 'Player',
        bonks: player.bonks,
        isWinner,
        eliminationOrder: player.eliminationOrder ?? 0,
      }
    })
    .sort(compareRankablePlayers)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }))
}
