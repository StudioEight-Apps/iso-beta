import { rngFromSeed } from './prng'
import type { Card } from './types'

/**
 * The whole card pool lives here so it can be swapped later. All five dice are placeholders for the designer to tune
 * (PASS and REB were added for v3). Jersey numbers are kept as data but not shown: several may be out of date.
 */
export const ROSTER: readonly Card[] = [
  { id: 'curry', name: 'Stephen Curry', number: 30, position: 'G', three: 12, drive: 6, pass: 10, reb: 6, def: 6 },
  { id: 'durant', name: 'Kevin Durant', number: 35, position: 'F', three: 10, drive: 10, pass: 8, reb: 8, def: 8 },
  { id: 'kawhi', name: 'Kawhi Leonard', number: 2, position: 'F', three: 8, drive: 8, pass: 6, reb: 8, def: 12 },
  { id: 'giannis', name: 'Giannis Antetokounmpo', number: 34, position: 'F', three: 4, drive: 12, pass: 10, reb: 12, def: 10 },
  { id: 'embiid', name: 'Joel Embiid', number: 21, position: 'C', three: 4, drive: 10, pass: 6, reb: 12, def: 10 },
  { id: 'jokic', name: 'Nikola Jokic', number: 15, position: 'C', three: 8, drive: 10, pass: 12, reb: 12, def: 6 },
  { id: 'luka', name: 'Luka Doncic', number: 77, position: 'G', three: 10, drive: 10, pass: 12, reb: 10, def: 4 },
  { id: 'sga', name: 'Shai Gilgeous-Alexander', number: 2, position: 'G', three: 8, drive: 12, pass: 10, reb: 6, def: 8 },
  { id: 'tatum', name: 'Jayson Tatum', number: 0, position: 'F', three: 10, drive: 8, pass: 8, reb: 10, def: 8 },
  { id: 'wemby', name: 'Victor Wembanyama', number: 1, position: 'C', three: 6, drive: 10, pass: 6, reb: 12, def: 12 },
  { id: 'ant', name: 'Anthony Edwards', number: 5, position: 'G', three: 8, drive: 10, pass: 8, reb: 6, def: 8 },
  { id: 'lebron', name: 'LeBron James', number: 23, position: 'F', three: 6, drive: 12, pass: 12, reb: 10, def: 8 },
  { id: 'davis', name: 'Anthony Davis', number: 3, position: 'C', three: 4, drive: 10, pass: 6, reb: 12, def: 12 },
  { id: 'morant', name: 'Ja Morant', number: 12, position: 'G', three: 6, drive: 12, pass: 10, reb: 6, def: 6 },
  { id: 'lillard', name: 'Damian Lillard', number: 0, position: 'G', three: 12, drive: 8, pass: 10, reb: 4, def: 4 },
  { id: 'booker', name: 'Devin Booker', number: 1, position: 'G', three: 10, drive: 10, pass: 10, reb: 6, def: 4 },
  { id: 'mitchell', name: 'Donovan Mitchell', number: 45, position: 'G', three: 10, drive: 10, pass: 8, reb: 6, def: 4 },
  { id: 'brunson', name: 'Jalen Brunson', number: 11, position: 'G', three: 10, drive: 10, pass: 10, reb: 4, def: 4 },
  { id: 'haliburton', name: 'Tyrese Haliburton', number: 0, position: 'G', three: 10, drive: 8, pass: 12, reb: 4, def: 6 },
  { id: 'butler', name: 'Jimmy Butler', number: 10, position: 'F', three: 6, drive: 10, pass: 8, reb: 8, def: 10 },
  { id: 'towns', name: 'Karl-Anthony Towns', number: 32, position: 'C', three: 10, drive: 8, pass: 6, reb: 12, def: 6 },
  { id: 'banchero', name: 'Paolo Banchero', number: 5, position: 'F', three: 6, drive: 10, pass: 8, reb: 8, def: 8 },
  { id: 'irving', name: 'Kyrie Irving', number: 11, position: 'G', three: 10, drive: 10, pass: 8, reb: 6, def: 4 },
  { id: 'harden', name: 'James Harden', number: 1, position: 'G', three: 10, drive: 10, pass: 12, reb: 6, def: 4 },
  { id: 'george', name: 'Paul George', number: 8, position: 'F', three: 10, drive: 8, pass: 8, reb: 8, def: 8 },
  { id: 'adebayo', name: 'Bam Adebayo', number: 13, position: 'C', three: 4, drive: 10, pass: 8, reb: 10, def: 10 },
  { id: 'siakam', name: 'Pascal Siakam', number: 43, position: 'F', three: 6, drive: 10, pass: 8, reb: 8, def: 8 },
  { id: 'fox', name: 'De\'Aaron Fox', number: 4, position: 'G', three: 8, drive: 10, pass: 10, reb: 6, def: 6 },
  { id: 'maxey', name: 'Tyrese Maxey', number: 0, position: 'G', three: 10, drive: 10, pass: 8, reb: 4, def: 4 },
  { id: 'young', name: 'Trae Young', number: 11, position: 'G', three: 10, drive: 10, pass: 12, reb: 4, def: 4 },
  { id: 'jwill', name: 'Jalen Williams', number: 8, position: 'F', three: 8, drive: 10, pass: 8, reb: 6, def: 8 },
  { id: 'cunningham', name: 'Cade Cunningham', number: 2, position: 'G', three: 8, drive: 10, pass: 12, reb: 8, def: 6 },
  { id: 'holmgren', name: 'Chet Holmgren', number: 7, position: 'C', three: 8, drive: 8, pass: 4, reb: 10, def: 10 },
  { id: 'holiday', name: 'Jrue Holiday', number: 5, position: 'G', three: 8, drive: 6, pass: 8, reb: 6, def: 8 },
  { id: 'white', name: 'Derrick White', number: 9, position: 'G', three: 8, drive: 6, pass: 8, reb: 6, def: 8 },
  { id: 'bridges', name: 'Mikal Bridges', number: 25, position: 'F', three: 8, drive: 6, pass: 6, reb: 6, def: 8 },
  { id: 'anunoby', name: 'OG Anunoby', number: 8, position: 'F', three: 6, drive: 6, pass: 4, reb: 6, def: 10 },
  { id: 'dgreen', name: 'Draymond Green', number: 23, position: 'F', three: 4, drive: 6, pass: 10, reb: 8, def: 10 },
  { id: 'gobert', name: 'Rudy Gobert', number: 27, position: 'C', three: 4, drive: 6, pass: 4, reb: 12, def: 12 },
  { id: 'gordon', name: 'Aaron Gordon', number: 32, position: 'F', three: 4, drive: 8, pass: 6, reb: 8, def: 8 },
  { id: 'klay', name: 'Klay Thompson', number: 31, position: 'G', three: 10, drive: 4, pass: 4, reb: 4, def: 6 },
  { id: 'reaves', name: 'Austin Reaves', number: 15, position: 'G', three: 8, drive: 8, pass: 8, reb: 6, def: 4 },
  { id: 'murray', name: 'Jamal Murray', number: 27, position: 'G', three: 8, drive: 8, pass: 8, reb: 6, def: 4 },
  { id: 'porzingis', name: 'Kristaps Porzingis', number: 8, position: 'C', three: 8, drive: 6, pass: 4, reb: 8, def: 8 },
  { id: 'middleton', name: 'Khris Middleton', number: 22, position: 'F', three: 8, drive: 6, pass: 8, reb: 6, def: 6 },
  { id: 'jjj', name: 'Jaren Jackson Jr.', number: 8, position: 'F', three: 6, drive: 6, pass: 4, reb: 8, def: 10 },
  { id: 'mccollum', name: 'CJ McCollum', number: 3, position: 'G', three: 8, drive: 8, pass: 8, reb: 6, def: 4 },
  { id: 'derozan', name: 'DeMar DeRozan', number: 10, position: 'F', three: 4, drive: 10, pass: 8, reb: 6, def: 6 },
  { id: 'wagner', name: 'Franz Wagner', number: 22, position: 'F', three: 6, drive: 8, pass: 8, reb: 6, def: 8 },
  { id: 'sengun', name: 'Alperen Sengun', number: 28, position: 'C', three: 4, drive: 8, pass: 10, reb: 10, def: 6 },
  { id: 'allen', name: 'Jarrett Allen', number: 31, position: 'C', three: 4, drive: 8, pass: 4, reb: 12, def: 10 },
  { id: 'hart', name: 'Josh Hart', number: 3, position: 'G', three: 4, drive: 6, pass: 8, reb: 10, def: 6 },
  { id: 'lopez', name: 'Brook Lopez', number: 11, position: 'C', three: 6, drive: 4, pass: 4, reb: 8, def: 6 },
  { id: 'caruso', name: 'Alex Caruso', number: 9, position: 'G', three: 4, drive: 4, pass: 6, reb: 4, def: 8 },
  { id: 'dort', name: 'Luguentz Dort', number: 5, position: 'G', three: 4, drive: 4, pass: 4, reb: 6, def: 8 },
  { id: 'kcp', name: 'Kentavious Caldwell-Pope', number: 3, position: 'G', three: 6, drive: 4, pass: 4, reb: 4, def: 6 },
  { id: 'hjones', name: 'Herbert Jones', number: 2, position: 'F', three: 4, drive: 4, pass: 4, reb: 6, def: 8 },
  { id: 'reid', name: 'Naz Reid', number: 11, position: 'C', three: 6, drive: 6, pass: 4, reb: 8, def: 4 },
  { id: 'portis', name: 'Bobby Portis', number: 9, position: 'F', three: 6, drive: 6, pass: 4, reb: 10, def: 4 },
  { id: 'mcconnell', name: 'T.J. McConnell', number: 9, position: 'G', three: 4, drive: 6, pass: 10, reb: 4, def: 6 },
  { id: 'looney', name: 'Kevon Looney', number: 5, position: 'C', three: 4, drive: 4, pass: 6, reb: 10, def: 8 },
  { id: 'dfs', name: 'Dorian Finney-Smith', number: 17, position: 'F', three: 6, drive: 4, pass: 4, reb: 6, def: 6 },
  { id: 'pritchard', name: 'Payton Pritchard', number: 11, position: 'G', three: 8, drive: 4, pass: 6, reb: 4, def: 4 },
  { id: 'strus', name: 'Max Strus', number: 2, position: 'G', three: 8, drive: 4, pass: 6, reb: 6, def: 4 },
  { id: 'thybulle', name: 'Matisse Thybulle', number: 4, position: 'G', three: 4, drive: 4, pass: 4, reb: 4, def: 8 },
  { id: 'kuzma', name: 'Kyle Kuzma', number: 18, position: 'F', three: 6, drive: 6, pass: 6, reb: 8, def: 4 },
]

