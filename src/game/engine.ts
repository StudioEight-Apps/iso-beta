/**
 * ISO v3 engine. Pure and deterministic: (seed, events) -> MatchState.
 * Every outcome is dice rolled once per contest plus card text. No simulations, no percentages,
 * no decimals. Online the dice come from the seeded PRNG; at a table they are real dice
 * (resolvePossessionWithDice takes the faces you rolled).
 */
import { abilityOf, abilitySpec } from './abilities'
import { hasLink, teamChem } from './chem'
import { cardFitsRole, DRAW_PER_BREAK, HAND_LIMIT, isPlayCardId, playCard, shuffledDeck, STARTING_HAND } from './deck'
import { fitScore, SLOTS } from './positions'
import { rngFromSeed, rollDie } from './prng'
import { dealPool, findCard, getCard } from './roster'
import type {
  BoxLine,
  Contest,
  ContestKind,
  DefensePick,
  DieRoll,
  DieSize,
  MatchEvent,
  MatchState,
  Modifier,
  ModSource,
  OffensePick,
  PassResult,
  PlayCardId,
  PlayedCard,
  PossessionResult,
  ReboundResult,
  RevealStep,
  Seat,
  ShotType,
  StatCredit,
  SubPick,
} from './types'

export const TEAM_SIZE = 5
export const ROSTER_SIZE = 7
export const BENCH_SIZE = ROSTER_SIZE - TEAM_SIZE
export const QUARTERS = 4
export const POSSESSIONS_PER_SIDE = 5
export const POSSESSIONS_PER_QUARTER = POSSESSIONS_PER_SIDE * 2
/** Usage rule: nobody takes more than this many shots in a quarter (putbacks are free). */
export const MAX_SHOTS_PER_QUARTER = 2
/** Mid-quarter substitutions each coach may call per quarter. */
export const SUBS_PER_QUARTER = 1
export const HELP_DIE: DieSize = 6
/** Threes are long shots: the defence adds this against every three. */
export const LONG_RANGE = 2
/** Bonus for the shooter when the double team went to somebody else. */
export const OPEN_LOOK = 2
/** Shot bonus from a dime. */
export const DIME_BONUS = 2
/** A pass is a dime on this face or higher. */
export const DIME_AT = 5
/** A pass is stolen on this face or lower. */
export const STEAL_AT = 1
/** The defence wins by this much: block on a drive, steal on a three. */
export const STUFF_MARGIN = 5
/** Inside position: the defence adds this to its rebound roll. */
export const BOX_OUT = 2
/** The die the defence rolls against an uncontested shot. */
export const UNCONTESTED_DIE: DieSize = 4
/** Seat penalty: a player in a seat that is not printed on his card. */
export const OUT_OF_POSITION = -1

/** One pick at a time, alternating. 0 = the coin-flip winner, 1 = the other coach. */
export const DRAFT_ORDER: readonly (0 | 1)[] = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
export const TOTAL_PICKS = DRAFT_ORDER.length

export function otherSeat(seat: Seat): Seat {
  return seat === 0 ? 1 : 0
}

export function shotPoints(shot: ShotType): number {
  return shot === 'THREE' ? 3 : 2
}

export function shotDie(cardId: string, shot: ShotType): DieSize {
  const card = getCard(cardId)
  return shot === 'THREE' ? card.three : card.drive
}

/** New match. The coin flip and the deck order come from the seed; the state starts in 'draft'. */
export function createMatch(seed: string): MatchState {
  const firstDrafter: Seat = rngFromSeed(`${seed}|coinflip`)() < 0.5 ? 0 : 1
  return {
    version: 3,
    seed,
    phase: 'draft',
    firstDrafter,
    draft: { available: dealPool(seed), picks: [[], []], pickNumber: 0 },
    lineups: null,
    quarter: 0,
    overtime: false,
    possession: 0,
    possessionsInQuarter: 0,
    shots: [{}, {}],
    subsUsed: [0, 0],
    deck: shuffledDeck(seed),
    hands: [[], []],
    discard: [],
    score: [0, 0],
    history: [],
    winner: null,
  }
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/** Seat that makes pick number `pickNumber` (0-based), or null if out of range. */
export function draftSeatAt(state: MatchState, pickNumber: number): Seat | null {
  const slot = DRAFT_ORDER[pickNumber]
  if (slot === undefined) return null
  return slot === 0 ? state.firstDrafter : otherSeat(state.firstDrafter)
}

/** Seat on the clock in the draft, or null when not drafting. */
export function whoseDraftTurn(state: MatchState): Seat | null {
  if (state.phase !== 'draft') return null
  return draftSeatAt(state, state.draft.pickNumber)
}

/**
 * Seat with the first possession of `quarter` (1-based; overtime pairs continue the count).
 * The coach who drafted SECOND opens the 1st quarter, then it alternates every quarter.
 */
export function firstOffenseSeatOfQuarter(state: MatchState, quarter: number): Seat {
  const second = otherSeat(state.firstDrafter)
  return quarter % 2 === 1 ? second : state.firstDrafter
}

/** Seat on offence for the next possession, or null outside the play phase. */
export function currentOffenseSeat(state: MatchState): Seat | null {
  if (state.phase !== 'play') return null
  const first = firstOffenseSeatOfQuarter(state, state.quarter)
  return state.possession % 2 === 0 ? first : otherSeat(first)
}

export function currentDefenseSeat(state: MatchState): Seat | null {
  const offense = currentOffenseSeat(state)
  return offense === null ? null : otherSeat(offense)
}

/** All seven cards a seat drafted. */
export function rosterOf(state: MatchState, seat: Seat): string[] {
  return [...state.draft.picks[seat]]
}

/** The two cards not on the floor (empty before lineups). */
export function benchOf(state: MatchState, seat: Seat): string[] {
  if (!state.lineups) return []
  const floor = state.lineups[seat]
  return state.draft.picks[seat].filter((id) => !floor.includes(id))
}

export function handOf(state: MatchState, seat: Seat): PlayCardId[] {
  return [...state.hands[seat]]
}

/** Shots `cardId` may still take this quarter. */
export function shotsLeft(state: MatchState, seat: Seat, cardId: string): number {
  return Math.max(0, MAX_SHOTS_PER_QUARTER - (state.shots[seat][cardId] ?? 0))
}

/** Players on the floor who may still shoot this quarter (seat order). Empty outside play. */
export function legalShooters(state: MatchState, seat: Seat): string[] {
  if (state.phase !== 'play' || !state.lineups) return []
  return state.lineups[seat].filter((id) => shotsLeft(state, seat, id) > 0)
}

/** Players the defence may double when `offenseSeat` has the ball: anyone on that roster (a sub may be coming). */
export function legalDoubles(state: MatchState, offenseSeat: Seat): string[] {
  if (state.phase !== 'play' || !state.lineups) return []
  return rosterOf(state, offenseSeat)
}

/** Mid-quarter substitutions `seat` may still call this quarter. */
export function subsLeft(state: MatchState, seat: Seat): number {
  if (state.phase !== 'play') return 0
  return Math.max(0, SUBS_PER_QUARTER - state.subsUsed[seat])
}

export function isGameOver(state: MatchState): boolean {
  return state.phase === 'gameover'
}

/** Which seat owns a drafted card, or null. */
export function seatOfCard(state: MatchState, cardId: string): Seat | null {
  if (state.draft.picks[0].includes(cardId)) return 0
  if (state.draft.picks[1].includes(cardId)) return 1
  return null
}

/** 0-based seat (PG..C) of a card on the floor, or -1. */
export function slotOf(state: MatchState, cardId: string): number {
  if (!state.lineups) return -1
  const a = state.lineups[0].indexOf(cardId)
  return a >= 0 ? a : state.lineups[1].indexOf(cardId)
}

/** The card guarding `cardId` (same seat, other team), or null when either is not on the floor. */
export function matchupOf(state: MatchState, cardId: string): string | null {
  if (!state.lineups) return null
  const seat = seatOfCard(state, cardId)
  if (seat === null) return null
  const slot = state.lineups[seat].indexOf(cardId)
  if (slot < 0) return null
  return state.lineups[otherSeat(seat)][slot] ?? null
}

export function lastResult(state: MatchState): PossessionResult | null {
  return state.history.length > 0 ? state.history[state.history.length - 1] : null
}

/** Possessions each seat still has on offence in the current quarter. */
export function possessionsLeftInQuarter(state: MatchState): [number, number] {
  if (state.phase !== 'play') return [0, 0]
  const perSide = state.possessionsInQuarter / 2
  const out: [number, number] = [perSide, perSide]
  const first = firstOffenseSeatOfQuarter(state, state.quarter)
  for (let i = 0; i < state.possession; i++) out[i % 2 === 0 ? first : otherSeat(first)] -= 1
  return out
}

/** The last possession `seat` had the ball, or null. */
function lastOwnPossession(state: MatchState, seat: Seat): PossessionResult | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].offenseSeat === seat) return state.history[i]
  }
  return null
}

