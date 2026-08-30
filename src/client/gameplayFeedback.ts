export type GameplayFeedbackKind = 'hit' | 'player-eliminated' | 'eliminated'

export type GameplayFeedback = {
  kind: GameplayFeedbackKind
  title: string
  detail: string
  expiresAtMs: number
}

let activeFeedback: GameplayFeedback | null = null
let eliminationChoicePending = false
let eliminationChoiceDetail = ''

export function showBonkAcceptedFeedback(targetPlayerName: string): void {
  activeFeedback = targetPlayerName
    ? {
        kind: 'player-eliminated',
        title: 'PLAYER ELIMINATED',
        detail: `${targetPlayerName} is out`,
        expiresAtMs: Date.now() + 2_800,
      }
    : {
        kind: 'hit',
        title: 'BONK LANDED',
        detail: 'Target eliminated',
        expiresAtMs: Date.now() + 1_600,
      }
}

export function showLocalEliminatedFeedback(attackerDisplayName = ''): void {
  eliminationChoicePending = true
  eliminationChoiceDetail = attackerDisplayName ? `You were BONKed by ${attackerDisplayName}` : 'You were BONKed'
  activeFeedback = {
    kind: 'eliminated',
    title: 'ELIMINATED',
    detail: eliminationChoiceDetail,
    expiresAtMs: Date.now() + 1_600,
  }
}

export function isEliminationChoicePending(): boolean {
  return eliminationChoicePending
}

export function getEliminationChoiceDetail(): string {
  return eliminationChoiceDetail
}

export function resolveEliminationChoice(): void {
  eliminationChoicePending = false
  eliminationChoiceDetail = ''
}

export function getGameplayFeedback(): GameplayFeedback | null {
  if (!activeFeedback || activeFeedback.expiresAtMs > Date.now()) return activeFeedback

  activeFeedback = null
  return null
}

export function resetGameplayFeedback(): void {
  activeFeedback = null
  eliminationChoicePending = false
  eliminationChoiceDetail = ''
}
