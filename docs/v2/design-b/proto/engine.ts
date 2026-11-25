/**
 * ISO v2 / design-b "COACH FIRST" rules engine. Pure and deterministic: every outcome is a function of
 * (seed, draft picks, per-run calls). No Math.random anywhere.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rngFromSeed } from './prng.ts'
import type { Rng } from './prng.ts'

export type Position = 'G' | 'F' | 'C'
export type Trait = 'Sniper' | 'Slasher' | 'Playmaker' | 'Lockdown' | 'Anchor' | 'Roller' | 'Glue' | 'Alpha'
export type Tier = 'elite' | 'star' | 'starter' | 'role'
export interface Card {
  id: string
  name: string
  position: Position
  three: number
  drive: number
  def: number
  cost: number
  tier: Tier
  traits: Trait[]
  ability: { id: string; name: string; text: string } | null
}

/* ------------------------------------------------------------------ */
/* Tunable constants (every number in rules.md lives here)             */
/* ------------------------------------------------------------------ */
export const CFG = {
  ROSTER_SIZE: 6,
  POOL_MIX: { elite: 3, star: 4, starter: 5, role: 4 } as Record<Tier, number>,
  CAP: 42,
  RUNS: 6,
  GOTO_SHOTS: 4, // go-to takes 4 of the 8 shots in a run, the other four take 1 each
  BASE_IN: 0.5, // make chance of an even Inside shot (2 points)
  SLOPE_IN: 0.03, // per bar point of edge
  BASE_OUT: 0.33, // make chance of an even Outside shot (3 points)
  SLOPE_OUT: 0.02,
  P_MIN: 0.05,
  P_MAX: 0.95,
  HELP: 4, // Guard bonus on every shot by the player you send help at
  WALL_RIGHT: 1, // Guard bonus on shots the wall covers
  WALL_TRAIT: 1, // extra per Anchor (paint wall) or Lockdown (arc wall) on the defending five
  WALL_TRAIT_MAX: 2,
  WALL_WRONG: 1, // Guard penalty on shots the wall does not cover
  TEAM_D: 0, // tested alternative (0.5 = half man, half team); 0 = off. Share of share of a defender's Guard that comes from his team's average Defence
  CHEM_DIV: 15, // every 15 chem = +1 to every Attack and every Guard
  // chemistry link rules
  L_KICK: 4, L_KICK_MAX: 12, // Slasher + Sniper
  L_PNR: 4, L_PNR_MAX: 8, // Playmaker + Roller
  L_LOCK: 4, L_LOCK_MAX: 8, // Lockdown + Anchor
  L_GLUE: 4, L_GLUE_MAX: 8, // Alpha + Glue
  L_ONEBALL: -8, // each Alpha after the second
  L_COMPLETE: 6, // a 10+ in each of the three bars somewhere on the roster
  FIT: 4, // per filled slot G,G,F,F,C
  // abilities
  A_GRAVITY: 2, A_CLAMP: 2, A_DOWNHILL_MAX: 3, A_WRONGFOOT: 2, A_NOFLY: 1, A_GENERAL: 2, A_RIMRUN: 2, A_FASTBREAK_MAX: 3, A_LATE: 3,
  ABILITIES_ON: true,
  MATCH_BY_RANK: false as boolean, // false = old rule: match up position by position
}

const here = dirname(fileURLToPath(import.meta.url))
export const CARDS: Card[] = JSON.parse(readFileSync(join(here, '..', 'cards.json'), 'utf8'))
export const ROOKIE: Card = { id: 'rookie', name: 'Rookie', position: 'F', three: 4, drive: 4, def: 4, cost: 0, tier: 'role', traits: [], ability: null }
const BY_ID = new Map<string, Card>(CARDS.map((c) => [c.id, c]))
/** Rookies are handed out as rookie-<seat>-<n> so every roster id stays unique. */
for (const s of [0, 1]) for (let n = 0; n < 6; n++) BY_ID.set(`rookie-${s}-${n}`, { ...ROOKIE, id: `rookie-${s}-${n}` })
export function card(id: string): Card {
  const c = BY_ID.get(id)
  if (!c) throw new Error(`unknown card ${id}`)
  return c
}
export const total = (c: Card) => c.three + c.drive + c.def
export const threat = (c: Card) => Math.max(c.three, c.drive)
const has = (c: Card, t: Trait) => c.traits.includes(t)

