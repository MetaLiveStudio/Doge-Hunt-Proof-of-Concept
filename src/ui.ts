import { engine, Entity, Transform, TextShape, Billboard, BillboardMode } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

const CX = 24
const CZ = 24

interface KillFeedEntry {
  entity: Entity
  timer: number
}

const killFeedEntries: KillFeedEntry[] = []
const MAX_FEED_ENTRIES = 4

export function addKillFeedMessage(message: string): void {
  if (killFeedEntries.length >= MAX_FEED_ENTRIES) {
    const oldest = killFeedEntries.shift()
    if (oldest) engine.removeEntity(oldest.entity)
  }

  const entity = engine.addEntity()
  const yOffset = 3.5 + killFeedEntries.length * 0.6

  Transform.create(entity, {
    position: Vector3.create(CX, yOffset, CZ),
  })

  TextShape.create(entity, {
    text: message,
    fontSize: 3,
    textColor: Color4.create(1, 0.84, 0, 1),
    outlineColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0.15,
  })

  Billboard.create(entity, { billboardMode: BillboardMode.BM_Y })
  killFeedEntries.push({ entity, timer: 4 })
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
    const t = Transform.getMutable(killFeedEntries[i].entity)
    t.position = Vector3.create(CX, 3.5 + i * 0.6, CZ)
  }
}

export function createWelcomeSign(): void {
  return
}

let bonkCounterEntity: Entity | null = null

export function createBonkCounter(): void {
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
  if (bonkCounterEntity !== null) {
    const text = TextShape.getMutable(bonkCounterEntity)
    text.text = `BONKS: ${count}`
  }
}

let timerEntity: Entity | null = null
export let roundTimeLeft = 180
export let roundOver = false

export function createRoundTimer(): void {
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
    addKillFeedMessage('ROUND OVER! Time is up.')
  }
  if (timerEntity !== null) {
    const minutes = Math.floor(roundTimeLeft / 60)
    const seconds = Math.floor(roundTimeLeft % 60)
    const text = TextShape.getMutable(timerEntity)
    text.text = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
    if (roundTimeLeft <= 30 && !roundOver) {
      text.textColor = Color4.create(1, 0.2, 0.2, 1)
    }
  }
}

let aliveEntity: Entity | null = null
let totalNpcCount = 0

export function createAliveCounter(total: number): void {
  totalNpcCount = total
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
  if (aliveEntity !== null) {
    const text = TextShape.getMutable(aliveEntity)
    text.text = `DOGES ALIVE: ${alive}/${totalNpcCount}`
    if (alive <= 3) {
      text.textColor = Color4.create(1, 0.2, 0.2, 1)
    } else if (alive <= 6) {
      text.textColor = Color4.create(1, 0.84, 0, 1)
    }
  }
}
