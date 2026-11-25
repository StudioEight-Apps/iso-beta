/**
 * ISO v2, design A ("GM FIRST"): rules engine. Pure and deterministic: same seed + same choices = same game.
 * Run with `node file.ts` (Node 23.6+) or `npx tsx file.ts`. No dependencies.
 */
import { readFileSync } from 'node:fs'

/* ------------------------------------------------------------------ */
/* Seeded RNG (same algorithms as src/game/prng.ts)                     */
/* ------------------------------------------------------------------ */
export type Rng = () => number
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const rngFromSeed = (seed: string): Rng => mulberry32(hashSeed(seed))

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */
export type Pos = 'G' | 'F' | 'C' | 'X' // X = Walk-on, fits any slot
export type Trait = 'Sniper' | 'Slasher' | 'Playmaker' | 'Anchor' | 'Stopper' | 'Glue' | 'Ball-Dominant'
export type Tier = 'elite' | 'star' | 'starter' | 'role'
export interface Card {
  id: string
  name: string
  position: Pos
  /** SHOOT bar, 4..12 */
  three: number
  /** RIM bar, 4..12 */
  drive: number
  /** DEF bar, 4..12 */
  def: number
  /** Price in the draft, 1..8 */
  cost: number
  tier: Tier
  traits: Trait[]
  ability?: { id: string; name: string; text: string }
  /** internal: trait/position bits, filled lazily */
  m?: number
}

const HERE = new URL('.', import.meta.url)
export function loadCards(file = 'cards.json'): Card[] {
  return JSON.parse(readFileSync(new URL(file, HERE), 'utf8')).cards as Card[]
}
export const WALK_ON: Card = {
  id: 'walkon', name: 'Walk-on', position: 'X', three: 4, drive: 4, def: 4, cost: 0, tier: 'role', traits: [],
}

