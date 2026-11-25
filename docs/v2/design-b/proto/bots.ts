/** Drafting and coaching bots used by the experiments, plus the full-match driver. */
import { rngFromSeed } from './prng.ts'
import type { Rng } from './prng.ts'
import {
  CFG, DRAFT_ORDER, N_DEF, N_OFF, ROOKIE, buildSide, card, chemistry, dealPool, floorOf, legalPicks, mustRestFrom, payoff, playRun,
  slotFive, spent, startMatch, threat, total,
} from './engine.ts'
import type { Call, Card, MatchState, Position, Side } from './engine.ts'

/* ------------------------------------------------------------------ */
/* Zero-sum solver (fictitious play)                                   */
/* ------------------------------------------------------------------ */
export function solve(m: Float64Array, iters = 200): { off: Float64Array; def: Float64Array; value: number } {
  const rowPay = new Float64Array(N_OFF)
  const colPay = new Float64Array(N_DEF)
  const off = new Float64Array(N_OFF)
  const def = new Float64Array(N_DEF)
  let o = 0
  let d = 0
  for (let t = 0; t < iters; t++) {
    off[o]++; def[d]++
    for (let i = 0; i < N_OFF; i++) rowPay[i] += m[i * N_DEF + d]
    for (let j = 0; j < N_DEF; j++) colPay[j] += m[o * N_DEF + j]
    o = 0; d = 0
    for (let i = 1; i < N_OFF; i++) if (rowPay[i] > rowPay[o]) o = i
    for (let j = 1; j < N_DEF; j++) if (colPay[j] < colPay[d]) d = j
  }
  for (let i = 0; i < N_OFF; i++) off[i] /= iters
  for (let j = 0; j < N_DEF; j++) def[j] /= iters
  return { off, def, value: (rowPay[o] + colPay[d]) / (2 * iters) }
}
/** Cheap value estimate: midpoint of the two pure-strategy bounds. */
export function quickValue(m: Float64Array): number {
  let lo = -Infinity
  for (let i = 0; i < N_OFF; i++) {
    let mn = Infinity
    for (let j = 0; j < N_DEF; j++) if (m[i * N_DEF + j] < mn) mn = m[i * N_DEF + j]
    if (mn > lo) lo = mn
  }
  let hi = Infinity
  for (let j = 0; j < N_DEF; j++) {
    let mx = -Infinity
    for (let i = 0; i < N_OFF; i++) if (m[i * N_DEF + j] > mx) mx = m[i * N_DEF + j]
    if (mx < hi) hi = mx
  }
  return (lo + hi) / 2
}
function sample(p: ArrayLike<number>, rng: Rng): number {
  let r = rng()
  for (let i = 0; i < p.length; i++) { r -= p[i]; if (r < 0) return i }
  return p.length - 1
}
const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]

/* ------------------------------------------------------------------ */
/* Coaches                                                             */
/* ------------------------------------------------------------------ */
export interface Coach { name: string; call(st: MatchState, seat: 0 | 1, rng: Rng): Call }
const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
const bestBy = (ids: string[], f: (c: Card) => number) => [...ids].sort((a, b) => f(card(b)) - f(card(a)) || total(card(b)) - total(card(a)) || (a < b ? -1 : 1))[0]

/** Hero ball: same go-to every run, always doubles their best scorer, rests the cheapest players first. */
export const heroCoach: Coach = {
  name: 'Hero',
  call(st, seat) {
    const me = st.rosters[seat]
    const sit = [...mustRestFrom(st, seat)].sort((a, b) => card(a).cost - card(b).cost || (a < b ? -1 : 1))[0]
    const goTo = bestBy(floorOf(me, sit), threat)
    const star = bestBy(st.rosters[other(seat)], threat)
    return { sit, goTo, emph: card(goTo).drive >= card(goTo).three ? 'IN' : 'OUT', help: star, wall: card(star).drive >= card(star).three ? 'PAINT' : 'ARC' }
  },
}
export const randomCoach: Coach = {
  name: 'Random',
  call(st, seat, rng) {
    const sit = pick(mustRestFrom(st, seat), rng)
    return { sit, goTo: pick(floorOf(st.rosters[seat], sit), rng), emph: rng() < 0.5 ? 'IN' : 'OUT', help: pick(st.rosters[other(seat)], rng), wall: rng() < 0.5 ? 'PAINT' : 'ARC' }
  },
}
/** A coach that is sensible except for one frozen habit. Used to show no single call is always right. */
export function habitCoach(name: string, habit: { emph?: 'IN' | 'OUT'; wall?: 'PAINT' | 'ARC'; help?: 'star'; goTo?: 'star' }): Coach {
  return {
    name,
    call(st, seat, rng) {
      const c = mixCoach.call(st, seat, rng)
      if (habit.emph) c.emph = habit.emph
      if (habit.wall) c.wall = habit.wall
      if (habit.help === 'star') c.help = bestBy(st.rosters[other(seat)], threat)
      if (habit.goTo === 'star') c.goTo = bestBy(floorOf(st.rosters[seat], c.sit), threat)
      return c
    },
  }
}

