import { engine } from '@dcl/sdk/ecs'

let serverDiagnosticsStarted = false
let clientDiagnosticsStarted = false

export function setupO4ServerDiagnostics(): void {
  if (serverDiagnosticsStarted) return
  serverDiagnosticsStarted = true

  console.log('[Server][O4] Runtime diagnostics registered.')

  let elapsedSeconds = 0
  let heartbeatLogged = false

  engine.addSystem((dt: number) => {
    if (heartbeatLogged) return

    elapsedSeconds += dt
    if (elapsedSeconds < 1) return

    heartbeatLogged = true
    console.log('[Server][O4] Runtime heartbeat confirmed after first server tick.')
  })
}

export function setupO4ClientDiagnostics(): void {
  if (clientDiagnosticsStarted) return
  clientDiagnosticsStarted = true

  console.log('[Client][O4] Runtime diagnostics registered.')

  let firstFrameLogged = false
  engine.addSystem(() => {
    if (firstFrameLogged) return

    firstFrameLogged = true
    console.log('[Client][O4] First client frame confirmed.')
  })
}
