import ReactEcs, { ReactEcsRenderer, UiEntity, Label } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { totalBonks } from './combat'
import { aliveCount, NPC_TOTAL } from './npc'
import { roundTimeLeft, roundOver } from './ui'

const h = ReactEcs.createElement

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const WHITE = Color4.create(0.8, 0.8, 0.8, 1)
const GOLD = Color4.create(1, 0.84, 0, 1)
const PINK = Color4.create(1, 0.18, 0.59, 1)
const CYAN = Color4.create(0, 0.96, 1, 1)
const RED = Color4.create(1, 0.2, 0.2, 1)
const GREEN = Color4.create(0.22, 1, 0.08, 1)
const BG = Color4.create(0, 0, 0, 0.75)
const DIVIDER = Color4.create(1, 1, 1, 0.2)
const BUTTON_BG = Color4.create(0.08, 0.08, 0.12, 0.9)

const SCALE = 1.2
const s = (n: number) => Math.round(n * SCALE)
const E_HINT_SCALE = 1.35
const es = (n: number) => Math.round(n * SCALE * E_HINT_SCALE)

function hudPanel() {
  const timeColor = (roundTimeLeft <= 30 && !roundOver) ? RED : CYAN
  const aliveColor = aliveCount <= 3 ? RED : aliveCount <= 6 ? GOLD : GREEN
  const panel = h(UiEntity, {
    uiTransform: {
      width: s(320),
      height: s(320),
      positionType: 'absolute',
      position: { right: s(16), bottom: s(16) },
      flexDirection: 'column',
      padding: { top: s(12), bottom: s(12), left: s(16), right: s(16) },
    },
    uiBackground: { color: BG },
  }, [
    h(UiEntity, {
      key: 'titleBlock',
      uiTransform: { height: s(48), flexDirection: 'column', margin: { bottom: s(6) } },
    }, [
      h(Label, {
        key: 'title',
        value: 'DOGE HUNT',
        fontSize: s(20),
        color: GOLD,
        uiTransform: { height: s(24), margin: { bottom: s(2) } },
      }),
      h(Label, {
        key: 'subtitle',
        value: 'Proof of Concept (Visual and gameplay enhancements coming in future updates.)',
        fontSize: s(11),
        color: GOLD,
        uiTransform: { height: s(18) },
      }),
    ]),
    h(Label, {
      key: 'timer',
      value: roundOver ? 'ROUND OVER' : formatTime(roundTimeLeft),
      fontSize: s(18),
      color: timeColor,
      uiTransform: { height: s(24), margin: { bottom: s(8) } },
    }),
    h(Label, {
      key: 'stats',
      value: `Alive: ${aliveCount}/${NPC_TOTAL}    Bonks: ${totalBonks}`,
      fontSize: s(13),
      color: aliveColor,
      uiTransform: { height: s(20), margin: { bottom: s(10) } },
    }),
    h(UiEntity, {
      key: 'divider',
      uiTransform: { height: 1, width: '100%', margin: { bottom: s(10) } },
      uiBackground: { color: DIVIDER },
    }),
    h(Label, {
      key: 'h2p',
      value: 'HOW TO PLAY',
      fontSize: s(14),
      color: PINK,
      uiTransform: { height: s(18), margin: { bottom: s(6) } },
    }),
    h(Label, {
      key: 'r1',
      value: '• Players and NPCs look identical.',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18), margin: { bottom: s(2) } },
    }),
    h(Label, {
      key: 'r2',
      value: '• Click a Doge to BONK (eliminate).',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18), margin: { bottom: s(2) } },
    }),
    h(Label, {
      key: 'r3',
      value: '• BONKed real players are OUT.',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18), margin: { bottom: s(2) } },
    }),
    h(Label, {
      key: 'r4',
      value: 'Last real player standing wins.',
      fontSize: s(12),
      color: GOLD,
      uiTransform: { height: s(18), margin: { bottom: s(4) } },
    }),
    h(Label, {
      key: 'r5',
      value: '• Round ends at 0:00 — time up: most Bonks wins.',
      fontSize: s(12),
      color: WHITE,
      uiTransform: { height: s(18) },
    }),
  ])

  const eKeyHint = h(UiEntity, {
    key: 'eKeyHintWrap',
    uiTransform: {
      positionType: 'absolute',
      position: { left: 0, right: 0, bottom: es(18) },
      height: es(84),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, [
    h(UiEntity, {
      key: 'eKeyHintPill',
      uiTransform: {
        height: es(76),
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: es(12), right: es(14), top: es(10), bottom: es(10) },
      },
      uiBackground: { color: BG },
    }, [
      h(UiEntity, {
        key: 'eKeyBox',
        uiTransform: {
          width: es(40),
          height: es(40),
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          margin: { right: es(12) },
        },
        uiBackground: { color: BUTTON_BG },
      }, [
        h(Label, {
          key: 'eKeyText',
          value: 'E',
          fontSize: es(18),
          color: CYAN,
          uiTransform: { height: es(22) },
        }),
      ]),
      h(UiEntity, {
        key: 'eKeyCopy',
        uiTransform: { flexDirection: 'column' },
      }, [
        h(Label, {
          key: 'eKeyTitle',
          value: 'Rock Solid — More skills will be released.',
          fontSize: es(12),
          color: CYAN,
          uiTransform: { height: es(18), margin: { bottom: es(3) } },
        }),
        h(Label, {
          key: 'eKeyDesc',
          value: 'Press E near a pillar to hide as a pillar (5s / 15s).',
          fontSize: es(10),
          color: WHITE,
          uiTransform: { height: es(16) },
        }),
      ]),
    ]),
  ])

  return h(UiEntity, {
    uiTransform: {
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      position: { left: 0, top: 0 },
    },
  }, [panel, eKeyHint])
}

export function setupHud(): void {
  ReactEcsRenderer.setUiRenderer(hudPanel)
}