function smartSit(st: MatchState, seat: 0 | 1, rng: Rng): string {
  let opts = mustRestFrom(st, seat)
  // Late Clock only works in runs 5-6, so rest Lillard early when possible.
  if (CFG.ABILITIES_ON && opts.includes('lillard') && opts.length > 1) {
    if (st.run >= 5) opts = opts.filter((x) => x !== 'lillard')
    else if (st.run >= 3) return 'lillard'
  }
  return pick(opts, rng)
}
function guessFloor(st: MatchState, seat: 0 | 1, rng: Rng): string[] {
  return floorOf(st.rosters[seat], pick(mustRestFrom(st, seat), rng))
}
interface Reads { side: Side; m: Float64Array; sol: ReturnType<typeof solve> }
function analyse(st: MatchState, offSeat: 0 | 1, offFloor: string[], defFloor: string[]): Reads {
  const side = buildSide(offFloor, defFloor, st.chem[offSeat], st.chem[other(offSeat)], st.run)
  const m = payoff(side)
  return { side, m, sol: solve(m) }
}
/** Mixes its calls in the proportions that cannot be exploited (solves the run as a small matrix game). */
export const mixCoach: Coach = {
  name: 'Mixer',
  call(st, seat, rng) {
    const sit = smartSit(st, seat, rng)
    const mine = floorOf(st.rosters[seat], sit)
    const theirs = guessFloor(st, other(seat), rng)
    const a = analyse(st, seat, mine, theirs)
    const o = sample(a.sol.off, rng)
    const b = analyse(st, other(seat), theirs, mine)
    const d = sample(b.sol.def, rng)
    return { sit, goTo: a.side.off[o >> 1].id, emph: o & 1 ? 'OUT' : 'IN', help: b.side.off[d >> 1].id, wall: d & 1 ? 'ARC' : 'PAINT' }
  },
}
/** Mixer that also keeps a tally of the opponent's habits and leans into them. */
export const readerCoach: Coach = {
  name: 'Reader',
  call(st, seat, rng) {
    const opp = other(seat)
    const sit = smartSit(st, seat, rng)
    const mine = floorOf(st.rosters[seat], sit)
    const theirs = guessFloor(st, opp, rng)
    const K = 1.5 // weight of the unexploitable mix against the observed tally
    const n = st.history.length
    // --- defence: estimate their offence mix
    const b = analyse(st, opp, theirs, mine)
    const offEst = new Float64Array(N_OFF)
    for (let o = 0; o < N_OFF; o++) offEst[o] = (K * b.sol.off[o]) / (K + n)
    for (const h of st.history) {
      const c = h.calls[opp]
      const j = b.side.off.findIndex((x) => x.id === c.goTo)
      if (j >= 0) offEst[j * 2 + (c.emph === 'OUT' ? 1 : 0)] += 1 / (K + n)
    }
    let d = 0, dBest = Infinity
    for (let j = 0; j < N_DEF; j++) {
      let v = 0
      for (let o = 0; o < N_OFF; o++) v += offEst[o] * b.m[o * N_DEF + j]
      if (v < dBest - 1e-9) { dBest = v; d = j }
    }
    // --- offence: estimate their defence mix
    const a = analyse(st, seat, mine, theirs)
    const defEst = new Float64Array(N_DEF)
    for (let j = 0; j < N_DEF; j++) defEst[j] = (K * a.sol.def[j]) / (K + n)
    for (const h of st.history) {
      const c = h.calls[opp]
      const j = a.side.off.findIndex((x) => x.id === c.help)
      if (j >= 0) defEst[j * 2 + (c.wall === 'ARC' ? 1 : 0)] += 1 / (K + n) // a tally on someone resting right now tells us nothing
    }
    let o = 0, oBest = -Infinity
    for (let i = 0; i < N_OFF; i++) {
      let v = 0
      for (let j = 0; j < N_DEF; j++) v += defEst[j] * a.m[i * N_DEF + j]
      if (v > oBest + 1e-9) { oBest = v; o = i }
    }
    return { sit, goTo: a.side.off[o >> 1].id, emph: o & 1 ? 'OUT' : 'IN', help: b.side.off[d >> 1].id, wall: d & 1 ? 'ARC' : 'PAINT' }
  },
}

