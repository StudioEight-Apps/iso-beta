/**
 * The lockstep state machine. Both clients feed it the same two per-seat logs and get the
 * same result no matter how the two logs were interleaved on arrival: an entry is consumed,
 * skipped (stale / illegal) or left waiting purely as a function of its position in its own
 * log and of steps that need BOTH seats to complete.
 */
import { applyEvent, createMatch, currentOffenseSeat, draftSeatAt, isPlayCardId, otherSeat, validateEvent } from '../game'
import type { DefensePick, MatchState, OffensePick, PlayCardId, Seat, SubPick } from '../game'
import type { DataBody, LogEntry } from './protocol'

export type StepKind = 'flip' | 'lineup' | 'play' | 'break'

export interface RevealData {
  payload: unknown
  nonce: string
}

export interface StepState {
  id: string
  kind: StepKind
  commits: [string | null, string | null]
  reveals: [RevealData | null, RevealData | null]
}

export interface Proto {
  names: [string | null, string | null]
  /** Number of the match being set up or played (0-based, +1 per rematch). */
  matchIndex: number
  /** The match being played; null while the coin flip for `matchIndex` is still pending. */
  match: MatchState | null
  /** What the UI shows: the newest match that exists (stays on the old game during a rematch flip). */
  shown: MatchState | null
  /** The secret step in progress, if any. */
  step: StepState | null
  rematch: [boolean, boolean]
  /** How many entries of each seat's log have been processed. */
  cursor: [number, number]
  /** Set on a commit-reveal mismatch or an illegal revealed payload. The machine halts. */
  error: string | null
}

export function createProto(): Proto {
  return {
    names: [null, null],
    matchIndex: 0,
    match: null,
    shown: null,
    step: null,
    rematch: [false, false],
    cursor: [0, 0],
    error: null,
  }
}

export function stepId(matchIndex: number, kind: StepKind, seq = 0): string {
  if (kind === 'play') return `m${matchIndex}:p${seq}`
  if (kind === 'break') return `m${matchIndex}:b${seq}`
  return `m${matchIndex}:${kind}`
}

/**
 * Ordinal of a point in a match: flip 0, draft 0.5, lineup 1, possession k = 2 + k, the quarter
 * break after k possessions = 1.5 + k (it sits between possession k-1 and possession k), over = Infinity.
 */
function currentOrdinal(match: MatchState | null): number {
  if (!match) return 0
  switch (match.phase) {
    case 'draft':
      return 0.5
    case 'lineup':
      return 1
    case 'play':
      return 2 + match.history.length
    case 'break':
      return 1.5 + match.history.length
    case 'gameover':
      return Number.POSITIVE_INFINITY
    default:
      return 0
  }
}

function parseStepId(id: string): { m: number; ordinal: number } | null {
  const match = /^m(\d{1,6}):(flip|lineup|([pb])(\d{1,6}))$/.exec(id)
  if (!match) return null
  const m = Number(match[1])
  if (match[2] === 'flip') return { m, ordinal: 0 }
  if (match[2] === 'lineup') return { m, ordinal: 1 }
  return { m, ordinal: (match[3] === 'p' ? 2 : 1.5) + Number(match[4]) }
}

function expectedStep(p: Proto): { id: string; kind: StepKind } | null {
  if (p.names[0] === null || p.names[1] === null) return null
  if (!p.match) return { id: stepId(p.matchIndex, 'flip'), kind: 'flip' }
  if (p.match.phase === 'lineup') return { id: stepId(p.matchIndex, 'lineup'), kind: 'lineup' }
  if (p.match.phase === 'play') return { id: stepId(p.matchIndex, 'play', p.match.history.length), kind: 'play' }
  if (p.match.phase === 'break') return { id: stepId(p.matchIndex, 'break', p.match.history.length), kind: 'break' }
  return null
}

