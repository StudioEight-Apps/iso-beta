/**
 * Bots used to measure the design: drafting strategies and coaching strategies.
 * Bots draw their "human" randomness from their own seeded stream, never from the game's.
 */
import {
  K, N_CALLS, WALK_ON, buildTeam, computeChem, legalPicks, shotTable, threat,
  type Call, type Card, type DraftState, type Rng, type Team,
} from './engine.ts'

/* ------------------------------------------------------------------ */
/* The quarter as a pair of 8x8 guessing games                          */
/* ------------------------------------------------------------------ */
/** m[oc][dc] = expected points per possession for `off` against `def`. */
export function pppMatrix(off: Team, def: Team, quarter: number): number[][] {
  const m: number[][] = []
  for (let oc = 0; oc < N_CALLS; oc++) {
    m[oc] = []
    for (let dc = 0; dc < N_CALLS; dc++) m[oc][dc] = shotTable(off, def, oc, dc, quarter).ppp
  }
  return m
}

/** Solve a zero-sum matrix game (row maximises) by fictitious play. Returns mixes and value. */
export function solveGame(m: number[][], iters = 2000): { row: number[]; col: number[]; value: number } {
  const n = m.length, k = m[0].length
  const rowCount = new Array(n).fill(0), colCount = new Array(k).fill(0)
  const rowPay = new Array(n).fill(0), colPay = new Array(k).fill(0)
  let r = 0, c = 0
  for (let t = 0; t < iters; t++) {
    rowCount[r]++; colCount[c]++
    for (let i = 0; i < n; i++) rowPay[i] += m[i][c]
    for (let j = 0; j < k; j++) colPay[j] += m[r][j]
    r = 0; for (let i = 1; i < n; i++) if (rowPay[i] > rowPay[r]) r = i
    c = 0; for (let j = 1; j < k; j++) if (colPay[j] < colPay[c]) c = j
  }
  const row = rowCount.map((x: number) => x / iters), col = colCount.map((x: number) => x / iters)
  let lo = Infinity, hi = -Infinity
  for (let j = 0; j < k; j++) { let v = 0; for (let i = 0; i < n; i++) v += row[i] * m[i][j]; if (v < lo) lo = v }
  for (let i = 0; i < n; i++) { let v = 0; for (let j = 0; j < k; j++) v += col[j] * m[i][j]; if (v > hi) hi = v }
  return { row, col, value: (lo + hi) / 2 }
}

function sample(p: number[], rng: Rng): number {
  const r = rng()
  let acc = 0
  for (let i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return i }
  return p.length - 1
}
const argmax = (a: number[]) => a.reduce((b, x, i) => (x > a[b] ? i : b), 0)
const argmin = (a: number[]) => a.reduce((b, x, i) => (x < a[b] ? i : b), 0)
const bestSlot = (t: Team) => argmax(t.cards.map((c) => threat(c) * 100 + c.three + c.drive))

/* ------------------------------------------------------------------ */
/* Coaches                                                              */
/* ------------------------------------------------------------------ */
/** `seen` = the opponent's calls in earlier quarters of this match (they are revealed at the end of each quarter). */
export type Coach = (me: Team, opp: Team, quarter: number, rng: Rng, seen?: Call[]) => Call
const cache = new WeakMap<Team, WeakMap<Team, Map<number, number[][]>>>()
function matrix(off: Team, def: Team, quarter: number): number[][] {
  const q = quarter >= 4 ? 4 : 1 // only the 4th quarter differs (Closer)
  let a = cache.get(off); if (!a) cache.set(off, (a = new WeakMap()))
  let b = a.get(def); if (!b) a.set(def, (b = new Map()))
  let m = b.get(q); if (!m) b.set(q, (m = pppMatrix(off, def, q)))
  return m
}
const solved = new WeakMap<number[][], ReturnType<typeof solveGame>>()
function solve(m: number[][]) {
  let s = solved.get(m); if (!s) solved.set(m, (s = solveGame(m)))
  return s
}

