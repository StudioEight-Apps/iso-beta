// Judge's adversarial tests on the final rules: degenerate drafts, call spam, ability stacking, roster shapes.
//   node adv.ts <draft|coach|human|shape> [matches=4000]
import { K, buildTeam, computeChem, draftHint, legalPicks, loadCards, shotTable, threat, type Card, type DraftState, type Team } from './iso2.ts'
import { COACHES, DRAFTERS, initWorth, pppMatrix, solveGame, power, type Coach, type Drafter } from './bots.ts'
import { playMatch } from './match.ts'
const [grp = 'draft', nArg = '4000'] = process.argv.slice(2)
const N = +nArg
const all = loadCards()
const worth = initWorth(all)
const sum = (c: Card) => c.three + c.drive + c.def
const greedy = (key: (c: Card, r: Card[], d: DraftState) => number): Drafter => (d, seat) => {
  const legal = legalPicks(d, seat); if (!legal.length) return null
  const r = d.rosters[seat]
  return legal.reduce((b, c) => (key(c, r, d) > key(b, r, d) ? c : b))
}
const even = (key: (c: Card, r: Card[]) => number): Drafter => (d, seat) => {
  let legal = legalPicks(d, seat); if (!legal.length) return null
  const r = d.rosters[seat]; const per = d.budget[seat] / (K.TEAM - r.length)
  const ok = legal.filter((c) => c.cost <= per + 1.5); if (ok.length) legal = ok
  return legal.reduce((b, c) => (key(c, r) > key(b, r) ? c : b))
}
const hintKey = (w: number) => (c: Card, r: Card[]) => { const h = draftHint(r, c); return sum(c) + w * h.chemDelta + (h.fit === 'out of position' ? -4 : 0) }
Object.assign(DRAFTERS, {
  hint: greedy(hintKey(2)),               // human following the on-card hint: bars + 2 x chem
  hintEven: even(hintKey(2)),
  hintHeavy: even(hintKey(4)),
  offPerDollar: greedy((c) => (c.three + c.drive) / c.cost),   // exploit cheap low-DEF scorers
  worthPerDollar: greedy((c) => ((worth.get(c.id) ?? 0) + 0.15) / c.cost),
  cheapest: greedy((c) => -c.cost * 100 + sum(c)),
  starsAndScrubs: ((d: DraftState, seat: 0 | 1) => { const l = legalPicks(d, seat); if (!l.length) return null; const r = d.rosters[seat]; return r.length < 2 ? l.reduce((b, c) => (c.cost * 100 + sum(c) > b.cost * 100 + sum(b) ? c : b)) : l.reduce((b, c) => (hintKey(2)(c, r) > hintKey(2)(b, r) ? c : b)) }) as Drafter,
  allDefence: greedy((c) => c.def * 100 + sum(c)),
  bigMen: greedy((c) => (c.position === 'C' ? 1000 : 0) + c.def * 10 + sum(c)),
  fiveShooters: greedy((c) => c.three * 100 + sum(c)),
  abilityStack: ((d: DraftState, seat: 0 | 1, rng: any) => {
    const l = legalPicks(d, seat).filter((c) => c.ability)
    if (l.length) return l.reduce((b, c) => (sum(c) > sum(b) ? c : b))
    return DRAFTERS.builder(d, seat, rng)
  }) as Drafter,
})
const bestSlot = (t: Team) => t.cards.map((c, i) => [threat(c) * 100 + c.three + c.drive, i]).sort((a, b) => b[0] - a[0])[0][1]
Object.assign(COACHES, {
  abilitySpam: ((me: Team, opp: Team, q: number, rng: any) => {
    const a = me.abil; let off = -1, def = -1
    if (a.has('gravity')) off = 1; else if (a.has('pointforward')) off = 0; else if (a.has('postup')) off = 2
    else for (const id of ['maestro', 'iso']) if (a.has(id)) off = 3 + me.cards.findIndex((c) => c.ability?.id === id)
    if (off < 0 && a.has('costar')) off = 3 + bestSlot({ ...me, cards: me.cards.map((c) => (c.ability?.id === 'costar' ? { ...c, three: 0, drive: 0 } : c)) } as Team)
    if (a.has('eraser')) def = 2; else if (a.has('clamp')) def = 3 + bestSlot(opp)
    const g = COACHES.greedy(me, opp, q, rng)
    return { off: off < 0 ? g.off : off, def: def < 0 ? g.def : def }
  }) as Coach,
  moveShadow: ((me: Team, opp: Team) => ({ off: 0, def: 3 + bestSlot(opp) })) as Coach,
  feedPlain: ((me: Team) => ({ off: 3 + bestSlot(me), def: 0 })) as Coach,
  flyPlain: (() => ({ off: 1, def: 0 })) as Coach,
  plainPaint: (() => ({ off: 0, def: 2 })) as Coach,
  plainLine: (() => ({ off: 0, def: 1 })) as Coach,
})
function duel(tag: string, a: [string, string], b: [string, string], n = N) {
  let w = 0, chemA = 0, costA = 0, walk = 0
  for (let i = 0; i < n; i++) {
    const sa = (i % 2) as 0 | 1
    const pa = { drafter: DRAFTERS[a[0]], coach: COACHES[a[1]] }, pb = { drafter: DRAFTERS[b[0]], coach: COACHES[b[1]] }
    const m = playMatch(`${tag}|${i}`, all, sa === 0 ? [pa, pb] : [pb, pa])
    if (m.result.winner === sa) w++
    chemA += m.teams[sa].chem.total
    walk += m.draft.rosters[sa].filter((c) => c.id === 'walkon').length
  }
  console.log(`${a.join('/')} vs ${b.join('/')}: ${(100 * w / n).toFixed(1)}%  (chemA ${(chemA / n).toFixed(1)}, walk-ons/roster ${(walk / n).toFixed(3)}) n=${n}`)
}
if (grp === 'draft') {
  for (const d of ['hint', 'hintHeavy', 'starsAndScrubs', 'offPerDollar', 'worthPerDollar', 'cheapest', 'allDefence', 'bigMen', 'fiveShooters', 'abilityStack']) {
    duel(`adv|${d}|b`, [d, 'sharp'], ['builder', 'sharp'])
    duel(`adv|${d}|n`, [d, 'sharp'], ['bigNames', 'sharp'])
  }
}
if (grp === 'coach') {
  for (const c of ['abilitySpam', 'moveShadow', 'feedPlain', 'flyPlain', 'plainPaint', 'plainLine', 'greedy', 'reader']) {
    duel(`advc|${c}|s`, ['builder', c], ['builder', 'sharp'])
    duel(`advc|${c}|p`, ['builder', c], ['builder', 'plain'])
    duel(`advc|${c}|r`, ['builder', c], ['builder', 'reader'])
  }
  duel('advc|abil-helio', ['abilityStack', 'abilitySpam'], ['builder', 'sharp'])
  duel('advc|abil-helio2', ['abilityStack', 'sharp'], ['builder', 'sharp'])
}
if (grp === 'human') {
  // realistic skill gradient: a human following hints vs naive
  duel('h1', ['hintEven', 'reader'], ['bigNames', 'plain'])
  duel('h2', ['hintEven', 'greedy'], ['bigNames', 'star'])
  duel('h3', ['hintEven', 'plain'], ['bigNames', 'plain'])
  duel('h4', ['hintEven', 'plain'], ['ratings', 'plain'])
  duel('h5', ['hint', 'plain'], ['bigNames', 'plain'])
  duel('h6', ['builder', 'plain'], ['hintEven', 'plain'])
  duel('h7', ['hintEven', 'star'], ['random', 'random'])
}
if (grp === 'shape') {
  const mk = (name: string, specs: [string, number, number, number][]) => ({ name, t: buildTeam(specs.map(([p, a, b, c], i) => ({ id: `${name}${i}`, name, position: p as any, three: a, drive: b, def: c, cost: 3, tier: 'starter', traits: [] }))) })
  const teams = [
    mk('allShoot', [['G', 10, 6, 8], ['G', 10, 6, 8], ['F', 10, 6, 8], ['F', 10, 6, 8], ['C', 10, 6, 8]]),
    mk('allRim', [['G', 6, 10, 8], ['G', 6, 10, 8], ['F', 6, 10, 8], ['F', 6, 10, 8], ['C', 6, 10, 8]]),
    mk('mixed', [['G', 10, 6, 8], ['G', 6, 10, 8], ['F', 10, 6, 8], ['F', 6, 10, 8], ['C', 8, 8, 8]]),
    mk('flat', [['G', 8, 8, 8], ['G', 8, 8, 8], ['F', 8, 8, 8], ['F', 8, 8, 8], ['C', 8, 8, 8]]),
    mk('oneStar', [['G', 12, 12, 8], ['G', 7, 7, 8], ['F', 7, 7, 8], ['F', 7, 7, 8], ['C', 7, 7, 8]]),
    mk('noD', [['G', 10, 10, 4], ['G', 10, 10, 4], ['F', 10, 10, 4], ['F', 10, 10, 4], ['C', 10, 10, 4]]),
    mk('allD', [['G', 6, 6, 12], ['G', 6, 6, 12], ['F', 6, 6, 12], ['F', 6, 6, 12], ['C', 6, 6, 12]]),
  ]
  console.log('margin per 100 possessions under best play (row vs column)')
  console.log(''.padEnd(10) + teams.map((t) => t.name.padStart(9)).join(''))
  for (const a of teams) console.log(a.name.padEnd(10) + teams.map((b) => (100 * power(a.t, b.t)).toFixed(1).padStart(9)).join(''))
  for (const a of teams) { const m = pppMatrix(a.t, teams[3].t, 1); const g = solveGame(m, 4000); console.log(a.name, 'off blind(plain D)', (100 * Math.max(...m.map((r) => r[0]))).toFixed(1), 'value', (100 * g.value).toFixed(1), 'mix', g.row.map((x) => x.toFixed(2)).join(' ')) }
}