/* ------------------------------------------------------------------ */
/* Tunable constants (every number in rules.md lives here)              */
/* ------------------------------------------------------------------ */
export const K = {
  BUDGET: 17,
  TEAM: 5,
  POOL: { elite: 3, star: 5, starter: 5, role: 5 } as Record<Tier, number>,
  POOL_MIN: { G: 5, F: 5, C: 3 },
  /** Snake draft: A B B A A B B A A B */
  DRAFT_ORDER: [0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
  POSS_PER_QUARTER: 25, // per team
  QUARTERS: 4,
  OT_POSS: 10,
  MAX_OT: 3,
  // chemistry
  LINK: 3,
  GLUE: 2,
  ONE_BALL: -3,
  OUT_OF_POSITION: -2,
  CHEM_TO_RATING: 0.08, // rating points per chem point
  PLAY_YOUR_GAME: 1.8, // chem multiplier on Move the Ball / Straight Up
  // shot model
  THREE_BASE: 0.35, THREE_SLOPE: 0.025, THREE_MIN: 0.08, THREE_MAX: 0.65,
  RIM_BASE: 0.5, RIM_SLOPE: 0.03, RIM_MIN: 0.15, RIM_MAX: 0.85,
  // calls
  PLAN_SHIFT: 0.2, // Let It Fly / Attack the Rim shift in three-point share
  PLAN_BONUS: 1, // ...and the rating bonus on that kind of shot
  ANCHOR: 0.35, // share of rim defence that comes from the centre slot
  FEED_MULT: 3,
  TAKE_AWAY: 3, // Guard the Line / Protect the Paint penalty
  GIVE_UP: 2, // ...and what it concedes on the other shot
  SHADOW: 4,
  SHADOW_OPEN: 1.5,
}

/* ------------------------------------------------------------------ */
/* Team building: slots, matchups, chemistry                            */
/* ------------------------------------------------------------------ */
export interface Chem {
  total: number
  driveKick: boolean
  pickRoll: boolean
  lockdown: boolean
  spacing: boolean
  glue: boolean
  ballDominant: number
  outOfPosition: number
}
export interface Team {
  /** Slot order: G, G, F, F, C */
  cards: Card[]
  chem: Chem
  /** card index by matchup rank: [G#1, G#2, F#1, F#2, C]; offence ranks by scoring threat */
  offOrder: number[]
  /** same, ranked by DEF: best defender in a position group guards the other side's top threat there */
  defOrder: number[]
  abil: Set<string>
  cIsAnchor: boolean
}

const has = (c: Card, t: Trait) => c.traits.includes(t)
export const threat = (c: Card) => Math.max(c.three, c.drive)

const BIT: Record<string, number> = { Slasher: 1, Sniper: 2, Playmaker: 4, Anchor: 8, Stopper: 16, Glue: 32, 'Ball-Dominant': 64 }
function mask(k: Card): number {
  if (k.m !== undefined) return k.m
  let m = 0
  for (const t of k.traits) m |= BIT[t]
  if (k.three >= 8) m |= 128
  m |= k.position === 'G' ? 256 : k.position === 'F' ? 512 : k.position === 'C' ? 1024 : 2048
  return (k.m = m)
}

export function computeChem(cards: readonly Card[]): Chem {
  let sl = 0, sn = 0, pm = 0, an = 0, st = 0, gl = 0, bd = 0, sh = 0, g = 0, f = 0, c = 0, pmc = 0, x = 0
  for (const k of cards) {
    const m = mask(k)
    if (m & 1) sl++
    if (m & 2) sn++
    if (m & 4) pm++
    if (m & 8) an++
    if (m & 16) st++
    if (m & 32) gl++
    if (m & 64) bd++
    if (m & 128) sh++
    if (m & 256) g++
    else if (m & 512) f++
    else if (m & 1024) { c++; if (m & 4) pmc++ }
    else x++
  }
  const driveKick = sl > 0 && sn > 0
  const pickRoll = pm > 0 && c > 0 && pm + c - pmc >= 2
  const lockdown = st > 0 && an > 0
  const spacing = sh >= 3
  const glue = gl > 0
  const ballDominant = Math.max(0, bd - 1)
  // only a full five can be out of position; partial rosters are scored on what they have
  const natural = Math.min(g, 2) + Math.min(f, 2) + Math.min(c, 1)
  const outOfPosition = cards.length >= K.TEAM ? Math.max(0, K.TEAM - natural - x) : (Math.max(0, g - 2) + Math.max(0, f - 2) + Math.max(0, c - 1))
  const total =
    (driveKick ? K.LINK : 0) + (pickRoll ? K.LINK : 0) + (lockdown ? K.LINK : 0) + (spacing ? K.LINK : 0) +
    (glue ? K.GLUE : 0) + ballDominant * K.ONE_BALL + outOfPosition * K.OUT_OF_POSITION
  return { total, driveKick, pickRoll, lockdown, spacing, glue, ballDominant, outOfPosition }
}

/** Put five cards into slots G,G,F,F,C. Naturals first; leftovers (highest DEF first) fill empty slots C, F, G. */
export function assignSlots(cards: readonly Card[]): Card[] {
  const slots: (Card | null)[] = [null, null, null, null, null]
  const left: Card[] = []
  const byThreat = (a: Card, b: Card) => threat(b) - threat(a) || (b.three + b.drive) - (a.three + a.drive) || (a.id < b.id ? -1 : 1)
  const byDef = (a: Card, b: Card) => b.def - a.def || (a.id < b.id ? -1 : 1)
  const gs = cards.filter((c) => c.position === 'G').sort(byThreat)
  const fs = cards.filter((c) => c.position === 'F').sort(byThreat)
  const cs = cards.filter((c) => c.position === 'C').sort(byDef)
  gs.forEach((c, i) => (i < 2 ? (slots[i] = c) : left.push(c)))
  fs.forEach((c, i) => (i < 2 ? (slots[2 + i] = c) : left.push(c)))
  cs.forEach((c, i) => (i < 1 ? (slots[4] = c) : left.push(c)))
  left.sort(byDef)
  left.push(...cards.filter((c) => c.position === 'X'))
  for (const s of [4, 2, 3, 0, 1]) if (!slots[s]) slots[s] = left.shift() ?? WALK_ON
  return slots as Card[]
}

export function buildTeam(picked: readonly Card[]): Team {
  const five = picked.slice(0, K.TEAM)
  while (five.length < K.TEAM) five.push(WALK_ON)
  const cards = assignSlots(five)
  const rank = (a: number, b: number, key: (c: Card) => number) => {
    const d = key(cards[b]) - key(cards[a])
    return d > 0 || (d === 0 && cards[b].id < cards[a].id) ? [b, a] : [a, b]
  }
  const offKey = (c: Card) => threat(c) * 100 + c.three + c.drive
  const defKey = (c: Card) => c.def
  return {
    cards,
    chem: computeChem(cards),
    offOrder: [...rank(0, 1, offKey), ...rank(2, 3, offKey), 4],
    defOrder: [...rank(0, 1, defKey), ...rank(2, 3, defKey), 4],
    abil: new Set(cards.filter((c) => c.ability).map((c) => c.ability!.id)),
    cIsAnchor: has(cards[4], 'Anchor'),
  }
}

/** What the draft screen shows on an undrafted card: chem change and slot fit if you took it now. */
export function draftHint(roster: readonly Card[], card: Card): { chemDelta: number; fit: string; links: string[] } {
  const before = computeChem(roster)
  const after = computeChem([...roster, card])
  const links: string[] = []
  if (after.driveKick && !before.driveKick) links.push('Drive & Kick')
  if (after.pickRoll && !before.pickRoll) links.push('Pick & Roll')
  if (after.lockdown && !before.lockdown) links.push('Lockdown')
  if (after.spacing && !before.spacing) links.push('Spacing')
  if (after.glue && !before.glue) links.push('Glue Guy')
  if (after.ballDominant > before.ballDominant) links.push('One Ball (too many ball-dominant stars)')
  const n = roster.filter((c) => c.position === card.position).length
  const cap = card.position === 'C' ? 1 : 2
  const word = card.position === 'C' ? 'centre' : card.position === 'G' ? 'guard' : 'forward'
  const fit = n < cap ? `fills your ${word} slot` : 'out of position'
  return { chemDelta: after.total - before.total, fit, links }
}

/* ------------------------------------------------------------------ */
/* Coaching calls                                                       */
/* ------------------------------------------------------------------ */
/** Offence: 0 Move the Ball, 1 Let It Fly, 2 Attack the Rim, 3..7 Feed the player in slot (n-3). */
export type OffCall = number
/** Defence: 0 Straight Up, 1 Guard the Line, 2 Protect the Paint, 3..7 Shadow the opponent in slot (n-3). */
export type DefCall = number
export const N_CALLS = 8
export interface Call { off: OffCall; def: DefCall }
export function offCallName(c: OffCall, t: Team) {
  return c === 0 ? 'Move the Ball' : c === 1 ? 'Let It Fly' : c === 2 ? 'Attack the Rim' : `Feed ${t.cards[c - 3].name}`
}
export function defCallName(c: DefCall, opp: Team) {
  return c === 0 ? 'Straight Up' : c === 1 ? 'Guard the Line' : c === 2 ? 'Protect the Paint' : `Shadow ${opp.cards[c - 3].name}`
}

/* ------------------------------------------------------------------ */
/* Possession model                                                     */
/* ------------------------------------------------------------------ */
export interface ShotTable {
  /** cumulative probability that slot i takes the shot */
  cum: number[]
  share3: number[]
  p3: number[]
  p2: number[]
  /** expected points per possession */
  ppp: number
}
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x)

