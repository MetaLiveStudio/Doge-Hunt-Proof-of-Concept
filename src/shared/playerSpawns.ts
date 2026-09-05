export type PlayerSpawnPoint = {
  position: {
    x: number
    y: number
    z: number
  }
  cameraTarget: {
    x: number
    y: number
    z: number
  }
}

const MATCH_SPAWN_Y = 1.2

export const MATCH_SPAWN_POINTS: PlayerSpawnPoint[] = [
  {
    position: { x: 48, y: MATCH_SPAWN_Y, z: 35 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 55.6, y: MATCH_SPAWN_Y, z: 37.5 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 60.4, y: MATCH_SPAWN_Y, z: 44 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 60.4, y: MATCH_SPAWN_Y, z: 52 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 55.6, y: MATCH_SPAWN_Y, z: 58.5 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 48, y: MATCH_SPAWN_Y, z: 61 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 40.4, y: MATCH_SPAWN_Y, z: 58.5 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 35.6, y: MATCH_SPAWN_Y, z: 52 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 35.6, y: MATCH_SPAWN_Y, z: 44 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
  {
    position: { x: 40.4, y: MATCH_SPAWN_Y, z: 37.5 },
    cameraTarget: { x: 48, y: 1.6, z: 48 },
  },
]

export function getMatchSpawnPoint(playerIndex: number, matchId: string): PlayerSpawnPoint {
  const safeIndex = Math.max(0, playerIndex)
  const offset = getStableMatchOffset(matchId)
  const point = MATCH_SPAWN_POINTS[(safeIndex + offset) % MATCH_SPAWN_POINTS.length]

  return {
    position: { ...point.position },
    cameraTarget: { ...point.cameraTarget },
  }
}

function getStableMatchOffset(matchId: string): number {
  let hash = 0

  for (let i = 0; i < matchId.length; i += 1) {
    hash = (hash * 31 + matchId.charCodeAt(i)) >>> 0
  }

  return hash % MATCH_SPAWN_POINTS.length
}
