/**
 * Bot brain. Every function here is a pure function of (public MatchState, seat, rand).
 * A MatchState never contains an uncommitted pick, so the bot cannot peek at the human's secret
 * choice: it only learns from revealed history. It reads the exact dice odds (shotOdds), which is
 * the same arithmetic a person can do at the table by looking at the two cards.
 */
import { abilityOf, abilitySpec } from './abilities'
import { playCard } from './deck'
import { fitScore, positionsOf, seatByPosition, SLOTS } from './positions'
import { dieStep, getCard } from './roster'
import {
  benchOf,
  currentOffenseSeat,
  legalShooters,
  LONG_RANGE,
  MAX_SHOTS_PER_QUARTER,
  otherSeat,
  previewPass,
  previewShot,
  QUARTERS,
  scoreProbability,
  shotOdds,
  shotPoints,
  subsLeft,
  TEAM_SIZE,
  UNCONTESTED_DIE,
  validateDefensePick,
  validateOffensePick,
} from './engine'
import type { DefensePick, MatchState, OffensePick, PlayCardId, Seat, ShotType, SubPick } from './types'

export type Rand = () => number

const SHOTS: readonly ShotType[] = ['THREE', 'DRIVE']

function softmaxSample<T>(items: readonly T[], scores: readonly number[], temperature: number, rand: Rand): T {
  const max = Math.max(...scores)
  const weights = scores.map((s) => Math.exp((s - max) / temperature))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** Points a card threatens against an average d8 defender, best shot only. */
function threat(cardId: string): number {
  const c = getCard(cardId)
  return Math.max(3 * scoreProbability(c.three, 8, LONG_RANGE), 2 * scoreProbability(c.drive, 8))
}

/* ------------------------------ draft ------------------------------ */

/** Rough card value: scoring, defence, passing, rebounding, and a little for having an ability. */
export function draftValue(cardId: string): number {
  const c = getCard(cardId)
  const three = 3 * scoreProbability(c.three, 8, LONG_RANGE)
  const drive = 2 * scoreProbability(c.drive, 8)
  const offense = Math.max(three, drive) + 0.25 * Math.min(three, drive)
  // Points denied per possession guarded against a typical d10 attack worth about 2.4.
  const defense = 2.4 * (1 - scoreProbability(10, c.def))
  return offense + defense + 0.08 * dieStep(c.pass) + 0.1 * dieStep(c.reb) + (abilityOf(cardId) ? 0.15 : 0)
}

function seatsCovered(ids: readonly string[]): number {
  return SLOTS.filter((p) => ids.some((id) => positionsOf(id).includes(p))).length
}

export function botDraftPick(state: MatchState, seat: Seat, rand: Rand): string {
  const available = state.draft.available
  if (available.length === 0) throw new Error('nothing to draft')
  const mine = state.draft.picks[seat]
  const before = seatsCovered(mine)
  const need = mine.length >= 3 ? 0.6 : 0.2
  const scores = available.map((id) => draftValue(id) + need * (seatsCovered([...mine, id]) - before))
  return softmaxSample(available, scores, 0.12, rand)
}

/* ------------------------------ lineup ----------------------------- */

function combos<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = []
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc])
      return
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i])
      walk(i + 1, acc)
      acc.pop()
    }
  }
  walk(0, [])
  return out
}

/**
 * Five to put on the floor, in seat order PG SG SF PF C. Used for the opening lineup and at every
 * quarter break: best value, players in seats printed on their card, a little noise so the bench plays.
 */
export function botLineup(state: MatchState, seat: Seat, rand: Rand): string[] {
  const roster = state.draft.picks[seat]
  let best: string[] = []
  let bestScore = Number.NEGATIVE_INFINITY
  for (const five of combos(roster, TEAM_SIZE)) {
    const seated = seatByPosition(five) as string[]
    let score = rand() * 0.5
    seated.forEach((id, slot) => {
      score += draftValue(id) - (fitScore(id, slot) === 0 ? 0.7 : 0)
    })
    if (score > bestScore) {
      bestScore = score
      best = seated
    }
  }
  return best
}

/* --------------------------- pattern tracker ----------------------- */

/**
 * What the other coach has shown so far, from revealed history only.
 *  shooterRank[r] = weight that the offence shoots with its r-th biggest threat on the floor.
 *  doubleRank[r]  = weight that the defence doubles the r-th biggest threat; doubleNone = plays straight up.
 */