export const COACHES: Record<string, Coach> = {
  /** Never makes a read: Move the Ball + Straight Up. */
  plain: () => ({ off: 0, def: 0 }),
  /** Picks any of the 8 x 8 calls at random. */
  random: (_m, _o, _q, rng) => ({ off: Math.floor(rng() * N_CALLS), def: Math.floor(rng() * N_CALLS) }),
  /** Mixes calls in the unexploitable proportions for these two rosters. */
  sharp: (me, opp, q, rng) => ({
    off: sample(solve(matrix(me, opp, q)).row, rng),
    def: sample(solve(matrix(opp, me, q)).col, rng),
  }),
  /** Best response to an opponent who plays plain. Strong against plain, readable by anyone else. */
  greedy: (me, opp, q) => ({
    off: argmax(matrix(me, opp, q).map((r) => r[0])),
    def: argmin(matrix(opp, me, q)[0]),
  }),
  /** Assumes the opponent repeats last quarter's calls and plays the best reply. Opens with the sharp mix. */
  reader: (me, opp, q, rng, seen) => {
    if (!seen || !seen.length) return COACHES.sharp(me, opp, q, rng)
    const last = seen[seen.length - 1]
    return { off: argmax(matrix(me, opp, q).map((r) => r[last.def])), def: argmin(matrix(opp, me, q)[last.off]) }
  },
  fly: () => ({ off: 1, def: 1 }),
  rim: () => ({ off: 2, def: 2 }),
  /** Always feeds its best scorer and shadows theirs. */
  star: (me, opp) => ({ off: 3 + bestSlot(me), def: 3 + bestSlot(opp) }),
  flyPaint: () => ({ off: 1, def: 2 }),
  rimLine: () => ({ off: 2, def: 1 }),
}

/* ------------------------------------------------------------------ */
/* Team evaluation used by the thinking drafters                        */
/* ------------------------------------------------------------------ */
const filler = (position: 'G' | 'F' | 'C', three = 7, drive = 8, def = 7): Card =>
  ({ id: `filler-${position}`, name: 'Average', position, three, drive, def, cost: 3, tier: 'starter', traits: [] })
export const REF_CARDS: Card[] = [filler('G'), filler('G'), filler('F'), filler('F'), filler('C')]
export const REF: Team = (() => {
  const t = buildTeam(REF_CARDS)
  t.chem = { ...t.chem, total: 5 }
  return t
})()

/** Expected points margin per possession against `opp` when both coaches mix sharply. */
export function power(team: Team, opp: Team = REF): number {
  return solveGame(pppMatrix(team, opp, 1), 200).value - solveGame(pppMatrix(opp, team, 1), 200).value
}
const powerCache = new Map<string, number>()
function cachedPower(cards: Card[], oppCards: Card[] | null): number {
  const key = cards.map((c) => c.id).sort().join(',') + '|' + (oppCards ? oppCards.map((c) => c.id).join(',') : '')
  let v = powerCache.get(key)
  if (v === undefined) {
    if (powerCache.size > 200000) powerCache.clear()
    v = power(buildTeam(cards), oppCards ? padded(oppCards) : REF)
    powerCache.set(key, v)
  }
  return v
}

/** Cheap stand-in for power(): per-card worth (measured once, in an average lineup) + chemistry. */
let worthCache: Map<string, number> | null = null
let chemWorth = 0
export function initWorth(all: readonly Card[]): Map<string, number> {
  const base = power(REF)
  const m = new Map<string, number>()
  for (const c of all) {
    const five = REF_CARDS.slice()
    five[c.position === 'G' ? 0 : c.position === 'F' ? 2 : 4] = { ...c, traits: [], m: undefined }
    const t = buildTeam(five)
    t.chem = { ...t.chem, total: 5 }
    m.set(c.id, power(t) - base)
  }
  m.set(WALK_ON.id, -0.12)
  const up = buildTeam(REF_CARDS)
  up.chem = { ...up.chem, total: 6 }
  chemWorth = power(up) - base
  worthCache = m
  return m
}
export const getChemWorth = () => chemWorth
function quick(cards: Card[]): number {
  let s = 0
  for (const c of cards) s += worthCache!.get(c.id) ?? 0
  return s + chemWorth * computeChem(cards).total
}

/** All ways to finish `roster` from `avail` within `budget`, scored. Calls back for each. */
function eachCompletion(roster: Card[], avail: Card[], budget: number, fn: (team: Card[]) => void): void {
  const need = K.TEAM - roster.length
  const cur = roster.slice()
  const rec = (start: number, left: number, money: number) => {
    if (left === 0) { fn(cur); return }
    for (let i = start; i <= avail.length - left; i++) {
      const c = avail[i]
      if (c.cost > money - (left - 1)) continue
      cur.push(c)
      rec(i + 1, left - 1, money - c.cost)
      cur.pop()
    }
  }
  rec(0, need, budget)
}

