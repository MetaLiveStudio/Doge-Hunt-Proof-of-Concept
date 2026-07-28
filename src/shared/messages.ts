import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const DogeMessages = {
  joinRoom: Schemas.Map({
    displayName: Schemas.String,
  }),
  leaveRoom: Schemas.Map({
    reason: Schemas.String,
  }),
  setReady: Schemas.Map({
    isReady: Schemas.Boolean,
  }),
  requestRoomSnapshot: Schemas.Map({
    reason: Schemas.String,
  }),
  roomHeartbeat: Schemas.Map({
    status: Schemas.String,
  }),
  roomSnapshot: Schemas.Map({
    snapshotJson: Schemas.String,
  }),
  roomError: Schemas.Map({
    code: Schemas.String,
    message: Schemas.String,
  }),
  requestStartMatch: Schemas.Map({
    requestId: Schemas.String,
  }),
  matchStarted: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  matchError: Schemas.Map({
    code: Schemas.String,
    message: Schemas.String,
  }),
  publicStateSnapshot: Schemas.Map({
    snapshotJson: Schemas.String,
  }),
  npcStateSnapshot: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  bonkActionRequest: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  bonkActionEvent: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  bonkRequest: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  bonkResult: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  turnToRockRequest: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  turnToRockResult: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  roundEndRequest: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  roundEndResult: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  debugMarkOutRequest: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  debugMarkOutResult: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  debugForceRoundEndRequest: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  debugForceRoundEndResult: Schemas.Map({
    payloadJson: Schemas.String,
  }),
  leaderboardPointsAwarded: Schemas.Map({
    points: Schemas.Int,
    mode: Schemas.String,
    rank: Schemas.Int,
    totalScore: Schemas.Int,
    soloDailyRemaining: Schemas.Int,
    multiDailyRemaining: Schemas.Int,
  }),
}

const dogeRoom = registerMessages(DogeMessages)

export function getDogeRoom(): typeof dogeRoom {
  return dogeRoom
}