export interface Tendencies {
  shooterRank: number[]
  doubleRank: number[]
  doubleNone: number
  /** Share of the offence's possessions with a pass / with a play card (with a mild prior). */
  passRate: number
  cardRate: number
}

function byThreat(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => threat(b) - threat(a) || a.localeCompare(b))
}

export function trackTendencies(state: MatchState, offenseSeat: Seat): Tendencies {
  const shooterRank = [1.7, 1.3, 0.9, 0.65, 0.45]
  const doubleRank = [1.5, 0.9, 0.5, 0.3, 0.2]
  let doubleNone = 1.6
  let passes = 1.2
  let cards = 1
  let n = 4
  for (const r of state.history) {
    if (r.offenseSeat !== offenseSeat) continue
    n += 1
    const order = byThreat(r.floor[offenseSeat])
    const sRank = order.indexOf(r.picks.offense.shooterId)
    if (sRank >= 0) shooterRank[sRank] += 1
    if (r.doubleId === null) doubleNone += 1
    else {
      const dRank = order.indexOf(r.doubleId)
      if (dRank >= 0) doubleRank[dRank] += 1
    }
    if (r.pass) passes += 1
    if (r.cards.offense) cards += 1
  }
  return { shooterRank, doubleRank, doubleNone, passRate: passes / n, cardRate: cards / n }
}

/* ------------------------------ offence ---------------------------- */

interface Scenario {
  /** Chance the defence doubles the shooter, somebody else, nobody. */
  onShooter: number
  elsewhere: number
  none: number
}

function doubleScenario(t: Tendencies, order: readonly string[], shooter: string): Scenario {
  const total = t.doubleNone + order.reduce((a, _, i) => a + (t.doubleRank[i] ?? 0.2), 0)
  const rank = order.indexOf(shooter)
  const onShooter = rank >= 0 ? (t.doubleRank[rank] ?? 0.2) / total : 0
  const none = t.doubleNone / total
  return { onShooter, none, elsewhere: Math.max(0, 1 - onShooter - none) }
}

/** Expected points of an offence pick against a double-team scenario. First shot only. */
function offenseEV(state: MatchState, seat: Seat, pick: OffensePick, sc: Scenario, floor: readonly string[]): number {
  const pts = shotPoints(pick.shot)
  const other = floor.find((id) => id !== pick.shooterId) ?? null
  const klay = floor.find((id) => abilitySpec(id, 'catchShoot') !== null && id !== pick.shooterId) ?? null
  const make = (doubleId: string | null, dime: boolean): number => {
    const plan = previewShot(state, seat, pick, { doubleId, dime })
    return plan ? shotOdds(plan).make : 0
  }
  const value = (dime: boolean): number => {
    let doubled = pts * make(pick.shooterId, dime)
    if (pick.cardId === 'kickout') {
      // the ball goes to the best three-point die for an open three
      let to: string | null = null
      for (const id of floor) if (id !== pick.shooterId && (!to || getCard(id).three > getCard(to).three)) to = id
      if (to) {
        const plan = previewShot(state, seat, { shooterId: to, shot: 'THREE', sub: pick.sub }, { doubleId: pick.shooterId })
        if (plan) doubled = 3 * shotOdds(plan).make
      }
    } else if (klay && (state.shots[seat][klay] ?? 0) < MAX_SHOTS_PER_QUARTER) {
      doubled = 3 * scoreProbability(getCard(klay).three, UNCONTESTED_DIE, LONG_RANGE)
    }
    const open = other ? pts * make(other, dime) : 0
    const straight = pts * make(null, dime)
    return sc.onShooter * doubled + sc.elsewhere * open + sc.none * straight
  }
  let ev: number
  const passer = pick.passerId ?? null
  if (passer) {
    const p = previewPass(state, seat, passer)
    if (!p) return -1
    const steal = Math.min(p.die, p.stealAt) / p.die
    const dime = Math.max(0, p.die - Math.max(p.dimeAt, p.stealAt + 1) + 1) / p.die
    ev = dime * value(true) + Math.max(0, 1 - steal - dime) * value(false)
  } else ev = value(false)
  if (pick.cardId === 'crash') ev += 0.3 * (1 - ev / pts)
  if (pick.cardId === 'timeout') ev += state.hands[seat].length <= 4 ? 0.4 : 0.05
  return ev
}

