import { cardTier } from '../../game'
import type { Card, CardTier, DieSize } from '../../game'

export type Tier = CardTier

/** Elite, Star, Starter or Role. Elite drives the iridescent edge. */
export function tierOf(card: Card): Tier {
  return cardTier(card)
}

export const TIER_LABEL: Record<Tier, string> = { elite: 'Elite', star: 'Star', starter: 'Starter', role: 'Role' }

export type SkillKey = 'three' | 'drive' | 'pass' | 'reb' | 'def'

export interface Skill {
  key: SkillKey
  /** Short label printed under the die on the card front. */
  label: string
  /** Violet for the dice you attack with, cyan for the dice you stop with. */
  tone: 'off' | 'def'
  /** One plain line for the card back: when this die is rolled. */
  what: string
}

/** The five skill dice, in the order they are printed on every card. */
export const SKILLS: readonly Skill[] = [
  { key: 'three', label: '3PT', tone: 'off', what: 'Rolled on a three. Worth 3.' },
  { key: 'drive', label: 'DRIVE', tone: 'off', what: 'Rolled on a drive. Worth 2.' },
  { key: 'pass', label: 'PASS', tone: 'off', what: 'Rolled when he passes. 5+ is a dime.' },
  { key: 'reb', label: 'REB', tone: 'def', what: 'Rolled for the board after a miss.' },
  { key: 'def', label: 'DEF', tone: 'def', what: 'Rolled against his man\'s shot.' },
]

/** One-word read of the card, derived only from its dice. */
export function archetypeOf(card: Card): string {
  const top = Math.max(card.three, card.drive, card.def)
  const isThree = card.three === top
  const isDrive = card.drive === top
  const isDef = card.def === top
  if (isDef && (isThree || isDrive)) return 'Two-way'
  if (isDef) return 'Lockdown'
  if (isThree && isDrive) return 'Scorer'
  if (isThree) return 'Sniper'
  return 'Slasher'
}

/** d4..d12 mapped to 1..5 strength pips. */
export function pipsOf(size: DieSize): number {
  return (size - 2) / 2
}
