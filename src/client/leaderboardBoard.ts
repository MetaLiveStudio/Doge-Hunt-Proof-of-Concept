import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  TextShape,
  TextAlignMode,
  VisibilityComponent,
  InputAction,
  pointerEventsSystem,
  ColliderLayer,
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import { LEADERBOARD_PAGE_SIZE } from '../shared/leaderboardConfig'
import { Leaderboard } from '../shared/leaderboardSchemas'

// Dog head ~ (48, 1.55, 48). Board offset 0.5m on X/Y from dog head.
const DOG_HEAD_POSITION = Vector3.create(55, 1.5,54)
const BOARD_OFFSET_FROM_DOG = 1
const BOARD_SCALE = 1.5
const BOARD_POSITION = Vector3.create(
  DOG_HEAD_POSITION.x + BOARD_OFFSET_FROM_DOG,
  DOG_HEAD_POSITION.y + BOARD_OFFSET_FROM_DOG,
  DOG_HEAD_POSITION.z
)
const BOARD_Y_ROTATION = -100
const BOARD_WIDTH = 4.8 * BOARD_SCALE
const BOARD_DEPTH = 0.12 * BOARD_SCALE
const BORDER_THICKNESS = 0.1 * BOARD_SCALE
const TEXT_FACE_OFFSET_Z = BOARD_DEPTH / 2 + 0.02 * BOARD_SCALE
const TEXT_FACE_ROTATION = Quaternion.fromEulerDegrees(0, 180, 0)

const VISIBLE_ROWS = LEADERBOARD_PAGE_SIZE
const ROW_HEIGHT = 0.52 * BOARD_SCALE
const ROW_FONT_SIZE = 0.92 * BOARD_SCALE
const TITLE_BAND = 1.05 * BOARD_SCALE
const BOTTOM_PAD = 0.3 * BOARD_SCALE
const BOTTOM_EXTRA = 0.45 * BOARD_SCALE
const ROWS_BAND = VISIBLE_ROWS * ROW_HEIGHT
const BOARD_HEIGHT = Math.max(2.35 * BOARD_SCALE, TITLE_BAND + ROWS_BAND + BOTTOM_PAD) + BOTTOM_EXTRA
const BOARD_TOP_Y = Math.max(2.35 * BOARD_SCALE, TITLE_BAND + ROWS_BAND + BOTTOM_PAD)
const BOARD_CENTER_Y = BOARD_TOP_Y - BOARD_HEIGHT / 2
const TITLE_OFFSET_Y = BOARD_TOP_Y - BOARD_CENTER_Y - 0.28 * BOARD_SCALE
const FIRST_ROW_OFFSET_Y = TITLE_OFFSET_Y - 0.62 * BOARD_SCALE
const NAV_BUTTON_X = BOARD_WIDTH / 2 + 0.42 * BOARD_SCALE
const NAME_MAX_LENGTH = 18

const BOARD_FILL_COLOR = Color4.create(0.08, 0.14, 0.28, 1)
const BOARD_BORDER_COLOR = Color4.create(1, 0.84, 0, 1)
const BOARD_BORDER_GLOW = Color4.create(0.45, 0.32, 0.05, 1)
const NAV_BUTTON_COLOR = Color4.create(1, 0.84, 0, 1)

let boardStarted = false
let boardRoot: Entity | null = null
let textFaceRoot: Entity | null = null
let titleEntity: Entity | null = null
let pageIndicatorEntity: Entity | null = null
let prevPageButton: Entity | null = null
let nextPageButton: Entity | null = null
let rowEntities: Entity[] = []
let boardEntities: Entity[] = []
let lastUpdatedAt = -1
let boardVisible = true
let currentPage = 0
let cachedNames: string[] = []
let cachedScores: number[] = []

