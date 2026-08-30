import { engine, Entity, Transform, AudioSource } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { isPlaying } from '../gameState'

const GAME_MUSIC_SRC = 'sound/doge_hunt_moonwalk_30s.mp3'
const BONK_HIT_SRC = 'sound/bonkon.mp3'
const BONK_MISS_SRC = 'sound/bonkmiss.mp3'

const GAME_MUSIC_VOLUME = 1.0
const BONK_SFX_VOLUME = 1

let audioStarted = false
let audioRoot: Entity | null = null
let musicEntity: Entity | null = null
let sfxEntity: Entity | null = null
let gameAudioActive = false
let musicPrimed = false

export function setupGameAudio(): void {
  if (audioStarted) return
  audioStarted = true

  audioRoot = engine.addEntity()
  Transform.create(audioRoot, {
    position: Vector3.create(48, 1, 48),
  })

  musicEntity = engine.addEntity()
  Transform.create(musicEntity, { parent: audioRoot })
  AudioSource.create(musicEntity, {
    audioClipUrl: GAME_MUSIC_SRC,
    playing: false,
    loop: true,
    volume: GAME_MUSIC_VOLUME,
    global: true,
  })

  sfxEntity = engine.addEntity()
  Transform.create(sfxEntity, { parent: audioRoot })
}

export function startGameMusic(): void {
  if (!musicEntity) {
    console.log('[Audio] music start skipped: entity is unavailable')
    return
  }

  gameAudioActive = true
  AudioSource.playSound(musicEntity, GAME_MUSIC_SRC)

  const music = AudioSource.getMutable(musicEntity)
  music.loop = true
  music.volume = GAME_MUSIC_VOLUME
  music.global = true
  music.playing = true
  console.log(`[Audio] game music started primed=${musicPrimed} src=${GAME_MUSIC_SRC} volume=${GAME_MUSIC_VOLUME}`)
}

// Explorer may require a player gesture before reliably starting an audio
// clip that is later requested by an asynchronous server match event.
export function primeGameAudioFromUserAction(reason: string): void {
  if (musicPrimed || !musicEntity) return

  const music = AudioSource.getMutable(musicEntity)
  music.loop = true
  music.volume = 0
  music.global = true
  AudioSource.playSound(musicEntity, GAME_MUSIC_SRC)
  music.playing = true
  AudioSource.stopSound(musicEntity)
  music.playing = false
  musicPrimed = true
  console.log(`[Audio] music primed from user action reason=${reason} src=${GAME_MUSIC_SRC}`)
}

export function stopGameAudio(): void {
  gameAudioActive = false

  if (musicEntity) {
    AudioSource.stopSound(musicEntity)
  }
  if (sfxEntity) {
    AudioSource.stopSound(sfxEntity)
  }
  console.log('[Audio] game audio stopped')
}

export function playBonkHitSound(): void {
  playBonkSfx(BONK_HIT_SRC)
}

export function playBonkMissSound(): void {
  playBonkSfx(BONK_MISS_SRC)
}

function playBonkSfx(src: string): void {
  if (!gameAudioActive || !isPlaying() || !sfxEntity) return

  AudioSource.playSound(sfxEntity, src)

  const sfx = AudioSource.getMutable(sfxEntity)
  sfx.loop = false
  sfx.volume = BONK_SFX_VOLUME
  sfx.global = true
  sfx.playing = true
}
