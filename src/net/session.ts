/**
 * Online two-player session: symmetric lockstep over an unreliable broadcast transport.
 * No authoritative server. Each client keeps an ordered log of what it sent; the two logs
 * are folded by ./core into identical MatchStates on both sides.
 */
import { isLegalLineup, otherSeat, validateDefensePick, validateEvent, validateOffensePick } from '../game'
import type { DefensePick, OffensePick, Seat } from '../game'
import type { PlayerAction, Session, SessionSnapshot } from '../session/types'
import { createProto, pump } from './core'
import type { Proto } from './core'
import { normalizeRoom, parseEnvelope, parseLogEntry, TOPIC_PREFIX } from './protocol'
import type { DataBody, Envelope, LogEntry } from './protocol'
import { commitHash, randomHex } from './sha256'
import type { Transport, TransportFactory, TransportStatus } from './transport'

export type NetError = 'desync' | 'room-full'

/** SessionSnapshot plus an error flag the UI may read. */
export interface OnlineSnapshot extends SessionSnapshot {
  /**
   * 'desync'    - the opponent's reveal did not match its commit, or revealed an illegal
   *               choice. The game is frozen.
   * 'room-full' - two other clients already own this room; this client is ignored.
   */
  error: NetError | null
  /** Human-readable detail for `error` (debugging). */
  errorDetail: string | null
}

export interface OnlineSession extends Session {
  getSnapshot(): OnlineSnapshot
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface NetTiming {
  /** Heartbeat period. */
  heartbeatMs: number
  /** No message from the opponent for this long => 'reconnecting'. */
  reconnectMs: number
  /** No message from the opponent for this long => 'opponent-left'. */
  leftMs: number
  /** Minimum gap before the same log entry is sent again. */
  resendMs: number
  /** Minimum gap between two "I am missing messages" heartbeats. */
  nudgeMs: number
}

export const DEFAULT_TIMING: NetTiming = {
  heartbeatMs: 2000,
  reconnectMs: 7000,
  leftMs: 45000,
  resendMs: 1200,
  nudgeMs: 250,
}

export interface NetDeps {
  transport: TransportFactory
  storage: StorageLike | null
  timing: NetTiming
}

export interface OnlineOptions {
  room: string
  name: string
  host: boolean
}

interface Secret {
  payload: unknown
  nonce: string
  hash: string
}

interface Persisted {
  v: 1
  clientId: string
  peerId: string | null
  sent: LogEntry[]
  recv: LogEntry[]
  secrets: Record<string, Secret>
  updatedAt: number
}

/** Saved sessions older than this are discarded instead of resumed. */
const STORAGE_MAX_AGE_MS = 12 * 60 * 60 * 1000
const MAX_RESEND_BURST = 64
const MAX_BUFFERED = 2000
const MAX_NAME = 24

export function storageKey(room: string, seat: Seat): string {
  return `${TOPIC_PREFIX}/${normalizeRoom(room)}/seat${seat}`
}

function cleanName(name: string, fallback: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
  return trimmed.length > 0 ? trimmed : fallback
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function loadPersisted(storage: StorageLike | null, key: string): Persisted | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || data.v !== 1) return null
    if (typeof data.clientId !== 'string' || data.clientId.length === 0) return null
    if (typeof data.updatedAt !== 'number' || Date.now() - data.updatedAt > STORAGE_MAX_AGE_MS) return null
    if (!Array.isArray(data.sent) || !Array.isArray(data.recv) || !isRecord(data.secrets)) return null
    const sent: LogEntry[] = []
    for (const item of data.sent) {
      const entry = parseLogEntry(item)
      if (!entry) return null
      sent.push(entry)
    }
    const recv: LogEntry[] = []
    for (const item of data.recv) {
      const entry = parseLogEntry(item)
      if (!entry) return null
      recv.push(entry)
    }
    const secrets: Record<string, Secret> = {}
    for (const [step, value] of Object.entries(data.secrets)) {
      if (!isRecord(value) || typeof value.nonce !== 'string' || typeof value.hash !== 'string') return null
      secrets[step] = { payload: value.payload, nonce: value.nonce, hash: value.hash }
    }
    return {
      v: 1,
      clientId: data.clientId,
      peerId: typeof data.peerId === 'string' ? data.peerId : null,
      sent,
      recv,
      secrets,
      updatedAt: data.updatedAt,
    }
  } catch {
    return null
  }
}