/* ------------------------------------------------------------------ */
/* Deal + draft                                                        */
/* ------------------------------------------------------------------ */
export function dealPool(seed: string): string[] {
  const rng = rngFromSeed(`${seed}|pool`)
  const out: string[] = []
  for (const tier of ['elite', 'star', 'starter', 'role'] as Tier[]) {
    const bag = CARDS.filter((c) => c.tier === tier).map((c) => c.id)
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const t = bag[i]; bag[i] = bag[j]; bag[j] = t
    }
    out.push(...bag.slice(0, CFG.POOL_MIX[tier]))
  }
  return out
}
/** Snake order: A B B A A B B A A B B A. 0 = first drafter. */
export const DRAFT_ORDER = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]
export const spent = (roster: string[]) => roster.reduce((s, id) => s + card(id).cost, 0)
/** Cards a seat may legally take now: anything left that fits under the cap. Empty => the seat receives a Rookie. */
export function legalPicks(pool: string[], roster: string[]): string[] {
  const left = CFG.CAP - spent(roster)
  return pool.filter((id) => card(id).cost <= left)
}

/* ------------------------------------------------------------------ */
/* Chemistry (roster level, fixed for the whole match)                 */
/* ------------------------------------------------------------------ */
export interface ChemBreakdown { kick: number; pnr: number; lock: number; glue: number; oneBall: number; complete: number; fit: number; total: number }
function pairs(cs: Card[], a: Trait, b: Trait): number {
  let n = 0
  for (let i = 0; i < cs.length; i++) for (let j = 0; j < cs.length; j++) if (i !== j && has(cs[i], a) && has(cs[j], b)) n++
  return n
}
export function chemistry(roster: string[]): ChemBreakdown {
  const cs = roster.map(card)
  const kick = Math.min(CFG.L_KICK_MAX, CFG.L_KICK * pairs(cs, 'Slasher', 'Sniper'))
  const pnr = Math.min(CFG.L_PNR_MAX, CFG.L_PNR * pairs(cs, 'Playmaker', 'Roller'))
  const lock = Math.min(CFG.L_LOCK_MAX, CFG.L_LOCK * pairs(cs, 'Lockdown', 'Anchor'))
  const alphas = cs.filter((c) => has(c, 'Alpha')).length
  const glue = Math.min(CFG.L_GLUE_MAX, CFG.L_GLUE * pairs(cs, 'Alpha', 'Glue'))
  const oneBall = alphas > 2 ? CFG.L_ONEBALL * (alphas - 2) : 0
  const complete = cs.some((c) => c.three >= 10) && cs.some((c) => c.drive >= 10) && cs.some((c) => c.def >= 10) ? CFG.L_COMPLETE : 0
  const n = (p: Position) => cs.filter((c) => c.position === p).length
  const fit = CFG.FIT * (Math.min(2, n('G')) + Math.min(2, n('F')) + Math.min(1, n('C')))
  return { kick, pnr, lock, glue, oneBall, complete, fit, total: kick + pnr + lock + glue + oneBall + complete + fit }
}
/** What the draft screen prints on an undrafted card: chem change and the slot it fills (or null). */
export function draftHint(roster: string[], id: string): { chem: number; fills: Position | null } {
  const before = chemistry(roster)
  const after = chemistry([...roster, id])
  return { chem: after.total - before.total, fills: after.fit > before.fit ? card(id).position : null }
}

/* ------------------------------------------------------------------ */
/* A run                                                               */
/* ------------------------------------------------------------------ */
export type Emph = 'IN' | 'OUT'
export type Wall = 'PAINT' | 'ARC'
export interface Call {
  /** Who rests this run (must not have rested yet in regulation). */
  sit: string
  /** Go-to player (must be on the floor) and how he attacks. */
  goTo: string
  emph: Emph
  /** Opposing player to send help at (any of their six; wasted if he is resting). */
  help: string
  wall: Wall
}