/* ------------------------------------------------------------------ */
/* Drafters                                                            */
/* ------------------------------------------------------------------ */
export interface Drafter { name: string; pick(pool: string[], mine: string[], theirs: string[], rng: Rng): string | null }
/**
 * Legal picks that keep the rest of the roster fundable: after this pick you must still be able to pay for the
 * cheapest cards left, assuming the opponent grabs one cheap card for each slot you still have to fill.
 * Every bot (the naive ones too) budgets this way, so nobody loses just by going broke.
 */
function sane(pool: string[], mine: string[]): string[] {
  const legal = legalPicks(pool, mine)
  const left = CFG.CAP - spent(mine)
  const after = CFG.ROSTER_SIZE - mine.length - 1
  const ok = legal.filter((id) => {
    const costs = pool.filter((x) => x !== id).map((x) => card(x).cost).sort((a, b) => a - b)
    let reserve = 0
    for (let k = 0; k < after; k++) reserve += costs[Math.min(costs.length - 1, k + after)] ?? 0
    return card(id).cost <= left - reserve
  })
  return ok.length ? ok : legal.length ? [legal.sort((a, b) => card(a).cost - card(b).cost)[0]] : legal
}
function even(pool: string[], mine: string[], slack: number): string[] {
  const opts = sane(pool, mine)
  const left = CFG.CAP - spent(mine)
  const per = left / (CFG.ROSTER_SIZE - mine.length)
  const ok = opts.filter((id) => card(id).cost <= per + slack)
  return ok.length ? ok : opts
}
function argmax(ids: string[], f: (id: string) => number): string | null {
  let best: string | null = null, bv = -Infinity
  for (const id of ids) { const v = f(id); if (v > bv + 1e-9) { bv = v; best = id } }
  return best
}
export function simpleDrafter(name: string, score: (c: Card, mine: string[]) => number, spend: 'top' | 'even'): Drafter {
  return { name, pick: (pool, mine) => argmax(spend === 'top' ? sane(pool, mine) : even(pool, mine, 1.5), (id) => score(card(id), mine)) }
}
const chemGain = (mine: string[], id: string) => chemistry([...mine, id]).total - chemistry(mine).total
export const DRAFTERS: Record<string, Drafter> = {
  /** Naive: biggest bars, ignores fit and chemistry. */
  TopRated: simpleDrafter('TopRated', (c) => total(c), 'top'),
  SpreadRated: simpleDrafter('SpreadRated', (c) => total(c), 'even'),
  Shooters: simpleDrafter('Shooters', (c) => c.three * 3 + total(c) * 0.1, 'even'),
  Slashers: simpleDrafter('Slashers', (c) => c.drive * 3 + total(c) * 0.1, 'even'),
  Stoppers: simpleDrafter('Stoppers', (c) => c.def * 3 + total(c) * 0.1, 'even'),
  /** Chases the chem number only. */
  ChemOnly: simpleDrafter('ChemOnly', (c, mine) => chemGain(mine, c.id) * 3 + total(c) * 0.1, 'even'),
  /** What the draft screen invites a human to do: bars + the chem hint, spending evenly. */
  FitSpread: simpleDrafter('FitSpread', (c, mine) => total(c) + chemGain(mine, c.id), 'even'),
  /** Fit-aware specialists: same as FitSpread with a thumb on one bar. */
  FitShoot: simpleDrafter('FitShoot', (c, mine) => total(c) + chemGain(mine, c.id) + 1.5 * c.three, 'even'),
  FitDrive: simpleDrafter('FitDrive', (c, mine) => total(c) + chemGain(mine, c.id) + 1.5 * c.drive, 'even'),
  FitDefend: simpleDrafter('FitDefend', (c, mine) => total(c) + chemGain(mine, c.id) + 1.5 * c.def, 'even'),
  /** Same but stars first, bargain bin last. */
  FitStars: simpleDrafter('FitStars', (c, mine) => total(c) + chemGain(mine, c.id), 'top'),
}