/** Did `cardId` score on his team's previous possession? (Heat Check card.) */
export function scoredLastPossession(state: MatchState, seat: Seat, cardId: string): boolean {
  const r = lastOwnPossession(state, seat)
  return !!r && r.contests.some((c) => c.shooter === cardId && c.outcome === 'made')
}

/** Did `cardId` make the last shot he took? (hot-hand abilities.) */
export function madeLastShot(state: MatchState, cardId: string): boolean {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const cs = state.history[i].contests
    for (let j = cs.length - 1; j >= 0; j--) if (cs[j].shooter === cardId) return cs[j].outcome === 'made'
  }
  return false
}

/** Exact chance one die beats another die plus `defBonus`, ties to the defence. Used for rough card values. */
export function scoreProbability(offenseDie: number, defenseDie: number, defBonus = 0): number {
  let wins = 0
  for (let o = 1; o <= offenseDie; o++) wins += Math.min(defenseDie, Math.max(0, o - 1 - defBonus))
  return wins / (offenseDie * defenseDie)
}

/* ------------------------------------------------------------------ */
/* Shot plan: what is rolled against what, before any die lands        */
/* ------------------------------------------------------------------ */

export interface ShotPlan {
  kind: ContestKind
  shooter: string
  shot: ShotType
  slot: number
  offenseSeat: Seat
  /** null on an uncontested shot. */
  defender: string | null
  uncontested: boolean
  doubled: boolean
  open: boolean
  offDie: DieSize
  /** Extra die added to the shot (Pick & Roll card). */
  offBonusDie: { die: DieSize; label: string } | null
  defDie: DieSize
  helpDie: DieSize | null
  /** Extra die added to the defence (Wall Up card). */
  defBonusDie: { die: DieSize; label: string } | null
  mods: Modifier[]
  /** A natural face this high on the shot die is automatically in. */
  autoMin: number | null
  /** Set when the shot is automatically in whatever is rolled (Alley-Oop on a dime). */
  autoAll: boolean
  autoLabel: string
  /** Reroll the shot die once when it shows this or lower (0 = no reroll). */
  rerollMax: number
  /** Auto stop when (shot die - DEF die) is between 0 and this. null = no clamp. */
  clampRange: number | null
  clampLabel: string
  /** Defence wins by this much: block (drive) or steal (three). */
  stuffMargin: number
  /** Who gets a block. */
  blockCredit: string | null
  /** Abilities written into this plan (shown if the shot is taken). */
  abilities: string[]
}

interface ShotContext {
  state: MatchState
  floor: [string[], string[]]
  offenseSeat: Seat
  kind: ContestKind
  shooter: string
  shot: ShotType
  mode: 'normal' | 'open' | 'uncontested' | 'putback'
  /** The double team in force (null when none, or ignored by Fast Break). */
  doubleId: string | null
  offCard: PlayCardId | null
  defCard: PlayCardId | null
  dimeBonus: number
  gotPass: boolean
  alleyOop: boolean
  /** Offence player subbed in on this play. */
  subbedIn: string | null
}

