import { describe, expect, it } from 'vitest'
import { ABILITIES, abilityOf, previewPass, previewShot } from '../src/game'
import type { MatchState } from '../src/game'
import { F_DEF, F_OFF, build, dud, give, last, mod, play, shotOf, swap } from './helpers'

describe('abilities are dice text', () => {
  it('Splash (Curry): a natural 10-12 on his 3PT die is automatically in', () => {
    const { s } = build(swap(F_OFF, 0, 'curry'))
    let n = play(s, { shooterId: 'curry', shot: 'THREE' }, { doubleId: 'curry' }, [10, 4, 6])
    let c = shotOf(n)
    expect([c.offenseTotal, c.defenseTotal]).toEqual([10, 12]) // would be a stop on totals
    expect(c.auto).toEqual({ result: 'make', label: 'Splash' })
    expect([c.outcome, c.points]).toEqual(['made', 3])
    expect(last(n).abilities.map((a) => a.name)).toEqual(['Splash'])
    n = play(s, { shooterId: 'curry', shot: 'THREE' }, { doubleId: 'curry' }, [9, 4, 6, 1, 1])
    c = shotOf(n)
    expect([c.auto, c.outcome]).toEqual([null, 'missed'])
    // his drive die has no such text
    n = play(s, { shooterId: 'curry', shot: 'DRIVE' }, { doubleId: 'curry' }, [6, 4, 6, 1, 1])
    expect(shotOf(n).outcome).toBe('missed')
  })

  it('Freight Train, Above the Rim, Poster: natural high faces on the DRIVE die are automatically in', () => {
    let { s } = build(swap(F_OFF, 3, 'giannis'))
    let n = play(s, { shooterId: 'giannis', shot: 'DRIVE' }, { doubleId: 'giannis' }, [11, 8, 6])
    expect(shotOf(n).auto).toEqual({ result: 'make', label: 'Freight Train' })
    expect(shotOf(n).points).toBe(2)
    ;({ s } = build(swap(F_OFF, 1, 'ant')))
    n = play(s, { shooterId: 'ant', shot: 'DRIVE' }, { doubleId: 'ant' }, [10, 6, 6])
    expect(shotOf(n).auto).toEqual({ result: 'make', label: 'Poster' })
    n = play(s, { shooterId: 'ant', shot: 'DRIVE' }, { doubleId: 'ant' }, [9, 6, 6, 1, 1])
    expect(shotOf(n).outcome).toBe('missed')
    expect(ABILITIES.morant.spec).toEqual({ kind: 'autoMake', shot: 'DRIVE', min: 11 })
  })

  it('Clamp: his DEF die matching the shooter\'s die is an automatic stop, even against bonuses', () => {
    let { s, off, def } = build(swap(F_OFF, 0, 'curry'), swap(F_DEF, 0, 'holiday'))
    let n = play(s, { shooterId: 'curry', shot: 'DRIVE' }, { doubleId: 'kcp' }, [6, 6])
    let c = shotOf(n)
    expect([c.offenseTotal, c.defenseTotal]).toEqual([8, 7]) // the open look would have beaten it (7 = die 6 + Lockdown)
    expect(c.auto).toEqual({ result: 'stop', label: 'Clamp' })
    expect(c.outcome).toBe('blocked')
    expect(last(n).credits).toEqual([{ cardId: 'holiday', seat: def, stat: 'BLK', value: 1 }])
    n = play(s, { shooterId: 'curry', shot: 'THREE' }, { doubleId: 'kcp' }, [8, 8])
    expect(shotOf(n).outcome).toBe('stolen')
    expect(last(n).credits).toEqual([
      { cardId: 'holiday', seat: def, stat: 'STL', value: 1 },
      { cardId: 'curry', seat: off, stat: 'TOV', value: 1 },
    ])
    n = play(s, { shooterId: 'curry', shot: 'DRIVE' }, { doubleId: 'kcp' }, [5, 4])
    expect(shotOf(n).outcome).toBe('made') // 5 + 2 against 4 + 1, no match
    // on a drive the stop is a block
    ;({ s, def } = build(swap(F_OFF, 3, 'giannis'), swap(F_DEF, 3, 'anunoby')))
    n = play(s, { shooterId: 'giannis', shot: 'DRIVE' }, { doubleId: 'kcp' }, [7, 7])
    c = shotOf(n)
    expect([c.auto?.label, c.outcome]).toEqual(['Clamp', 'blocked'])
    expect(last(n).credits).toEqual([{ cardId: 'anunoby', seat: def, stat: 'BLK', value: 1 }])
    expect(last(n).rebounds).toEqual([])
  })

  it('The Klaw (Kawhi): equal or one lower stops the shot, and a clamp beats Splash', () => {
    const { s } = build(swap(F_OFF, 0, 'curry'), swap(F_DEF, 0, 'kawhi'))
    const run = (dice: number[]) => shotOf(play(s, { shooterId: 'curry', shot: 'THREE' }, {}, dice))
    expect(run([10, 10]).auto).toEqual({ result: 'stop', label: 'The Klaw' })
    expect(run([11, 10]).auto).toEqual({ result: 'stop', label: 'The Klaw' })
    expect(run([12, 10]).auto).toEqual({ result: 'make', label: 'Splash' })
    expect(run([10, 11]).auto).toEqual({ result: 'make', label: 'Splash' }) // a higher DEF roll is not a match
    expect(run([5, 3]).auto).toBeNull()
    expect(ABILITIES.george.spec).toEqual({ kind: 'clamp', range: 0 })
    for (const id of ['holiday', 'white', 'bridges', 'anunoby', 'caruso', 'dort', 'hjones', 'thybulle']) expect(abilityOf(id)?.name).toBe('Clamp')
  })

  it('Unguardable (Durant): a double team on him rolls a d4 help die', () => {
    const { s } = build(swap(F_OFF, 2, 'durant'))
    const c = shotOf(play(s, { shooterId: 'durant', shot: 'THREE' }, { doubleId: 'durant' }, [9, 1, 4]))
    expect(c.dice.map((d) => [d.purpose, d.die])).toEqual([['shot', 10], ['defense', 6], ['help', 4]])
    expect(c.dice[2].label).toBe('Help d4')
    const other = shotOf(play(s, { shooterId: 'mccollum', shot: 'THREE' }, { doubleId: 'mccollum' }, [8, 1, 1]))
    expect(other.dice[2].die).toBe(6)
  })

  it('Dame Time and Clutch Gene: +2 in the 4th quarter and overtime only', () => {
    const { s, off } = build(swap(F_OFF, 0, 'lillard'))
    const bonus = (state: MatchState) => previewShot(state, off, { shooterId: 'lillard', shot: 'THREE' })!.mods.filter((m) => m.label === 'Dame Time').reduce((n, m) => n + m.value, 0)
    expect(bonus(s)).toBe(0)
    expect(bonus({ ...s, quarter: 3 })).toBe(0)
    expect(bonus({ ...s, quarter: 4 })).toBe(2)
    expect(bonus({ ...s, quarter: 6, overtime: true })).toBe(2)
    expect(ABILITIES.brunson.spec).toEqual({ kind: 'clutch', bonus: 2 })
  })

  it('In Rhythm / Takeover / Heating Up: +2 if he made his last shot', () => {
    let { s, off } = build(swap(F_OFF, 1, 'booker'))
    const bonus = (state: MatchState) => previewShot(state, off, { shooterId: 'booker', shot: 'THREE' })!.mods.filter((m) => m.label === 'In Rhythm').length
    expect(bonus(s)).toBe(0)
    s = dud(play(s, { shooterId: 'booker', shot: 'THREE' }, {}, [10, 1]))
    expect(bonus(s)).toBe(1)
    s = play(s, { shooterId: 'booker', shot: 'THREE' }, {}, [1, 5, 1, 12])
    expect(mod(shotOf(s), 'In Rhythm')).toBe(2)
    expect(shotOf(s).outcome).toBe('missed') // 1 + 2 against 5
    s = dud(s)
    expect(bonus(s)).toBe(0)
    expect(ABILITIES.mitchell.spec.kind).toBe('hotHand')
    expect(ABILITIES.maxey.spec.kind).toBe('hotHand')
  })

  it('Momentum (LeBron): +2 if his team scored on its last possession', () => {
    let { s, off } = build(swap(F_OFF, 2, 'lebron'))
    const bonus = (state: MatchState) => previewShot(state, off, { shooterId: 'lebron', shot: 'DRIVE' })!.mods.filter((m) => m.label === 'Momentum').length
    expect(bonus(s)).toBe(0)
    s = dud(play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [8, 1]))
    expect(bonus(s)).toBe(1)
    s = dud(dud(s))
    expect(bonus(s)).toBe(0)
  })

  it('Isolation (SGA) and Fifth Gear (Fox): +1 when the help die is not rolled against him', () => {
    let { s, off } = build(swap(F_OFF, 0, 'sga'))
    const iso = (shot: 'THREE' | 'DRIVE', doubleId: string | null, id = 'sga', label = 'Isolation') =>
      previewShot(s, off, { shooterId: id, shot }, { doubleId })!.mods.filter((m) => m.label === label).reduce((n, m) => n + m.value, 0)
    expect(iso('DRIVE', null)).toBe(1)
    expect(iso('THREE', null)).toBe(1)
    expect(iso('DRIVE', 'kcp')).toBe(1)
    expect(iso('DRIVE', 'sga')).toBe(0)
    ;({ s, off } = build(swap(F_OFF, 0, 'fox')))
    expect(iso('DRIVE', null, 'fox', 'Fifth Gear')).toBe(1)
    expect(iso('THREE', null, 'fox', 'Fifth Gear')).toBe(0)
    expect(iso('DRIVE', 'fox', 'fox', 'Fifth Gear')).toBe(0)
  })

  it('Tough Shot / Step Back / Handles / Spin Cycle: reroll a 1 or 2 once', () => {
    const { s } = build(swap(F_OFF, 2, 'tatum'))
    let c = shotOf(play(s, { shooterId: 'tatum', shot: 'THREE' }, {}, [2, 7, 3]))
    expect(c.dice.map((d) => [d.purpose, d.face, d.discarded])).toEqual([['shot', 2, true], ['reroll', 7, false], ['defense', 3, false]])
    expect([c.natural, c.offenseTotal, c.outcome]).toEqual([7, 7, 'made'])
    // the second roll stands even if it is worse
    c = shotOf(play(s, { shooterId: 'tatum', shot: 'THREE' }, {}, [2, 1, 3, 1, 1]))
    expect([c.natural, c.outcome]).toEqual([1, 'missed'])
    expect(c.dice).toHaveLength(3)
    c = shotOf(play(s, { shooterId: 'tatum', shot: 'THREE' }, {}, [3, 5, 1, 1]))
    expect(c.dice).toHaveLength(2)
    c = shotOf(play(s, { shooterId: 'tatum', shot: 'DRIVE' }, {}, [2, 5, 1, 1]))
    expect(c.dice).toHaveLength(2) // only his three
    expect(ABILITIES.harden.spec).toEqual({ kind: 'reroll', shot: 'THREE', max: 2 })
    expect(ABILITIES.irving.spec).toEqual({ kind: 'reroll', shot: 'DRIVE', max: 2 })
    expect(ABILITIES.siakam.spec).toEqual({ kind: 'reroll', shot: 'DRIVE', max: 2 })
  })

  it('Post Up (Embiid) and Mismatch (Banchero): +2 on drives against a d8 or smaller DEF die', () => {
    const small = build(swap(F_OFF, 4, 'embiid'), ['murray', 'hart', 'middleton', 'gordon', 'sengun', 'kuzma', 'allen'])
    const big = build(swap(F_OFF, 4, 'embiid'))
    const bonus = (r: typeof small, shot: 'THREE' | 'DRIVE') => previewShot(r.s, r.off, { shooterId: 'embiid', shot })!.mods.filter((m) => m.label === 'Post Up').reduce((n, m) => n + m.value, 0)
    expect(bonus(small, 'DRIVE')).toBe(2)
    expect(bonus(small, 'THREE')).toBe(0)
    expect(bonus(big, 'DRIVE')).toBe(0) // allen rolls a d10
    expect(ABILITIES.banchero.spec).toEqual({ kind: 'mismatch', shot: 'DRIVE', bonus: 2, maxDef: 8 })
  })

  it('Pick & Pop (Towns) and Back Cut (J. Williams): +1 when a teammate passes him the ball', () => {
    const { s, off } = build(swap(F_OFF, 4, 'towns'))
    const bonus = (shot: 'THREE' | 'DRIVE', passerId: string | null) => previewShot(s, off, { shooterId: 'towns', shot, passerId })!.mods.filter((m) => m.label === 'Pick & Pop').reduce((n, m) => n + m.value, 0)
    expect(bonus('THREE', 'mccollum')).toBe(1)
    expect(bonus('THREE', null)).toBe(0)
    expect(bonus('DRIVE', 'mccollum')).toBe(0)
    // it counts even when the pass is not a dime
    const n = play(s, { shooterId: 'towns', shot: 'THREE', passerId: 'mccollum' }, {}, [3, 7, 5])
    expect(shotOf(n).mods.map((m) => m.label)).toEqual(['Pick & Pop', 'Long range'])
    expect(shotOf(n).outcome).toBe('made')
    expect(ABILITIES.jwill.spec).toEqual({ kind: 'offPass', shot: 'DRIVE', bonus: 1 })
  })

  it('Maestro (Luka) and Lob Threat (Young): dimes on a 4', () => {
    const { s, off } = build(['luka', 'kcp', 'dfs', 'dgreen', 'portis', 'strus', 'lopez'])
    expect(previewPass(s, off, 'luka')).toEqual({ die: 12, stealAt: 1, dimeAt: 4, bonus: 2 })
    expect(previewPass(s, off, 'dgreen')?.dimeAt).toBe(5)
    const n = play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'luka' }, {}, [4, 6, 5])
    expect(last(n).pass).toMatchObject({ dime: true, dimeAt: 4, bonus: 2 })
    expect(last(n).credits.map((k) => [k.cardId, k.stat])).toEqual([['kcp', 'PTS'], ['luka', 'AST']])
    expect(ABILITIES.young.spec).toEqual({ kind: 'dime' })
  })

  it('Hub (Jokic): his dimes are worth +3', () => {
    const { s, off } = build(swap(F_OFF, 4, 'jokic'))
    expect(previewPass(s, off, 'jokic')).toEqual({ die: 12, stealAt: 1, dimeAt: 5, bonus: 3 })
    const n = play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'jokic' }, {}, [5, 5, 5])
    expect(mod(shotOf(n), 'Dime')).toBe(3)
    expect(shotOf(n).outcome).toBe('made')
    const plain = play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'jokic' }, {}, [4, 3, 5, 1, 1])
    expect(mod(shotOf(plain), 'Dime')).toBe(0)
  })

  it('Table Setter (Haliburton) and Floor General (Cunningham): passes are never stolen', () => {
    const r = build(swap(F_OFF, 0, 'haliburton'))
    expect(previewPass(r.s, r.off, 'haliburton')?.stealAt).toBe(0)
    const s = give(r.s, r.def, ['pickpocket'])
    const n = play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'haliburton' }, { cardId: 'pickpocket' }, [1, 6, 1])
    expect(last(n).pass).toMatchObject({ stolen: false, dime: false, stealAt: 0 })
    expect(last(n).contests).toHaveLength(1)
    expect(ABILITIES.cunningham.spec).toEqual({ kind: 'safePass' })
  })

  it('Catch & Shoot (Klay): uncontested three on the play he is subbed in', () => {
    const { s, off } = build(['mccollum', 'kcp', 'dfs', 'portis', 'looney', 'klay', 'lopez'])
    const n = play(s, { shooterId: 'klay', shot: 'THREE', sub: { out: 'kcp', in: 'klay' } }, { doubleId: 'klay' }, [7, 4])
    const c = shotOf(n)
    expect(c).toMatchObject({ shooter: 'klay', defender: null, uncontested: true, doubled: false, open: false, outcome: 'made', points: 3 })
    expect(c.dice.map((d) => [d.who, d.die, d.face, d.label])).toEqual([['klay', 10, 7, '3PT d10'], [null, 4, 4, 'Open shot d4']])
    expect(last(n).steps.find((x) => x.kind === 'shot')?.text).toBe('Three. Klay Thompson rolls his 3PT d10 against an open-shot d4. 7 against 6. Good for 3.')
    // next time down he is just a shooter with a defender
    const later = dud(n)
    const again = play(later, { shooterId: 'klay', shot: 'THREE' }, {}, [5, 4, 1, 1])
    expect(shotOf(again)).toMatchObject({ uncontested: false, defender: 'hart' })
    // a drive on the play he comes in is a normal drive
    const drive = play(s, { shooterId: 'klay', shot: 'DRIVE', sub: { out: 'kcp', in: 'klay' } }, {}, [4, 1])
    expect(shotOf(drive).uncontested).toBe(false)
    void off
  })

  it('Catch & Shoot (Klay): takes the shot when your shooter is double-teamed', () => {
    const { s, off } = build(swap(F_OFF, 1, 'klay'))
    let n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, { doubleId: 'portis' }, [7, 4])
    let r = last(n)
    expect(r.swing).toEqual({ kind: 'catchshoot', from: 'portis', to: 'klay' })
    expect([r.shooter, r.shot]).toEqual(['klay', 'THREE'])
    expect(r.contests[0]).toMatchObject({ shooter: 'klay', uncontested: true, outcome: 'made' })
    expect(r.contests[0].dice).toHaveLength(2) // no help die
    expect(r.credits.map((k) => [k.cardId, k.stat, k.value])).toEqual([['klay', 'PTS', 3], ['portis', 'AST', 1]])
    expect(n.shots[off]).toEqual({ klay: 1 })
    // not when he is the one doubled, and not when the double is somewhere else
    n = play(s, { shooterId: 'klay', shot: 'THREE' }, { doubleId: 'klay' }, [5, 1, 1])
    expect(last(n).swing).toBeNull()
    expect(shotOf(n).doubled).toBe(true)
    n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, { doubleId: 'dfs' }, [5, 1])
    expect(last(n).swing).toBeNull()
    // and not once he has used his two shots this quarter
    const spent: MatchState = { ...s, shots: off === 0 ? [{ klay: 2 }, {}] : [{}, { klay: 2 }] }
    n = play(spent, { shooterId: 'portis', shot: 'DRIVE' }, { doubleId: 'portis' }, [5, 1, 1])
    r = last(n)
    expect(r.swing).toBeNull()
    expect(r.contests[0]).toMatchObject({ shooter: 'portis', doubled: true })
  })

  it('Catch & Shoot (Klay): takes an uncontested three when your shooter is blocked', () => {
    const { s, off, def } = build(swap(F_OFF, 1, 'klay'))
    const n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [1, 6, 2, 4, 1, 12])
    const r = last(n)
    expect(r.contests.map((c) => [c.kind, c.shooter, c.outcome])).toEqual([['shot', 'portis', 'blocked'], ['catchshoot', 'klay', 'missed']])
    expect(r.contests[1].uncontested).toBe(true)
    expect(r.rebounds).toHaveLength(1)
    expect(r.credits).toEqual([
      { cardId: 'gordon', seat: def, stat: 'BLK', value: 1 },
      { cardId: 'allen', seat: def, stat: 'REB', value: 1 },
    ])
    expect(n.shots[off]).toEqual({ portis: 1, klay: 1 })
    const made = last(play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [1, 6, 9, 4]))
    expect(made.points).toBe(3)
    expect(made.credits.some((k) => k.stat === 'AST')).toBe(false)
  })

  it('Sixth Man (Reid) and Spark (Pritchard): +2 on the play he is subbed in', () => {
    let { s } = build(['mccollum', 'kcp', 'dfs', 'portis', 'looney', 'reid', 'lopez'])
    s = play(s, { shooterId: 'reid', shot: 'THREE', sub: { out: 'looney', in: 'reid' } }, {}, [2, 1])
    expect(mod(shotOf(s), 'Sixth Man')).toBe(2)
    expect(shotOf(s).outcome).toBe('made') // 2 + 2 against 1 + 2
    s = dud(s)
    s = play(s, { shooterId: 'reid', shot: 'THREE' }, {}, [1, 1, 1, 12])
    expect(mod(shotOf(s), 'Sixth Man')).toBe(0)
    expect(ABILITIES.pritchard.spec).toEqual({ kind: 'sixthMan', bonus: 2 })
  })

  it('Eraser (Wemby): any drive against his team is blocked at a margin of 3, and he gets the block', () => {
    const { s, def } = build(F_OFF, swap(F_DEF, 4, 'wemby'))
    let n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [2, 5])
    expect(shotOf(n)).toMatchObject({ defender: 'gordon', outcome: 'blocked' })
    expect(last(n).credits).toEqual([{ cardId: 'wemby', seat: def, stat: 'BLK', value: 1 }])
    expect(last(n).abilities.map((a) => a.name)).toEqual(['Eraser'])
    n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [3, 5, 1, 12])
    expect(shotOf(n).outcome).toBe('missed')
    n = play(s, { shooterId: 'dfs', shot: 'THREE' }, {}, [3, 5, 1, 12])
    expect(shotOf(n).outcome).toBe('missed') // 3 against 7: threes are not his business
  })

  it('Back Line (Davis), Swat (Holmgren), Block Party (JJJ): only the player he guards', () => {
    const { s, def } = build(F_OFF, swap(F_DEF, 3, 'davis'))
    let n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [2, 5])
    expect(shotOf(n).outcome).toBe('blocked')
    expect(last(n).credits).toEqual([{ cardId: 'davis', seat: def, stat: 'BLK', value: 1 }])
    n = play(s, { shooterId: 'looney', shot: 'DRIVE' }, {}, [1, 4, 1, 12])
    expect(shotOf(n)).toMatchObject({ defender: 'allen', outcome: 'missed' })
    expect(ABILITIES.holmgren.spec).toEqual({ kind: 'swat', scope: 'own', margin: 3 })
    expect(ABILITIES.jjj.spec).toEqual({ kind: 'swat', scope: 'own', margin: 3 })
  })

  it('Stifle Tower (Gobert): +1 to his team\'s defence against drives', () => {
    const { s, off } = build(F_OFF, swap(F_DEF, 4, 'gobert'))
    const plan = previewShot(s, off, { shooterId: 'portis', shot: 'DRIVE' })!
    expect(plan.mods).toEqual([{ side: 'def', label: 'Stifle Tower', value: 1, source: 'ability' }])
    expect(previewShot(s, off, { shooterId: 'dfs', shot: 'THREE' })!.mods.map((m) => m.label)).toEqual(['Long range'])
    const n = play(s, { shooterId: 'portis', shot: 'DRIVE' }, {}, [4, 3, 1, 12])
    expect([shotOf(n).offenseTotal, shotOf(n).defenseTotal, shotOf(n).outcome]).toEqual([4, 4, 'missed'])
  })

  it('Glass Cleaner (Adebayo): +2 when he rolls for a rebound', () => {
    const { s } = build(swap(F_OFF, 4, 'adebayo'))
    let r = last(play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [1, 1, 4, 4]))
    expect(r.rebounds[0]).toMatchObject({ offRebounder: 'adebayo', offenseTotal: 6, defenseTotal: 6, winner: 'def' })
    expect(r.rebounds[0].mods).toContainEqual({ side: 'off', label: 'Glass Cleaner', value: 2, source: 'ability' })
    r = last(play(s, { shooterId: 'mccollum', shot: 'THREE' }, {}, [1, 1, 5, 4, 1, 1]))
    expect(r.rebounds[0].winner).toBe('off')
  })

  it('Jump the Lane (Butler): passes by the player he guards are stolen on a 1 or 2', () => {
    const { s, off, def } = build(F_OFF, swap(F_DEF, 2, 'butler'))
    expect(previewPass(s, off, 'dfs')?.stealAt).toBe(2)
    expect(previewPass(s, off, 'mccollum')?.stealAt).toBe(1)
    let r = last(play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'dfs' }, {}, [2]))
    expect(r.pass?.stolen).toBe(true)
    expect(r.credits[0]).toEqual({ cardId: 'butler', seat: def, stat: 'STL', value: 1 })
    r = last(play(s, { shooterId: 'kcp', shot: 'THREE', passerId: 'mccollum' }, {}, [2, 6, 1]))
    expect(r.pass?.stolen).toBe(false)
  })
})
