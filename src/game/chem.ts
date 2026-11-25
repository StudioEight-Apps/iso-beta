import { getCard } from './roster'
import { traitsOf } from './traits'
import type { Trait } from './traits'

/**
 * v3 chemistry: three team links, each a plain tabletop rule about the five on the floor.
 * The v2 links that needed fractions (Spacing, Glue Guy, One Ball, the 0.1-per-point bonus) are gone.
 */
export interface ChemLink {
  id: 'drivekick' | 'pickroll' | 'lockdown'
  name: string
  /** What switches it on, in plain words. */
  need: string
  /** What it does, in plain words. */
  text: string
}

export interface TeamChem {
  links: ChemLink[]
}

export const CHEM_LINKS: readonly ChemLink[] = [
  { id: 'drivekick', name: 'Drive & Kick', need: 'a Slasher and a Sniper on the floor', text: '+1 to your drives.' },
  { id: 'pickroll', name: 'Pick & Roll', need: 'a Playmaker and a centre on the floor', text: 'Your passes are dimes on a 4 or higher.' },
  { id: 'lockdown', name: 'Lockdown', need: 'a Stopper and an Anchor on the floor', text: '+1 to your defence against drives.' },
]

const has = (ids: readonly string[], t: Trait) => ids.filter((id) => traitsOf(id).includes(t))
const pair = (a: readonly string[], b: readonly string[]) => a.some((x) => b.some((y) => x !== y))

const cache = new Map<string, TeamChem>()

/** Chemistry for the players on the floor. Pass null for empty seats (while drafting). */
export function teamChem(lineup: readonly (string | null)[]): TeamChem {
  const ids = lineup.filter((id): id is string => !!id)
  const key = ids.join(',')
  const hit = cache.get(key)
  if (hit) return hit
  const on: ChemLink['id'][] = []
  if (pair(has(ids, 'Slasher'), has(ids, 'Sniper'))) on.push('drivekick')
  if (pair(has(ids, 'Playmaker'), ids.filter((id) => getCard(id).position === 'C'))) on.push('pickroll')
  if (pair(has(ids, 'Stopper'), has(ids, 'Anchor'))) on.push('lockdown')
  const chem: TeamChem = { links: CHEM_LINKS.filter((l) => on.includes(l.id)) }
  if (cache.size > 5000) cache.clear()
  cache.set(key, chem)
  return chem
}

export function hasLink(chem: TeamChem, id: ChemLink['id']): boolean {
  return chem.links.some((l) => l.id === id)
}
