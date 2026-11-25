import { describe, expect, it } from 'vitest'
import {
  DECK_SIZE,
  HAND_LIMIT,
  MAX_SHOTS_PER_QUARTER,
  POSSESSIONS_PER_QUARTER,
  STARTING_HAND,
  TOTAL_PICKS,
  applyEvent,
  benchOf,
  botDefensePick,
  botDraftPick,
  botLineup,
  botOffensePick,
  boxScore,
  createMatch,
  currentOffenseSeat,
  firstOffenseSeatOfQuarter,
  hasLink,
  legalDoubles,
  legalShooters,
  matchupOf,
  mulberry32,
  otherSeat,
  previewPass,
  previewShot,
  replay,
  resolvePossessionWithDice,
  shotOdds,
  shotsLeft,
  subsLeft,
  teamChem,
  tryApplyEvent,
  validateDefensePick,
  validateEvent,
  validateOffensePick,
  whoseDraftTurn,
} from '../src/game'
import type { MatchEvent, MatchState, Seat } from '../src/game'
import { F_DEF, F_OFF, TEAM_A, TEAM_B, build, draftTeams, dud, last, mod, play, playState, sameFive, shotOf, swap } from './helpers'

/** Bot against bot from a seed, recording every event. */
function botGame(seed: string): { state: MatchState; events: MatchEvent[] } {
  const rand = mulberry32(seed.length * 131 + seed.charCodeAt(seed.length - 1))
  let s = createMatch(seed)
  const events: MatchEvent[] = []
  const push = (e: MatchEvent) => {
    const next = applyEvent(s, e)
    if (next === s) throw new Error(`rejected ${e.type}: ${validateEvent(s, e)}`)
    events.push(e)
    s = next
  }
  let guard = 0
  while (s.phase !== 'gameover') {
    if (++guard > 500) throw new Error('game did not finish')
    if (s.phase === 'draft') {
      const seat = whoseDraftTurn(s) as Seat
      push({ type: 'draftPick', seat, cardId: botDraftPick(s, seat, rand) })
    } else if (s.phase === 'lineup' || s.phase === 'break') {
      push({ type: s.phase === 'lineup' ? 'lineupReveal' : 'quarterBreak', lineups: [botLineup(s, 0, rand), botLineup(s, 1, rand)] })
    } else {
      const off = currentOffenseSeat(s) as Seat
      push({ type: 'possessionResolve', offensePick: botOffensePick(s, off, rand), defensePick: botDefensePick(s, otherSeat(off), rand), seed: `dice-${guard}` })
    }
  }
  return { state: s, events }
}

