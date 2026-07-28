import { engine, Schemas } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

export const Leaderboard = engine.defineComponent('doge-hunt::Leaderboard', {
  names: Schemas.Array(Schemas.String),
  scores: Schemas.Array(Schemas.Int),
  updatedAt: Schemas.Int64,
})

export function registerLeaderboardValidators(): void {
  if (!isServer()) return

  const serverOnly = (value: { senderAddress: string }) =>
    value.senderAddress.toLowerCase() === AUTH_SERVER_PEER_ID.toLowerCase()

  Leaderboard.validateBeforeChange(serverOnly)
}