/** Everything that decides a possession, for one offence against one defence under one pair of calls. */
export function shotTable(off: Team, def: Team, oc: OffCall, dc: DefCall, quarter: number): ShotTable {
  const chemO = off.chem.total * K.CHEM_TO_RATING * (oc === 0 ? K.PLAY_YOUR_GAME : 1)
  const chemD = def.chem.total * K.CHEM_TO_RATING * (dc === 0 ? K.PLAY_YOUR_GAME : 1)
  const fed = oc >= 3 ? oc - 3 : -1
  const shadowed = dc >= 3 ? dc - 3 : -1
  const anchorDef = def.cards[4].def
  const w: number[] = [], share3: number[] = [], p3: number[] = [], p2: number[] = []
  let wsum = 0
  for (let rankIdx = 0; rankIdx < 5; rankIdx++) {
    const i = off.offOrder[rankIdx]
    const j = def.defOrder[rankIdx]
    const me = off.cards[i]
    const him = def.cards[j]
    const a = me.ability?.id
    let S = me.three + chemO
    let R = me.drive + chemO
    const Dp = him.def + chemD
    const Dr = (1 - K.ANCHOR) * him.def + K.ANCHOR * anchorDef + chemD
    // offensive plan
    if (oc === 1) S += K.PLAN_BONUS
    else if (oc === 2) R += K.PLAN_BONUS
    // defensive call
    if (dc === 1) { S -= K.TAKE_AWAY; R += K.GIVE_UP }
    else if (dc === 2) { R -= K.TAKE_AWAY; S += K.GIVE_UP }
    else if (shadowed >= 0) {
      if (i === shadowed) { const pen = K.SHADOW + (def.abil.has('clamp') ? 2 : 0); S -= pen; R -= pen }
      else { S += K.SHADOW_OPEN; R += K.SHADOW_OPEN }
    }
    // offensive abilities
    if (off.abil.has('gravity') && oc === 1 && a !== 'gravity') S += 2
    if (a === 'closer' && quarter >= 4) S += 3
    if (a === 'runway' && off.chem.spacing) R += 2
    if (a === 'iso' && fed === i) R += 2
    if (off.abil.has('maestro') && fed >= 0 && off.cards[fed].ability?.id === 'maestro' && a !== 'maestro') S += 2
    if (off.abil.has('pointforward') && oc === 0 && a !== 'pointforward') { S += 1; R += 1 }
    if (a === 'abovetherim' && !def.cIsAnchor) R += 2
    if (off.abil.has('hub') && off.chem.driveKick && a !== 'hub') { S += 1; R += 1 }
    if (a === 'costar' && fed >= 0 && fed !== i) { S += 2; R += 2 }
    if (a === 'postup' && oc === 2) R += 2
    // defensive abilities
    if (def.abil.has('eraser') && dc === 2) R -= 2
    if (def.abil.has('backline') && def.chem.lockdown) R -= 1.5
    let wt = threat(me) * threat(me)
    if (fed === i) wt *= K.FEED_MULT
    const base3 = (me.three * me.three) / (me.three * me.three + me.drive * me.drive)
    w[i] = wt
    wsum += wt
    share3[i] = clamp(base3 + (oc === 1 ? K.PLAN_SHIFT : oc === 2 ? -K.PLAN_SHIFT : 0), 0.05, 0.95)
    p3[i] = clamp(K.THREE_BASE + K.THREE_SLOPE * (S - Dp), K.THREE_MIN, K.THREE_MAX)
    p2[i] = clamp(K.RIM_BASE + K.RIM_SLOPE * (R - Dr), K.RIM_MIN, K.RIM_MAX)
  }
  const cum: number[] = []
  let acc = 0, ppp = 0
  for (let i = 0; i < 5; i++) {
    const pr = w[i] / wsum
    acc += pr
    cum[i] = acc
    ppp += pr * (share3[i] * p3[i] * 3 + (1 - share3[i]) * p2[i] * 2)
  }
  cum[4] = 1
  return { cum, share3, p3, p2, ppp }
}