function buildPlan(ctx: ShotContext): ShotPlan {
  const { state, floor, offenseSeat, shooter, shot, mode } = ctx
  const defenseSeat = otherSeat(offenseSeat)
  const off = floor[offenseSeat]
  const def = floor[defenseSeat]
  const slot = off.indexOf(shooter)
  const uncontested = mode === 'uncontested'
  const defender = uncontested ? null : def[slot]
  const drive = shot === 'DRIVE'
  const cards = mode === 'normal' || mode === 'open'
  const offCard = cards || uncontested ? ctx.offCard : null
  const defCard = cards ? ctx.defCard : null
  const doubled = mode === 'normal' && ctx.doubleId === shooter
  const open = mode === 'open' || (mode === 'normal' && ctx.doubleId !== null && ctx.doubleId !== shooter && defCard !== 'zone')
  const mods: Modifier[] = []
  const abilities: string[] = []
  const add = (side: 'off' | 'def', label: string, value: number, source: ModSource, by?: string) => {
    if (!value) return
    mods.push({ side, label, value, source })
    if (by && !abilities.includes(by)) abilities.push(by)
  }

  // ---- offence ----
  if (open) add('off', 'Open look', OPEN_LOOK, 'rule')
  if (ctx.dimeBonus) add('off', 'Dime', ctx.dimeBonus, 'rule')
  if (fitScore(shooter, slot) === 0) add('off', `Out of position at ${SLOTS[slot]}`, OUT_OF_POSITION, 'rule')
  if (offCard === 'screen' && !drive) add('off', 'Off-Ball Screen', 2, 'card')
  if (offCard === 'fastbreak') add('off', 'Fast Break', 1, 'card')
  if (offCard === 'heatcheck') add('off', 'Heat Check', 3, 'card')
  if (drive && hasLink(teamChem(off), 'drivekick')) add('off', 'Drive & Kick', 1, 'chem')

  const a = abilityOf(shooter)
  let autoMin: number | null = null
  let rerollMax = 0
  let helpDie: DieSize | null = doubled ? HELP_DIE : null
  if (a) {
    const s = a.spec
    if (s.kind === 'autoMake' && s.shot === shot) {
      autoMin = s.min
      abilities.push(shooter)
    } else if (s.kind === 'clutch' && state.quarter >= QUARTERS) add('off', a.name, s.bonus, 'ability', shooter)
    else if (s.kind === 'hotHand' && madeLastShot(state, shooter)) add('off', a.name, s.bonus, 'ability', shooter)
    else if (s.kind === 'momentum') {
      const last = lastOwnPossession(state, offenseSeat)
      if (last && last.scored) add('off', a.name, s.bonus, 'ability', shooter)
    } else if (s.kind === 'softHelp' && doubled) {
      helpDie = s.die
      abilities.push(shooter)
    } else if (s.kind === 'unDoubled' && !doubled && (s.shot === null || s.shot === shot)) add('off', a.name, s.bonus, 'ability', shooter)
    else if (s.kind === 'reroll' && s.shot === shot) {
      rerollMax = s.max
      abilities.push(shooter)
    } else if (s.kind === 'mismatch' && s.shot === shot && defender && getCard(defender).def <= s.maxDef) add('off', a.name, s.bonus, 'ability', shooter)
    else if (s.kind === 'offPass' && s.shot === shot && ctx.gotPass) add('off', a.name, s.bonus, 'ability', shooter)
    else if (s.kind === 'sixthMan' && ctx.subbedIn === shooter && mode !== 'putback') add('off', a.name, s.bonus, 'ability', shooter)
    else if (s.kind === 'catchShoot' && uncontested) abilities.push(shooter)
  }

  // ---- defence ----
  let clampRange: number | null = null
  let clampLabel = ''
  let stuffMargin = uncontested ? Number.POSITIVE_INFINITY : STUFF_MARGIN
  let blockCredit: string | null = defender
  if (!drive) add('def', 'Long range', LONG_RANGE, 'rule')
  if (defender) {
    const dslot = slot
    if (fitScore(defender, dslot) === 0) add('def', `Out of position at ${SLOTS[dslot]}`, OUT_OF_POSITION, 'rule')
    if (defCard === 'closeout' && !drive) add('def', 'Closeout', 2, 'card')
    if (drive && hasLink(teamChem(def), 'lockdown')) add('def', 'Lockdown', 1, 'chem')
    for (const id of def) {
      const anchor = abilitySpec(id, 'anchor')
      if (anchor && drive) add('def', abilityOf(id)!.name, anchor.bonus, 'ability', id)
    }
    const clamp = abilitySpec(defender, 'clamp')
    if (clamp) {
      clampRange = clamp.range
      clampLabel = abilityOf(defender)!.name
    }
    if (drive) {
      const own = abilitySpec(defender, 'swat')
      if (own && own.scope === 'own') stuffMargin = Math.min(stuffMargin, own.margin)
      for (const id of def) {
        const team = abilitySpec(id, 'swat')
        if (team && team.scope === 'team') {
          stuffMargin = Math.min(stuffMargin, team.margin)
          blockCredit = id
        }
      }
    }
  }

  return {
    kind: ctx.kind,
    shooter,
    shot,
    slot,
    offenseSeat,
    defender,
    uncontested,
    doubled,
    open,
    offDie: shotDie(shooter, shot),
    offBonusDie: offCard === 'pickroll' && drive && cards ? { die: 4, label: 'Pick & Roll d4' } : null,
    defDie: defender ? getCard(defender).def : UNCONTESTED_DIE,
    helpDie,
    defBonusDie: defCard === 'wallup' && drive ? { die: 4, label: 'Wall Up d4' } : null,
    mods,
    autoMin,
    autoAll: ctx.alleyOop,
    autoLabel: ctx.alleyOop ? 'Alley-Oop' : autoMin !== null && a ? a.name : '',
    rerollMax,
    clampRange,
    clampLabel,
    stuffMargin,
    blockCredit,
    abilities,
  }
}

const oddsCache = new Map<string, { make: number; stuffed: number }>()

/**
 * Exact chance of a plan: every combination of faces counted once. For bots and for a UI hint;
 * the game itself never uses it.
 */
export function shotOdds(plan: ShotPlan): { make: number; stuffed: number } {
  let offMod = 0
  let defMod = 0
  for (const m of plan.mods) {
    if (m.side === 'off') offMod += m.value
    else defMod += m.value
  }
  const key = [
    plan.offDie, plan.offBonusDie?.die ?? 0, plan.defDie, plan.helpDie ?? 0, plan.defBonusDie?.die ?? 0, offMod, defMod,
    plan.autoMin ?? 0, plan.autoAll ? 1 : 0, plan.rerollMax, plan.clampRange ?? -1, plan.stuffMargin,
  ].join('|')
  const hit = oddsCache.get(key)
  if (hit) return hit
  const n = plan.offDie
  const ob = plan.offBonusDie?.die ?? 1
  const hd = plan.helpDie ?? 1
  const db = plan.defBonusDie?.die ?? 1
  let make = 0
  let stuffed = 0
  for (let o = 1; o <= n; o++) {
    // chance the shot die ends on face o, with the reroll folded in
    const po = (o > plan.rerollMax ? 1 / n : 0) + (plan.rerollMax / n) * (1 / n)
    for (let d = 1; d <= plan.defDie; d++) {
      const diff = o - d
      const clamped = plan.clampRange !== null && diff >= 0 && diff <= plan.clampRange
      const auto = !clamped && (plan.autoAll || (plan.autoMin !== null && o >= plan.autoMin))
      const pd = po / plan.defDie
      if (clamped) {
        stuffed += pd
        continue
      }
      if (auto) {
        make += pd
        continue
      }
      const cell = pd / (ob * hd * db)
      for (let x = 1; x <= ob; x++) {
        for (let h = 1; h <= hd; h++) {
          for (let y = 1; y <= db; y++) {
            const offTotal = o + (plan.offBonusDie ? x : 0) + offMod
            const defTotal = d + (plan.helpDie ? h : 0) + (plan.defBonusDie ? y : 0) + defMod
            if (offTotal > defTotal) make += cell
            else if (defTotal - offTotal >= plan.stuffMargin) stuffed += cell
          }
        }
      }
    }
  }
  const out = { make, stuffed }
  if (oddsCache.size > 20000) oddsCache.clear()
  oddsCache.set(key, out)
  return out
}

/* ------------------------------------------------------------------ */
/* Pick validation                                                     */
/* ------------------------------------------------------------------ */

function validateSub(state: MatchState, seat: Seat, sub: SubPick | null | undefined): string | null {
  if (sub === null || sub === undefined) return null
  if (!state.lineups) return 'no lineups'
  if (typeof sub.out !== 'string' || typeof sub.in !== 'string') return 'bad sub'
  if (state.subsUsed[seat] >= SUBS_PER_QUARTER) return 'no substitutions left this quarter'
  if (!state.lineups[seat].includes(sub.out)) return 'sub: player going out is not on the floor'
  if (!benchOf(state, seat).includes(sub.in)) return 'sub: player coming in is not on the bench'
  return null
}

function floorAfter(floor: readonly string[], sub: SubPick | null | undefined): string[] {
  return sub ? floor.map((id) => (id === sub.out ? sub.in : id)) : [...floor]
}

function validateCard(state: MatchState, seat: Seat, cardId: PlayCardId | null | undefined, onOffense: boolean): string | null {
  if (cardId === null || cardId === undefined) return null
  if (!isPlayCardId(cardId)) return 'unknown play card'
  if (!state.hands[seat].includes(cardId)) return 'card is not in hand'
  if (!cardFitsRole(cardId, onOffense)) return onOffense ? 'that card is a defence card' : 'that card is an offence card'
  return null
}