function bestBy(roster: Card[], avail: Card[], budget: number, score: (t: Card[]) => number, keep = 1): { team: Card[]; score: number }[] {
  const top: { team: Card[]; score: number }[] = []
  eachCompletion(roster, avail, budget, (t) => {
    const s = score(t)
    if (top.length < keep) { top.push({ team: t.slice(), score: s }); top.sort((a, b) => b.score - a.score) }
    else if (s > top[keep - 1].score) { top[keep - 1] = { team: t.slice(), score: s }; top.sort((a, b) => b.score - a.score) }
  })
  return top
}

/* ------------------------------------------------------------------ */
/* Drafters                                                             */
/* ------------------------------------------------------------------ */
export type Drafter = (d: DraftState, seat: 0 | 1, rng: Rng) => Card | null
const sum = (c: Card) => c.three + c.drive + c.def

/** Take the legal card that maximises `key`, one pick at a time, no planning. */
const greedyBy = (key: (c: Card, roster: Card[]) => number): Drafter => (d, seat) => {
  const legal = legalPicks(d, seat)
  if (!legal.length) return null
  return legal.reduce((b, c) => (key(c, d.rosters[seat]) > key(b, d.rosters[seat]) ? c : b))
}

/** Plan the best finishing five by `score`, then take its scarcest card (the one it hurts most to lose). */
const planner = (score: (t: Card[], d: DraftState, seat: 0 | 1) => number, refine?: (t: Card[], d: DraftState, seat: 0 | 1) => number): Drafter =>
  (d, seat) => {
    const legal = legalPicks(d, seat)
    if (!legal.length) return null
    const roster = d.rosters[seat], budget = d.budget[seat]
    const sc = (t: Card[]) => score(t, d, seat)
    let top = bestBy(roster, d.available, budget, sc, refine ? 8 : 1)
    if (!top.length) return legal[0]
    if (refine) top = top.map((x) => ({ team: x.team, score: refine(x.team, d, seat) })).sort((a, b) => b.score - a.score)
    const target = top[0].team.filter((c) => !roster.includes(c))
    if (target.length === 1) return target[0]
    let pick = target[0], worst = Infinity
    for (const c of target) {
      const alt = bestBy(roster, d.available.filter((x) => x !== c), budget, sc, 1)
      const v = alt.length ? alt[0].score : -Infinity
      if (v < worst || (v === worst && c.cost > pick.cost)) { worst = v; pick = c }
    }
    return pick
  }

function padded(cards: Card[]): Team {
  const five = cards.slice()
  for (const p of ['C', 'G', 'F', 'G', 'F'] as const) {
    if (five.length >= K.TEAM) break
    const n = five.filter((c) => c.position === p).length
    if (n < (p === 'C' ? 1 : 2)) five.push(filler(p))
  }
  return buildTeam(five)
}

export const DRAFTERS: Record<string, Drafter> = {
  /** Picks any legal card at random. */
  random: (d, seat, rng) => { const l = legalPicks(d, seat); return l.length ? l[Math.floor(rng() * l.length)] : null },
  /** "Always take the highest total": biggest name the budget allows, every pick. */
  bigNames: greedyBy((c) => sum(c) * 10 + c.cost),
  /** Best individual ratings, no fit: the five with the highest rating total the budget can buy. */
  ratings: planner((t) => t.reduce((s, c) => s + sum(c), 0)),
  /** Chemistry above all, ratings as the tie-break. */
  chemistry: planner((t) => computeChem(t).total * 100 + t.reduce((s, c) => s + sum(c), 0)),
  /** Shooters only. */
  shooters: planner((t) => t.reduce((s, c) => s + c.three * 3 + c.def, 0)),
  /** Rim pressure only. */
  bullies: planner((t) => t.reduce((s, c) => s + c.drive * 3 + c.def, 0)),
  /** Defence only. */
  stoppers: planner((t) => t.reduce((s, c) => s + c.def * 3 + threat(c), 0)),
  /** One superstar to feed, then the best supporting cast for him. */
  heliocentric: (d, seat, rng) => {
    const roster = d.rosters[seat]
    if (!roster.length) {
      const stars = legalPicks(d, seat).filter((c) => c.ability)
      if (stars.length) return stars.reduce((b, c) => (threat(c) * 10 + sum(c) > threat(b) * 10 + sum(b) ? c : b))
    }
    return DRAFTERS.builder(d, seat, rng)
  },
  /** The skilled GM: ratings + chemistry + fit, judged as a whole five against an average opponent. */
  builder: planner((t) => quick(t), (t) => cachedPower(t, null)),
  /** The skilled GM who also drafts against the roster the opponent is actually building. */
  counter: planner((t) => quick(t), (t, d, seat) => {
    const opp = d.rosters[1 - seat]
    return cachedPower(t, opp.length >= 2 ? opp : null)
  }),
}
