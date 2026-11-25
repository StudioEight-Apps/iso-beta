import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  botDefensePick,
  botDraftPick,
  botLineup,
  botOffensePick,
  createMatch,
  currentOffenseSeat,
  isLegalLineup,
  mulberry32,
  otherSeat,
  validateDefensePick,
  validateOffensePick,
  whoseDraftTurn,
} from '../src/game'
import type { MatchState } from '../src/game'
import { createBotSession } from '../src/session'
import type { PlayerAction, Session, SessionSnapshot } from '../src/session'
import { createOnlineSession, makeRoomCode } from '../src/net'
import { playState } from './helpers'

/** The action a bot would take for the human seat right now, or null if nothing is owed. */
function autoAction(snap: SessionSnapshot, rand: () => number): PlayerAction | null {
  const m = snap.match
  if (!m) return null
  const me = snap.me
  switch (m.phase) {
    case 'draft':
      return whoseDraftTurn(m) === me ? { type: 'draftPick', cardId: botDraftPick(m, me, rand) } : null
    case 'lineup':
    case 'break':
      return snap.myPending.lineup ? null : { type: 'submitLineup', order: botLineup(m, me, rand) }
    case 'play': {
      if (snap.myPending.pick) return null
      if (currentOffenseSeat(m) === me) return { type: 'submitOffense', ...botOffensePick(m, me, rand) }
      return { type: 'submitDefense', ...botDefensePick(m, me, rand) }
    }
    default:
      return null
  }
}

function playToEnd(session: Session, rand: () => number): number {
  let steps = 0
  while (session.getSnapshot().match?.phase !== 'gameover') {
    if (++steps > 2000) throw new Error('game did not finish')
    const action = autoAction(session.getSnapshot(), rand)
    if (action) session.act(action)
    vi.advanceTimersByTime(1800)
  }
  return steps
}