describe('draft and lineups', () => {
  it('drafts 7 each, one pick at a time, alternating', () => {
    let s = createMatch('d1')
    expect(s.phase).toBe('draft')
    expect(s.version).toBe(3)
    expect(TOTAL_PICKS).toBe(14)
    const order: Seat[] = []
    while (s.phase === 'draft') {
      const seat = whoseDraftTurn(s) as Seat
      order.push(seat)
      expect(applyEvent(s, { type: 'draftPick', seat: otherSeat(seat), cardId: s.draft.available[0] })).toBe(s)
      s = applyEvent(s, { type: 'draftPick', seat, cardId: s.draft.available[0] })
    }
    expect(order).toHaveLength(14)
    order.forEach((seat, i) => expect(seat).toBe(i % 2 === 0 ? s.firstDrafter : otherSeat(s.firstDrafter)))
    expect(s.draft.picks[0]).toHaveLength(7)
    expect(s.draft.picks[1]).toHaveLength(7)
    expect(s.draft.available).toHaveLength(4)
    expect(s.phase).toBe('lineup')
  })

  it('rejects unknown, taken and out-of-phase picks', () => {
    const s = createMatch('d2')
    const seat = whoseDraftTurn(s) as Seat
    expect(validateEvent(s, { type: 'draftPick', seat, cardId: 'nobody' })).toMatch(/unknown/)
    const s2 = applyEvent(s, { type: 'draftPick', seat, cardId: 'curry' })
    expect(validateEvent(s2, { type: 'draftPick', seat: otherSeat(seat), cardId: 'curry' })).toMatch(/already/)
    expect(validateEvent(s, { type: 'lineupReveal', lineups: [[], []] })).toMatch(/lineup phase/)
  })

  it('lineup is five own cards; the other two are the bench; hands are dealt from the shared deck', () => {
    const d = draftTeams('l1', TEAM_A, TEAM_B)
    const a = d.firstDrafter
    const lineups: [string[], string[]] = [[], []]
    lineups[a] = TEAM_A.slice(0, 5)
    lineups[otherSeat(a)] = TEAM_B.slice(0, 5)
    const bad: [string[], string[]] = [[...lineups[0]], [...lineups[1]]]
    bad[a] = ['curry', 'curry', 'kawhi', 'giannis', 'embiid']
    expect(applyEvent(d, { type: 'lineupReveal', lineups: bad })).toBe(d)
    bad[a] = ['curry', 'ant', 'kawhi', 'giannis', 'luka']
    expect(applyEvent(d, { type: 'lineupReveal', lineups: bad })).toBe(d)
    bad[a] = TEAM_A
    expect(applyEvent(d, { type: 'lineupReveal', lineups: bad })).toBe(d)

    const s = applyEvent(d, { type: 'lineupReveal', lineups })
    expect(s.phase).toBe('play')
    expect(s.quarter).toBe(1)
    expect(s.possessionsInQuarter).toBe(POSSESSIONS_PER_QUARTER)
    expect(benchOf(s, a)).toEqual(['klay', 'reid'])
    expect(benchOf(s, otherSeat(a))).toEqual(['holiday', 'gobert'])
    expect(s.hands[0]).toHaveLength(STARTING_HAND)
    expect(s.hands[1]).toHaveLength(STARTING_HAND)
    expect(s.deck).toHaveLength(DECK_SIZE - 2 * STARTING_HAND)
    expect([...s.deck, ...s.hands[0], ...s.hands[1]].sort()).toEqual([...d.deck].sort())
    expect(matchupOf(s, 'curry')).toBe('luka')
    expect(currentOffenseSeat(s)).toBe(otherSeat(s.firstDrafter))
    expect(legalDoubles(s, a)).toEqual(TEAM_A)
  })
})

