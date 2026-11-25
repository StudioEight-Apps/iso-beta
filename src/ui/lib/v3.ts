import { fitScore, getCard, seatByPosition } from '../../game'
import type { BoxLine, MatchState, PlayCardId, Seat, StatKey } from '../../game'

const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv)$/i

/** Surname in normal case for running copy: "Curry", "Gilgeous-Alexander". */
export function lastName(id: string): string {
  const all = getCard(id).name.trim().split(/\s+/)
  while (all.length > 1 && SUFFIX.test(all[all.length - 1])) all.pop()
  return all[all.length - 1] ?? getCard(id).name
}

/** "Curry's" / "Davis'" */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`
}

function combos<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = []
  const walk = (start: number, cur: T[]) => {
    if (cur.length === k) {
      out.push([...cur])
      return
    }
    for (let i = start; i < items.length; i++) {
      cur.push(items[i])
      walk(i + 1, cur)
      cur.pop()
    }
  }
  walk(0, [])
  return out
}

const strength = (id: string) => {
  const c = getCard(id)
  return c.three + c.drive + c.def
}

/**
 * Seat up to seven drafted cards: five on the floor in PG SG SF PF C (null = empty seat) and the rest on the bench.
 * With six or seven cards the five that fit their seats best start, stronger dice breaking ties.
 */
export function seatSeven(ids: readonly string[]): { floor: (string | null)[]; bench: string[] } {
  if (ids.length <= 5) return { floor: seatByPosition(ids), bench: [] }
  let best: string[] = []
  let bestScore = -1
  for (const five of combos(ids, 5)) {
    const seated = seatByPosition(five) as string[]
    let score = 0
    seated.forEach((id, slot) => {
      score += (fitScore(id, slot) > 0 ? 1000 : 0) + strength(id)
    })
    if (score > bestScore) {
      bestScore = score
      best = seated
    }
  }
  return { floor: best, bench: ids.filter((id) => !best.includes(id)) }
}

/** Cards in `after` that were not in `before` (hands can hold duplicates). */
export function handGain(before: readonly PlayCardId[], after: readonly PlayCardId[]): PlayCardId[] {
  const left = [...before]
  const out: PlayCardId[] = []
  for (const id of after) {
    const at = left.indexOf(id)
    if (at >= 0) left.splice(at, 1)
    else out.push(id)
  }
  return out
}

export const STAT_LABEL: Record<StatKey, string> = { PTS: 'PTS', REB: 'REB', OREB: 'OREB', AST: 'AST', STL: 'STL', BLK: 'BLK', TOV: 'TO' }

/** One number for "who had the best game". Whole numbers only: every counted stat is worth one. */
export function gameScore(l: BoxLine): number {
  return l.pts + l.reb + l.ast + l.stl + l.blk
}

/** "15 PTS · 7 REB · 2 AST", skipping zeros (points always shown). */
export function statLine(l: BoxLine): string {
  const parts = [`${l.pts} PTS`]
  if (l.reb) parts.push(`${l.reb} REB`)
  if (l.ast) parts.push(`${l.ast} AST`)
  if (l.stl) parts.push(`${l.stl} STL`)
  if (l.blk) parts.push(`${l.blk} BLK`)
  return parts.join(' · ')
}

export function quarterLabel(quarter: number, overtime: boolean): string {
  if (!overtime) return `Q${quarter}`
  const n = quarter - 4
  return n > 1 ? `OT${n}` : 'OT'
}

export function otherOf(seat: Seat): Seat {
  return seat === 0 ? 1 : 0
}

/** Players on the floor right now for a seat (empty before lineups). */
export function floorOf(match: MatchState, seat: Seat): string[] {
  return match.lineups ? match.lineups[seat] : []
}
