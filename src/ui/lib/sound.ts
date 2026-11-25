import { useSyncExternalStore } from 'react'
import { readStore, writeStore } from './storage'

/** All sound is synthesised with WebAudio. No audio files. */
export type Sfx = 'tap' | 'select' | 'lockin' | 'rattle' | 'land' | 'clamp' | 'fizzle' | 'swish' | 'clank' | 'buzzer' | 'whoosh' | 'coin'

const MUTE_KEY = 'iso.muted'
let muted = readStore(MUTE_KEY) === '1'
let ctx: AudioContext | null = null
let master: GainNode | null = null
const listeners = new Set<() => void>()

export function isMuted(): boolean {
  return muted
}

export function toggleMuted(): void {
  muted = !muted
  writeStore(MUTE_KEY, muted ? '1' : '0')
  for (const l of [...listeners]) l()
  if (!muted) {
    unlockAudio()
    play('select')
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, isMuted)
}

/** Call from a user gesture. Audio stays silent until this has run once. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext
      if (!Ctor) return
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

let installed = false
export function installAudioUnlock(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const once = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
  }
  window.addEventListener('pointerdown', once)
  window.addEventListener('keydown', once)
}

function tone(
  ac: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  at: number,
  dur: number,
  gain: number,
): void {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f0, at)
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

let noiseBuf: AudioBuffer | null = null
function noise(
  ac: AudioContext,
  out: AudioNode,
  filter: BiquadFilterType,
  f0: number,
  f1: number,
  at: number,
  dur: number,
  gain: number,
  q = 1,
): void {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const src = ac.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = ac.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(f0, at)
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(out)
  src.start(at, Math.random() * 0.5)
  src.stop(at + dur + 0.02)
}

export function play(name: Sfx): void {
  if (muted || !ctx || !master || ctx.state !== 'running') return
  const ac = ctx
  const out = master
  const t = ac.currentTime + 0.005
  try {
    switch (name) {
      case 'tap':
        tone(ac, out, 'triangle', 520, 380, t, 0.05, 0.22)
        break
      case 'select':
        tone(ac, out, 'triangle', 660, 880, t, 0.07, 0.24)
        break
      case 'lockin':
        tone(ac, out, 'square', 220, 220, t, 0.07, 0.14)
        tone(ac, out, 'square', 330, 330, t + 0.08, 0.12, 0.16)
        noise(ac, out, 'highpass', 3000, 3000, t, 0.03, 0.12)
        break
      case 'whoosh':
        noise(ac, out, 'bandpass', 300, 2600, t, 0.28, 0.3, 1.4)
        break
      case 'rattle':
        for (let i = 0; i < 9; i++) {
          const at = t + i * 0.085 + Math.random() * 0.03
          noise(ac, out, 'bandpass', 1800 + Math.random() * 2400, 1200, at, 0.035, 0.34, 3)
          tone(ac, out, 'triangle', 240 + Math.random() * 180, 160, at, 0.03, 0.1)
        }
        break
      case 'land':
        tone(ac, out, 'sine', 170, 70, t, 0.14, 0.5)
        noise(ac, out, 'lowpass', 900, 300, t, 0.07, 0.3)
        break
      case 'clamp':
        tone(ac, out, 'square', 140, 60, t, 0.16, 0.34)
        tone(ac, out, 'triangle', 1900, 1500, t, 0.1, 0.16)
        tone(ac, out, 'triangle', 2850, 2300, t + 0.012, 0.14, 0.1)
        noise(ac, out, 'highpass', 4200, 4200, t, 0.04, 0.3)
        break
      case 'fizzle':
        noise(ac, out, 'bandpass', 2600, 400, t, 0.3, 0.16, 2)
        tone(ac, out, 'sine', 420, 180, t, 0.26, 0.1)
        break
      case 'swish':
        noise(ac, out, 'bandpass', 5200, 900, t, 0.42, 0.42, 0.9)
        noise(ac, out, 'highpass', 6000, 3000, t + 0.05, 0.28, 0.16)
        tone(ac, out, 'sine', 660, 990, t + 0.2, 0.3, 0.14)
        tone(ac, out, 'sine', 990, 1320, t + 0.32, 0.34, 0.1)
        break
      case 'clank':
        for (const f of [412, 618, 1037, 1531]) tone(ac, out, 'square', f, f * 0.985, t, 0.34, 0.07)
        tone(ac, out, 'sine', 120, 62, t, 0.2, 0.5)
        noise(ac, out, 'bandpass', 2200, 1400, t, 0.06, 0.3, 4)
        break
      case 'buzzer':
        tone(ac, out, 'sawtooth', 196, 196, t, 0.7, 0.2)
        tone(ac, out, 'square', 198.5, 198.5, t, 0.7, 0.1)
        tone(ac, out, 'sawtooth', 392, 392, t, 0.7, 0.05)
        break
      case 'coin':
        tone(ac, out, 'sine', 1760, 1760, t, 0.5, 0.14)
        tone(ac, out, 'sine', 2637, 2637, t, 0.36, 0.08)
        break
    }
  } catch {
    /* audio is decoration; never let it break play */
  }
}
