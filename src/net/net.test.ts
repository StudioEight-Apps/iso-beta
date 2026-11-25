import { afterEach, describe, expect, it } from 'vitest'
import { currentOffenseSeat, mulberry32, seatByPosition, whoseDraftTurn } from '../game'
import type { MatchState } from '../game'
import { createProto, pump, replayLogs } from './core'
import { BroadcastChannelTransport, createOnlineSession, createOnlineSessionWith, makeRoomCode, setNetStorage, setNetTiming, setTransport, storageKey } from './index'
import type { NetTiming, OnlineSession } from './index'
import { parseEnvelope, parseLogEntry } from './protocol'
import type { Envelope, LogEntry } from './protocol'
import { canonicalJson, commitHash, sha256Hex, sha256HexJs } from './sha256'
import { autoplay, waitFor } from './testing/autoplay'
import { FakeNetwork, MemoryStorage } from './testing/fakeNetwork'
import type { FakeNetworkOptions } from './testing/fakeNetwork'

const FAST: NetTiming = { heartbeatMs: 25, reconnectMs: 250, leftMs: 900, resendMs: 30, nudgeMs: 4 }

interface Rig {
  net: FakeNetwork
  storage: MemoryStorage
  host: OnlineSession
  guest: OnlineSession
  open(host: boolean, name?: string, storage?: MemoryStorage | null): OnlineSession
}

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
  setTransport(null)
  setNetStorage(undefined)
  setNetTiming({})
})

function rig(netOpts: FakeNetworkOptions = {}, room = 'ROOM7', timing: NetTiming = FAST): Rig {
  const net = new FakeNetwork(netOpts)
  const storage = new MemoryStorage()
  const open = (host: boolean, name = host ? 'Mike' : 'Jay', store: MemoryStorage | null = storage) => {
    const s = createOnlineSessionWith({ room, name, host }, { transport: net.factory, storage: store, timing })
    cleanups.push(() => s.dispose())
    return s
  }
  cleanups.push(() => net.stop())
  const host = open(true)
  const guest = open(false)
  return { net, storage, host, guest, open }
}

const over = (s: OnlineSession) => s.getSnapshot().match?.phase === 'gameover'
const matchOf = (s: OnlineSession) => s.getSnapshot().match as MatchState

function envelopes(net: FakeNetwork): Envelope[] {
  const out: Envelope[] = []
  for (const raw of net.published) {
    const env = parseEnvelope(raw)
    if (env) out.push(env)
  }
  return out
}

function storedLogs(storage: MemoryStorage, room: string, seat: 0 | 1): { sent: LogEntry[]; recv: LogEntry[] } {
  const raw = JSON.parse(storage.getItem(storageKey(room, seat)) as string) as { sent: unknown[]; recv: unknown[] }
  return {
    sent: raw.sent.map((e) => parseLogEntry(e) as LogEntry),
    recv: raw.recv.map((e) => parseLogEntry(e) as LogEntry),
  }
}

describe('sha256 / commit', () => {
  it('JS fallback matches known vectors and crypto.subtle', async () => {
    expect(sha256HexJs('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256HexJs('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    for (const text of ['x', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(200), 'héllo ✓ {"k":1}']) {
      expect(await sha256Hex(text)).toBe(sha256HexJs(text))
    }
  })

  it('commit hash ignores key order but not content or nonce', async () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}')
    const a = await commitHash({ shooterId: 'curry', shot: 'THREE' }, 'n1')
    expect(await commitHash({ shot: 'THREE', shooterId: 'curry' }, 'n1')).toBe(a)
    expect(await commitHash({ shooterId: 'curry', shot: 'DRIVE' }, 'n1')).not.toBe(a)
    expect(await commitHash({ shooterId: 'curry', shot: 'THREE' }, 'n2')).not.toBe(a)
  })
})

describe('makeRoomCode', () => {
  it('is 5 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) expect(makeRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
  })
})