describe('match flow', () => {
  it('plays 4 quarters of 10 possessions with a break after each, then ends or goes to overtime pairs', () => {
    for (const seed of ['flow-a', 'flow-b', 'flow-c', 'flow-d']) {
      const { state: s } = botGame(seed)
      expect(s.history.length).toBeGreaterThanOrEqual(40)
      expect((s.history.length - 40) % 2).toBe(0)
      for (let q = 1; q <= 4; q++) {
        const inQ = s.history.filter((r) => r.quarter === q)
        expect(inQ).toHaveLength(10)
        expect(inQ.filter((r) => r.offenseSeat === 0)).toHaveLength(5)
        expect(inQ[0].offenseSeat).toBe(firstOffenseSeatOfQuarter(s, q))
        inQ.forEach((r, i) => {
          expect(r.index).toBe(i)
          expect(r.offenseSeat).toBe(i % 2 === 0 ? inQ[0].offenseSeat : otherSeat(inQ[0].offenseSeat))
        })
      }
      expect(s.winner).not.toBeNull()
      expect(s.score[s.winner as Seat]).toBeGreaterThan(s.score[otherSeat(s.winner as Seat)])
      const total = s.history.reduce((n, r) => n + r.points, 0)
      expect(total).toBe(s.score[0] + s.score[1])
      s.history.forEach((r, i) => expect(r.seq).toBe(i))
      // nobody ever took more than two shots in a quarter (putbacks are free)
      for (let q = 1; q <= 4; q++) {
        const count = new Map<string, number>()
        for (const r of s.history.filter((x) => x.quarter === q)) {
          for (const c of r.contests) if (c.kind !== 'putback') count.set(c.shooter, (count.get(c.shooter) ?? 0) + 1)
        }
        for (const n of count.values()) expect(n).toBeLessThanOrEqual(MAX_SHOTS_PER_QUARTER)
      }
      // every card that left a hand is in the discard pile; nothing was invented
      expect(s.deck.length + s.hands[0].length + s.hands[1].length + s.discard.length).toBe(DECK_SIZE)
      expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    }
  })

  it('is deterministic: the same seed and events replay to the same state', () => {
    const { state, events } = botGame('replay-1')
    expect(replay('replay-1', events)).toEqual(state)
    expect(botGame('replay-1').state).toEqual(state)
    // a different dice seed on one possession changes that possession only from there on
    const i = events.findIndex((e) => e.type === 'possessionResolve')
    const altered = events.map((e, j) => (j === i && e.type === 'possessionResolve' ? { ...e, seed: 'other' } : e))
    const alt = replay('replay-1', altered.slice(0, i + 1))
    const same = replay('replay-1', events.slice(0, i + 1))
    expect(alt.history[0].picks).toEqual(same.history[0].picks)
    expect(JSON.stringify(alt.history[0].steps)).not.toBe(JSON.stringify(same.history[0].steps))
  })

  it('never mutates the state it is given, and illegal events return the same reference', () => {
    const { s } = build()
    const frozen = JSON.stringify(s)
    const next = play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [8, 1])
    expect(JSON.stringify(s)).toBe(frozen)
    expect(next).not.toBe(s)
    expect(resolvePossessionWithDice(s, { shooterId: 'nobody', shot: 'THREE' }, { doubleId: null }, [])).toBe(s)
    const r = tryApplyEvent(s, { type: 'possessionResolve', offensePick: { shooterId: 'murray', shot: 'THREE' }, defensePick: { doubleId: null }, seed: 'x' })
    expect(r.ok).toBe(false)
  })

  it('quarter break: both set five, hands draw 2 up to the limit of 6, usage and subs reset', () => {
    let { s } = build()
    for (let i = 0; i < 10; i++) s = dud(s)
    expect(s.phase).toBe('break')
    expect(s.quarter).toBe(1)
    expect(currentOffenseSeat(s)).toBeNull()
    expect(validateEvent(s, { type: 'quarterBreak', lineups: [['a'], ['b']] })).toMatch(/five/)
    const before = s.deck.length
    const lineups: [string[], string[]] = [[...s.lineups![0]], [...s.lineups![1]]]
    const seat = s.draft.picks[0].includes('strus') ? 0 : 1
    lineups[seat] = swap(lineups[seat], 1, 'strus')
    s = applyEvent(s, { type: 'quarterBreak', lineups })
    expect(s.phase).toBe('play')
    expect(s.quarter).toBe(2)
    expect(s.possession).toBe(0)
    expect(s.lineups![seat]).toContain('strus')
    expect(benchOf(s, seat as Seat)).toContain('kcp')
    expect(s.hands[0]).toHaveLength(6)
    expect(s.hands[1]).toHaveLength(6)
    expect(s.deck).toHaveLength(before - 4)
    expect(s.shots).toEqual([{}, {}])
    expect(currentOffenseSeat(s)).toBe(s.firstDrafter)
    for (let i = 0; i < 10; i++) s = dud(s)
    s = sameFive(s)
    expect(s.hands[0]).toHaveLength(HAND_LIMIT) // already full: draws nothing
    expect(s.deck).toHaveLength(before - 4)
  })

  it('a tie after four quarters goes to a break, then overtime pairs until someone leads', () => {
    let { s, off } = build()
    for (let q = 1; q <= 4; q++) {
      for (let i = 0; i < 10; i++) s = dud(s)
      if (q < 4) s = sameFive(s)
    }
    expect(s.score).toEqual([0, 0])
    expect(s.phase).toBe('break')
    const deck = s.deck.length
    s = sameFive(s)
    expect(s.overtime).toBe(true)
    expect(s.quarter).toBe(5)
    expect(s.possessionsInQuarter).toBe(2)
    expect(s.deck).toHaveLength(deck) // no draw before overtime
    s = dud(dud(s))
    expect(s.phase).toBe('play') // still tied: next pair starts right away
    expect(s.quarter).toBe(6)
    expect(s.shots).toEqual([{}, {}])
    const shooter = currentOffenseSeat(s) === off ? 'mccollum' : 'murray'
    s = play(s, { shooterId: shooter, shot: 'THREE' }, {}, [8, 1])
    expect(s.phase).toBe('play') // the other side still gets its possession
    s = dud(s)
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(shooter === 'mccollum' ? off : otherSeat(off))
    expect(last(s).overtime).toBe(true)
  })
})

