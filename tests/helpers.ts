import {
  applyEvent,
  createMatch,
  currentOffenseSeat,
  legalShooters,
  otherSeat,
  resolvePossessionWithDice,
  setFixedPool,
  whoseDraftTurn,
} from '../src/game'
import type { Contest, DefensePick, MatchState, OffensePick, PlayCardId, PossessionResult, Seat } from '../src/game'
import { TEST_POOL } from './setup'

/** Draft so that the FIRST drafter ends with `first` and the second drafter with `second` (7 each). */
export function draftTeams(seed: string, first: string[], second: string[]): MatchState {
  let s = createMatch(seed)
  const queues: [string[], string[]] = [[], []]
  queues[s.firstDrafter] = [...first]
  queues[otherSeat(s.firstDrafter)] = [...second]
  while (s.phase === 'draft') {
    const seat = whoseDraftTurn(s) as Seat
    const cardId = queues[seat].shift() as string
    const next = applyEvent(s, { type: 'draftPick', seat, cardId })
    if (next === s) throw new Error(`draft pick rejected: ${cardId}`)
    s = next
  }
  return s
}

/** Starters first (PG SG SF PF C), then the two bench cards. */
export const TEAM_A = ['curry', 'ant', 'kawhi', 'giannis', 'embiid', 'klay', 'reid']
export const TEAM_B = ['luka', 'sga', 'tatum', 'lebron', 'wemby', 'holiday', 'gobert']

/** Play-phase state: the first drafter has `first`, the second has `second`; the first five of each start. */
export function playState(seed = 'test', first = TEAM_A, second = TEAM_B): MatchState {
  const s = draftTeams(seed, first, second)
  const lineups: [string[], string[]] = [[], []]
  lineups[s.firstDrafter] = first.slice(0, 5)
  lineups[otherSeat(s.firstDrafter)] = second.slice(0, 5)
  const next = applyEvent(s, { type: 'lineupReveal', lineups })
  if (next === s) throw new Error('lineup rejected')
  return next
}

/** Plain role players with no abilities and no chemistry on their own side of the ball. */
export const F_OFF = ['mccollum', 'kcp', 'dfs', 'portis', 'looney', 'strus', 'lopez']
export const F_DEF = ['murray', 'hart', 'middleton', 'gordon', 'allen', 'kuzma', 'sengun']

/** Copy of `team` with `id` in seat `slot` (0 = PG ... 4 = C, 5 and 6 = bench). */
export function swap(team: readonly string[], slot: number, id: string): string[] {
  const out = [...team]
  out[slot] = id
  return out
}

export interface Rig {
  s: MatchState
  off: Seat
  def: Seat
}

/** A play-phase state from any 14 roster cards. `off` has the first possession. */
export function build(off: readonly string[] = F_OFF, def: readonly string[] = F_DEF, seed = 'rig'): Rig {
  setFixedPool([...off, ...def])
  try {
    const s = playState(seed, [...def], [...off])
    return { s, off: currentOffenseSeat(s) as Seat, def: otherSeat(currentOffenseSeat(s) as Seat) }
  } finally {
    setFixedPool(TEST_POOL)
  }
}

/** Resolve the next possession with chosen dice. Throws when the picks are illegal. */
export function play(s: MatchState, offense: OffensePick, defense: Partial<DefensePick> = {}, dice: number[] = []): MatchState {
  const next = resolvePossessionWithDice(s, offense, { doubleId: null, ...defense }, dice)
  if (next === s) throw new Error('possession rejected')
  return next
}

/** A possession where nothing happens: first legal shooter drives and rolls a 1, the defence rolls its best and rebounds. */
export function dud(s: MatchState): MatchState {
  const seat = currentOffenseSeat(s) as Seat
  return play(s, { shooterId: legalShooters(s, seat)[0], shot: 'DRIVE' }, {}, [1, 12, 1, 12])
}

export function last(s: MatchState): PossessionResult {
  return s.history[s.history.length - 1]
}

export function shotOf(s: MatchState, i = 0): Contest {
  return last(s).contests[i]
}

/** Value of the modifier called `label` on a contest (0 when absent). */
export function mod(c: Contest, label: string): number {
  return c.mods.filter((m) => m.label === label).reduce((n, m) => n + m.value, 0)
}

/** Same state with `seat` holding exactly `cards`. */
export function give(s: MatchState, seat: Seat, cards: PlayCardId[]): MatchState {
  const hands: [PlayCardId[], PlayCardId[]] = [[...s.hands[0]], [...s.hands[1]]]
  hands[seat] = [...cards]
  return { ...s, hands }
}

/** Set the same five again at a quarter break. */
export function sameFive(s: MatchState): MatchState {
  const next = applyEvent(s, { type: 'quarterBreak', lineups: s.lineups as [string[], string[]] })
  if (next === s) throw new Error('break rejected')
  return next
}