/** null when `pick` is a legal offence pick for `seat` right now, otherwise the reason. */
export function validateOffensePick(state: MatchState, seat: Seat, pick: OffensePick): string | null {
  if (state.phase !== 'play' || !state.lineups) return 'not in play phase'
  if (currentOffenseSeat(state) !== seat) return 'not on offence'
  if (!pick || typeof pick !== 'object') return 'missing pick'
  if (pick.shot !== 'THREE' && pick.shot !== 'DRIVE') return 'bad shot type'
  const subErr = validateSub(state, seat, pick.sub)
  if (subErr) return subErr
  const floor = floorAfter(state.lineups[seat], pick.sub)
  if (typeof pick.shooterId !== 'string' || !floor.includes(pick.shooterId)) return 'shooter is not on the floor'
  if (shotsLeft(state, seat, pick.shooterId) <= 0) return 'shooter has no shots left this quarter'
  const passer = pick.passerId ?? null
  if (passer !== null) {
    if (typeof passer !== 'string' || !floor.includes(passer)) return 'passer is not on the floor'
    if (passer === pick.shooterId) return 'a player cannot pass to himself'
  }
  const cardErr = validateCard(state, seat, pick.cardId, true)
  if (cardErr) return cardErr
  switch (pick.cardId) {
    case 'pickroll':
      if (pick.shot !== 'DRIVE') return 'Pick & Roll needs a drive'
      break
    case 'screen':
      if (pick.shot !== 'THREE') return 'Off-Ball Screen needs a three'
      break
    case 'alleyoop':
      if (pick.shot !== 'DRIVE' || passer === null) return 'Alley-Oop needs a pass into a drive'
      break
    case 'heatcheck':
      if (!scoredLastPossession(state, seat, pick.shooterId)) return 'Heat Check needs a shooter who scored on your last possession'
      break
    default:
      break
  }
  return null
}

/** null when `pick` is a legal defence pick for `seat` right now, otherwise the reason. */
export function validateDefensePick(state: MatchState, seat: Seat, pick: DefensePick): string | null {
  if (state.phase !== 'play' || !state.lineups) return 'not in play phase'
  if (currentDefenseSeat(state) !== seat) return 'not on defence'
  if (!pick || typeof pick !== 'object') return 'missing pick'
  const d = pick.doubleId ?? null
  if (d !== null && (typeof d !== 'string' || !state.draft.picks[otherSeat(seat)].includes(d))) return 'double-team target is not on the other roster'
  const subErr = validateSub(state, seat, pick.sub)
  if (subErr) return subErr
  return validateCard(state, seat, pick.cardId, false)
}

/** Play cards in hand that `seat` could legally play this possession (offence conditions depend on the pick, see validateOffensePick). */
export function playableCards(state: MatchState, seat: Seat): PlayCardId[] {
  const offense = currentOffenseSeat(state)
  if (offense === null) return []
  return state.hands[seat].filter((id) => cardFitsRole(id, offense === seat))
}

function isLineupOf(order: unknown, roster: readonly string[]): order is string[] {
  if (!Array.isArray(order) || order.length !== TEAM_SIZE) return false
  const seen = new Set<string>()
  for (const id of order) {
    if (typeof id !== 'string' || !roster.includes(id) || seen.has(id)) return false
    seen.add(id)
  }
  return true
}

/** Is `order` five different cards from `seat`'s roster? (Lineup and quarter-break submissions.) */
export function isLegalLineup(state: MatchState, seat: Seat, order: unknown): order is string[] {
  return isLineupOf(order, state.draft.picks[seat])
}

function isSeat(v: unknown): v is Seat {
  return v === 0 || v === 1
}

