import { engine, Schemas } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

export const SERVER_HEARTBEAT_INTERVAL_SECONDS = 2
export const SERVER_HEARTBEAT_TIMEOUT_SECONDS = 6

export const ServerHeartbeat = engine.defineComponent('doge-hunt::ServerHeartbeat', {
  timestamp: Schemas.Int64,
})

export function registerServerHeartbeatValidators(): void {
  if (!isServer()) return

  ServerHeartbeat.validateBeforeChange((value) => {
    return value.senderAddress.toLowerCase() === AUTH_SERVER_PEER_ID.toLowerCase()
  })
}