describe('possession: dice against dice', () => {
  it('shot die must beat the DEF die; ties go to the defence; a drive is 2', () => {
    const { s, off } = build()
    let n = play(s, { shooterId: 'mccollum', shot: 'DRIVE' }, {}, [3, 3, 1, 1])
    let c = shotOf(n)
    expect(c.dice.map((d) => [d.who, d.die, d.face, d.purpose])).toEqual([['mccollum', 8, 3, 'shot'], ['murray', 4, 3, 'defense']])
    expect(c.mods).toEqual([])
    expect([c.offenseTotal, c.defenseTotal, c.outcome, c.points]).toEqual([3, 3, 'missed', 0])
    expect(n.score[off]).toBe(0)

    n = play(s, { shooterId: 'mccollum', shot: 'DRIVE' }, {}, [4, 3])
    c = shotOf(n)
    expect([c.outcome, c.points]).toEqual(['made', 2])
    expect(n.score[off]).toBe(2)
    expect(last(n).scored).toBe(true)
    expect(last(n).rebounds).toEqual([])
  })

  it('a three is worth 3, and the defence adds +2 against it (long range)', () => {
    const { s, off } = build()
    let n = play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [5, 3, 1, 1])
    let c = shotOf(n)
    expect(c.mods).toEqual([{ side: 'def', label: 'Long range', value: 2, source: 'rule' }])
    expect([c.offenseTotal, c.defenseTotal, c.outcome]).toEqual([5, 5, 'missed'])
    n = play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [6, 3])
    c = shotOf(n)
    expect([c.offenseTotal, c.defenseTotal, c.outcome, c.points]).toEqual([6, 5, 'made', 3])
    expect(n.score[off]).toBe(3)
  })

  it('doubling the shooter adds a help d6; doubling anyone else gives the shooter an open look (+2)', () => {
    const { s } = build()
    let n = play(s, { shooterId: 'mccollum', shot: 'DRIVE' }, { doubleId: 'mccollum' }, [6, 2, 4, 1, 1])
    let c = shotOf(n)
    expect(c.doubled).toBe(true)
    expect(c.dice.map((d) => [d.purpose, d.die, d.face])).toEqual([['shot', 8, 6], ['defense', 4, 2], ['help', 6, 4]])
    expect([c.offenseTotal, c.defenseTotal, c.outcome]).toEqual([6, 6, 'missed'])

    n = play(s, { shooterId: 'mccollum', shot: 'DRIVE' }, { doubleId: 'kcp' }, [3, 4])
    c = shotOf(n)
    expect(c.doubled).toBe(false)
    expect(c.open).toBe(true)
    expect(mod(c, 'Open look')).toBe(2)
    expect(c.dice).toHaveLength(2)
    expect([c.offenseTotal, c.defenseTotal, c.outcome]).toEqual([5, 4, 'made'])

    // straight up: no help die, no bonus
    n = play(s, { shooterId: 'mccollum', shot: 'DRIVE' }, { doubleId: null }, [3, 4, 1, 1])
    c = shotOf(n)
    expect([c.open, c.doubled, c.outcome]).toEqual([false, false, 'missed'])
  })

  it('the defence winning by 5 or more is a block on a drive and a steal on a three; no rebound', () => {
    const { s, def } = build()
    let n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [1, 6])
    expect(shotOf(n).outcome).toBe('blocked')
    expect(last(n).rebounds).toEqual([])
    expect(last(n).credits).toEqual([{ cardId: 'gordon', seat: def, stat: 'BLK', value: 1 }])

    n = play(s, { shooterId: 'dfs', shot: 'THREE' }, {}, [1, 6])
    expect(shotOf(n).outcome).toBe('stolen')
    expect(last(n).credits.map((k) => [k.cardId, k.stat])).toEqual([['middleton', 'STL'], ['dfs', 'TOV']])

    n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [1, 5, 1, 1])
    expect(shotOf(n).outcome).toBe('missed')
  })

  it('a pass rolls the PASS die: 5+ is a dime (+2 and the assist), a 1 is stolen', () => {
    const { s, off, def } = build()
    const pick = { shooterId: 'kcp', shot: 'THREE' as const, passerId: 'mccollum' }
    let n = play(s, pick, {}, [5, 6, 5])
    let r = last(n)
    expect(r.pass).toMatchObject({ passer: 'mccollum', defender: 'murray', receiver: 'kcp', stealAt: 1, dimeAt: 5, dime: true, stolen: false, bonus: 2 })
    expect(r.pass?.roll).toMatchObject({ who: 'mccollum', die: 8, face: 5, purpose: 'pass' })
    expect(mod(r.contests[0], 'Dime')).toBe(2)
    expect(r.contests[0].outcome).toBe('made')
    expect(r.credits).toEqual([
      { cardId: 'kcp', seat: off, stat: 'PTS', value: 3 },
      { cardId: 'mccollum', seat: off, stat: 'AST', value: 1 },
    ])

    n = play(s, pick, {}, [1])
    r = last(n)
    expect(r.pass?.stolen).toBe(true)
    expect(r.contests).toEqual([])
    expect(r.credits).toEqual([
      { cardId: 'murray', seat: def, stat: 'STL', value: 1 },
      { cardId: 'mccollum', seat: off, stat: 'TOV', value: 1 },
    ])
    expect(n.shots[off]).toEqual({}) // no shot was taken
    expect(n.score).toEqual([0, 0])

    // the pass gets there without a dime: the shot can still go in, but there is no assist
    n = play(s, pick, {}, [3, 6, 3])
    r = last(n)
    expect(r.pass?.dime).toBe(false)
    expect(r.contests[0].outcome).toBe('made')
    expect(r.credits.some((k) => k.stat === 'AST')).toBe(false)

    expect(validateOffensePick(s, off, { shooterId: 'kcp', shot: 'THREE', passerId: 'kcp' })).toMatch(/himself/)
    expect(validateOffensePick(s, off, { shooterId: 'kcp', shot: 'THREE', passerId: 'strus' })).toMatch(/passer/)
  })

  it('every miss is a board battle: best REB dice, defence +2, ties to the defence; an offensive board is one putback', () => {
    const { s, off, def } = build()
    const miss = { shooterId: 'mccollum', shot: 'THREE' as const }
    let n = play(s, miss, {}, [1, 1, 6, 4])
    let r = last(n)
    expect(r.rebounds).toHaveLength(1)
    expect(r.rebounds[0]).toMatchObject({ contested: true, offRebounder: 'looney', defRebounder: 'allen', offenseTotal: 6, defenseTotal: 6, winner: 'def', rebounder: 'allen' })
    expect(r.rebounds[0].dice.map((d) => [d.who, d.die, d.face])).toEqual([['looney', 10, 6], ['allen', 12, 4]])
    expect(r.credits).toEqual([{ cardId: 'allen', seat: def, stat: 'REB', value: 1 }])

    // offensive rebound and a made putback (a drive against his own defender, worth 2)
    n = play(s, miss, {}, [1, 1, 6, 3, 4, 2])
    r = last(n)
    expect(r.rebounds[0].winner).toBe('off')
    expect(r.contests.map((c) => c.kind)).toEqual(['shot', 'putback'])
    expect(r.contests[1]).toMatchObject({ shooter: 'looney', defender: 'allen', shot: 'DRIVE', outcome: 'made', points: 2 })
    expect(r.points).toBe(2)
    expect(r.credits.map((k) => [k.cardId, k.stat, k.value])).toEqual([['looney', 'REB', 1], ['looney', 'OREB', 1], ['looney', 'PTS', 2]])
    expect(n.shots[off]).toEqual({ mccollum: 1 }) // the putback is free

    // missed putback: the defence collects it, no second board battle
    n = play(s, miss, {}, [1, 1, 6, 3, 1, 2, 12, 1])
    r = last(n)
    expect(r.rebounds).toHaveLength(2)
    expect(r.rebounds[1]).toMatchObject({ contested: false, winner: 'def', rebounder: 'allen', dice: [] })
    expect(r.points).toBe(0)

    // blocked putback: a block, and nobody is credited with a rebound for it
    n = play(s, miss, {}, [1, 1, 6, 3, 1, 10])
    r = last(n)
    expect(r.contests[1].outcome).toBe('blocked')
    expect(r.rebounds).toHaveLength(1)
    expect(r.credits.map((k) => [k.cardId, k.stat])).toEqual([['looney', 'REB'], ['looney', 'OREB'], ['allen', 'BLK']])
  })

  it('a player in a seat not printed on his card gets -1 on his shot and on his defence', () => {
    const { s } = build(['looney', 'kcp', 'dfs', 'portis', 'mccollum', 'strus', 'lopez'], ['allen', 'hart', 'middleton', 'gordon', 'murray', 'kuzma', 'sengun'])
    const n = play(s, { shooterId: 'looney', shot: 'DRIVE' }, {}, [3, 2, 1, 1])
    const c = shotOf(n)
    expect(c.mods.map((m) => [m.side, m.label, m.value])).toEqual([['off', 'Out of position at PG', -1], ['def', 'Out of position at PG', -1]])
    expect([c.offenseTotal, c.defenseTotal]).toEqual([2, 1])
  })

  it('the reveal script names every die in order and says what is rolled against what', () => {
    const { s } = build()
    const n = play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'mccollum' }, { doubleId: 'kcp' }, [6, 4, 3, 1, 4, 9])
    const r = last(n)
    expect(r.steps.map((x) => x.kind)).toEqual(['pass', 'double', 'shot', 'rebound', 'result'])
    const rolled = r.steps.flatMap((x) => x.rolls)
    expect(rolled.map((d) => d.label)).toEqual(['PASS d8', '3PT d6', 'DEF d6', 'Help d6', 'REB d10', 'REB d12'])
    expect(rolled.map((d) => d.face)).toEqual([6, 4, 3, 1, 4, 9])
    expect(r.steps[2].text).toBe("Three. Kentavious Caldwell-Pope rolls his 3PT d6 against Josh Hart's DEF d6 plus a help d6. 6 against 6. No good.")
    for (const step of r.steps) expect(step.text).not.toMatch(/—|%|\d\.\d/)
    expect(r.floor[r.offenseSeat]).toEqual(F_OFF.slice(0, 5))
  })
})