export interface Possession {
  quarter: number
  seat: 0 | 1
  shooter: number // slot index in the offence's team.cards
  three: boolean
  made: boolean
  points: number
  score: [number, number]
}

function playPossession(t: ShotTable, rng: Rng): { shooter: number; three: boolean; made: boolean } {
  const r = rng()
  let s = 0
  while (r >= t.cum[s]) s++
  const three = rng() < t.share3[s]
  const made = rng() < (three ? t.p3[s] : t.p2[s])
  return { shooter: s, three, made }
}

export interface MatchResult {
  score: [number, number]
  winner: 0 | 1
  quarters: [number, number][]
  overtimes: number
  decidedByTiebreak: boolean
  log: Possession[]
}

/**
 * Simulate a whole game. calls[q][seat] are the secret calls for quarter q (0..3); overtime reuses quarter 4's.
 * `secondDrafter` only matters if three overtimes cannot split the teams.
 */
export function simulateMatch(
  seed: string, teams: [Team, Team], calls: [Call, Call][], secondDrafter: 0 | 1 = 1, keepLog = false,
): MatchResult {
  const score: [number, number] = [0, 0]
  const quarters: [number, number][] = []
  const log: Possession[] = []
  const period = (label: string, q: number, c: [Call, Call], n: number) => {
    const rng = rngFromSeed(`${seed}|${label}`)
    const tabs = [shotTable(teams[0], teams[1], c[0].off, c[1].def, q), shotTable(teams[1], teams[0], c[1].off, c[0].def, q)]
    const before: [number, number] = [score[0], score[1]]
    const first = q % 2 === 1 ? 0 : 1
    for (let i = 0; i < n * 2; i++) {
      const seat = (i % 2 === 0 ? first : 1 - first) as 0 | 1
      const p = playPossession(tabs[seat], rng)
      const pts = p.made ? (p.three ? 3 : 2) : 0
      score[seat] += pts
      if (keepLog) log.push({ quarter: q, seat, ...p, points: pts, score: [score[0], score[1]] })
    }
    quarters.push([score[0] - before[0], score[1] - before[1]])
  }
  for (let q = 1; q <= K.QUARTERS; q++) period(`q${q}`, q, calls[q - 1], K.POSS_PER_QUARTER)
  let overtimes = 0
  while (score[0] === score[1] && overtimes < K.MAX_OT) {
    overtimes++
    period(`ot${overtimes}`, K.QUARTERS + overtimes, calls[K.QUARTERS - 1], K.OT_POSS)
  }
  let winner: 0 | 1
  let decidedByTiebreak = false
  if (score[0] !== score[1]) winner = score[0] > score[1] ? 0 : 1
  else {
    decidedByTiebreak = true
    const c0 = teams[0].chem.total, c1 = teams[1].chem.total
    winner = c0 !== c1 ? (c0 > c1 ? 0 : 1) : secondDrafter
  }
  return { score, winner, quarters, overtimes, decidedByTiebreak, log }
}

