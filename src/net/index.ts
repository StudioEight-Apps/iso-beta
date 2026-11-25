/**
 * Online two-player play. Public surface:
 *   createOnlineSession({ room, name, host }) -> Session   (host = seat 0, joiner = seat 1)
 *   makeRoomCode() -> 5-char room code
 * Extras for the UI / QA: the returned snapshot also carries `error` ('desync' | 'room-full' | null),
 * and the transport can be switched with setTransport('bc') or the URL param ?transport=bc.
 */
import { MqttTransport } from './mqttTransport'
import { createOnlineSessionWith, DEFAULT_TIMING } from './session'
import type { NetTiming, OnlineSession, StorageLike } from './session'
import { BroadcastChannelTransport } from './transport'
import type { TransportFactory } from './transport'

export type { NetError, NetTiming, OnlineSession, OnlineSnapshot, StorageLike } from './session'
export type { Transport, TransportFactory, TransportStatus, WireMessage } from './transport'
export { BroadcastChannelTransport } from './transport'
export { MqttTransport, DEFAULT_BROKERS } from './mqttTransport'
export { createOnlineSessionWith, DEFAULT_TIMING, storageKey } from './session'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0 / O / 1 / I

/** 5 chars from an unambiguous alphabet. */
export function makeRoomCode(): string {
  const bytes = new Uint32Array(5)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ROOM_ALPHABET[b % ROOM_ALPHABET.length]
  return out
}

export type TransportChoice = 'mqtt' | 'bc' | TransportFactory

let transportOverride: TransportChoice | null = null
let storageOverride: StorageLike | null | undefined
let timingOverride: Partial<NetTiming> = {}

/** Force a transport for every later createOnlineSession call. null = back to the default. */
export function setTransport(choice: TransportChoice | null): void {
  transportOverride = choice
}

/** Replace (or disable with null) the storage used for reload recovery. undefined = default. */
export function setNetStorage(storage: StorageLike | null | undefined): void {
  storageOverride = storage
}

/** Override heartbeat / timeout timings (tests). */
export function setNetTiming(timing: Partial<NetTiming>): void {
  timingOverride = timing
}

function urlTransport(): 'mqtt' | 'bc' | null {
  try {
    const search = (globalThis as { location?: { search?: string } }).location?.search
    if (!search) return null
    const value = new URLSearchParams(search).get('transport')
    return value === 'bc' || value === 'mqtt' ? value : null
  } catch {
    return null
  }
}

function resolveTransport(): TransportFactory {
  const choice = transportOverride ?? urlTransport() ?? 'mqtt'
  if (typeof choice === 'function') return choice
  if (choice === 'bc') return (room) => new BroadcastChannelTransport(room)
  return (room) => new MqttTransport(room)
}

function defaultStorage(): StorageLike | null {
  try {
    // Only in a real browser: some runtimes expose a non-functional localStorage global.
    if (typeof window === 'undefined' || typeof document === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function createOnlineSession(opts: { room: string; name: string; host: boolean }): OnlineSession {
  return createOnlineSessionWith(opts, {
    transport: resolveTransport(),
    storage: storageOverride === undefined ? defaultStorage() : storageOverride,
    timing: { ...DEFAULT_TIMING, ...timingOverride },
  })
}