describe('online session', () => {
  it('plays a full game on a clean network and both sides end deep-equal', async () => {
    const { host, guest, net } = rig()
    expect(host.getSnapshot().me).toBe(0)
    expect(guest.getSnapshot().me).toBe(1)
    expect(host.getSnapshot().room).toBe('ROOM7')
    autoplay(host)
    autoplay(guest)
    await waitFor(() => over(host) && over(guest), 20000, 'gameover')
    const a = matchOf(host)
    const b = matchOf(guest)
    expect(a).toEqual(b)
    expect(a.history.length).toBeGreaterThanOrEqual(40)
    // the scripted players used play cards and mid-quarter subs, all through commit-reveal
    expect(a.history.some((r) => r.cards.offense !== null)).toBe(true)
    expect(a.history.some((r) => r.subs.length > 0)).toBe(true)
    expect(a.history.some((r) => r.pass !== null)).toBe(true)
    expect(a.winner).not.toBeNull()
    expect(host.getSnapshot().names).toEqual(['Mike', 'Jay'])
    expect(guest.getSnapshot().names).toEqual(['Mike', 'Jay'])
    expect(host.getSnapshot().connection).toBe('connected')
    expect(guest.getSnapshot().connection).toBe('connected')
    expect(host.getSnapshot().error).toBeNull()
    expect(net.dropped).toBe(0)
  })

  it('goes connecting/waiting -> connected, and match stays null until the coin flip resolves', async () => {
    const net = new FakeNetwork()
    cleanups.push(() => net.stop())
    const host = createOnlineSessionWith({ room: 'solo1', name: 'Mike', host: true }, { transport: net.factory, storage: null, timing: FAST })
    cleanups.push(() => host.dispose())
    expect(host.getSnapshot().connection).toBe('waiting-for-opponent')
    expect(host.getSnapshot().match).toBeNull()
    expect(host.getSnapshot().room).toBe('SOLO1')
    await new Promise((r) => setTimeout(r, 80))
    expect(host.getSnapshot().connection).toBe('waiting-for-opponent')
    const guest = createOnlineSessionWith({ room: 'SOLO1', name: 'Jay', host: false }, { transport: net.factory, storage: null, timing: FAST })
    cleanups.push(() => guest.dispose())
    await waitFor(() => host.getSnapshot().match !== null && guest.getSnapshot().match !== null, 5000, 'coin flip')
    expect(host.getSnapshot().connection).toBe('connected')
    expect(host.getSnapshot().match).toEqual(guest.getSnapshot().match)
    expect(host.getSnapshot().match?.phase).toBe('draft')
  })

  it('converges with dropped, duplicated and reordered messages', async () => {
    for (const seed of [11, 12]) {
      const { host, guest, net } = rig({ delay: [0, 25], drop: 0.2, duplicate: 0.2, seed }, `LOSSY${seed}`)
      autoplay(host)
      autoplay(guest)
      await waitFor(() => over(host) && over(guest), 50000, 'lossy gameover')
      expect(matchOf(host)).toEqual(matchOf(guest))
      expect(host.getSnapshot().error).toBeNull()
      expect(guest.getSnapshot().error).toBeNull()
      expect(net.dropped).toBeGreaterThan(20)
    }
  })

  it('snapshots are stable references and listeners fire only on change', async () => {
    const { host, guest } = rig()
    await waitFor(() => host.getSnapshot().match !== null, 5000, 'match')
    const snap = host.getSnapshot()
    let calls = 0
    host.subscribe(() => {
      calls += 1
    })
    await new Promise((r) => setTimeout(r, 120)) // several heartbeats, nothing changes
    expect(host.getSnapshot()).toBe(snap)
    expect(calls).toBe(0)
    void guest
  })

  it('never leaks a secret before both sides have committed', async () => {
    const { host, guest, net } = rig()
    // Guest plays by itself; host is driven by hand so we can hold a step open.
    autoplay(guest)
    await waitFor(() => host.getSnapshot().match?.phase === 'draft', 5000, 'draft')
    const draftOnly = () => {
      const m = host.getSnapshot().match
      if (m && m.phase === 'draft' && whoseDraftTurn(m) === 0) host.act({ type: 'draftPick', cardId: m.draft.available[0] })
    }
    host.subscribe(draftOnly)
    draftOnly()
    await waitFor(() => host.getSnapshot().match?.phase === 'lineup', 5000, 'lineup')

    // --- lineup: guest commits, host has not ---
    await waitFor(() => host.getSnapshot().oppPending.lineup, 5000, 'guest lineup commit')
    await new Promise((r) => setTimeout(r, 100))
    let snap = host.getSnapshot()
    expect(snap.myPending.lineup).toBe(false)
    expect(snap.match?.lineups).toBeNull()
    expect(snap.match?.phase).toBe('lineup')
    expect(envelopes(net).some((e) => e.body?.k === 'reveal' && e.body.step === 'm0:lineup')).toBe(false)

    const hostPicks = snap.match?.draft.picks[0] as string[]
    host.act({ type: 'submitLineup', order: seatByPosition(hostPicks.slice(0, 5)) as string[] })
    expect(host.getSnapshot().myPending.lineup).toBe(true) // flips synchronously
    await waitFor(() => host.getSnapshot().match?.phase === 'play', 5000, 'play')
    expect(host.getSnapshot().myPending).toEqual({ lineup: false, pick: false })

    // --- possession 0: guest commits its pick, host waits ---
    await waitFor(() => host.getSnapshot().oppPending.pick, 5000, 'guest pick commit')
    await new Promise((r) => setTimeout(r, 100))
    snap = host.getSnapshot()
    expect(snap.match?.history.length).toBe(0)
    expect(snap.myPending.pick).toBe(false)
    const guestMsgs = envelopes(net).filter((e) => e.seat === 1 && e.body !== undefined)
    expect(guestMsgs.some((e) => e.body?.k === 'commit' && e.body.step === 'm0:p0')).toBe(true)
    expect(guestMsgs.some((e) => e.body?.k === 'reveal' && e.body.step === 'm0:p0')).toBe(false)
    // The snapshot holds nothing but public state: no nonce / payload / reveal anywhere in it.
    const text = JSON.stringify(snap)
    expect(text).not.toMatch(/nonce|payload|doubleId|shooterId|reveal/)
    // The commit on the wire is only a hash.
    const commit = guestMsgs.find((e) => e.body?.k === 'commit' && e.body.step === 'm0:p0')
    expect(JSON.stringify(commit)).not.toMatch(/doubleId|shooterId|cardId|THREE|DRIVE/)

    // Host commits; only now do reveals appear and the possession resolve.
    const m = snap.match as MatchState
    if (currentOffenseSeat(m) === 0) host.act({ type: 'submitOffense', shooterId: (m.lineups as [string[], string[]])[0][0], shot: 'THREE' })
    else host.act({ type: 'submitDefense', doubleId: (m.lineups as [string[], string[]])[1][0] })
    await waitFor(() => (host.getSnapshot().match?.history.length ?? 0) === 1, 5000, 'first possession')
    expect(host.getSnapshot().match).toEqual(guest.getSnapshot().match)
    // Order on the wire: both commits strictly before either reveal.
    const order = envelopes(net).filter((e) => e.body !== undefined && 'step' in e.body && e.body.step === 'm0:p0')
    const firstReveal = order.findIndex((e) => e.body?.k === 'reveal')
    const commitSeats = new Set(order.slice(0, firstReveal).filter((e) => e.body?.k === 'commit').map((e) => e.seat))
    expect(commitSeats.size).toBe(2)
  })

  it('ignores illegal and out-of-turn actions', async () => {
    const { host, guest } = rig()
    await waitFor(() => host.getSnapshot().match !== null && guest.getSnapshot().match !== null, 5000, 'match')
    const m = matchOf(host)
    const onClock = m.firstDrafter === 0 ? host : guest
    const waiting = m.firstDrafter === 0 ? guest : host
    const before = waiting.getSnapshot()
    waiting.act({ type: 'draftPick', cardId: 'curry' })
    waiting.act({ type: 'submitLineup', order: ['curry'] })
    waiting.act({ type: 'submitOffense', shooterId: 'curry', shot: 'THREE' })
    waiting.act({ type: 'submitDefense', doubleId: 'curry' })
    waiting.act({ type: 'requestRematch' })
    onClock.act({ type: 'draftPick', cardId: 'nobody' })
    await new Promise((r) => setTimeout(r, 60))
    expect(waiting.getSnapshot()).toBe(before)
    expect(matchOf(host).draft.pickNumber).toBe(0)
    onClock.act({ type: 'draftPick', cardId: 'curry' })
    await waitFor(() => matchOf(waiting).draft.pickNumber === 1, 5000, 'pick')
    expect(matchOf(host)).toEqual(matchOf(guest))
  })

  it('detects a tampered reveal and freezes instead of continuing', async () => {
    const { host, guest, net } = rig()
    // Anything the guest reveals for a possession is rewritten in transit.
    net.tamper = (msg) => {
      const env = parseEnvelope(msg)
      if (env && env.seat === 1 && env.body?.k === 'reveal' && /:p\d+$/.test(env.body.step)) {
        const payload = env.body.payload as Record<string, unknown>
        const forged = 'doubleId' in payload ? { ...payload, doubleId: 'forged' } : { ...payload, shot: payload.shot === 'THREE' ? 'DRIVE' : 'THREE' }
        return { ...env, body: { ...env.body, payload: forged } }
      }
      return msg
    }
    autoplay(host)
    autoplay(guest)
    await waitFor(() => host.getSnapshot().error !== null, 10000, 'desync')
    const snap = host.getSnapshot()
    expect(snap.error).toBe('desync')
    expect(snap.errorDetail).toMatch(/does not match commit/)
    expect(snap.match?.phase).toBe('play')
    expect(snap.match?.history.length).toBe(0) // the forged possession was never applied
    const frozen = snap.match
    host.act({ type: 'submitDefense', doubleId: 'curry' })
    await new Promise((r) => setTimeout(r, 100))
    expect(host.getSnapshot().match).toBe(frozen)
  })

  it('detects an illegal choice hidden behind a valid commit', async () => {
    // Both logs are honest up to the lineup; then seat 1 commits to a lineup that is not its picks.
    const { host, guest, storage } = rig({}, 'CHEAT')
    const a = autoplay(host)
    const b = autoplay(guest)
    await waitFor(() => host.getSnapshot().match?.phase === 'play' && guest.getSnapshot().match?.phase === 'play', 5000, 'play')
    a.stop()
    b.stop()
    const h = storedLogs(storage, 'CHEAT', 0)
    const log0 = h.sent
    const log1 = h.recv
    const cut = (log: LogEntry[]) => log.slice(0, log.findIndex((e) => e.body.k === 'commit' && e.body.step === 'm0:lineup'))
    const honest0 = log0.filter((e) => 'step' in e.body && e.body.step === 'm0:lineup')
    const badPayload = { order: ['curry', 'curry', 'curry', 'curry', 'curry'] }
    const badHash = await commitHash(badPayload, 'nn')
    const forged1: LogEntry[] = [
      ...cut(log1),
      { body: { k: 'commit', step: 'm0:lineup', hash: badHash } },
      { body: { k: 'reveal', step: 'm0:lineup', payload: badPayload, nonce: 'nn' }, h: badHash },
    ]
    const p = replayLogs([[...cut(log0), ...honest0], forged1])
    expect(p.error).toMatch(/illegal lineup/)
    expect(p.match?.phase).toBe('lineup')
  })

  it('recovers when one client reloads mid-game (persisted log + resend)', async () => {
    const { host, guest, open, net } = rig({ delay: [0, 8], drop: 0.05, seed: 5 }, 'RELOAD')
    autoplay(host)
    const g = autoplay(guest)
    await waitFor(() => (host.getSnapshot().match?.history.length ?? 0) >= 9, 20000, 'mid-game')
    g.stop()
    const before = guest.getSnapshot().match as MatchState
    guest.dispose()

    const guest2 = open(false, 'ignored-new-name')
    // State is rebuilt synchronously from the persisted logs.
    const rebuilt = guest2.getSnapshot().match as MatchState
    expect(rebuilt.seed).toBe(before.seed)
    expect(rebuilt.history.length).toBeGreaterThanOrEqual(before.history.length)
    expect(rebuilt.history.slice(0, before.history.length)).toEqual(before.history)
    expect(guest2.getSnapshot().names).toEqual(['Mike', 'Jay'])
    autoplay(guest2)
    await waitFor(() => over(host) && over(guest2), 30000, 'gameover after reload')
    expect(matchOf(host)).toEqual(matchOf(guest2))
    expect(host.getSnapshot().error).toBeNull()
    expect(guest2.getSnapshot().connection).toBe('connected')
    void net
  })

  it('recovers a reload even when the received log was lost (full resend from the opponent)', async () => {
    const { host, guest, open, storage } = rig({}, 'RELO2')
    autoplay(host)
    const g = autoplay(guest)
    await waitFor(() => (guest.getSnapshot().match?.history.length ?? 0) >= 6, 20000, 'mid-game')
    g.stop()
    guest.dispose()
    // Keep only what the spec requires: own sent log + own secrets.
    const key = storageKey('RELO2', 1)
    const data = JSON.parse(storage.getItem(key) as string) as { recv: unknown[] }
    data.recv = []
    storage.setItem(key, JSON.stringify(data))

    const guest2 = open(false)
    expect(guest2.getSnapshot().match).toBeNull()
    expect(guest2.getSnapshot().connection).toBe('waiting-for-opponent')
    autoplay(guest2)
    await waitFor(() => over(host) && over(guest2), 30000, 'gameover after reload')
    expect(matchOf(host)).toEqual(matchOf(guest2))
  })

  it('both players reloading still converges', async () => {
    const { host, guest, open } = rig({}, 'RELO3')
    const h = autoplay(host)
    const g = autoplay(guest)
    await waitFor(() => (guest.getSnapshot().match?.history.length ?? 0) >= 4, 20000, 'mid-game')
    h.stop()
    g.stop()
    host.dispose()
    guest.dispose()
    const host2 = open(true)
    const guest2 = open(false)
    autoplay(host2)
    autoplay(guest2)
    await waitFor(() => over(host2) && over(guest2), 30000, 'gameover after double reload')
    expect(matchOf(host2)).toEqual(matchOf(guest2))
  })

  it('rejects a third client and leaves the two players unaffected', async () => {
    const { host, guest, open } = rig({}, 'FULL1')
    await waitFor(() => host.getSnapshot().match !== null && guest.getSnapshot().match !== null, 5000, 'match')
    const third = open(false, 'Intruder', new MemoryStorage())
    await waitFor(() => third.getSnapshot().error === 'room-full', 5000, 'room-full (second joiner)')
    const fourth = open(true, 'Intruder2', new MemoryStorage())
    await waitFor(() => fourth.getSnapshot().error === 'room-full', 5000, 'room-full (second host)')
    expect(third.getSnapshot().match).toBeNull()
    expect(third.getSnapshot().connection).toBe('opponent-left')
    third.act({ type: 'draftPick', cardId: 'curry' })
    autoplay(host)
    autoplay(guest)
    await waitFor(() => over(host) && over(guest), 20000, 'gameover')
    expect(matchOf(host)).toEqual(matchOf(guest))
    expect(host.getSnapshot().names).toEqual(['Mike', 'Jay'])
    expect(third.getSnapshot().match).toBeNull()
  })

  it('rematch starts a fresh match in the same room with seats unchanged', async () => {
    const { host, guest } = rig({}, 'AGAIN')
    autoplay(host)
    autoplay(guest)
    await waitFor(() => over(host) && over(guest), 20000, 'first gameover')
    const first = matchOf(host)
    expect(host.getSnapshot().rematch).toEqual({ me: false, opp: false })

    host.act({ type: 'requestRematch' })
    expect(host.getSnapshot().rematch).toEqual({ me: true, opp: false })
    await waitFor(() => guest.getSnapshot().rematch.opp, 5000, 'rematch request seen')
    expect(guest.getSnapshot().rematch).toEqual({ me: false, opp: true })
    expect(guest.getSnapshot().match).toEqual(first) // still showing the finished game
    host.act({ type: 'requestRematch' }) // duplicate is ignored

    guest.act({ type: 'requestRematch' })
    await waitFor(() => over(host) && over(guest) && matchOf(host).seed !== first.seed && matchOf(guest).seed !== first.seed, 20000, 'second gameover')
    const second = matchOf(host)
    expect(second).toEqual(matchOf(guest))
    expect(second.seed).not.toBe(first.seed)
    expect(host.getSnapshot().me).toBe(0)
    expect(guest.getSnapshot().me).toBe(1)
    expect(host.getSnapshot().rematch).toEqual({ me: false, opp: false })
    expect(host.getSnapshot().room).toBe('AGAIN')
  })

  it("reports 'reconnecting' then 'opponent-left' when the opponent goes silent, and recovers", async () => {
    const { host, guest, open } = rig({}, 'QUIET')
    await waitFor(() => host.getSnapshot().connection === 'connected', 5000, 'connected')
    guest.dispose()
    await waitFor(() => host.getSnapshot().connection === 'reconnecting', 3000, 'reconnecting')
    await waitFor(() => host.getSnapshot().connection === 'opponent-left', 5000, 'opponent-left')
    const back = open(false)
    await waitFor(() => host.getSnapshot().connection === 'connected' && back.getSnapshot().connection === 'connected', 5000, 'reconnected')
  })

  it('dispose stops all traffic', async () => {
    const { host, guest, net } = rig({}, 'STOP1')
    await waitFor(() => host.getSnapshot().match !== null, 5000, 'match')
    host.dispose()
    guest.dispose()
    await new Promise((r) => setTimeout(r, 40))
    const count = net.published.length
    await new Promise((r) => setTimeout(r, 120))
    expect(net.published.length).toBe(count)
  })
})

