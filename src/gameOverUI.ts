/**
 * gameOverUI.ts — Game over screen with results
 */
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { totalBonks } from './combat'
import { aliveCount, NPC_TOTAL } from './npc'
import { returnToLobby } from './lobby'
import { GameState, setState } from './gameState'

const h = ReactEcs.createElement

let showGameOver = false

export function showGameOverUI(): void {
  showGameOver = true
  setState(GameState.GAME_OVER)
}

export function hideGameOverUI(): void {
  showGameOver = false
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function setupGameOverUI(): void {
  const uiComponent = () => {
    if (!showGameOver) return null

    const survivalTime = 180 // 3 minutes total
    const timeElapsed = formatTime(survivalTime)

    return h(UiEntity, {
      uiTransform: {
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { left: 0, top: 0 },
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
      uiBackground: { color: Color4.create(0, 0, 0, 0.9) },
    }, [
      h(UiEntity, {
        key: 'modal',
        uiTransform: {
          width: 600,
          height: 500,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { top: 40, bottom: 40, left: 50, right: 50 },
        },
        uiBackground: { color: Color4.create(0.08, 0.08, 0.12, 0.98) },
      }, [
        h(Label, {
          key: 'title',
          value: 'GAME OVER',
          fontSize: 36,
          color: Color4.create(1, 0.2, 0.2, 1),
          uiTransform: { height: 50, margin: { bottom: 30 } },
        }),
        h(Label, {
          key: 'subtitle',
          value: 'Round Complete',
          fontSize: 20,
          color: Color4.create(1, 0.84, 0, 1),
          uiTransform: { height: 30, margin: { bottom: 40 } },
        }),
        h(UiEntity, {
          key: 'stats',
          uiTransform: {
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            margin: { bottom: 40 },
          },
        }, [
          h(Label, {
            key: 'bonks',
            value: `Total Bonks: ${totalBonks}`,
            fontSize: 22,
            color: Color4.create(0, 0.96, 1, 1),
            uiTransform: { height: 35, margin: { bottom: 15 } },
          }),
          h(Label, {
            key: 'survived',
            value: `Doges Remaining: ${aliveCount}/${NPC_TOTAL}`,
            fontSize: 22,
            color: Color4.create(0.22, 1, 0.08, 1),
            uiTransform: { height: 35, margin: { bottom: 15 } },
          }),
          h(Label, {
            key: 'time',
            value: `Time: ${timeElapsed}`,
            fontSize: 22,
            color: Color4.create(1, 0.84, 0, 1),
            uiTransform: { height: 35 },
          }),
        ]),
        h(Button, {
          key: 'returnBtn',
          value: 'RETURN TO LOBBY',
          variant: 'primary',
          uiTransform: { width: 350, height: 70 },
          fontSize: 20,
          onMouseDown: () => {
            hideGameOverUI()
            returnToLobby()
          },
        }),
      ]),
    ])
  }

  ReactEcsRenderer.setUiRenderer(uiComponent)
}
