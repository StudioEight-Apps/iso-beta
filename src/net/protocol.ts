/** Wire format shared by both clients. Everything here is plain JSON. */
import type { Seat } from '../game'

/** v3 rules use their own topic so a v2 client can never share a room with a v3 client. */
export const PROTOCOL_VERSION = 1
export const TOPIC_PREFIX = 'iso-beta/v3'

export function topicFor(room: string): string {
  return `${TOPIC_PREFIX}/${room}`
}

export function normalizeRoom(room: string): string {
  return room.trim().toUpperCase()
}

/**
 * Reliable, ordered, per-sender log entries.
 *  hello   - first entry of every log: display name.
 *  commit  - SHA-256(json(payload) + nonce) for a secret step.
 *  reveal  - the payload and nonce; only sent once BOTH commits for the step exist.
 *  draft   - a public draft pick (match number + pick number make it unambiguous).
 *  rematch - "I want another game" after match `m` is over.
 *
 * Step ids: `m<match>:flip`, `m<match>:lineup`, `m<match>:p<possession seq>`, and
 * `m<match>:b<possessions played>` for the quarter break that follows that many possessions.
 * A possession pick carries everything secret at once: shooter, shot, passer, play card and any
 * substitution, so subs and card plays are commit-reveal too. Card draws need no message: the
 * deck order is part of the shared match state.
 */
export type DataBody =
  | { k: 'hello'; name: string }
  | { k: 'commit'; step: string; hash: string }
  | { k: 'reveal'; step: string; payload: unknown; nonce: string }
  | { k: 'draft'; m: number; pick: number; cardId: string }
  | { k: 'rematch'; m: number }

/** A log entry as stored locally. `h` is the locally computed hash of a reveal. */
export interface LogEntry {
  body: DataBody
  h?: string
}

/**
 * Every message on the wire. A data message carries `seq` + `body`; without them it is a
 * heartbeat. `sent` = how many log entries the sender has, `ack` = how many of the
 * receiver's entries the sender holds contiguously. `to` = the opponent the sender is
 * bound to (null until it has heard one) - a third client uses it to learn the room is full.
 */
export interface Envelope {
  v: 1
  id: string
  room: string
  from: string
  seat: Seat
  to: string | null
  sent: number
  ack: number
  seq?: number
  body?: DataBody
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1_000_000
}

function isShortString(v: unknown, max = 200): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max
}

export function parseBody(v: unknown): DataBody | null {
  if (!isRecord(v)) return null
  switch (v.k) {
    case 'hello':
      return typeof v.name === 'string' && v.name.length <= 200 ? { k: 'hello', name: v.name } : null
    case 'commit':
      return isShortString(v.step) && isShortString(v.hash) ? { k: 'commit', step: v.step, hash: v.hash } : null
    case 'reveal':
      return isShortString(v.step) && isShortString(v.nonce) && 'payload' in v
        ? { k: 'reveal', step: v.step, payload: v.payload, nonce: v.nonce }
        : null
    case 'draft':
      return isCount(v.m) && isCount(v.pick) && isShortString(v.cardId)
        ? { k: 'draft', m: v.m, pick: v.pick, cardId: v.cardId }
        : null
    case 'rematch':
      return isCount(v.m) ? { k: 'rematch', m: v.m } : null
    default:
      return null
  }
}

export function parseLogEntry(v: unknown): LogEntry | null {
  if (!isRecord(v)) return null
  const body = parseBody(v.body)
  if (!body) return null
  return typeof v.h === 'string' ? { body, h: v.h } : { body }
}

export function parseEnvelope(v: unknown): Envelope | null {
  if (!isRecord(v) || v.v !== PROTOCOL_VERSION) return null
  if (!isShortString(v.id) || !isShortString(v.room) || !isShortString(v.from)) return null
  if (v.seat !== 0 && v.seat !== 1) return null
  if (v.to !== null && !isShortString(v.to)) return null
  if (!isCount(v.sent) || !isCount(v.ack)) return null
  const env: Envelope = { v: 1, id: v.id, room: v.room, from: v.from, seat: v.seat, to: v.to, sent: v.sent, ack: v.ack }
  if (v.seq === undefined) return env
  if (!isCount(v.seq)) return null
  const body = parseBody(v.body)
  if (!body) return null
  env.seq = v.seq
  env.body = body
  return env
}