export function setupLeaderboardBoard(): void {
  if (boardStarted) return
  boardStarted = true

  boardRoot = engine.addEntity()
  boardEntities.push(boardRoot)
  Transform.create(boardRoot, {
    position: BOARD_POSITION,
    rotation: Quaternion.fromEulerDegrees(0, BOARD_Y_ROTATION, 0),
  })
  VisibilityComponent.create(boardRoot, { visible: true })

  createBoardPanel(
    Vector3.create(0, BOARD_CENTER_Y, 0),
    Vector3.create(BOARD_WIDTH, BOARD_HEIGHT, BOARD_DEPTH),
    BOARD_FILL_COLOR,
    BOARD_BORDER_GLOW,
    0.15
  )

  createBoardBorderEntity(
    Vector3.create(0, BOARD_CENTER_Y + BOARD_HEIGHT / 2 + BORDER_THICKNESS / 2, 0),
    Vector3.create(BOARD_WIDTH + BORDER_THICKNESS * 2, BORDER_THICKNESS, BOARD_DEPTH + 0.02)
  )
  createBoardBorderEntity(
    Vector3.create(0, BOARD_CENTER_Y - BOARD_HEIGHT / 2 - BORDER_THICKNESS / 2, 0),
    Vector3.create(BOARD_WIDTH + BORDER_THICKNESS * 2, BORDER_THICKNESS, BOARD_DEPTH + 0.02)
  )
  createBoardBorderEntity(
    Vector3.create(-BOARD_WIDTH / 2 - BORDER_THICKNESS / 2, BOARD_CENTER_Y, 0),
    Vector3.create(BORDER_THICKNESS, BOARD_HEIGHT, BOARD_DEPTH + 0.02)
  )
  createBoardBorderEntity(
    Vector3.create(BOARD_WIDTH / 2 + BORDER_THICKNESS / 2, BOARD_CENTER_Y, 0),
    Vector3.create(BORDER_THICKNESS, BOARD_HEIGHT, BOARD_DEPTH + 0.02)
  )

  textFaceRoot = engine.addEntity()
  boardEntities.push(textFaceRoot)
  Transform.create(textFaceRoot, {
    parent: boardRoot,
    position: Vector3.create(0, BOARD_CENTER_Y, TEXT_FACE_OFFSET_Z),
    rotation: TEXT_FACE_ROTATION,
  })
  VisibilityComponent.create(textFaceRoot, { visible: boardVisible })

  titleEntity = engine.addEntity()
  boardEntities.push(titleEntity)
  Transform.create(titleEntity, {
    parent: textFaceRoot,
    position: Vector3.create(0, TITLE_OFFSET_Y, 0),
  })
  TextShape.create(titleEntity, {
    text: 'DOGE HUNT LEADERBOARD',
    fontSize: 1.35 * BOARD_SCALE,
    textColor: Color4.create(1, 0.84, 0, 1),
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
  })
  VisibilityComponent.create(titleEntity, { visible: boardVisible })

  pageIndicatorEntity = engine.addEntity()
  boardEntities.push(pageIndicatorEntity)
  Transform.create(pageIndicatorEntity, {
    parent: textFaceRoot,
    position: Vector3.create(0, TITLE_OFFSET_Y - 0.42 * BOARD_SCALE, 0),
  })
  TextShape.create(pageIndicatorEntity, {
    text: '',
    fontSize: 0.72 * BOARD_SCALE,
    textColor: Color4.create(0.82, 0.82, 0.86, 1),
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
  })
  VisibilityComponent.create(pageIndicatorEntity, { visible: boardVisible })

  for (let i = 0; i < VISIBLE_ROWS; i++) {
    const rowEntity = engine.addEntity()
    boardEntities.push(rowEntity)
    Transform.create(rowEntity, {
      parent: textFaceRoot,
      position: Vector3.create(0, FIRST_ROW_OFFSET_Y - i * ROW_HEIGHT, 0),
    })
    TextShape.create(rowEntity, {
      text: '',
      fontSize: ROW_FONT_SIZE,
      textColor: Color4.White(),
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    })
    VisibilityComponent.create(rowEntity, { visible: boardVisible })
    rowEntities.push(rowEntity)
  }

  prevPageButton = createPageNavButton('◀', NAV_BUTTON_X, 'Previous page', () => {
    const totalPages = getTotalPages(cachedNames.length)
    if (totalPages <= 1) return
    currentPage = currentPage <= 0 ? totalPages - 1 : currentPage - 1
    renderLeaderboardPage()
  })

  nextPageButton = createPageNavButton('▶', -NAV_BUTTON_X, 'Next page', () => {
    const totalPages = getTotalPages(cachedNames.length)
    if (totalPages <= 1) return
    currentPage = currentPage >= totalPages - 1 ? 0 : currentPage + 1
    renderLeaderboardPage()
  })

  const initial = readLeaderboardBoard()
  if (initial.updatedAt > 0) {
    lastUpdatedAt = initial.updatedAt
    cachedNames = initial.names
    cachedScores = initial.scores
  }
  renderLeaderboardPage()

  engine.addSystem(refreshLeaderboardBoardSystem)
  console.log('[Client][LB] 3D leaderboard board created in lobby.')
}

export function setLeaderboardBoardVisible(visible: boolean): void {
  boardVisible = visible

  for (const entity of boardEntities) {
    VisibilityComponent.createOrReplace(entity, { visible })
  }

  renderLeaderboardPage()
}