/** Five cards in slot order G,G,F,F,C. Natural positions first; leftovers fill the empty slots, biggest first. */
export function slotFive(floor: Card[], key: (c: Card) => number): Card[] {
  const srt = (a: Card, b: Card) => key(b) - key(a) || total(b) - total(a) || (a.id < b.id ? -1 : 1)
  const by: Record<Position, Card[]> = { G: [], F: [], C: [] }
  for (const c of floor) by[c.position].push(c)
  by.G.sort(srt); by.F.sort(srt); by.C.sort(srt)
  const slots: (Card | null)[] = [by.G[0] ?? null, by.G[1] ?? null, by.F[0] ?? null, by.F[1] ?? null, by.C[0] ?? null]
  const size: Record<Position, number> = { C: 0, F: 1, G: 2 }
  const left = [...by.C.slice(1), ...by.F.slice(2), ...by.G.slice(2)].sort((a, b) => size[a.position] - size[b.position] || srt(a, b))
  for (const i of [4, 3, 2, 1, 0]) if (!slots[i]) slots[i] = left.shift()!
  return slots as Card[]
}

/** Everything about one team's offence against one defence that does not depend on the calls. */
export interface Side {
  off: Card[] // slot order, most dangerous scorer first within a position
  def: Card[] // matched defenders, same index
  atkIn: number[]
  atkOut: number[]
  guard: number[]
  pref: (Emph | null)[] // shot a non go-to takes; null = equal bars, follows the go-to's emphasis
  curry: number // slot index or -1
  lebron: number
  sga: number
  lillardLate: number // slot index if Late Clock is live this run, else -1
  kawhiDef: boolean
  wallPaint: number // Guard bonus when the paint wall covers a shot
  wallArc: number
}
export function buildSide(offFloor: string[], defFloor: string[], offChem: number, defChem: number, run: number): Side {
  return buildSideCards(offFloor.map(card), defFloor.map(card), offChem, defChem, run)
}
export function buildSideCards(offCards: Card[], defCards: Card[], offChem: number, defChem: number, run: number): Side {
  // Matchups: their most dangerous scorer draws your best defender, and so on down the line.
  const rank = (key: (c: Card) => number) => (a: Card, b: Card) => key(b) - key(a) || total(b) - total(a) || (a.id < b.id ? -1 : 1)
  const off = CFG.MATCH_BY_RANK ? [...offCards].sort(rank(threat)) : slotFive(offCards, threat)
  const def = CFG.MATCH_BY_RANK ? [...defCards].sort(rank((c) => c.def)) : slotFive(defCards, (c) => c.def)
  const teamDef = def.reduce((s, c) => s + c.def, 0) / def.length
  const A = CFG.ABILITIES_ON
  const oc = offChem / CFG.CHEM_DIV
  const dc = defChem / CFG.CHEM_DIV
  const snipers = (me: Card) => off.filter((c) => c !== me && has(c, 'Sniper')).length
  const locks = (me: Card) => off.filter((c) => c !== me && has(c, 'Lockdown')).length
  const idx = (id: string) => (A ? off.findIndex((c) => c.id === id) : -1)
  return {
    off, def,
    atkIn: off.map((c) => {
      let a = c.drive + oc
      if (A && c.id === 'giannis') a += Math.min(CFG.A_DOWNHILL_MAX, snipers(c))
      if (A && c.id === 'morant') a += Math.min(CFG.A_FASTBREAK_MAX, locks(c))
      if (A && c.id === 'davis' && off.some((t) => t !== c && has(t, 'Playmaker'))) a += CFG.A_RIMRUN
      return a
    }),
    atkOut: off.map((c) => c.three + oc),
    guard: def.map((c) => (1 - CFG.TEAM_D) * c.def + CFG.TEAM_D * teamDef + dc),
    pref: off.map((c) => (c.drive > c.three ? 'IN' : c.three > c.drive ? 'OUT' : null)),
    curry: idx('curry'), lebron: idx('lebron'), sga: idx('sga'),
    lillardLate: run >= 5 ? idx('lillard') : -1,
    kawhiDef: A && def.some((c) => c.id === 'kawhi'),
    wallPaint: CFG.WALL_RIGHT + CFG.WALL_TRAIT * Math.min(CFG.WALL_TRAIT_MAX, def.filter((c) => has(c, 'Anchor')).length) + (A && def.some((c) => c.id === 'wemby') ? CFG.A_NOFLY : 0),
    wallArc: CFG.WALL_RIGHT + CFG.WALL_TRAIT * Math.min(CFG.WALL_TRAIT_MAX, def.filter((c) => has(c, 'Lockdown')).length),
  }
}