const BY_ID: ReadonlyMap<string, Card> = new Map(ROSTER.map((c) => [c.id, c]))

export function findCard(id: string): Card | undefined {
  return BY_ID.get(id)
}

/** Throws on unknown ids. Use for ids that came out of a MatchState. */
export function getCard(id: string): Card {
  const card = BY_ID.get(id)
  if (!card) throw new Error(`unknown card id: ${id}`)
  return card
}

export type CardTier = 'elite' | 'star' | 'starter' | 'role'

/**
 * Tier comes from the three headline dice (3PT + DRIVE + DEF), as before v3, so the pool mix did not move.
 * Elite: owns a d12 among them and 24+ total. Star: 24+ total. Starter: 18-22. Role: 16 or less.
 */
export function cardTier(card: Card): CardTier {
  const sum = card.three + card.drive + card.def
  if (sum >= 24) return Math.max(card.three, card.drive, card.def) >= 12 ? 'elite' : 'star'
  return sum >= 18 ? 'starter' : 'role'
}

/** d4 = 1 step ... d12 = 5 steps. The only thing star ratings and OVR are built from. */
export function dieStep(die: number): number {
  return die / 2 - 1
}

function clampStars(n: number): number {
  return Math.max(1, Math.min(5, n))
}

/** OFF stars (1-5): the best of 3PT / DRIVE / PASS counts double, the second best once. */
export function offStars(card: Card): number {
  const s = [dieStep(card.three), dieStep(card.drive), dieStep(card.pass)].sort((a, b) => b - a)
  return clampStars(Math.round((2 * s[0] + s[1]) / 3))
}