describe('usage rule and substitutions', () => {
  it('nobody takes more than two shots in a quarter', () => {
    let { s, off } = build()
    s = play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [8, 1])
    s = dud(s)
    expect(shotsLeft(s, off, 'mccollum')).toBe(1)
    s = play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [8, 1])
    s = dud(s)
    expect(shotsLeft(s, off, 'mccollum')).toBe(0)
    expect(legalShooters(s, off)).toEqual(['kcp', 'dfs', 'portis', 'looney'])
    expect(validateOffensePick(s, off, { shooterId: 'mccollum', shot: 'THREE' })).toMatch(/no shots left/)
    // he can still pass
    expect(validateOffensePick(s, off, { shooterId: 'kcp', shot: 'THREE', passerId: 'mccollum' })).toBeNull()
  })

  it('one mid-quarter sub per coach per quarter, called with the secret pick; the new player takes the same seat', () => {
    let { s, off, def } = build()
    expect(subsLeft(s, off)).toBe(1)
    expect(validateOffensePick(s, off, { shooterId: 'kcp', shot: 'THREE', sub: { out: 'strus', in: 'kcp' } })).toMatch(/not on the floor/)
    expect(validateOffensePick(s, off, { shooterId: 'kcp', shot: 'THREE', sub: { out: 'kcp', in: 'murray' } })).toMatch(/not on the bench/)
    expect(validateOffensePick(s, off, { shooterId: 'kcp', shot: 'THREE', sub: { out: 'kcp', in: 'strus' } })).toMatch(/shooter is not on the floor/)

    s = play(s, { shooterId: 'strus', shot: 'THREE', sub: { out: 'kcp', in: 'strus' } }, { sub: { out: 'hart', in: 'kuzma' } }, [8, 1])
    const r = last(s)
    expect(r.subs).toEqual([
      { seat: off, out: 'kcp', in: 'strus', slot: 1 },
      { seat: def, out: 'hart', in: 'kuzma', slot: 1 },
    ])
    expect(r.steps.slice(0, 2).map((x) => x.kind)).toEqual(['sub', 'sub'])
    expect(r.contests[0]).toMatchObject({ shooter: 'strus', defender: 'kuzma', slot: 1 })
    expect(s.lineups![off]).toEqual(['mccollum', 'strus', 'dfs', 'portis', 'looney'])
    expect(benchOf(s, off)).toEqual(['kcp', 'lopez'])
    expect(benchOf(s, def)).toEqual(['hart', 'sengun'])
    expect(s.subsUsed).toEqual([1, 1])
    expect(subsLeft(s, off)).toBe(0)
    s = dud(s)
    expect(validateOffensePick(s, off, { shooterId: 'mccollum', shot: 'THREE', sub: { out: 'strus', in: 'kcp' } })).toMatch(/no substitutions left/)
  })

  it('the defence may double a bench player; a double on someone who is not the shooter is a wrong read', () => {
    const { s, def } = build()
    expect(validateDefensePick(s, def, { doubleId: 'strus' })).toBeNull()
    expect(validateDefensePick(s, def, { doubleId: 'murray' })).toMatch(/other roster/)
    // the doubled player is subbed out on the same play: the shooter is open
    let n = play(s, { shooterId: 'mccollum', shot: 'THREE', sub: { out: 'kcp', in: 'strus' } }, { doubleId: 'kcp' }, [8, 1])
    expect(shotOf(n).open).toBe(true)
    // the double read the substitution: help die on the man coming in
    n = play(s, { shooterId: 'strus', shot: 'THREE', sub: { out: 'kcp', in: 'strus' } }, { doubleId: 'strus' }, [8, 1, 1])
    expect(shotOf(n).doubled).toBe(true)
  })
})