export function createOnlineSessionWith(opts: OnlineOptions, deps: NetDeps): OnlineSession {
  const room = normalizeRoom(opts.room)
  const me: Seat = opts.host ? 0 : 1
  const opp: Seat = otherSeat(me)
  const myName = cleanName(opts.name, opts.host ? 'Host' : 'Guest')
  const { timing, storage } = deps
  const key = storageKey(room, me)

  const saved = loadPersisted(storage, key)
  const store: Persisted = saved ?? {
    v: 1,
    clientId: randomHex(8),
    peerId: null,
    sent: [],
    recv: [],
    secrets: {},
    updatedAt: Date.now(),
  }
  const myId = store.clientId

  /** logs[seat] — mine is everything I ever sent, the opponent's is what I hold contiguously. */
  const logs: [LogEntry[], LogEntry[]] = [[], []]
  logs[me] = store.sent
  logs[opp] = store.recv

  const proto: Proto = createProto()

  let disposed = false
  let roomFull = false
  let transportStatus: TransportStatus = 'connecting'
  let heardThisSession = false
  let lastHeard = Date.now()
  /** When each of my log entries was last put on the wire (0 = not this session). */
  const lastSentAt: number[] = store.sent.map(() => 0)
  /** Opponent entries received out of order, by seq. */
  const buffer = new Map<number, DataBody>()
  /** How many opponent entries have been taken off the wire in order (= my ack). */
  let taken = store.recv.length
  let draining = false
  /** Steps for which my commit hash is being computed. */
  const inflight = new Set<string>()
  let lastHeartbeatAt = 0
  let nudgeTimer: ReturnType<typeof setTimeout> | null = null
  let msgCounter = 0

  const listeners = new Set<() => void>()

  const save = () => {
    if (!storage) return
    store.updatedAt = Date.now()
    try {
      storage.setItem(key, JSON.stringify(store))
    } catch {
      // storage full or unavailable: keep playing, reload recovery is simply lost
    }
  }

  /* ------------------------------ snapshot ------------------------------ */

  const connectionNow = (): OnlineSnapshot['connection'] => {
    if (roomFull) return 'opponent-left'
    if (proto.names[opp] === null) return transportStatus === 'up' ? 'waiting-for-opponent' : 'connecting'
    const silent = Date.now() - lastHeard
    if (silent > timing.leftMs) return 'opponent-left'
    if (!heardThisSession || silent > timing.reconnectMs || transportStatus !== 'up') return 'reconnecting'
    return 'connected'
  }

  const buildSnapshot = (): OnlineSnapshot => {
    const step = proto.step
    const mine = step !== null && (step.commits[me] !== null || inflight.has(step.id))
    const theirs = step !== null && step.commits[opp] !== null
    const names: [string, string] = ['', '']
    names[me] = proto.names[me] ?? myName
    names[opp] = proto.names[opp] ?? 'Opponent'
    return {
      me,
      names,
      connection: connectionNow(),
      room,
      // Only public, already-resolved state. Reveals never appear here.
      match: proto.shown,
      myPending: { lineup: mine && (step?.kind === 'lineup' || step?.kind === 'break'), pick: mine && step?.kind === 'play' },
      oppPending: { lineup: theirs && (step?.kind === 'lineup' || step?.kind === 'break'), pick: theirs && step?.kind === 'play' },
      rematch: { me: proto.rematch[me], opp: proto.rematch[opp] },
      error: roomFull ? 'room-full' : proto.error !== null ? 'desync' : null,
      errorDetail: roomFull ? 'room already has two players' : proto.error,
    }
  }

  let snapshot = buildSnapshot()

  const sameSnapshot = (a: OnlineSnapshot, b: OnlineSnapshot) =>
    a.match === b.match &&
    a.connection === b.connection &&
    a.names[0] === b.names[0] &&
    a.names[1] === b.names[1] &&
    a.myPending.lineup === b.myPending.lineup &&
    a.myPending.pick === b.myPending.pick &&
    a.oppPending.lineup === b.oppPending.lineup &&
    a.oppPending.pick === b.oppPending.pick &&
    a.rematch.me === b.rematch.me &&
    a.rematch.opp === b.rematch.opp &&
    a.error === b.error &&
    a.errorDetail === b.errorDetail

  const emit = () => {
    if (disposed) return
    const next = buildSnapshot()
    if (sameSnapshot(snapshot, next)) return
    snapshot = next
    for (const l of [...listeners]) l()
  }

  /* ------------------------------ sending ------------------------------ */

  let transport: Transport | null = null

  const envelope = (seq?: number): Envelope => {
    msgCounter += 1
    const env: Envelope = {
      v: 1,
      id: `${myId}.${Date.now().toString(36)}.${msgCounter.toString(36)}`,
      room,
      from: myId,
      seat: me,
      to: store.peerId,
      sent: store.sent.length,
      ack: taken,
    }
    if (seq !== undefined) {
      env.seq = seq
      env.body = store.sent[seq].body
    }
    return env
  }

  const publishEntry = (seq: number) => {
    if (!transport || roomFull) return
    lastSentAt[seq] = Date.now()
    transport.publish(envelope(seq))
  }

  const heartbeat = () => {
    if (disposed || !transport || roomFull) return
    lastHeartbeatAt = Date.now()
    transport.publish(envelope())
  }

  /** Ask for missing messages soon, without flooding. */
  const nudge = () => {
    if (disposed || nudgeTimer !== null) return
    const wait = Math.max(0, lastHeartbeatAt + timing.nudgeMs - Date.now())
    nudgeTimer = setTimeout(() => {
      nudgeTimer = null
      heartbeat()
    }, wait)
  }

  /** Re-send log entries the opponent says it does not have. */
  const resendFrom = (ack: number) => {
    const now = Date.now()
    let burst = 0
    for (let seq = ack; seq < store.sent.length && burst < MAX_RESEND_BURST; seq++) {
      if (now - lastSentAt[seq] < timing.resendMs) continue
      publishEntry(seq)
      burst += 1
    }
  }

  /** Append to my log, persist, publish, and advance the machine. */
  const append = (entry: LogEntry) => {
    store.sent.push(entry)
    lastSentAt.push(0)
    save()
    publishEntry(store.sent.length - 1)
    advance()
  }

  /* ------------------------------ machine ------------------------------ */

  const startCommit = (step: string, payload: unknown) => {
    inflight.add(step)
    const nonce = randomHex(16)
    void commitHash(payload, nonce).then((hash) => {
      inflight.delete(step)
      if (disposed) return
      const current = proto.step
      if (proto.error !== null || roomFull || !current || current.id !== step || current.commits[me] !== null) {
        emit()
        return
      }
      // The secret is stored together with the commit so a reload can still reveal it.
      store.secrets[step] = { payload, nonce, hash }
      append({ body: { k: 'commit', step, hash } })
    })
  }

  /** Things I owe the protocol given the current state. Idempotent. */
  const obligations = () => {
    if (disposed || roomFull || proto.error !== null) return
    const step = proto.step
    if (!step) return
    if (step.kind === 'flip' && step.commits[me] === null && !inflight.has(step.id)) {
      startCommit(step.id, { flip: randomHex(16) })
      return
    }
    if (step.commits[0] !== null && step.commits[1] !== null && step.reveals[me] === null) {
      if (proto.cursor[me] < logs[me].length) return // my reveal is already queued in my log
      const secret = store.secrets[step.id]
      if (!secret) return
      append({ body: { k: 'reveal', step: step.id, payload: secret.payload, nonce: secret.nonce }, h: secret.hash })
    }
  }

  const advance = () => {
    if (disposed) return
    pump(proto, logs)
    obligations()
    emit()
  }

  /* ------------------------------ receiving ------------------------------ */

  const drain = async () => {
    if (draining) return
    draining = true
    try {
      for (;;) {
        const body = buffer.get(taken)
        if (body === undefined) break
        buffer.delete(taken)
        taken += 1
        const entry: LogEntry = { body }
        // Hash the reveal ourselves; the machine compares it with the earlier commit.
        if (body.k === 'reveal') entry.h = await commitHash(body.payload, body.nonce)
        if (disposed) return
        store.recv.push(entry)
        save()
        advance()
      }
    } finally {
      draining = false
    }
  }

  const receive = (raw: unknown) => {
    if (disposed || roomFull) return
    const env = parseEnvelope(raw)
    if (!env || env.room !== room) return
    if (env.from === myId || env.seat === me) return // my own echo, or someone else claiming my seat

    const addressedElsewhere = env.to !== null && env.to !== myId
    if (store.peerId === null) {
      if (addressedElsewhere) {
        // The other seat is already playing someone else: we are the third client.
        roomFull = true
        emit()
        return
      }
      store.peerId = env.from
      save()
    } else if (env.from !== store.peerId) {
      // A third client: ignore it. But if we have nothing from our own "opponent" yet and this
      // one is visibly paired with somebody else, we are the odd one out in an occupied room.
      if (store.recv.length === 0 && addressedElsewhere) {
        roomFull = true
        emit()
      }
      return
    } else if (addressedElsewhere) {
      // We both heard the same opponent first, but it bound to the other client.
      if (store.recv.length === 0) {
        roomFull = true
        emit()
      }
      return
    }

    lastHeard = Date.now()
    heardThisSession = true

    if (env.seq !== undefined && env.body !== undefined) {
      if (env.seq >= taken && !buffer.has(env.seq) && buffer.size < MAX_BUFFERED) buffer.set(env.seq, env.body)
      void drain()
    }
    if (env.ack < store.sent.length) resendFrom(env.ack)
    if (env.sent > taken + buffer.size) nudge()
    emit()
  }

  /* ------------------------------ actions ------------------------------ */

  const act = (action: PlayerAction) => {
    if (disposed || roomFull || proto.error !== null) return
    const match = proto.match
    const step = proto.step
    const committed = step !== null && (step.commits[me] !== null || inflight.has(step.id))
    switch (action.type) {
      case 'draftPick': {
        if (!match || typeof action.cardId !== 'string') return
        if (validateEvent(match, { type: 'draftPick', seat: me, cardId: action.cardId }) !== null) return
        append({ body: { k: 'draft', m: proto.matchIndex, pick: match.draft.pickNumber, cardId: action.cardId } })
        return
      }
      case 'submitLineup': {
        if (!match || !step || (step.kind !== 'lineup' && step.kind !== 'break') || committed) return
        if (!isLegalLineup(match, me, action.order)) return
        startCommit(step.id, { order: [...action.order] })
        emit()
        return
      }
      case 'submitOffense': {
        if (!match || !step || step.kind !== 'play' || committed) return
        // Always the same keys, so the committed payload has one canonical shape.
        const pick: OffensePick = {
          shooterId: action.shooterId,
          shot: action.shot,
          passerId: action.passerId ?? null,
          cardId: action.cardId ?? null,
          sub: action.sub ? { out: action.sub.out, in: action.sub.in } : null,
        }
        if (validateOffensePick(match, me, pick) !== null) return
        startCommit(step.id, pick)
        emit()
        return
      }
      case 'submitDefense': {
        if (!match || !step || step.kind !== 'play' || committed) return
        const pick: DefensePick = {
          doubleId: action.doubleId ?? null,
          cardId: action.cardId ?? null,
          sub: action.sub ? { out: action.sub.out, in: action.sub.in } : null,
        }
        if (validateDefensePick(match, me, pick) !== null) return
        startCommit(step.id, pick)
        emit()
        return
      }
      case 'requestRematch': {
        if (!match || match.phase !== 'gameover' || proto.rematch[me]) return
        append({ body: { k: 'rematch', m: proto.matchIndex } })
        return
      }
      default:
        return
    }
  }

  /* ------------------------------ start ------------------------------ */

  // Rebuild from whatever was persisted (reload recovery), then say hello if this is new.
  pump(proto, logs)
  snapshot = buildSnapshot()
  if (store.sent.length === 0) {
    store.sent.push({ body: { k: 'hello', name: myName } })
    lastSentAt.push(0)
    save()
    pump(proto, logs)
    snapshot = buildSnapshot()
  }

  transport = deps.transport(room)
  transport.onMessage(receive)
  transport.onStatus((status) => {
    if (disposed) return
    const was = transportStatus
    transportStatus = status
    if (status === 'up' && was !== 'up') {
      // Announce ourselves; anything the opponent lacks is re-sent when it answers.
      if (store.peerId === null) for (let seq = 0; seq < store.sent.length; seq++) publishEntry(seq)
      heartbeat()
    }
    emit()
  })

  const ticker = setInterval(() => {
    heartbeat()
    emit() // connection may have aged into 'reconnecting' / 'opponent-left'
  }, timing.heartbeatMs)

  obligations()
  emit()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    act,
    dispose() {
      if (disposed) return
      disposed = true
      clearInterval(ticker)
      if (nudgeTimer !== null) clearTimeout(nudgeTimer)
      nudgeTimer = null
      transport?.close()
      transport = null
      listeners.clear()
    },
  }
}