/** DEF stars (1-5): DEF counts double, REB once. */
export function defStars(card: Card): number {
  return clampStars(Math.round((2 * dieStep(card.def) + dieStep(card.reb)) / 3))
}

/** OVR (60s to 99): 59 + 3x the best die step + 2x the second best + the other three. */
export function ovr(card: Card): number {
  const s = [card.three, card.drive, card.pass, card.reb, card.def].map(dieStep).sort((a, b) => b - a)
  return Math.min(99, 59 + 3 * s[0] + 2 * s[1] + s[2] + s[3] + s[4])
}

/** How many of each tier are dealt into a game's draft pool (18 cards, 14 get drafted). */
export const POOL_MIX: Readonly<Record<CardTier, number>> = { elite: 3, star: 5, starter: 5, role: 5 }
export const POOL_SIZE = POOL_MIX.elite + POOL_MIX.star + POOL_MIX.starter + POOL_MIX.role

let fixedPool: readonly string[] | null = null

/** Test hook: pin the dealt pool. Pass null to go back to seeded deals. */
export function setFixedPool(ids: readonly string[] | null): void {
  fixedPool = ids ? [...ids] : null
}

/** The draft pool for a match: a seeded deal from the full roster, strongest tier first. Same seed, same pool. */
export function dealPool(seed: string): string[] {
  if (fixedPool) return [...fixedPool]
  const rng = rngFromSeed(`${seed}|pool`)
  const out: string[] = []
  for (const tier of ['elite', 'star', 'starter', 'role'] as const) {
    const bag = ROSTER.filter((c) => cardTier(c) === tier).map((c) => c.id)
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const t = bag[i]
      bag[i] = bag[j]
      bag[j] = t
    }
    out.push(...bag.slice(0, POOL_MIX[tier]))
  }
  return out
}