describe('bot session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays a full bot-vs-bot game to gameover through the Session interface', () => {
    for (const seed of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']) {
      const session = createBotSession({ name: 'Tester', seed, random: mulberry32(seed.length * 7919 + seed.charCodeAt(1)) })
      const rand = mulberry32(99 + seed.charCodeAt(1))
      let notifications = 0
      const unsub = session.subscribe(() => {
        notifications++
      })
      const first = session.getSnapshot()
      expect(first.connection).toBe('local')
      expect(first.room).toBeNull()
      expect(first.me).toBe(0)
      expect(first.names).toEqual(['Tester', 'CPU'])
      expect(first.match?.phase).toBe('draft')

      playToEnd(session, rand)
      const end = session.getSnapshot()
      const m = end.match as MatchState
      expect(m.phase).toBe('gameover')
      expect(m.winner).not.toBeNull()
      expect(m.score[m.winner as 0 | 1]).toBeGreaterThan(m.score[otherSeat(m.winner as 0 | 1)])
      expect(m.history.length).toBeGreaterThanOrEqual(40)
      expect((m.history.length - 40) % 2).toBe(0)
      expect(m.history.some((r) => r.cards.offense !== null || r.cards.defense !== null)).toBe(true)
      expect(notifications).toBeGreaterThan(50)
      expect(JSON.parse(JSON.stringify(end))).toEqual(end)
      unsub()
      session.dispose()
    }
  })

  it('bot thinks 600-1800ms: nothing before 600ms, committed by 1800ms', () => {
    // pick a seed where the human (seat 0) drafts second, so the human makes the last
    // draft pick and the lineup step starts at a known instant
    let seed = ''
    for (let i = 0; ; i++) {
      seed = `think-${i}`
      if (createMatch(seed).firstDrafter === 1) break
    }
    for (let trial = 0; trial < 20; trial++) {
      const session = createBotSession({ name: 'T', seed, random: mulberry32(500 + trial) })
      const rand = mulberry32(6)
      for (;;) {
        const snap = session.getSnapshot()
        if (snap.match?.phase !== 'draft') break
        const a = autoAction(snap, rand)
        if (a) session.act(a)
        else vi.advanceTimersByTime(1800)
      }
      expect(session.getSnapshot().match?.phase).toBe('lineup')
      expect(session.getSnapshot().oppPending.lineup).toBe(false)
      vi.advanceTimersByTime(599)
      expect(session.getSnapshot().oppPending.lineup).toBe(false)
      vi.advanceTimersByTime(1201)
      expect(session.getSnapshot().oppPending.lineup).toBe(true)
      // the human has not committed: nothing is revealed, the match has not advanced
      expect(session.getSnapshot().myPending.lineup).toBe(false)
      expect(session.getSnapshot().match?.phase).toBe('lineup')
      expect(session.getSnapshot().match?.lineups).toBeNull()
      session.dispose()
    }
  })

  it('snapshots are stable references and never leak the opponent secret', () => {
    const session = createBotSession({ name: 'T', seed: 'leak', random: mulberry32(11) })
    const rand = mulberry32(12)
    const s1 = session.getSnapshot()
    expect(session.getSnapshot()).toBe(s1)
    while (session.getSnapshot().match?.phase !== 'play') {
      const a = autoAction(session.getSnapshot(), rand)
      if (a) session.act(a)
      vi.advanceTimersByTime(1800)
      const snap = session.getSnapshot()
      if (snap.match?.phase === 'lineup') {
        // lineups are not in the match state until both have committed
        expect(snap.match.lineups).toBeNull()
        expect(Object.keys(snap).sort()).toEqual(
          ['connection', 'match', 'me', 'myPending', 'names', 'oppPending', 'rematch', 'room'].sort(),
        )
      }
    }
    vi.advanceTimersByTime(1800) // bot commits its pick for possession 0
    const snap = session.getSnapshot()
    expect(snap.oppPending.pick).toBe(true)
    expect(snap.match?.history).toHaveLength(0)
    expect(Object.keys(snap.oppPending).sort()).toEqual(['lineup', 'pick'])
    expect(Object.keys(snap).sort()).toEqual(
      ['connection', 'match', 'me', 'myPending', 'names', 'oppPending', 'rematch', 'room'].sort(),
    )
    session.dispose()
  })

  it('ignores illegal / out-of-turn actions', () => {
    const session = createBotSession({ name: 'T', seed: 'illegal', random: mulberry32(21) })
    const rand = mulberry32(22)
    const s0 = session.getSnapshot()
    session.act({ type: 'submitLineup', order: [] })
    session.act({ type: 'submitOffense', shooterId: 'curry', shot: 'THREE' })
    session.act({ type: 'submitDefense', doubleId: 'curry' })
    session.act({ type: 'requestRematch' })
    session.act({ type: 'draftPick', cardId: 'nobody' })
    expect(session.getSnapshot()).toBe(s0)
    while (session.getSnapshot().match?.phase !== 'play') {
      const a = autoAction(session.getSnapshot(), rand)
      if (a) session.act(a)
      vi.advanceTimersByTime(1800)
    }
    const snap = session.getSnapshot()
    const m = snap.match as MatchState
    const before = session.getSnapshot()
    if (currentOffenseSeat(m) === snap.me) {
      session.act({ type: 'submitDefense', doubleId: m.lineups![1][0] })
      session.act({ type: 'submitOffense', shooterId: m.lineups![1][0], shot: 'THREE' })
      session.act({ type: 'submitOffense', shooterId: m.lineups![0][0], shot: 'DRIVE', cardId: 'wallup' })
      session.act({ type: 'submitOffense', shooterId: m.lineups![0][0], shot: 'DRIVE', sub: { out: m.lineups![0][0], in: m.lineups![1][0] } })
    } else {
      session.act({ type: 'submitOffense', shooterId: m.lineups![0][0], shot: 'THREE' })
      session.act({ type: 'submitDefense', doubleId: m.lineups![0][0] })
      session.act({ type: 'submitDefense', doubleId: null, cardId: 'screen' })
    }
    expect(session.getSnapshot()).toBe(before)
    session.dispose()
  })

  it('rematch: human requests, bot accepts after thinking, a fresh match starts', () => {
    const session = createBotSession({ name: 'T', seed: 'rm', random: mulberry32(31) })
    playToEnd(session, mulberry32(32))
    const oldSeed = session.getSnapshot().match?.seed
    vi.advanceTimersByTime(5000)
    expect(session.getSnapshot().match?.phase).toBe('gameover')
    expect(session.getSnapshot().rematch).toEqual({ me: false, opp: false })
    session.act({ type: 'requestRematch' })
    expect(session.getSnapshot().rematch).toEqual({ me: true, opp: false })
    vi.advanceTimersByTime(1800)
    const snap = session.getSnapshot()
    expect(snap.match?.phase).toBe('draft')
    expect(snap.match?.seed).not.toBe(oldSeed)
    expect(snap.match?.history).toHaveLength(0)
    expect(snap.rematch).toEqual({ me: false, opp: false })
    expect(snap.myPending).toEqual({ lineup: false, pick: false })
    // and the new match is playable to the end
    playToEnd(session, mulberry32(33))
    expect(session.getSnapshot().match?.phase).toBe('gameover')
    session.dispose()
  })

  it('dispose stops the bot', () => {
    const session = createBotSession({ name: 'T', seed: 'disp', random: mulberry32(41) })
    const s0 = session.getSnapshot()
    session.dispose()
    vi.advanceTimersByTime(10000)
    session.act({ type: 'draftPick', cardId: 'curry' })
    expect(session.getSnapshot()).toBe(s0)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('bot brain', () => {
  it('always returns legal picks and is not fully predictable', () => {
    const s = playState('brain')
    const off = currentOffenseSeat(s) as 0 | 1
    const def = otherSeat(off)
    const rand = mulberry32(1234)
    const shooters = new Set<string>()
    const doubles = new Set<string | null>()
    for (let i = 0; i < 400; i++) {
      const o = botOffensePick(s, off, rand)
      expect(validateOffensePick(s, off, o)).toBeNull()
      shooters.add(o.shooterId)
      const d = botDefensePick(s, def, rand)
      expect(validateDefensePick(s, def, d)).toBeNull()
      doubles.add(d.doubleId)
    }
    expect(shooters.size).toBeGreaterThanOrEqual(3)
    expect(doubles.size).toBeGreaterThanOrEqual(2)
  })

  it('drafts strong cards first more often than weak ones, and seats a legal five', () => {
    const rand = mulberry32(77)
    const counts = new Map<string, number>()
    const fresh = createMatch('y')
    for (let i = 0; i < 500; i++) {
      const id = botDraftPick(fresh, fresh.firstDrafter, rand)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBeGreaterThan(1)
    expect(counts.get('caruso') ?? 0).toBeLessThan(counts.get('durant') ?? 0)
    const s = playState('z')
    const d = { ...s, phase: 'lineup' as const, lineups: null }
    for (const seat of [0, 1] as const) {
      const five = botLineup(d, seat, rand)
      expect(isLegalLineup(d, seat, five)).toBe(true)
    }
  })
})

describe('net entry point', () => {
  it('makeRoomCode: 5 chars, unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) expect(makeRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
  })
  it('createOnlineSession is exported (covered in src/net/net.test.ts)', () => {
    expect(typeof createOnlineSession).toBe('function')
  })
})