const clamp = (p: number) => (p < CFG.P_MIN ? CFG.P_MIN : p > CFG.P_MAX ? CFG.P_MAX : p)
/**
 * Make chance for shooter slot j. g = go-to slot, e = go-to emphasis, h = helped slot (-1 = help wasted
 * on a resting player), w = wall. Returns the chance and whether it is an Inside shot.
 */
export function shot(s: Side, j: number, g: number, e: Emph, h: number, w: Wall): { p: number; inside: boolean } {
  const isGo = j === g
  const type: Emph = isGo ? e : s.pref[j] ?? e
  const inside = type === 'IN'
  let atk = inside ? s.atkIn[j] : s.atkOut[j]
  let grd = s.guard[j]
  if (isGo) {
    if (s.curry >= 0 && s.curry !== g) atk += CFG.A_GRAVITY
    if (s.lillardLate === g && !inside) atk += CFG.A_LATE
  } else if (s.lebron === g) atk += CFG.A_GENERAL
  if (h === j) grd += CFG.HELP + (isGo && s.kawhiDef ? CFG.A_CLAMP : 0)
  const covered = (w === 'PAINT') === inside
  if (covered) grd += inside ? s.wallPaint : s.wallArc
  else {
    grd -= CFG.WALL_WRONG
    if (isGo && s.sga === g) atk += CFG.A_WRONGFOOT
  }
  const p = inside ? CFG.BASE_IN + CFG.SLOPE_IN * (atk - grd) : CFG.BASE_OUT + CFG.SLOPE_OUT * (atk - grd)
  return { p: clamp(p), inside }
}
/** Expected points of one run for the offence. */
export function expectedRun(s: Side, g: number, e: Emph, h: number, w: Wall): number {
  let ev = 0
  for (let j = 0; j < 5; j++) {
    const r = shot(s, j, g, e, h, w)
    ev += (j === g ? CFG.GOTO_SHOTS : 1) * r.p * (r.inside ? 2 : 3)
  }
  return ev
}
/** Payoff matrix: rows = offence (slot*2 + emph), cols = defence (helpSlot*2 + wall). */
export const N_OFF = 10
export const N_DEF = 10
export function payoff(s: Side): Float64Array {
  const m = new Float64Array(N_OFF * N_DEF)
  for (let o = 0; o < N_OFF; o++)
    for (let d = 0; d < N_DEF; d++) {
      m[o * N_DEF + d] = expectedRun(s, o >> 1, o & 1 ? 'OUT' : 'IN', d >> 1, d & 1 ? 'ARC' : 'PAINT')
    }
  return m
}