/** What holding a card is worth: cards get cheaper to spend as the game runs out. */
function cardCost(state: MatchState): number {
  if (state.overtime) return 0
  return state.quarter >= QUARTERS ? 0.12 : 0.3
}

function subCandidates(state: MatchState, seat: Seat): SubPick[] {
  if (!state.lineups || subsLeft(state, seat) <= 0) return []
  const floor = state.lineups[seat]
  const out: SubPick[] = []
  for (const inId of benchOf(state, seat)) {
    const special = abilitySpec(inId, 'catchShoot') !== null || abilitySpec(inId, 'sixthMan') !== null
    let best: SubPick | null = null
    let bestGain = special ? -0.4 : 0.05
    floor.forEach((outId, slot) => {
      if (fitScore(inId, slot) === 0 && !special) return
      const spent = (state.shots[seat][outId] ?? 0) >= MAX_SHOTS_PER_QUARTER
      // A player with no shots left only defends and rebounds for the rest of the quarter.
      const gain = draftValue(inId) - draftValue(outId) + (spent ? threat(outId) * 0.5 : 0) - (fitScore(inId, slot) === 0 ? 0.5 : 0)
      if (gain > bestGain) {
        bestGain = gain
        best = { out: outId, in: inId }
      }
    })
    if (best) out.push(best)
  }
  return out
}

export function botOffensePick(state: MatchState, seat: Seat, rand: Rand): OffensePick {
  const lineups = state.lineups
  if (!lineups || legalShooters(state, seat).length === 0) throw new Error('bot has no legal shooter')
  const t = trackTendencies(state, seat)
  const options: OffensePick[] = []
  const scores: number[] = []
  const floors: string[][] = []
  const consider = (pick: OffensePick, floor: string[], penalty: number) => {
    if (validateOffensePick(state, seat, pick) !== null) return
    const sc = doubleScenario(t, byThreat(floor), pick.shooterId)
    options.push(pick)
    floors.push(floor)
    scores.push(offenseEV(state, seat, pick, sc, floor) - penalty)
  }
  const subs: (SubPick | null)[] = [null, ...subCandidates(state, seat)]
  for (const sub of subs) {
    const floor = sub ? lineups[seat].map((id) => (id === sub.out ? sub.in : id)) : [...lineups[seat]]
    const subPenalty = sub ? (state.possession >= 6 || state.overtime ? 0.05 : 0.25) : 0
    // the best passer on the floor, if he is good enough to be worth the risk
    let passer: string | null = null
    for (const id of floor) if (id !== sub?.in && getCard(id).pass >= 8 && (!passer || getCard(id).pass > getCard(passer).pass)) passer = id
    for (const shooterId of floor) {
      if ((state.shots[seat][shooterId] ?? 0) >= MAX_SHOTS_PER_QUARTER) continue
      for (const shot of SHOTS) {
        consider({ shooterId, shot, passerId: null, cardId: null, sub }, floor, subPenalty)
        if (passer && passer !== shooterId) consider({ shooterId, shot, passerId: passer, cardId: null, sub }, floor, subPenalty)
      }
    }
  }
  if (options.length === 0) throw new Error('bot has no legal offence pick')
  // Try each card in hand on the three best plain options.
  const hand = [...new Set(state.hands[seat])].filter((id) => playCard(id).side !== 'defense')
  if (hand.length > 0) {
    const top = options.map((_, i) => i).sort((a, b) => scores[b] - scores[a]).slice(0, 3)
    const cost = cardCost(state)
    for (const i of top) {
      const subPenalty = options[i].sub ? (state.possession >= 6 || state.overtime ? 0.05 : 0.25) : 0
      for (const cardId of hand) consider({ ...options[i], cardId }, floors[i], subPenalty + cost)
    }
  }
  return softmaxSample(options, scores, 0.22, rand)
}

/* ------------------------------ defence ---------------------------- */

