import { describe, expect, it } from 'vitest'
import { DECK_SIZE, PLAY_CARDS, fullDeck, shuffledDeck, validateDefensePick, validateOffensePick } from '../src/game'
import { build, dud, give, last, mod, play, shotOf } from './helpers'

describe('the shared deck', () => {
  it('is 40 cards, 13 different, shuffled from the seed', () => {
    expect(DECK_SIZE).toBe(40)
    expect(PLAY_CARDS).toHaveLength(13)
    expect(fullDeck()).toHaveLength(40)
    const a = shuffledDeck('deck-1')
    expect(a).toEqual(shuffledDeck('deck-1'))
    expect(a).not.toEqual(shuffledDeck('deck-2'))
    expect([...a].sort()).toEqual(fullDeck().sort())
    expect(PLAY_CARDS.filter((c) => c.side === 'offense').reduce((n, c) => n + c.count, 0)).toBe(18)
    expect(PLAY_CARDS.filter((c) => c.side === 'defense').reduce((n, c) => n + c.count, 0)).toBe(16)
    for (const c of PLAY_CARDS) expect(c.text).not.toMatch(/—|%|\d\.\d/)
  })

  it('one card per side per possession, from your own hand, on the right side of the ball', () => {
    const r = build()
    const s = give(give(r.s, r.off, ['wallup', 'crash']), r.def, ['screen', 'crash'])
    expect(validateOffensePick(s, r.off, { shooterId: 'portis', shot: 'DRIVE', cardId: 'wallup' })).toMatch(/defence card/)
    expect(validateDefensePick(s, r.def, { doubleId: null, cardId: 'screen' })).toMatch(/offence card/)
    expect(validateOffensePick(s, r.off, { shooterId: 'portis', shot: 'DRIVE', cardId: 'pickroll' })).toMatch(/not in hand/)
    expect(validateOffensePick(s, r.off, { shooterId: 'portis', shot: 'DRIVE', cardId: 'crash' })).toBeNull()
    expect(validateDefensePick(s, r.def, { doubleId: null, cardId: 'crash' })).toBeNull()
    const n = play(s, { shooterId: 'portis', shot: 'DRIVE', cardId: 'crash' }, { cardId: 'crash' }, [6, 1])
    expect(n.hands[r.off]).toEqual(['wallup'])
    expect(n.hands[r.def]).toEqual(['screen'])
    expect(n.discard).toEqual(['crash', 'crash'])
    expect(last(n).steps.slice(0, 2).map((x) => [x.kind, x.card, x.seat])).toEqual([['card', 'crash', r.off], ['card', 'crash', r.def]])
  })

  it('Pick & Roll: drive only, add a d4', () => {
    const r = build()
    const s = give(r.s, r.off, ['pickroll'])
    expect(validateOffensePick(s, r.off, { shooterId: 'portis', shot: 'THREE', cardId: 'pickroll' })).toMatch(/drive/)
    const c = shotOf(play(s, { shooterId: 'portis', shot: 'DRIVE', cardId: 'pickroll' }, {}, [3, 4, 6]))
    expect(c.dice.map((d) => [d.label, d.face, d.who])).toEqual([['DRIVE d6', 3, 'portis'], ['Pick & Roll d4', 4, null], ['DEF d8', 6, 'gordon']])
    expect([c.offenseTotal, c.defenseTotal, c.outcome]).toEqual([7, 6, 'made'])
  })

  it('Off-Ball Screen: three only, +2', () => {
    const r = build()
    const s = give(r.s, r.off, ['screen'])
    expect(validateOffensePick(s, r.off, { shooterId: 'dfs', shot: 'DRIVE', cardId: 'screen' })).toMatch(/three/)
    const c = shotOf(play(s, { shooterId: 'dfs', shot: 'THREE', cardId: 'screen' }, {}, [5, 4]))
    expect(c.mods).toEqual([
      { side: 'off', label: 'Off-Ball Screen', value: 2, source: 'card' },
      { side: 'def', label: 'Long range', value: 2, source: 'rule' },
    ])
    expect(c.outcome).toBe('made')
  })

  it('Kick Out: a doubled shooter finds the best 3PT die for an open three and gets the assist', () => {
    const r = build()
    const s = give(r.s, r.off, ['kickout'])
    let n = play(s, { shooterId: 'portis', shot: 'DRIVE', cardId: 'kickout' }, { doubleId: 'portis' }, [5, 4])
    let res = last(n)
    expect(res.swing).toEqual({ kind: 'kickout', from: 'portis', to: 'mccollum' })
    expect(res.contests[0]).toMatchObject({ shooter: 'mccollum', shot: 'THREE', defender: 'murray', open: true, doubled: false, outcome: 'made' })
    expect(res.contests[0].dice).toHaveLength(2)
    expect(mod(res.contests[0], 'Open look')).toBe(2)
    expect(res.credits.map((k) => [k.cardId, k.stat, k.value])).toEqual([['mccollum', 'PTS', 3], ['portis', 'AST', 1]])
    expect(res.cards.offense).toEqual({ id: 'kickout', seat: r.off, status: 'played' })
    expect(n.shots[r.off]).toEqual({ mccollum: 1 })
    // no double on the shooter: the card does nothing
    n = play(s, { shooterId: 'portis', shot: 'DRIVE', cardId: 'kickout' }, { doubleId: null }, [6, 1])
    res = last(n)
    expect(res.swing).toBeNull()
    expect(res.cards.offense?.status).toBe('noEffect')
    expect(n.hands[r.off]).toEqual([])
  })

  it('Fast Break: the double team does nothing either way, +1', () => {
    const r = build()
    const s = give(r.s, r.off, ['fastbreak'])
    let c = shotOf(play(s, { shooterId: 'mccollum', shot: 'DRIVE', cardId: 'fastbreak' }, { doubleId: 'mccollum' }, [3, 3]))
    expect(c.dice).toHaveLength(2)
    expect(c.doubled).toBe(false)
    expect(c.mods).toEqual([{ side: 'off', label: 'Fast Break', value: 1, source: 'card' }])
    expect(c.outcome).toBe('made')
    c = shotOf(play(s, { shooterId: 'mccollum', shot: 'DRIVE', cardId: 'fastbreak' }, { doubleId: 'kcp' }, [3, 3]))
    expect(c.open).toBe(false)
    expect(mod(c, 'Open look')).toBe(0)
  })

  it('Alley-Oop: a pass into a drive; on a dime it is automatically in', () => {
    const r = build()
    const s = give(r.s, r.off, ['alleyoop'])
    expect(validateOffensePick(s, r.off, { shooterId: 'portis', shot: 'DRIVE', cardId: 'alleyoop' })).toMatch(/pass into a drive/)
    expect(validateOffensePick(s, r.off, { shooterId: 'portis', shot: 'THREE', passerId: 'mccollum', cardId: 'alleyoop' })).toMatch(/pass into a drive/)
    let res = last(play(s, { shooterId: 'portis', shot: 'DRIVE', passerId: 'mccollum', cardId: 'alleyoop' }, {}, [5, 1, 8]))
    expect(res.contests[0].auto).toEqual({ result: 'make', label: 'Alley-Oop' })
    expect(res.points).toBe(2)
    expect(res.credits.map((k) => [k.cardId, k.stat])).toEqual([['portis', 'PTS'], ['mccollum', 'AST']])
    res = last(play(s, { shooterId: 'portis', shot: 'DRIVE', passerId: 'mccollum', cardId: 'alleyoop' }, {}, [3, 1, 8]))
    expect(res.cards.offense?.status).toBe('noEffect')
    expect(res.contests[0].outcome).toBe('blocked')
  })

  it('Heat Check: +3 for a shooter who scored on your last possession', () => {
    const r = build()
    let s = give(r.s, r.off, ['heatcheck'])
    expect(validateOffensePick(s, r.off, { shooterId: 'mccollum', shot: 'THREE', cardId: 'heatcheck' })).toMatch(/scored on your last possession/)
    s = dud(play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [8, 1]))
    expect(validateOffensePick(s, r.off, { shooterId: 'kcp', shot: 'THREE', cardId: 'heatcheck' })).toMatch(/scored/)
    const c = shotOf(play(s, { shooterId: 'mccollum', shot: 'THREE', cardId: 'heatcheck' }, {}, [3, 3]))
    expect(mod(c, 'Heat Check')).toBe(3)
    expect(c.outcome).toBe('made')
  })

  it('Wall Up: against a drive the defence adds a d4; wasted against a three', () => {
    const r = build()
    const s = give(r.s, r.def, ['wallup'])
    let n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, { cardId: 'wallup' }, [6, 4, 3, 1, 12])
    let c = shotOf(n)
    expect(c.dice.map((d) => [d.label, d.face])).toEqual([['DRIVE d6', 6], ['DEF d8', 4], ['Wall Up d4', 3]])
    expect([c.offenseTotal, c.defenseTotal, c.outcome]).toEqual([6, 7, 'missed'])
    expect(last(n).cards.defense?.status).toBe('played')
    n = play(s, { shooterId: 'dfs', shot: 'THREE' }, { cardId: 'wallup' }, [6, 4])
    c = shotOf(n)
    expect(c.dice).toHaveLength(2)
    expect(last(n).cards.defense?.status).toBe('noEffect')
    expect(n.hands[r.def]).toEqual([])
  })

  it('Closeout: +2 against a three; wasted against a drive', () => {
    const r = build()
    const s = give(r.s, r.def, ['closeout'])
    let n = play(s, { shooterId: 'dfs', shot: 'THREE' }, { cardId: 'closeout' }, [5, 3, 1, 12])
    expect(shotOf(n).mods).toEqual([
      { side: 'def', label: 'Long range', value: 2, source: 'rule' },
      { side: 'def', label: 'Closeout', value: 2, source: 'card' },
    ])
    expect(shotOf(n).outcome).toBe('missed')
    n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, { cardId: 'closeout' }, [5, 3])
    expect(shotOf(n).mods).toEqual([])
    expect(last(n).cards.defense?.status).toBe('noEffect')
  })

  it('Zone: a wrong double gives no open look', () => {
    const r = build()
    const s = give(r.s, r.def, ['zone'])
    let n = play(s, { shooterId: 'mccollum', shot: 'THREE' }, { doubleId: 'kcp', cardId: 'zone' }, [3, 3, 1, 12])
    expect(shotOf(n)).toMatchObject({ open: false, doubled: false, outcome: 'missed' })
    expect(last(n).cards.defense?.status).toBe('played')
    n = play(s, { shooterId: 'mccollum', shot: 'THREE' }, { doubleId: 'mccollum', cardId: 'zone' }, [3, 3, 1, 1, 12])
    expect(shotOf(n).doubled).toBe(true)
    expect(last(n).cards.defense?.status).toBe('noEffect')
  })

  it('Pick Pocket: a pass is stolen on 1, 2 or 3', () => {
    const r = build()
    const s = give(r.s, r.def, ['pickpocket'])
    let res = last(play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'mccollum' }, { cardId: 'pickpocket' }, [3]))
    expect(res.pass).toMatchObject({ stolen: true, stealAt: 3 })
    expect(res.credits.map((k) => [k.cardId, k.stat])).toEqual([['murray', 'STL'], ['mccollum', 'TOV']])
    res = last(play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'mccollum' }, { cardId: 'pickpocket' }, [4, 6, 1]))
    expect(res.pass?.stolen).toBe(false)
    res = last(play(s, { shooterId: 'kcp', shot: 'THREE' }, { cardId: 'pickpocket' }, [6, 1]))
    expect(res.cards.defense?.status).toBe('noEffect')
  })

  it('Scouting Report: cancels the offence card; both are discarded', () => {
    const r = build()
    let s = give(give(r.s, r.off, ['screen']), r.def, ['scout'])
    let n = play(s, { shooterId: 'dfs', shot: 'THREE', cardId: 'screen' }, { cardId: 'scout' }, [3, 3, 1, 12])
    let res = last(n)
    expect(res.cards.offense?.status).toBe('cancelled')
    expect(res.cards.defense?.status).toBe('played')
    expect(mod(res.contests[0], 'Off-Ball Screen')).toBe(0)
    expect(res.contests[0].outcome).toBe('missed')
    expect(n.hands).toEqual([[], []])
    expect(n.discard).toEqual(['screen', 'scout'])
    expect(res.steps[0].text).toMatch(/Cancelled by Scouting Report/)
    // nothing to cancel
    res = last(play(s, { shooterId: 'dfs', shot: 'THREE' }, { cardId: 'scout' }, [3, 1]))
    expect(res.cards.defense?.status).toBe('noEffect')
    // a cancelled Timeout draws nothing
    s = give(give(r.s, r.off, ['timeout']), r.def, ['scout'])
    n = play(s, { shooterId: 'dfs', shot: 'THREE', cardId: 'timeout' }, { cardId: 'scout' }, [3, 1])
    expect(last(n).drawn).toEqual([[], []])
    expect(n.deck).toHaveLength(s.deck.length)
  })

  it('Crash the Glass: +3 to your rebound roll, either side', () => {
    const r = build()
    const miss = { shooterId: 'mccollum', shot: 'THREE' as const }
    let s = give(r.s, r.off, ['crash'])
    let res = last(play(s, { ...miss, cardId: 'crash' }, {}, [1, 1, 3, 4]))
    expect(res.rebounds[0]).toMatchObject({ offenseTotal: 6, defenseTotal: 6, winner: 'def' })
    res = last(play(s, { ...miss, cardId: 'crash' }, {}, [1, 1, 4, 4, 1, 1]))
    expect(res.rebounds[0]).toMatchObject({ offenseTotal: 7, defenseTotal: 6, winner: 'off' })
    res = last(play(s, { ...miss, cardId: 'crash' }, {}, [8, 1]))
    expect(res.cards.offense?.status).toBe('noEffect') // it went in
    s = give(r.s, r.def, ['crash'])
    res = last(play(s, miss, { cardId: 'crash' }, [1, 1, 6, 3]))
    expect(res.rebounds[0]).toMatchObject({ offenseTotal: 6, defenseTotal: 8, winner: 'def' })
  })

  it('Timeout: draw 2 from the top of the deck, never past 6 in hand', () => {
    const r = build()
    let s = give(r.s, r.off, ['timeout'])
    const top = s.deck.slice(0, 3)
    let n = play(s, { shooterId: 'mccollum', shot: 'THREE', cardId: 'timeout' }, {}, [8, 1])
    expect(n.hands[r.off]).toEqual(top.slice(0, 2))
    expect(last(n).drawn[r.off]).toEqual(top.slice(0, 2))
    expect(n.deck).toEqual(s.deck.slice(2))
    s = give(r.s, r.off, ['timeout', 'crash', 'crash', 'crash', 'crash', 'screen'])
    n = play(s, { shooterId: 'mccollum', shot: 'THREE', cardId: 'timeout' }, {}, [8, 1])
    expect(n.hands[r.off]).toHaveLength(6)
    expect(last(n).drawn[r.off]).toEqual([top[0]])
    // the defence can call one too
    s = give(r.s, r.def, ['timeout'])
    n = play(s, { shooterId: 'mccollum', shot: 'THREE' }, { cardId: 'timeout' }, [8, 1])
    expect(n.hands[r.def]).toEqual(top.slice(0, 2))
  })
})