describe('chemistry: three plain team rules', () => {
  it('links switch on from the five on the floor', () => {
    const a = teamChem(TEAM_A.slice(0, 5))
    expect(a.links.map((l) => l.id)).toEqual(['drivekick', 'pickroll', 'lockdown'])
    const b = teamChem(F_OFF.slice(0, 5))
    expect(b.links).toEqual([])
    expect(hasLink(teamChem(['murray', null, null, null, 'allen']), 'pickroll')).toBe(true)
    expect(hasLink(teamChem(['jokic']), 'pickroll')).toBe(false) // needs two different players
  })

  it('Drive & Kick is +1 to drives, Lockdown is +1 to defence against drives, Pick & Roll makes dimes one face earlier', () => {
    // F_DEF on offence has a Slasher (gordon) and a Sniper (middleton), and a Playmaker (murray) with a centre (allen)
    const { s, off } = build(F_DEF, swap(swap(F_OFF, 2, 'bridges'), 4, 'porzingis'))
    let plan = previewShot(s, off, { shooterId: 'gordon', shot: 'DRIVE' })!
    expect(plan.mods.map((m) => [m.side, m.label, m.value, m.source])).toEqual([['off', 'Drive & Kick', 1, 'chem'], ['def', 'Lockdown', 1, 'chem']])
    plan = previewShot(s, off, { shooterId: 'middleton', shot: 'THREE' })!
    expect(plan.mods.map((m) => m.label)).toEqual(['Long range'])
    expect(previewPass(s, off, 'murray')).toEqual({ die: 8, stealAt: 1, dimeAt: 4, bonus: 2 })
    const n = play(s, { shooterId: 'gordon', shot: 'DRIVE', passerId: 'murray' }, {}, [4, 8, 1])
    expect(last(n).pass?.dime).toBe(true)
  })
})

