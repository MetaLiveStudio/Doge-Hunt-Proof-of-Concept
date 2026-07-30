import { engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'

import {
  SERVER_HEARTBEAT_INTERVAL_SECONDS,
  ServerHeartbeat,
} from '../shared/serverHeartbeat'

let serverHeartbeatStarted = false

export function setupServerHeartbeat(): void {
  if (serverHeartbeatStarted) return
  serverHeartbeatStarted = true

  const heartbeatEntity = engine.addEntity()
  ServerHeartbeat.create(heartbeatEntity, { timestamp: Date.now() })
  syncEntity(heartbeatEntity, [ServerHeartbeat.componentId])

  let elapsedSeconds = 0
  engine.addSystem((dt: number) => {
    elapsedSeconds += dt
    if (elapsedSeconds < SERVER_HEARTBEAT_INTERVAL_SECONDS) return

    elapsedSeconds = 0
    ServerHeartbeat.getMutable(heartbeatEntity).timestamp = Date.now()
  })

  console.log('[Server][O4] Synced multiplayer-server heartbeat started.')
}