/* ------------------------------------------------------------------ */
/* Match                                                               */
/* ------------------------------------------------------------------ */
export interface ShotEvent { team: 0 | 1; shooter: string; defender: string; inside: boolean; goTo: boolean; helped: boolean; p: number; made: boolean; points: number }
export interface RunRecord { run: number; calls: [Call, Call]; floors: [string[], string[]]; points: [number, number]; expected: [number, number]; shots: ShotEvent[] }
export interface MatchState {
  seed: string
  rosters: [string[], string[]]
  chem: [number, number]
  rested: [string[], string[]]
  run: number // next run to play, 1-based
  score: [number, number]
  history: RunRecord[]
  winner: 0 | 1 | null
}
export function startMatch(seed: string, rosters: [string[], string[]]): MatchState {
  return { seed, rosters, chem: [chemistry(rosters[0]).total, chemistry(rosters[1]).total], rested: [[], []], run: 1, score: [0, 0], history: [], winner: null }
}
export function mustRestFrom(st: MatchState, seat: 0 | 1): string[] {
  if (st.run > CFG.RUNS) return [...st.rosters[seat]] // overtime: anyone may rest
  return st.rosters[seat].filter((id) => !st.rested[seat].includes(id))
}
export function validateCall(st: MatchState, seat: 0 | 1, c: Call): void {
  if (!mustRestFrom(st, seat).includes(c.sit)) throw new Error(`illegal rest ${c.sit}`)
  if (c.goTo === c.sit || !st.rosters[seat].includes(c.goTo)) throw new Error(`illegal go-to ${c.goTo}`)
  if (!st.rosters[seat === 0 ? 1 : 0].includes(c.help)) throw new Error(`illegal help ${c.help}`)
}
export function floorOf(roster: string[], sit: string): string[] {
  return roster.filter((id) => id !== sit)
}
/** Resolve one run from both secret calls. Mutates and returns the state. */
export function playRun(st: MatchState, calls: [Call, Call]): MatchState {
  if (st.winner !== null) throw new Error('match over')
  validateCall(st, 0, calls[0]); validateCall(st, 1, calls[1])
  const rng: Rng = rngFromSeed(`${st.seed}|run${st.run}`)
  const floors: [string[], string[]] = [floorOf(st.rosters[0], calls[0].sit), floorOf(st.rosters[1], calls[1].sit)]
  const sides = [buildSide(floors[0], floors[1], st.chem[0], st.chem[1], st.run), buildSide(floors[1], floors[0], st.chem[1], st.chem[0], st.run)]
  const plan = ([0, 1] as const).map((t) => {
    const s = sides[t]
    const dc = calls[t === 0 ? 1 : 0]
    const g = s.off.findIndex((c) => c.id === calls[t].goTo)
    const h = s.off.findIndex((c) => c.id === dc.help)
    // shot order: go-to, other, go-to, other ... so the go-to takes shots 1,3,5,7
    const others = [0, 1, 2, 3, 4].filter((j) => j !== g)
    const order: number[] = []
    for (let k = 0; k < 4; k++) { order.push(g); order.push(others[k]) }
    return { s, g, h, e: calls[t].emph, w: dc.wall, order }
  })
  const points: [number, number] = [0, 0]
  const shots: ShotEvent[] = []
  const first = (st.run + 1) % 2 as 0 | 1 // seat 0 has the ball first in odd runs
  for (let k = 0; k < 8; k++)
    for (const t of [first, first === 0 ? 1 : 0] as (0 | 1)[]) {
      const pl = plan[t]
      const j = pl.order[k]
      const r = shot(pl.s, j, pl.g, pl.e, pl.h, pl.w)
      const made = rng() < r.p
      const pts = made ? (r.inside ? 2 : 3) : 0
      points[t] += pts
      shots.push({ team: t, shooter: pl.s.off[j].id, defender: pl.s.def[j].id, inside: r.inside, goTo: j === pl.g, helped: pl.h === j, p: r.p, made, points: pts })
    }
  const expected: [number, number] = [expectedRun(plan[0].s, plan[0].g, plan[0].e, plan[0].h, plan[0].w), expectedRun(plan[1].s, plan[1].g, plan[1].e, plan[1].h, plan[1].w)]
  st.history.push({ run: st.run, calls, floors, points, expected, shots })
  st.score = [st.score[0] + points[0], st.score[1] + points[1]]
  if (st.run <= CFG.RUNS) { st.rested[0].push(calls[0].sit); st.rested[1].push(calls[1].sit) }
  st.run += 1
  if (st.run > CFG.RUNS && st.score[0] !== st.score[1]) st.winner = st.score[0] > st.score[1] ? 0 : 1
  return st
}