describe('odds and box score', () => {
  it('shotOdds counts every face combination exactly', () => {
    const { s, off } = build()
    const plain = shotOdds(previewShot(s, off, { shooterId: 'mccollum', shot: 'THREE' })!)
    expect(plain.make).toBeCloseTo(14 / 32, 10) // d8 must beat d4 + 2
    expect(plain.stuffed).toBeCloseTo(1 / 32, 10) // a 1 against a 4
    const doubled = shotOdds(previewShot(s, off, { shooterId: 'mccollum', shot: 'THREE' }, { doubleId: 'mccollum' })!)
    expect(doubled.make).toBeLessThan(plain.make)
    const open = shotOdds(previewShot(s, off, { shooterId: 'mccollum', shot: 'THREE' }, { doubleId: 'kcp' })!)
    expect(open.make).toBeGreaterThan(plain.make)
    const drive = shotOdds(previewShot(s, off, { shooterId: 'portis', shot: 'DRIVE' })!)
    expect(drive.make).toBeCloseTo(15 / 48, 10) // d6 against d8
    expect(drive.stuffed).toBeCloseTo(6 / 48, 10) // 1v6 1v7 1v8 2v7 2v8 3v8
  })

  it('box score is built only from recorded events', () => {
    let { s } = build()
    s = play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'mccollum' }, {}, [5, 6, 5]) // dime, made three
    s = dud(s)
    s = play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [1, 1, 6, 3, 4, 2]) // miss, off board, putback
    s = dud(s)
    s = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [1, 6]) // blocked
    const box = boxScore(s)
    expect(box.kcp).toMatchObject({ pts: 3, fgm: 1, fga: 1, tpm: 1, tpa: 1 })
    expect(box.mccollum).toMatchObject({ pts: 0, ast: 1, fga: 1, tpa: 1, possessions: 5 })
    expect(box.looney).toMatchObject({ pts: 2, reb: 3, oreb: 1, fgm: 1, fga: 1 }) // plus two defensive boards on the duds
    expect(box.gordon.blk).toBe(1)
    expect(box.strus.possessions).toBe(0)
    expect(Object.keys(box)).toHaveLength(14)
    const pts = Object.values(box).reduce((n, l) => n + l.pts, 0)
    expect(pts).toBe(s.score[0] + s.score[1])
    expect(Object.values(box).some((l) => l.doubleDouble || l.tripleDouble)).toBe(false)
  })

  it('bots only ever return legal picks', () => {
    const s = playState('legal')
    const rand = mulberry32(7)
    let cur = s
    for (let i = 0; i < 10; i++) {
      const off = currentOffenseSeat(cur) as Seat
      const o = botOffensePick(cur, off, rand)
      const d = botDefensePick(cur, otherSeat(off), rand)
      expect(validateOffensePick(cur, off, o)).toBeNull()
      expect(validateDefensePick(cur, otherSeat(off), d)).toBeNull()
      cur = applyEvent(cur, { type: 'possessionResolve', offensePick: o, defensePick: d, seed: `s${i}` })
    }
    expect(cur.phase).toBe('break')
  })
})