describe('lockstep machine', () => {
  it('reaches the same state for any interleaving of the two logs', async () => {
    const { host, guest, storage } = rig({}, 'ORDER')
    autoplay(host, { rematches: 1 })
    autoplay(guest, { rematches: 1 })
    const seeds = new Set<string>()
    host.subscribe(() => {
      const m = host.getSnapshot().match
      if (m && m.phase === 'gameover') seeds.add(m.seed)
    })
    await waitFor(() => seeds.size === 2 && over(guest) && matchOf(guest).seed === matchOf(host).seed, 40000, 'two games')
    const final = matchOf(host)
    const h = storedLogs(storage, 'ORDER', 0)
    const g = storedLogs(storage, 'ORDER', 1)
    // What each side holds of the other is exactly what the other sent.
    expect(h.recv.map((e) => e.body)).toEqual(g.sent.map((e) => e.body))
    expect(g.recv.map((e) => e.body)).toEqual(h.sent.map((e) => e.body))
    const logs: [LogEntry[], LogEntry[]] = [h.sent, h.recv]
    expect(replayLogs(logs).match).toEqual(final)
    expect(replayLogs([g.recv, g.sent]).match).toEqual(final)

    const rand = mulberry32(99)
    for (let trial = 0; trial < 25; trial++) {
      const p = createProto()
      const fed: [LogEntry[], LogEntry[]] = [[], []]
      const next = [0, 0]
      while (next[0] < logs[0].length || next[1] < logs[1].length) {
        const seat = next[0] >= logs[0].length ? 1 : next[1] >= logs[1].length ? 0 : rand() < 0.5 ? 0 : 1
        const burst = 1 + Math.floor(rand() * 6)
        for (let i = 0; i < burst && next[seat] < logs[seat].length; i++) fed[seat].push(logs[seat][next[seat]++])
        pump(p, fed)
        expect(p.error).toBeNull()
      }
      expect(p.match).toEqual(final)
      expect(p.cursor).toEqual([logs[0].length, logs[1].length])
    }
  })
})

describe('public entry point', () => {
  it('createOnlineSession works over BroadcastChannel via setTransport', async () => {
    setTransport('bc')
    setNetStorage(null)
    setNetTiming(FAST)
    const room = makeRoomCode()
    const host = createOnlineSession({ room, name: 'Mike', host: true })
    const guest = createOnlineSession({ room, name: 'Jay', host: false })
    cleanups.push(() => host.dispose(), () => guest.dispose())
    autoplay(host)
    autoplay(guest)
    await waitFor(() => over(host) && over(guest), 20000, 'gameover over BroadcastChannel')
    expect(matchOf(host)).toEqual(matchOf(guest))
    expect(new BroadcastChannelTransport(room)).toBeDefined()
  })
})