function syncStep(p: Proto): void {
  const want = expectedStep(p)
  if (!want) {
    p.step = null
  } else if (!p.step || p.step.id !== want.id) {
    p.step = { id: want.id, kind: want.kind, commits: [null, null], reveals: [null, null] }
  }
}

type Verdict = 'consume' | 'skip' | 'wait'

/** Where a step-tagged entry sits relative to the machine: past, current or future. */
function relation(p: Proto, id: string): 'past' | 'current' | 'future' | 'bad' {
  const at = parseStepId(id)
  if (!at) return 'bad'
  if (at.m !== p.matchIndex) return at.m < p.matchIndex ? 'past' : 'future'
  const now = currentOrdinal(p.match)
  if (at.ordinal === now) return p.step && p.step.id === id ? 'current' : 'future'
  return at.ordinal < now ? 'past' : 'future'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readFlip(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.flip === 'string' && payload.flip.length > 0 ? payload.flip : null
}

function readOrder(payload: unknown): string[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.order)) return null
  const order: string[] = []
  for (const id of payload.order) {
    if (typeof id !== 'string') return null
    order.push(id)
  }
  return order
}

function readSub(v: unknown): SubPick | null | undefined {
  if (v === null || v === undefined) return null
  if (!isRecord(v) || typeof v.out !== 'string' || typeof v.in !== 'string') return undefined
  return { out: v.out, in: v.in }
}

function readCard(v: unknown): PlayCardId | null | undefined {
  if (v === null || v === undefined) return null
  return isPlayCardId(v) ? v : undefined
}

function readOffense(payload: unknown): OffensePick | null {
  if (!isRecord(payload) || typeof payload.shooterId !== 'string') return null
  if (payload.shot !== 'THREE' && payload.shot !== 'DRIVE') return null
  const passerId = payload.passerId ?? null
  if (passerId !== null && typeof passerId !== 'string') return null
  const cardId = readCard(payload.cardId)
  const sub = readSub(payload.sub)
  if (cardId === undefined || sub === undefined) return null
  return { shooterId: payload.shooterId, shot: payload.shot, passerId, cardId, sub }
}

function readDefense(payload: unknown): DefensePick | null {
  if (!isRecord(payload) || !('doubleId' in payload)) return null
  const doubleId = payload.doubleId
  if (doubleId !== null && typeof doubleId !== 'string') return null
  const cardId = readCard(payload.cardId)
  const sub = readSub(payload.sub)
  if (cardId === undefined || sub === undefined) return null
  return { doubleId, cardId, sub }
}

/** Both reveals are in: turn the step into engine state. */
function resolveStep(p: Proto): void {
  const step = p.step
  if (!step) return
  const r0 = step.reveals[0]
  const r1 = step.reveals[1]
  if (!r0 || !r1) return

  if (step.kind === 'flip') {
    const f0 = readFlip(r0.payload)
    const f1 = readFlip(r1.payload)
    if (f0 === null || f1 === null) {
      p.error = `desync: bad coin flip payload (${step.id})`
      return
    }
    // Neither side controls the seed: it mixes both secrets and both nonces.
    p.match = createMatch(`${f0}|${f1}|${r0.nonce}|${r1.nonce}|m${p.matchIndex}`)
    p.shown = p.match
    p.rematch = [false, false]
    return
  }

  const match = p.match
  if (!match) return

  if (step.kind === 'lineup' || step.kind === 'break') {
    const o0 = readOrder(r0.payload)
    const o1 = readOrder(r1.payload)
    const next = o0 && o1 ? applyEvent(match, { type: step.kind === 'lineup' ? 'lineupReveal' : 'quarterBreak', lineups: [o0, o1] }) : match
    if (next === match) {
      p.error = `desync: illegal lineup revealed (${step.id})`
      return
    }
    p.match = next
    p.shown = next
    return
  }

  const offenseSeat = currentOffenseSeat(match)
  if (offenseSeat === null) return
  const offensePick = readOffense(step.reveals[offenseSeat]?.payload)
  const defensePick = readDefense(step.reveals[otherSeat(offenseSeat)]?.payload)
  const next =
    offensePick && defensePick
      ? applyEvent(match, {
          type: 'possessionResolve',
          offensePick,
          defensePick,
          // Dice seed from BOTH nonces plus the possession id.
          seed: `${r0.nonce}|${r1.nonce}|${step.id}`,
        })
      : match
  if (next === match) {
    p.error = `desync: illegal pick revealed (${step.id})`
    return
  }
  p.match = next
  p.shown = next
}