/** Returns null when `event` is legal in `state`, otherwise a human-readable reason. */
export function validateEvent(state: MatchState, event: MatchEvent): string | null {
  switch (event.type) {
    case 'draftPick': {
      if (state.phase !== 'draft') return 'not in draft phase'
      if (!isSeat(event.seat)) return 'bad seat'
      if (whoseDraftTurn(state) !== event.seat) return 'not this seat\'s pick'
      if (!findCard(event.cardId)) return 'unknown card'
      if (!state.draft.available.includes(event.cardId)) return 'card already drafted'
      return null
    }
    case 'lineupReveal':
    case 'quarterBreak': {
      const want = event.type === 'lineupReveal' ? 'lineup' : 'break'
      if (state.phase !== want) return `not in ${want} phase`
      if (!Array.isArray(event.lineups) || event.lineups.length !== 2) return 'bad lineups'
      if (!isLegalLineup(state, 0, event.lineups[0])) return 'seat 0 lineup is not five of its own cards'
      if (!isLegalLineup(state, 1, event.lineups[1])) return 'seat 1 lineup is not five of its own cards'
      return null
    }
    case 'possessionResolve': {
      const offense = currentOffenseSeat(state)
      if (offense === null) return 'not in play phase'
      if (typeof event.seed !== 'string' || event.seed.length === 0) return 'missing seed'
      return validateOffensePick(state, offense, event.offensePick) ?? validateDefensePick(state, otherSeat(offense), event.defensePick)
    }
    default:
      return 'unknown event'
  }
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

type Roller = (sides: number) => number

/**
 * Pure reducer. Never mutates `state`.
 * An illegal event returns the SAME state reference (use validateEvent for the reason).
 */
export function applyEvent(state: MatchState, event: MatchEvent): MatchState {
  if (validateEvent(state, event) !== null) return state
  switch (event.type) {
    case 'draftPick':
      return applyDraftPick(state, event.seat, event.cardId)
    case 'lineupReveal':
      return applyLineupReveal(state, event.lineups)
    case 'quarterBreak':
      return applyQuarterBreak(state, event.lineups)
    case 'possessionResolve': {
      // The sequence number is mixed in so a repeated seed string can never replay the same dice.
      const rng = rngFromSeed(`${event.seed}|${state.history.length}`)
      return applyPossession(state, event.offensePick, event.defensePick, (sides) => rollDie(rng, sides))
    }
  }
}

/** Like applyEvent but reports why an event was rejected. */
export function tryApplyEvent(
  state: MatchState,
  event: MatchEvent,
): { ok: true; state: MatchState } | { ok: false; error: string; state: MatchState } {
  const error = validateEvent(state, event)
  if (error !== null) return { ok: false, error, state }
  return { ok: true, state: applyEvent(state, event) }
}

/** Fold a list of events over a fresh match. Illegal events are skipped. */
export function replay(seed: string, events: readonly MatchEvent[]): MatchState {
  let state = createMatch(seed)
  for (const e of events) state = applyEvent(state, e)
  return state
}

/**
 * Resolve the next possession with dice YOU rolled (table play, and tests). `dice` is the faces in
 * roll order: pass die; shot die, reroll, card d4; DEF die, help die, card d4; then for each board
 * battle offence REB die, defence REB die; then any putback the same way. Faces are clamped to the
 * die; if the list runs out, the rest count as 1. Illegal picks return the same state.
 */
export function resolvePossessionWithDice(state: MatchState, offensePick: OffensePick, defensePick: DefensePick, dice: readonly number[]): MatchState {
  if (validateEvent(state, { type: 'possessionResolve', offensePick, defensePick, seed: 'table' }) !== null) return state
  let i = 0
  return applyPossession(state, offensePick, defensePick, (sides) => {
    const face = i < dice.length ? dice[i] : 1
    i += 1
    return Math.max(1, Math.min(sides, Math.floor(face)))
  })
}

function applyDraftPick(state: MatchState, seat: Seat, cardId: string): MatchState {
  const picks: [string[], string[]] = [[...state.draft.picks[0]], [...state.draft.picks[1]]]
  picks[seat].push(cardId)
  const pickNumber = state.draft.pickNumber + 1
  return {
    ...state,
    phase: pickNumber >= TOTAL_PICKS ? 'lineup' : 'draft',
    draft: { available: state.draft.available.filter((id) => id !== cardId), picks, pickNumber },
  }
}

/** Draw up to `n` from the top of the deck for `seat`, never past the hand limit. Mutates the arrays given. */
function drawInto(deck: PlayCardId[], hand: PlayCardId[], n: number): PlayCardId[] {
  const got: PlayCardId[] = []
  while (got.length < n && deck.length > 0 && hand.length < HAND_LIMIT) {
    const c = deck.shift() as PlayCardId
    hand.push(c)
    got.push(c)
  }
  return got
}

function applyLineupReveal(state: MatchState, lineups: [string[], string[]]): MatchState {
  const deck = [...state.deck]
  const hands: [PlayCardId[], PlayCardId[]] = [[], []]
  // Deal one at a time, the coach with the first possession first, like dealing at a table.
  const first = firstOffenseSeatOfQuarter(state, 1)
  for (let i = 0; i < STARTING_HAND; i++) {
    drawInto(deck, hands[first], 1)
    drawInto(deck, hands[otherSeat(first)], 1)
  }
  return {
    ...state,
    phase: 'play',
    lineups: [[...lineups[0]], [...lineups[1]]],
    quarter: 1,
    overtime: false,
    possession: 0,
    possessionsInQuarter: POSSESSIONS_PER_QUARTER,
    shots: [{}, {}],
    subsUsed: [0, 0],
    deck,
    hands,
  }
}

function applyQuarterBreak(state: MatchState, lineups: [string[], string[]]): MatchState {
  const quarter = state.quarter + 1
  const overtime = quarter > QUARTERS
  const deck = [...state.deck]
  const hands: [PlayCardId[], PlayCardId[]] = [[...state.hands[0]], [...state.hands[1]]]
  if (!overtime) {
    const first = firstOffenseSeatOfQuarter(state, quarter)
    for (let i = 0; i < DRAW_PER_BREAK; i++) {
      drawInto(deck, hands[first], 1)
      drawInto(deck, hands[otherSeat(first)], 1)
    }
  }
  return {
    ...state,
    phase: 'play',
    lineups: [[...lineups[0]], [...lineups[1]]],
    quarter,
    overtime,
    possession: 0,
    possessionsInQuarter: overtime ? 2 : POSSESSIONS_PER_QUARTER,
    shots: [{}, {}],
    subsUsed: [0, 0],
    deck,
    hands,
  }
}

/* ------------------------------ dice ------------------------------ */

const nm = (id: string) => getCard(id).name

function rollContest(plan: ShotPlan, roll: Roller): Contest {
  const offSeat = plan.offenseSeat
  const defSeat = otherSeat(offSeat)
  const dice: DieRoll[] = []
  const skill = plan.shot === 'THREE' ? '3PT' : 'DRIVE'
  const push = (who: string | null, side: 'off' | 'def', purpose: DieRoll['purpose'], die: DieSize, label: string): DieRoll => {
    const r: DieRoll = { who, seat: side === 'off' ? offSeat : defSeat, side, purpose, die, face: roll(die), label, discarded: false }
    dice.push(r)
    return r
  }
  let shotRoll = push(plan.shooter, 'off', 'shot', plan.offDie, `${skill} d${plan.offDie}`)
  if (plan.rerollMax > 0 && shotRoll.face <= plan.rerollMax) {
    shotRoll.discarded = true
    shotRoll = push(plan.shooter, 'off', 'reroll', plan.offDie, `${skill} d${plan.offDie} reroll`)
  }
  const natural = shotRoll.face
  let offenseTotal = natural
  if (plan.offBonusDie) offenseTotal += push(null, 'off', 'bonus', plan.offBonusDie.die, plan.offBonusDie.label).face
  const defRoll = push(plan.defender, 'def', 'defense', plan.defDie, plan.defender ? `DEF d${plan.defDie}` : `Open shot d${plan.defDie}`)
  let defenseTotal = defRoll.face
  if (plan.helpDie) defenseTotal += push(null, 'def', 'help', plan.helpDie, `Help d${plan.helpDie}`).face
  if (plan.defBonusDie) defenseTotal += push(null, 'def', 'bonus', plan.defBonusDie.die, plan.defBonusDie.label).face
  for (const m of plan.mods) {
    if (m.side === 'off') offenseTotal += m.value
    else defenseTotal += m.value
  }

  const drive = plan.shot === 'DRIVE'
  const diff = natural - defRoll.face
  let auto: Contest['auto'] = null
  let outcome: Contest['outcome']
  if (plan.clampRange !== null && diff >= 0 && diff <= plan.clampRange) {
    auto = { result: 'stop', label: plan.clampLabel }
    outcome = drive ? 'blocked' : 'stolen'
  } else if (plan.autoAll || (plan.autoMin !== null && natural >= plan.autoMin)) {
    auto = { result: 'make', label: plan.autoLabel }
    outcome = 'made'
  } else if (offenseTotal > defenseTotal) outcome = 'made'
  else if (defenseTotal - offenseTotal >= plan.stuffMargin) outcome = drive ? 'blocked' : 'stolen'
  else outcome = 'missed'

  return {
    kind: plan.kind,
    shooter: plan.shooter,
    defender: plan.defender,
    shot: plan.shot,
    slot: plan.slot,
    doubled: plan.doubled,
    open: plan.open,
    uncontested: plan.uncontested,
    dice,
    mods: plan.mods,
    natural,
    offenseTotal,
    defenseTotal,
    auto,
    outcome,
    points: outcome === 'made' ? shotPoints(plan.shot) : 0,
  }
}

/** Biggest REB die on the floor; ties go to the bigger position (later seat). */
export function bestRebounder(floor: readonly string[]): string {
  let best = floor[0]
  for (const id of floor) if (getCard(id).reb >= getCard(best).reb) best = id
  return best
}

function shotText(c: Contest, plan: ShotPlan): string {
  const skill = c.shot === 'THREE' ? '3PT' : 'DRIVE'
  const what = c.kind === 'putback' ? 'Putback' : c.shot === 'THREE' ? 'Three' : 'Drive'
  let offSide = `${nm(c.shooter)} rolls his ${skill} d${plan.offDie}`
  if (plan.offBonusDie) offSide += ` plus a d${plan.offBonusDie.die}`
  let defSide = c.defender ? `${nm(c.defender)}'s DEF d${plan.defDie}` : `an open-shot d${plan.defDie}`
  if (plan.helpDie) defSide += ` plus a help d${plan.helpDie}`
  if (plan.defBonusDie) defSide += ` plus a d${plan.defBonusDie.die}`
  const tail =
    c.auto?.result === 'stop'
      ? `${c.auto.label}: automatic stop.`
      : c.auto?.result === 'make'
        ? `${c.auto.label}: automatically in.`
        : `${c.offenseTotal} against ${c.defenseTotal}.`
  const end = c.outcome === 'made' ? `Good for ${c.points}.` : c.outcome === 'blocked' ? 'Blocked.' : c.outcome === 'stolen' ? 'Stolen.' : 'No good.'
  return `${what}. ${offSide} against ${defSide}. ${tail} ${end}`
}

function applyPossession(state: MatchState, offensePick: OffensePick, defensePick: DefensePick, roll: Roller): MatchState {
  const offenseSeat = currentOffenseSeat(state)
  if (!state.lineups || offenseSeat === null) return state
  const defenseSeat = otherSeat(offenseSeat)
  const picks = {
    offense: {
      shooterId: offensePick.shooterId,
      shot: offensePick.shot,
      passerId: offensePick.passerId ?? null,
      cardId: offensePick.cardId ?? null,
      sub: offensePick.sub ? { out: offensePick.sub.out, in: offensePick.sub.in } : null,
    },
    defense: {
      doubleId: defensePick.doubleId ?? null,
      cardId: defensePick.cardId ?? null,
      sub: defensePick.sub ? { out: defensePick.sub.out, in: defensePick.sub.in } : null,
    },
  }
  const steps: RevealStep[] = []
  const credits: StatCredit[] = []
  const used: { cardId: string; name: string; text: string }[] = []
  const noteAbility = (id: string) => {
    const a = abilityOf(id)
    if (a && !used.some((u) => u.cardId === id)) used.push({ cardId: id, name: a.name, text: a.text })
  }
  const credit = (cardId: string, seat: Seat, stat: StatCredit['stat'], value = 1) => credits.push({ cardId, seat, stat, value })

  // 1. substitutions, offence first
  const floor: [string[], string[]] = [[...state.lineups[0]], [...state.lineups[1]]]
  const subsUsed: [number, number] = [state.subsUsed[0], state.subsUsed[1]]
  const subs: PossessionResult['subs'] = []
  const subbedIn: [string | null, string | null] = [null, null]
  for (const [seat, sub] of [[offenseSeat, picks.offense.sub], [defenseSeat, picks.defense.sub]] as const) {
    if (!sub) continue
    const slot = floor[seat].indexOf(sub.out)
    floor[seat][slot] = sub.in
    subsUsed[seat] += 1
    subbedIn[seat] = sub.in
    subs.push({ seat, out: sub.out, in: sub.in, slot })
    steps.push({ kind: 'sub', seat, who: sub.in, rolls: [], text: `Substitution. ${nm(sub.in)} comes in for ${nm(sub.out)} at ${SLOTS[slot]}.` })
  }
  const off = floor[offenseSeat]
  const def = floor[defenseSeat]
  /** Card beats are shown right after the subs, even though their effect is only known later. */
  const cardStepAt = steps.length

  // 2. cards
  const deck = [...state.deck]
  const hands: [PlayCardId[], PlayCardId[]] = [[...state.hands[0]], [...state.hands[1]]]
  const discard = [...state.discard]
  const drawn: [PlayCardId[], PlayCardId[]] = [[], []]
  const spend = (seat: Seat, id: PlayCardId | null): PlayedCard | null => {
    if (!id) return null
    hands[seat].splice(hands[seat].indexOf(id), 1)
    discard.push(id)
    return { id, seat, status: 'played' }
  }
  const offPlayed = spend(offenseSeat, picks.offense.cardId)
  const defPlayed = spend(defenseSeat, picks.defense.cardId)
  if (defPlayed?.id === 'scout') {
    if (offPlayed) offPlayed.status = 'cancelled'
    else defPlayed.status = 'noEffect'
  }
  const offCard = offPlayed && offPlayed.status !== 'cancelled' ? offPlayed.id : null
  const defCard = defPlayed ? defPlayed.id : null
  for (const p of [offPlayed, defPlayed]) {
    if (p && p.status !== 'cancelled' && p.id === 'timeout') drawn[p.seat] = drawInto(deck, hands[p.seat], 2)
  }

  // 3. the double team
  const doubleId = picks.defense.doubleId
  const liveDouble = offCard === 'fastbreak' ? null : doubleId

  let shooter = picks.offense.shooterId
  let shot = picks.offense.shot
  const passer = picks.offense.passerId
  const contests: Contest[] = []
  const rebounds: ReboundResult[] = []
  const shots: [Record<string, number>, Record<string, number>] = [{ ...state.shots[0] }, { ...state.shots[1] }]
  const canShoot = (id: string) => (shots[offenseSeat][id] ?? 0) < MAX_SHOTS_PER_QUARTER
  const tookShot = (id: string) => {
    shots[offenseSeat][id] = (shots[offenseSeat][id] ?? 0) + 1
  }
  let points = 0
  let pass: PassResult | null = null
  let swing: PossessionResult['swing'] = null
  let turnover = false

  // 4. the pass
  let dimeBonus = 0
  if (passer) {
    const pDef = def[off.indexOf(passer)]
    let stealAt = STEAL_AT
    if (defCard === 'pickpocket') stealAt = Math.max(stealAt, 3)
    const jump = abilitySpec(pDef, 'jumpLane')
    if (jump && jump.stealAt > stealAt) {
      stealAt = jump.stealAt
      noteAbility(pDef)
    }
    if (abilitySpec(passer, 'safePass')) {
      stealAt = 0
      noteAbility(passer)
    }
    let dimeAt = DIME_AT
    if (abilitySpec(passer, 'dime')) {
      dimeAt -= 1
      noteAbility(passer)
    }
    if (hasLink(teamChem(off), 'pickroll')) dimeAt -= 1
    const die = getCard(passer).pass
    const r: DieRoll = { who: passer, seat: offenseSeat, side: 'off', purpose: 'pass', die, face: roll(die), label: `PASS d${die}`, discarded: false }
    const stolen = r.face <= stealAt
    const dime = !stolen && r.face >= dimeAt
    const big = abilitySpec(passer, 'bigDime')
    if (dime && big) noteAbility(passer)
    dimeBonus = dime ? (big ? big.bonus : DIME_BONUS) : 0
    pass = { passer, defender: pDef, receiver: shooter, roll: r, stealAt, dimeAt, stolen, dime, bonus: dimeBonus }
    const how = stolen ? `Stolen by ${nm(pDef)}.` : dime ? `A dime: +${dimeBonus} for ${nm(shooter)}.` : 'The pass gets there, no bonus.'
    steps.push({
      kind: 'pass',
      seat: offenseSeat,
      who: passer,
      rolls: [r],
      text: `${nm(passer)} passes to ${nm(shooter)} and rolls his PASS d${die}: ${r.face}. ${stealAt > 0 ? `${stealAt === 1 ? 'A 1 is' : `${stealAt} or lower is`} stolen, ` : ''}${dimeAt}+ is a dime. ${how}`,
    })
    if (stolen) {
      turnover = true
      credit(pDef, defenseSeat, 'STL')
      credit(passer, offenseSeat, 'TOV')
    }
  }

  const cardSteps = () => {
    const out: RevealStep[] = []
    for (const p of [offPlayed, defPlayed]) {
      if (!p) continue
      const c = playCard(p.id)
      const tail = p.status === 'cancelled' ? ' Cancelled by Scouting Report.' : p.status === 'noEffect' ? ' No effect this time.' : ''
      out.push({ kind: 'card', seat: p.seat, card: p.id, rolls: [], text: `${c.name}. ${c.text}${tail}` })
    }
    return out
  }

  if (!turnover) {
    // 5. does the shot swing to somebody else?
    const doubledShooter = liveDouble === shooter
    let mode: ShotContext['mode'] = 'normal'
    let gotPass = passer !== null
    const klay = off.find((id) => abilitySpec(id, 'catchShoot') !== null) ?? null
    if (doubledShooter && offCard === 'kickout') {
      const targets = off.filter((id) => id !== shooter && canShoot(id))
      if (targets.length > 0) {
        let to = targets[0]
        for (const id of targets) if (getCard(id).three > getCard(to).three) to = id
        swing = { kind: 'kickout', from: shooter, to }
        steps.push({ kind: 'swing', seat: offenseSeat, who: to, card: 'kickout', rolls: [], text: `Kick Out. ${nm(shooter)} is double-teamed and finds ${nm(to)} for an open three.` })
        shooter = to
        shot = 'THREE'
        mode = 'open'
        gotPass = true
      }
    } else if (doubledShooter && klay && klay !== shooter && canShoot(klay)) {
      swing = { kind: 'catchshoot', from: shooter, to: klay }
      noteAbility(klay)
      steps.push({ kind: 'swing', seat: offenseSeat, who: klay, rolls: [], text: `Catch & Shoot. ${nm(shooter)} is double-teamed, so ${nm(klay)} takes an uncontested three.` })
      shooter = klay
      shot = 'THREE'
      mode = 'uncontested'
      gotPass = true
    } else if (abilitySpec(shooter, 'catchShoot') && subbedIn[offenseSeat] === shooter && shot === 'THREE') {
      mode = 'uncontested'
      noteAbility(shooter)
    }
    if (offPlayed && offPlayed.status === 'played') {
      if (offPlayed.id === 'kickout' && !swing) offPlayed.status = 'noEffect'
      if (offPlayed.id === 'alleyoop' && !(pass && pass.dime)) offPlayed.status = 'noEffect'
      if (offPlayed.id === 'pickroll' && mode !== 'normal') offPlayed.status = 'noEffect'
      if (offPlayed.id === 'screen' && shot !== 'THREE') offPlayed.status = 'noEffect'
    }
    if (defPlayed && defPlayed.status === 'played') {
      const wrong = liveDouble !== null && liveDouble !== shooter && mode === 'normal'
      if (defPlayed.id === 'wallup' && (shot !== 'DRIVE' || mode === 'uncontested')) defPlayed.status = 'noEffect'
      if (defPlayed.id === 'closeout' && (shot !== 'THREE' || mode === 'uncontested')) defPlayed.status = 'noEffect'
      if (defPlayed.id === 'zone' && !wrong) defPlayed.status = 'noEffect'
      if (defPlayed.id === 'pickpocket' && !pass) defPlayed.status = 'noEffect'
    }
    if (doubleId !== null) {
      const on = swing ? swing.from : shooter
      const text =
        offCard === 'fastbreak'
          ? `The double team on ${nm(doubleId)} never gets set: Fast Break.`
          : doubleId === on
            ? `Double team on ${nm(doubleId)}. Right read.`
            : defCard === 'zone'
              ? `Double team on ${nm(doubleId)}. Wrong read, but the Zone covers it.`
              : `Double team on ${nm(doubleId)}. Wrong read: ${nm(shooter)} gets an open look (+${OPEN_LOOK}).`
      steps.push({ kind: 'double', seat: defenseSeat, who: doubleId, rolls: [], text })
    }

    // 6. the shot
    const base = { state, floor, offenseSeat, offCard, defCard, subbedIn: subbedIn[offenseSeat] }
    const alleyOop = offCard === 'alleyoop' && !!pass && pass.dime && !swing && shot === 'DRIVE'
    const plan = buildPlan({ ...base, kind: 'shot', shooter, shot, mode, doubleId: liveDouble, dimeBonus, gotPass, alleyOop })
    const main = rollContest(plan, roll)
    const record = (c: Contest, p: ShotPlan) => {
      contests.push(c)
      for (const id of p.abilities) noteAbility(id)
      if (c.auto?.result === 'stop' && c.defender) noteAbility(c.defender)
      steps.push({ kind: 'shot', seat: offenseSeat, who: c.shooter, rolls: c.dice, ref: contests.length - 1, text: shotText(c, p) })
      if (c.outcome === 'made') {
        points += c.points
        credit(c.shooter, offenseSeat, 'PTS', c.points)
      } else if (c.outcome === 'blocked') {
        const by = c.auto?.result === 'stop' ? (c.defender as string) : (p.blockCredit as string)
        if (by !== c.defender) noteAbility(by)
        credit(by, defenseSeat, 'BLK')
      } else if (c.outcome === 'stolen') {
        credit(c.defender as string, defenseSeat, 'STL')
        credit(c.shooter, offenseSeat, 'TOV')
      }
    }
    tookShot(shooter)
    record(main, plan)
    if (main.outcome === 'made') {
      const assister = swing ? swing.from : pass && pass.dime ? pass.passer : null
      if (assister) credit(assister, offenseSeat, 'AST')
    }

    // 7. Catch & Shoot off a block
    let last = main
    if (main.outcome === 'blocked' && !swing && klay && klay !== shooter && canShoot(klay)) {
      noteAbility(klay)
      steps.push({ kind: 'swing', seat: offenseSeat, who: klay, rolls: [], text: `Catch & Shoot. The block falls to ${nm(klay)} for an uncontested three.` })
      const p2 = buildPlan({ ...base, kind: 'catchshoot', shooter: klay, shot: 'THREE', mode: 'uncontested', doubleId: null, dimeBonus: 0, gotPass: false, alleyOop: false, offCard: null, defCard: null })
      const c2 = rollContest(p2, roll)
      tookShot(klay)
      record(c2, p2)
      last = c2
    }

    // 8. the board battle, and one putback
    if (last.outcome === 'missed') {
      const offR = bestRebounder(off)
      const defR = bestRebounder(def)
      const mods: Modifier[] = [{ side: 'def', label: 'Inside position', value: BOX_OUT, source: 'rule' }]
      if (offCard === 'crash') mods.push({ side: 'off', label: 'Crash the Glass', value: 3, source: 'card' })
      if (defCard === 'crash') mods.push({ side: 'def', label: 'Crash the Glass', value: 3, source: 'card' })
      for (const [id, side] of [[offR, 'off'], [defR, 'def']] as const) {
        const g = abilitySpec(id, 'glass')
        if (g) {
          mods.push({ side, label: abilityOf(id)!.name, value: g.bonus, source: 'ability' })
          noteAbility(id)
        }
      }
      const oDie = getCard(offR).reb
      const dDie = getCard(defR).reb
      const o: DieRoll = { who: offR, seat: offenseSeat, side: 'off', purpose: 'rebound', die: oDie, face: roll(oDie), label: `REB d${oDie}`, discarded: false }
      const d: DieRoll = { who: defR, seat: defenseSeat, side: 'def', purpose: 'rebound', die: dDie, face: roll(dDie), label: `REB d${dDie}`, discarded: false }
      const offenseTotal = o.face + mods.filter((m) => m.side === 'off').reduce((n, m) => n + m.value, 0)
      const defenseTotal = d.face + mods.filter((m) => m.side === 'def').reduce((n, m) => n + m.value, 0)
      const winner = offenseTotal > defenseTotal ? 'off' : 'def'
      const rebounder = winner === 'off' ? offR : defR
      rebounds.push({ contested: true, offRebounder: offR, defRebounder: defR, dice: [o, d], mods, offenseTotal, defenseTotal, winner, rebounder })
      credit(rebounder, winner === 'off' ? offenseSeat : defenseSeat, 'REB')
      if (winner === 'off') credit(rebounder, offenseSeat, 'OREB')
      steps.push({
        kind: 'rebound',
        seat: winner === 'off' ? offenseSeat : defenseSeat,
        who: rebounder,
        rolls: [o, d],
        ref: 0,
        text: `Board battle. ${nm(offR)} rolls his REB d${oDie} against ${nm(defR)}'s REB d${dDie} plus ${BOX_OUT} for inside position. ${offenseTotal} against ${defenseTotal}. ${winner === 'off' ? `Offensive rebound, ${nm(offR)} goes back up.` : `${nm(defR)} has it.`}`,
      })
      if (winner === 'off') {
        const p3 = buildPlan({ ...base, kind: 'putback', shooter: offR, shot: 'DRIVE', mode: 'putback', doubleId: null, dimeBonus: 0, gotPass: false, alleyOop: false, offCard: null, defCard: null })
        const c3 = rollContest(p3, roll)
        record(c3, p3)
        if (c3.outcome === 'missed') {
          rebounds.push({ contested: false, offRebounder: offR, defRebounder: defR, dice: [], mods: [], offenseTotal: 0, defenseTotal: 0, winner: 'def', rebounder: defR })
          credit(defR, defenseSeat, 'REB')
          steps.push({ kind: 'rebound', seat: defenseSeat, who: defR, rolls: [], ref: 1, text: `${nm(defR)} collects the second miss. No more second chances.` })
        }
      }
    }
    if (offPlayed?.id === 'crash' && rebounds.length === 0) offPlayed.status = 'noEffect'
    if (defPlayed?.id === 'crash' && rebounds.length === 0) defPlayed.status = 'noEffect'
  }
  steps.splice(cardStepAt, 0, ...cardSteps())

  const score: [number, number] = [state.score[0], state.score[1]]
  score[offenseSeat] += points
  steps.push({
    kind: 'result',
    seat: offenseSeat,
    rolls: [],
    text: points > 0 ? `${points} points. ${score[0]} to ${score[1]}.` : turnover ? 'Turnover. No points.' : 'No points.',
  })

  const result: PossessionResult = {
    seq: state.history.length,
    quarter: state.quarter,
    index: state.possession,
    overtime: state.overtime,
    offenseSeat,
    defenseSeat,
    picks,
    subs,
    floor: [[...floor[0]], [...floor[1]]],
    cards: { offense: offPlayed, defense: defPlayed },
    drawn,
    doubleId,
    pass,
    swing,
    shooter,
    shot,
    contests,
    rebounds,
    abilities: used,
    steps,
    credits,
    scored: points > 0,
    points,
    scoreAfter: [score[0], score[1]],
  }

  const next: MatchState = {
    ...state,
    lineups: floor,
    shots,
    subsUsed,
    deck,
    hands,
    discard,
    score,
    history: [...state.history, result],
    possession: state.possession + 1,
  }
  if (next.possession < next.possessionsInQuarter) return next

  // Quarter (or overtime pair) complete.
  const tied = score[0] === score[1]
  if (!state.overtime && state.quarter < QUARTERS) return { ...next, phase: 'break' }
  if (!tied) return { ...next, phase: 'gameover', winner: score[0] > score[1] ? 0 : 1 }
  if (!state.overtime) return { ...next, phase: 'break' }
  return { ...next, quarter: state.quarter + 1, possession: 0, shots: [{}, {}], subsUsed: [0, 0] }
}

/* ------------------------------------------------------------------ */
/* Previews and box score                                              */
/* ------------------------------------------------------------------ */

export interface PreviewOptions {
  /** Who the defence doubles (default: nobody). */
  doubleId?: string | null
  defCard?: PlayCardId | null
  /** Assume the pass is a dime (default false). */
  dime?: boolean
}

/**
 * What would be rolled against what if `seat` ran this pick now. Says nothing about the dice
 * themselves. Use it for the "d12 against d8 plus help d6" copy and for bot odds (shotOdds).
 */
export function previewShot(state: MatchState, seat: Seat, pick: OffensePick, opts: PreviewOptions = {}): ShotPlan | null {
  if (!state.lineups) return null
  const floor: [string[], string[]] = [[...state.lineups[0]], [...state.lineups[1]]]
  floor[seat] = floorAfter(floor[seat], pick.sub)
  if (!floor[seat].includes(pick.shooterId)) return null
  const offCard = pick.cardId ?? null
  const passer = pick.passerId ?? null
  let dimeBonus = 0
  if (passer && opts.dime) dimeBonus = abilitySpec(passer, 'bigDime')?.bonus ?? DIME_BONUS
  const subbedIn = pick.sub ? pick.sub.in : null
  const uncontested = !!abilitySpec(pick.shooterId, 'catchShoot') && subbedIn === pick.shooterId && pick.shot === 'THREE'
  return buildPlan({
    state,
    floor,
    offenseSeat: seat,
    kind: 'shot',
    shooter: pick.shooterId,
    shot: pick.shot,
    mode: uncontested ? 'uncontested' : 'normal',
    doubleId: offCard === 'fastbreak' ? null : (opts.doubleId ?? null),
    offCard,
    defCard: opts.defCard ?? null,
    dimeBonus,
    gotPass: passer !== null,
    alleyOop: offCard === 'alleyoop' && !!opts.dime && pick.shot === 'DRIVE',
    subbedIn,
  })
}

/** Pass numbers for a passer on the floor: which faces are stolen and which are dimes, and the dime bonus. */
export function previewPass(state: MatchState, seat: Seat, passerId: string, defCard: PlayCardId | null = null): { die: DieSize; stealAt: number; dimeAt: number; bonus: number } | null {
  if (!state.lineups) return null
  const slot = state.lineups[seat].indexOf(passerId)
  if (slot < 0) return null
  const pDef = state.lineups[otherSeat(seat)][slot]
  let stealAt = STEAL_AT
  if (defCard === 'pickpocket') stealAt = 3
  const jump = abilitySpec(pDef, 'jumpLane')
  if (jump) stealAt = Math.max(stealAt, jump.stealAt)
  if (abilitySpec(passerId, 'safePass')) stealAt = 0
  let dimeAt = DIME_AT
  if (abilitySpec(passerId, 'dime')) dimeAt -= 1
  if (hasLink(teamChem(state.lineups[seat]), 'pickroll')) dimeAt -= 1
  return { die: getCard(passerId).pass, stealAt, dimeAt, bonus: abilitySpec(passerId, 'bigDime')?.bonus ?? DIME_BONUS }
}

/** Per-card box score for every drafted card, keyed by card id. Built only from what happened. */
export function boxScore(state: MatchState): Record<string, BoxLine> {
  const out: Record<string, BoxLine> = {}
  for (const seat of [0, 1] as const) {
    for (const cardId of state.draft.picks[seat]) {
      out[cardId] = { cardId, seat, pts: 0, reb: 0, oreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, possessions: 0, doubleDouble: false, tripleDouble: false }
    }
  }
  for (const r of state.history) {
    for (const side of r.floor) for (const id of side) if (out[id]) out[id].possessions += 1
    for (const c of r.contests) {
      const line = out[c.shooter]
      if (!line) continue
      line.fga += 1
      if (c.shot === 'THREE') line.tpa += 1
      if (c.outcome === 'made') {
        line.fgm += 1
        if (c.shot === 'THREE') line.tpm += 1
      }
    }
    for (const k of r.credits) {
      const line = out[k.cardId]
      if (!line) continue
      if (k.stat === 'PTS') line.pts += k.value
      else if (k.stat === 'REB') line.reb += k.value
      else if (k.stat === 'OREB') line.oreb += k.value
      else if (k.stat === 'AST') line.ast += k.value
      else if (k.stat === 'STL') line.stl += k.value
      else if (k.stat === 'BLK') line.blk += k.value
      else line.tov += k.value
    }
  }
  for (const line of Object.values(out)) {
    const tens = [line.pts, line.reb, line.ast, line.stl, line.blk].filter((v) => v >= 10).length
    line.doubleDouble = tens >= 2
    line.tripleDouble = tens >= 3
  }
  return out
}