/* ------------------------------------------------------------------ */
/* Deal and draft                                                       */
/* ------------------------------------------------------------------ */
export function dealPool(seed: string, all: readonly Card[]): Card[] {
  const rng = rngFromSeed(`${seed}|pool`)
  for (;;) {
    const out: Card[] = []
    for (const tier of ['elite', 'star', 'starter', 'role'] as const) {
      const bag = all.filter((c) => c.tier === tier)
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const t = bag[i]; bag[i] = bag[j]; bag[j] = t
      }
      out.push(...bag.slice(0, K.POOL[tier]))
    }
    const n = (p: Pos) => out.filter((c) => c.position === p).length
    if (n('G') >= K.POOL_MIN.G && n('F') >= K.POOL_MIN.F && n('C') >= K.POOL_MIN.C) return out
  }
}

export interface DraftState {
  available: Card[]
  rosters: [Card[], Card[]]
  budget: [number, number]
  pick: number
  firstDrafter: 0 | 1
}
export function newDraft(seed: string, all: readonly Card[]): DraftState {
  return {
    available: dealPool(seed, all),
    rosters: [[], []],
    budget: [K.BUDGET, K.BUDGET],
    pick: 0,
    firstDrafter: rngFromSeed(`${seed}|coinflip`)() < 0.5 ? 0 : 1,
  }
}
export function seatOnClock(d: DraftState): 0 | 1 {
  return (K.DRAFT_ORDER[d.pick] === 0 ? d.firstDrafter : 1 - d.firstDrafter) as 0 | 1
}
/** You must always keep 1 budget for every slot you still have to fill after this pick. */
export function legalPicks(d: DraftState, seat: 0 | 1): Card[] {
  const slotsAfter = K.TEAM - d.rosters[seat].length - 1
  return d.available.filter((c) => c.cost <= d.budget[seat] - slotsAfter)
}
/** Apply a pick. Pass null only when legalPicks() is empty: the seat gets a Walk-on. */
export function applyPick(d: DraftState, card: Card | null): void {
  const seat = seatOnClock(d)
  if (card) {
    if (!legalPicks(d, seat).includes(card)) throw new Error(`illegal pick ${card.id}`)
    d.available = d.available.filter((c) => c !== card)
    d.rosters[seat].push(card)
    d.budget[seat] -= card.cost
  } else {
    if (legalPicks(d, seat).length) throw new Error('a legal card exists')
    d.rosters[seat].push(WALK_ON)
  }
  d.pick++
}
export const draftDone = (d: DraftState) => d.pick >= K.DRAFT_ORDER.length

/** Tuning hook for experiments only: ISO_K='{"PLAN_BONUS":1}' node experiments.ts ... */
if (typeof process !== 'undefined' && process.env.ISO_K) Object.assign(K, JSON.parse(process.env.ISO_K))