function process(p: Proto, seat: Seat, entry: LogEntry): Verdict {
  const body: DataBody = entry.body
  switch (body.k) {
    case 'hello': {
      if (p.names[seat] !== null) return 'skip'
      p.names[seat] = body.name
      return 'consume'
    }
    case 'commit': {
      const rel = relation(p, body.step)
      if (rel === 'future') return 'wait'
      if (rel !== 'current' || !p.step || p.step.commits[seat] !== null) return 'skip'
      p.step.commits[seat] = body.hash
      return 'consume'
    }
    case 'reveal': {
      const rel = relation(p, body.step)
      if (rel === 'future') return 'wait'
      if (rel !== 'current' || !p.step) return 'skip'
      const step = p.step
      if (step.commits[seat] === null) return 'skip' // revealing without ever committing
      if (step.commits[otherSeat(seat)] === null) return 'wait'
      if (step.reveals[seat] !== null) return 'skip'
      if (entry.h === undefined || entry.h !== step.commits[seat]) {
        p.error = `desync: reveal does not match commit (${step.id}, seat ${seat})`
        return 'consume'
      }
      step.reveals[seat] = { payload: body.payload, nonce: body.nonce }
      resolveStep(p)
      return 'consume'
    }
    case 'draft': {
      if (body.m !== p.matchIndex) return body.m < p.matchIndex ? 'skip' : 'wait'
      const match = p.match
      if (!match) return 'wait'
      if (match.phase !== 'draft') return 'skip'
      if (draftSeatAt(match, body.pick) !== seat) return 'skip'
      if (body.pick !== match.draft.pickNumber) return body.pick < match.draft.pickNumber ? 'skip' : 'wait'
      const event = { type: 'draftPick', seat, cardId: body.cardId } as const
      if (validateEvent(match, event) !== null) return 'skip'
      p.match = applyEvent(match, event)
      p.shown = p.match
      return 'consume'
    }
    case 'rematch': {
      if (body.m !== p.matchIndex) return body.m < p.matchIndex ? 'skip' : 'wait'
      if (!p.match || p.match.phase !== 'gameover') return 'wait'
      if (p.rematch[seat]) return 'skip'
      p.rematch[seat] = true
      if (p.rematch[0] && p.rematch[1]) {
        // New match in the same room: seats unchanged, fresh coin-flip commit-reveal.
        p.matchIndex += 1
        p.match = null
      }
      return 'consume'
    }
    default:
      return 'skip'
  }
}

/**
 * Advance the machine as far as the two logs allow. Mutates `p`. Returns true if anything
 * was processed.
 */
export function pump(p: Proto, logs: readonly [readonly LogEntry[], readonly LogEntry[]]): boolean {
  let progressed = false
  let moved = true
  const seats: Seat[] = [0, 1]
  while (moved && p.error === null) {
    moved = false
    for (const seat of seats) {
      while (p.error === null && p.cursor[seat] < logs[seat].length) {
        syncStep(p)
        const verdict = process(p, seat, logs[seat][p.cursor[seat]])
        if (verdict === 'wait') break
        p.cursor[seat] += 1
        moved = true
        progressed = true
      }
    }
  }
  if (p.error === null) syncStep(p)
  return progressed
}

/** Rebuild the machine from scratch (reload recovery, tests). */
export function replayLogs(logs: readonly [readonly LogEntry[], readonly LogEntry[]]): Proto {
  const p = createProto()
  pump(p, logs)
  return p
}
