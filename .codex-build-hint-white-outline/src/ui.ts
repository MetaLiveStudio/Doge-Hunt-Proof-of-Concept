import { engine, Entity, Transform, TextShape, Billboard, BillboardMode } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

const CX = 48
const CZ = 48

interface KillFeedEntry {
  entity: Entity
  timer: number
}

const killFeedEntries: KillFeedEntry[] = []
const MAX_FEED_ENTRIES = 4

function removeEntityIfExists(entity: Entity | null): null {
  if (entity !== null && Transform.getOrNull(entity)) {
    engine.removeEntity(entity)
  }
  return null
}

export function addKillFeedMessage(message: string): void {
  // World-space kill feed disabled as per user request
  return
}

export function killFeedSystem(dt: number): void {
  for (let i = killFeedEntries.length - 1; i >= 0; i--) {
    killFeedEntries[i].timer -= dt
    if (killFeedEntries[i].timer <= 0) {
      engine.removeEntity(killFeedEntries[i].entity)
      killFeedEntries.splice(i, 1)
    }
  }
  for (let i = 0; i < killFeedEntries.length; i++) {
    if (!Transform.getOrNull(killFeedEntries[i].entity)) {
      killFeedEntries.splice(i, 1)
      i--
      continue
    }
    const t = Transform.getMutable(killFeedEntries[i].entity)
    t.position = Vector3.create(CX, 3.5 + i * 0.6, CZ)
  }
}

export function createWelcomeSign(): void {
  return
}

let bonkCounterEntity: Entity | null = null

export function createBonkCounter(): void {
  bonkCounterEntity = removeEntityIfExists(bonkCounterEntity)
  bonkCounterEntity = engine.addEntity()
  Transform.create(bonkCounterEntity, {
    position: Vector3.create(CX, 6.5, CZ),
  })
  TextShape.create(bonkCounterEntity, {
    text: 'BONKS: 0',
    fontSize: 4,
    textColor: Color4.create(1, 0.84, 0, 1),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.2,
  })
  Billboard.create(bonkCounterEntity, { billboardMode: BillboardMode.BM_Y })
}

export function updateBonkCounter(count: number): void {
  if (bonkCounterEntity !== null && TextShape.getOrNull(bonkCounterEntity)) {
    const text = TextShape.getMutable(bonkCounterEntity)
    text.text = `BONKS: ${count}`
  }
}

let timerEntity: Entity | null = null
export let roundTimeLeft = 180
export let roundOver = false

/** Reset round timer */
export function resetRoundTimer(): void {
  roundTimeLeft = 180
  roundOver = false
}

export function createRoundTimer(): void {
  timerEntity = removeEntityIfExists(timerEntity)
  timerEntity = engine.addEntity()
  Transform.create(timerEntity, {
    position: Vector3.create(CX, 7.5, CZ),
  })
  TextShape.create(timerEntity, {
    text: '3:00',
    fontSize: 6,
    textColor: Color4.create(0, 0.96, 1, 1),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.2,
  })
  Billboard.create(timerEntity, { billboardMode: BillboardMode.BM_Y })
}

export function roundTimerSystem(dt: number): void {
  if (roundOver) return
  roundTimeLeft -= dt
  if (roundTimeLeft <= 0) {
    roundTimeLeft = 0
    roundOver = true
    // addKillFeedMessage('ROUND OVER! Time is up.')
  }
}

let aliveEntity: Entity | null = null
let totalNpcCount = 0

export function createAliveCounter(total: number): void {
  totalNpcCount = total
  aliveEntity = removeEntityIfExists(aliveEntity)
  aliveEntity = engine.addEntity()
  Transform.create(aliveEntity, {
    position: Vector3.create(CX, 5.8, CZ),
  })
  TextShape.create(aliveEntity, {
    text: `DOGES ALIVE: ${total}/${total}`,
    fontSize: 3,
    textColor: Color4.create(0.22, 1, 0.08, 1),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.15,
  })
  Billboard.create(aliveEntity, { billboardMode: BillboardMode.BM_Y })
}

export function updateAliveCounter(alive: number): void {
  if (aliveEntity !== null && TextShape.getOrNull(aliveEntity)) {
    const text = TextShape.getMutable(aliveEntity)
    text.text = `DOGES ALIVE: ${alive}/${totalNpcCount}`
    if (alive <= 3) {
      text.textColor = Color4.create(1, 0.2, 0.2, 1)
    } else if (alive <= 6) {
      text.textColor = Color4.create(1, 0.84, 0, 1)
    }
  }
}

export function cleanupWorldUi(): void {
  for (const entry of killFeedEntries) {
    if (Transform.getOrNull(entry.entity)) {
      engine.removeEntity(entry.entity)
    }
  }
  killFeedEntries.length = 0

  bonkCounterEntity = removeEntityIfExists(bonkCounterEntity)
  timerEntity = removeEntityIfExists(timerEntity)
  aliveEntity = removeEntityIfExists(aliveEntity)
  totalNpcCount = 0
}