/* Analytic drafter: values every candidate by solving the actual run game against the opponent's current roster. */
let fillerN = 0
function fillers(roster: string[]): Card[] {
  const cs = roster.map(card)
  const empty = CFG.ROSTER_SIZE - cs.length
  if (empty <= 0) return cs
  const per = Math.max(2, Math.min(8, (CFG.CAP - spent(roster)) / empty))
  const r = (8 + 2 * per) / 3
  const need: Position[] = []
  const n = (p: Position) => cs.filter((c) => c.position === p).length
  if (n('C') < 1) need.push('C')
  for (let i = n('G'); i < 2; i++) need.push('G')
  for (let i = n('F'); i < 2; i++) need.push('F')
  const out = [...cs]
  for (let i = 0; i < empty; i++) out.push({ ...ROOKIE, id: `filler${fillerN++ % 12}`, position: need[i] ?? 'F', three: r, drive: r, def: r })
  return out
}
function chemOf(cs: Card[], real: string[]): number {
  const n = (p: Position) => cs.filter((c) => c.position === p).length
  const fit = CFG.FIT * (Math.min(2, n('G')) + Math.min(2, n('F')) + Math.min(1, n('C')))
  const c = chemistry(real)
  return c.total - c.fit + fit
}
import { buildSideCards } from './engine.ts'
/** Fictitious-play iterations used when valuing a roster (60 is within ~0.03 points per run of the exact value). */
const VALUE_ITERS = 60
export function rosterValue(mine: string[], theirs: string[]): number {
  const a = fillers(mine), b = fillers(theirs)
  const ca = chemOf(a, mine), cb = chemOf(b, theirs)
  // opponent shows up with its five most expensive; we average over each of our six resting
  const bFloor = [...b].sort((x, y) => y.cost - x.cost || total(y) - total(x)).slice(0, 5)
  let v = 0
  let seenFiller = false
  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i].id.startsWith('filler')) { if (seenFiller) continue; seenFiller = true }
    const w = a[i].id.startsWith('filler') ? a.filter((c) => c.id.startsWith('filler')).length : 1
    const fl = a.filter((_, j) => j !== i)
    v += w * (solve(payoff(buildSideCards(fl, bFloor, ca, cb, 3)), VALUE_ITERS).value - solve(payoff(buildSideCards(bFloor, fl, cb, ca, 3)), VALUE_ITERS).value)
    k += w
  }
  return v / k
}
export const oracleDrafter: Drafter = {
  name: 'Oracle',
  pick: (pool, mine, theirs) => argmax(sane(pool, mine), (id) => rosterValue([...mine, id], theirs)),
}
DRAFTERS.Oracle = oracleDrafter
/**
 * Planner: for every candidate, plays out the rest of the draft (both sides finishing with the on-card hints,
 * i.e. FitSpread) and scores the two finished rosters with the run solver. Sees denial and budget shape.
 */
export const plannerDrafter: Drafter = {
  name: 'Planner',
  pick(pool, mine, theirs, rng) {
    const order = DRAFT_ORDER
    const done = mine.length + theirs.length
    const me = order[done]
    const finish = DRAFTERS.FitSpread
    return argmax(sane(pool, mine), (id) => {
      const r: [string[], string[]] = me === 0 ? [[...mine, id], [...theirs]] : [[...theirs], [...mine, id]]
      let p = pool.filter((x) => x !== id)
      for (let k = done + 1; k < order.length; k++) {
        const s = order[k]
        const c = legalPicks(p, r[s]).length ? finish.pick(p, r[s], r[1 - s], rng) : null
        if (c === null) r[s].push(`rookie-${s}-${r[s].length}`)
        else { r[s].push(c); p = p.filter((x) => x !== c) }
      }
      return rosterValue(r[me], r[1 - me]) - rosterValue(r[1 - me], r[me])
    })
  },
}
DRAFTERS.Planner = plannerDrafter

/* ------------------------------------------------------------------ */
/* Full match                                                          */
/* ------------------------------------------------------------------ */
export function runDraft(seed: string, drafters: [Drafter, Drafter]): { rosters: [string[], string[]]; pool: string[]; rookies: number } {
  let pool = dealPool(seed)
  const all = [...pool]
  const rosters: [string[], string[]] = [[], []]
  const rngs = [rngFromSeed(`${seed}|draft0`), rngFromSeed(`${seed}|draft1`)]
  let rookies = 0
  for (const s of DRAFT_ORDER as (0 | 1)[]) {
    let id = legalPicks(pool, rosters[s]).length ? drafters[s].pick(pool, rosters[s], rosters[s === 0 ? 1 : 0], rngs[s]) : null
    if (id === null) { id = `rookie-${s}-${rosters[s].length}`; rookies++ } else pool = pool.filter((x) => x !== id)
    rosters[s].push(id)
  }
  return { rosters, pool: all, rookies }
}
export function playMatch(seed: string, rosters: [string[], string[]], coaches: [Coach, Coach]): MatchState {
  const st = startMatch(seed, rosters)
  const rngs = [rngFromSeed(`${seed}|coach0`), rngFromSeed(`${seed}|coach1`)]
  let guard = 0
  while (st.winner === null) {
    playRun(st, [coaches[0].call(st, 0, rngs[0]), coaches[1].call(st, 1, rngs[1])])
    if (++guard > 60) { st.winner = rngFromSeed(`${seed}|coin`)() < 0.5 ? 0 : 1 }
  }
  return st
}
export { slotFive }