function createPageNavButton(
  label: string,
  x: number,
  hoverText: string,
  onClick: () => void
): Entity {
  if (!boardRoot) throw new Error('[Client][LB] boardRoot missing')

  const rowCenterY = BOARD_CENTER_Y + FIRST_ROW_OFFSET_Y - ((VISIBLE_ROWS - 1) * ROW_HEIGHT) / 2
  const hitSize = 0.72 * BOARD_SCALE

  const button = engine.addEntity()
  boardEntities.push(button)
  Transform.create(button, {
    parent: boardRoot,
    position: Vector3.create(x, rowCenterY, TEXT_FACE_OFFSET_Z),
    rotation: TEXT_FACE_ROTATION,
    scale: Vector3.create(hitSize, hitSize, 0.08 * BOARD_SCALE),
  })
  MeshCollider.setBox(button, ColliderLayer.CL_POINTER)
  VisibilityComponent.create(button, { visible: boardVisible })

  const triangle = engine.addEntity()
  boardEntities.push(triangle)
  Transform.create(triangle, {
    parent: button,
    position: Vector3.Zero(),
  })
  TextShape.create(triangle, {
    text: label,
    fontSize: 1.45 * BOARD_SCALE,
    textColor: NAV_BUTTON_COLOR,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
  })
  VisibilityComponent.create(triangle, { visible: boardVisible })

  pointerEventsSystem.onPointerDown(
    {
      entity: button,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText,
        maxDistance: 12,
      },
    },
    () => {
      if (!boardVisible) return
      onClick()
    }
  )

  return button
}

function createBoardPanel(
  position: Vector3,
  scale: Vector3,
  fillColor: Color4,
  emissiveColor: Color4,
  emissiveIntensity: number
): Entity {
  if (!boardRoot) throw new Error('[Client][LB] boardRoot missing')

  const panel = engine.addEntity()
  boardEntities.push(panel)
  Transform.create(panel, {
    parent: boardRoot,
    position,
    scale,
  })
  MeshRenderer.setBox(panel)
  Material.setPbrMaterial(panel, {
    albedoColor: fillColor,
    emissiveColor,
    emissiveIntensity,
  })
  VisibilityComponent.create(panel, { visible: boardVisible })
  return panel
}

function createBoardBorderEntity(position: Vector3, scale: Vector3): Entity {
  return createBoardPanel(position, scale, BOARD_BORDER_COLOR, BOARD_BORDER_COLOR, 0.25)
}

function refreshLeaderboardBoardSystem(): void {
  if (!boardVisible) return

  const board = readLeaderboardBoard()
  if (board.updatedAt === lastUpdatedAt) return

  lastUpdatedAt = board.updatedAt
  cachedNames = board.names
  cachedScores = board.scores
  currentPage = 0
  renderLeaderboardPage()
}

function renderLeaderboardPage(): void {
  const totalEntries = cachedNames.length
  const totalPages = getTotalPages(totalEntries)
  currentPage = Math.max(0, Math.min(currentPage, totalPages - 1))

  const startIndex = currentPage * VISIBLE_ROWS

  if (titleEntity) {
    TextShape.getMutable(titleEntity).text = 'DOGE HUNT LEADERBOARD'
  }

  if (pageIndicatorEntity) {
    const pageText = totalEntries > 0 ? `Page ${currentPage + 1}/${totalPages}` : 'No scores yet'
    TextShape.getMutable(pageIndicatorEntity).text = pageText
    VisibilityComponent.createOrReplace(pageIndicatorEntity, {
      visible: boardVisible,
    })
  }

  for (let i = 0; i < rowEntities.length; i++) {
    const rowEntity = rowEntities[i]
    const entryIndex = startIndex + i
    const name = cachedNames[entryIndex]
    const score = cachedScores[entryIndex]

    if (!name) {
      TextShape.getMutable(rowEntity).text = ''
      VisibilityComponent.createOrReplace(rowEntity, { visible: boardVisible })
      continue
    }

    const rank = entryIndex + 1
    const medal = rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : `${rank}.`
    const label = truncateName(name, NAME_MAX_LENGTH)
    TextShape.getMutable(rowEntity).text = `${medal} ${label} - ${score}`
    VisibilityComponent.createOrReplace(rowEntity, { visible: boardVisible })
  }

  const showNav = boardVisible && totalPages > 1

  if (prevPageButton) {
    VisibilityComponent.createOrReplace(prevPageButton, { visible: showNav })
  }
  if (nextPageButton) {
    VisibilityComponent.createOrReplace(nextPageButton, { visible: showNav })
  }
}

function getTotalPages(entryCount: number): number {
  if (entryCount <= 0) return 1
  return Math.ceil(entryCount / VISIBLE_ROWS)
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name
  return `${name.slice(0, Math.max(1, maxLength - 1))}…`
}

function readLeaderboardBoard(): { names: string[]; scores: number[]; updatedAt: number } {
  for (const [, board] of engine.getEntitiesWith(Leaderboard)) {
    return {
      names: [...board.names],
      scores: [...board.scores],
      updatedAt: Number(board.updatedAt),
    }
  }

  return { names: [], scores: [], updatedAt: 0 }
}