export function botDefensePick(state: MatchState, seat: Seat, rand: Rand): DefensePick {
  const lineups = state.lineups
  const offSeat = otherSeat(seat)
  if (!lineups) throw new Error('no lineups')
  const floor = lineups[offSeat]
  const legal = legalShooters(state, offSeat)
  if (legal.length === 0) return { doubleId: null, cardId: null, sub: null }
  const t = trackTendencies(state, offSeat)
  const order = byThreat(floor)
  const weight = (id: string) => t.shooterRank[order.indexOf(id)] ?? 0.4
  const total = legal.reduce((a, id) => a + weight(id), 0)
  const klay = floor.find((id) => abilitySpec(id, 'catchShoot') !== null) ?? null

  /** Best the offence can expect with shooter `s` when we double `d` and play `card`. */
  const best = (s: string, d: string | null, card: PlayCardId | null): { ev: number; shot: ShotType } => {
    let ev = -1
    let shot: ShotType = 'DRIVE'
    for (const sh of SHOTS) {
      let v: number
      if (d === s && klay && klay !== s && (state.shots[offSeat][klay] ?? 0) < MAX_SHOTS_PER_QUARTER) v = 3 * scoreProbability(getCard(klay).three, UNCONTESTED_DIE, LONG_RANGE)
      else {
        const plan = previewShot(state, offSeat, { shooterId: s, shot: sh }, { doubleId: d, defCard: card })
        v = plan ? shotPoints(sh) * shotOdds(plan).make : 0
      }
      if (v > ev) {
        ev = v
        shot = sh
      }
    }
    return { ev, shot }
  }
  const cost = (d: string | null, card: PlayCardId | null) => legal.reduce((a, s) => a + (weight(s) / total) * best(s, d, card).ev, 0)

  const doubles: (string | null)[] = [null, ...legal]
  const costs = doubles.map((d) => cost(d, null))
  const doubleId = softmaxSample(doubles, costs.map((c) => -c), 0.1, rand)
  const base = costs[doubles.indexOf(doubleId)]

  // One card, if it earns more than it is worth holding.
  let cardId: PlayCardId | null = null
  let bestGain = cardCost(state)
  for (const id of new Set(state.hands[seat])) {
    if (playCard(id).side === 'offense') continue
    let gain = 0
    if (id === 'closeout' || id === 'wallup' || id === 'zone') gain = base - cost(doubleId, id)
    else if (id === 'pickpocket') gain = t.passRate * 0.5
    else if (id === 'scout') gain = state.hands[offSeat].length > 0 ? t.cardRate * 0.9 : 0
    else if (id === 'crash') gain = 0.14
    else if (id === 'timeout') gain = state.hands[seat].length <= 4 ? 0.4 : 0.05
    gain += rand() * 0.06
    if (gain > bestGain) {
      bestGain = gain
      cardId = id
    }
  }
  const pick: DefensePick = { doubleId, cardId, sub: null }
  return validateDefensePick(state, seat, pick) === null ? pick : { doubleId, cardId: null, sub: null }
}

/** Convenience: whatever secret pick `seat` owes for the current possession. */
export function botPossessionPick(
  state: MatchState,
  seat: Seat,
  rand: Rand,
): { role: 'offense'; pick: OffensePick } | { role: 'defense'; pick: DefensePick } {
  if (currentOffenseSeat(state) === seat) return { role: 'offense', pick: botOffensePick(state, seat, rand) }
  return { role: 'defense', pick: botDefensePick(state, seat, rand) }
}

/* --------------------------- random-choice bot ---------------------- */

/** Baseline for balance numbers: a legal shooter and shot at random. No pass, no card, no sub. */
export function randomOffensePick(state: MatchState, seat: Seat, rand: Rand): OffensePick {
  const legal = legalShooters(state, seat)
  if (legal.length === 0) throw new Error('no legal shooter')
  return { shooterId: legal[Math.floor(rand() * legal.length)], shot: rand() < 0.5 ? 'THREE' : 'DRIVE', passerId: null, cardId: null, sub: null }
}

/** Baseline: double a random player on the floor, or nobody. No card, no sub. */
export function randomDefensePick(state: MatchState, seat: Seat, rand: Rand): DefensePick {
  const floor = state.lineups ? state.lineups[otherSeat(seat)] : []
  const i = Math.floor(rand() * (floor.length + 1))
  return { doubleId: i < floor.length ? floor[i] : null, cardId: null, sub: null }
}

/** Baseline lineup: the first five drafted, seated by position. Never changes. */
export function randomLineup(state: MatchState, seat: Seat): string[] {
  return seatByPosition(state.draft.picks[seat].slice(0, TEAM_SIZE)) as string[]
}
