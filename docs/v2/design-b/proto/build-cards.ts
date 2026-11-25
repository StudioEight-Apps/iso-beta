/**
 * Regenerates ../cards.json from src/game/roster.ts (read only) plus the design-b fields below.
 * Run:  node docs/v2/design-b/proto/build-cards.ts     (or: npx tsx ...)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

type Raw = { id: string; name: string; position: 'G' | 'F' | 'C'; three: number; drive: number; def: number }
const here = dirname(fileURLToPath(import.meta.url))
/** roster.ts is parsed as text (never imported, never edited) so this runs under plain node and tsx alike. */
const src = readFileSync(join(here, '..', '..', '..', '..', 'src', 'game', 'roster.ts'), 'utf8')
const ROSTER: Raw[] = [...src.matchAll(/\{ id: '([a-z]+)', name: '((?:[^'\\]|\\.)+)', number: \d+, position: '([GFC])', three: (\d+), drive: (\d+), def: (\d+) \}/g)].map(
  (m) => ({ id: m[1], name: m[2].replace(/\\'/g, "'"), position: m[3] as Raw['position'], three: +m[4], drive: +m[5], def: +m[6] }),
)
if (ROSTER.length < 60) throw new Error(`parsed only ${ROSTER.length} cards`)
/** Same tier rule as roster.ts cardTier(). */
function cardTier(c: Raw): 'elite' | 'star' | 'starter' | 'role' {
  const sum = c.three + c.drive + c.def
  if (sum >= 24) return Math.max(c.three, c.drive, c.def) >= 12 ? 'elite' : 'star'
  return sum >= 18 ? 'starter' : 'role'
}

const TRAITS: Record<string, string[]> = {
  curry: ['Sniper', 'Alpha'], durant: ['Sniper', 'Alpha'], kawhi: ['Lockdown', 'Alpha'], giannis: ['Slasher', 'Alpha'],
  embiid: ['Anchor', 'Alpha'], jokic: ['Playmaker', 'Alpha'], luka: ['Playmaker', 'Alpha'], sga: ['Slasher', 'Alpha'],
  tatum: ['Sniper', 'Alpha'], wemby: ['Anchor', 'Roller'], ant: ['Slasher', 'Alpha'], lebron: ['Playmaker', 'Alpha'],
  davis: ['Anchor'], morant: ['Slasher', 'Alpha'], lillard: ['Sniper', 'Alpha'], booker: ['Sniper', 'Alpha'],
  mitchell: ['Slasher', 'Alpha'], brunson: ['Playmaker', 'Alpha'], haliburton: ['Playmaker', 'Sniper'], butler: ['Lockdown', 'Alpha'],
  towns: ['Sniper', 'Roller'], banchero: ['Slasher', 'Alpha'], irving: ['Slasher', 'Alpha'], harden: ['Playmaker', 'Alpha'],
  george: ['Sniper', 'Lockdown'], adebayo: ['Anchor', 'Roller'], siakam: ['Slasher'], fox: ['Slasher', 'Playmaker'],
  maxey: ['Sniper', 'Slasher'], young: ['Playmaker', 'Alpha'], jwill: ['Slasher', 'Lockdown'], cunningham: ['Playmaker', 'Alpha'],
  holmgren: ['Anchor', 'Sniper'], holiday: ['Lockdown', 'Glue'], white: ['Lockdown', 'Glue'], bridges: ['Lockdown', 'Sniper'],
  anunoby: ['Lockdown', 'Glue'], dgreen: ['Playmaker', 'Lockdown'], gobert: ['Anchor', 'Roller'], gordon: ['Roller', 'Glue'],
  klay: ['Sniper'], reaves: ['Playmaker', 'Sniper'], murray: ['Playmaker', 'Sniper'], porzingis: ['Anchor', 'Sniper'],
  middleton: ['Sniper', 'Glue'], jjj: ['Anchor', 'Lockdown'], mccollum: ['Sniper'], derozan: ['Slasher', 'Alpha'],
  wagner: ['Slasher', 'Glue'], sengun: ['Playmaker', 'Roller'], allen: ['Anchor', 'Roller'], hart: ['Slasher', 'Glue'],
  lopez: ['Anchor', 'Sniper'], caruso: ['Lockdown', 'Glue'], dort: ['Lockdown'], kcp: ['Sniper', 'Glue'],
  hjones: ['Lockdown', 'Glue'], reid: ['Sniper', 'Roller'], portis: ['Roller', 'Glue'], mcconnell: ['Playmaker', 'Glue'],
  looney: ['Roller', 'Glue'], dfs: ['Sniper', 'Glue'], pritchard: ['Sniper'], strus: ['Sniper'],
  thybulle: ['Lockdown'], kuzma: ['Slasher'],
}

const ABILITIES: Record<string, { id: string; name: string; text: string }> = {
  curry: { id: 'gravity', name: 'Gravity', text: 'On the floor but NOT your go-to: your go-to gets +2.' },
  kawhi: { id: 'clamp', name: 'Clamp', text: 'On the floor, when your Help lands on their go-to: the help is +6 instead of +4.' },
  giannis: { id: 'downhill', name: 'Downhill', text: '+1 Inside for each Sniper on the floor with him (max +3).' },
  sga: { id: 'wrongfoot', name: 'Wrong-Foot', text: 'As your go-to: +2 when the defence\'s coverage is not set for his shot.' },
  wemby: { id: 'noflyzone', name: 'No-Fly Zone', text: 'On the floor, when you Pack the Paint: the coverage is worth 1 more.' },
  lebron: { id: 'floorgeneral', name: 'Floor General', text: 'When he IS your go-to: his four teammates each get +2.' },
  davis: { id: 'rimrunner', name: 'Rim Runner', text: '+2 Inside while a Playmaker is on the floor with him.' },
  morant: { id: 'fastbreak', name: 'Fast Break', text: '+1 Inside for each Lockdown on the floor with him (max +3).' },
  lillard: { id: 'lateclock', name: 'Late Clock', text: 'As your go-to shooting Outside in runs 5, 6 and overtime: +3.' },
}

const VALUES: Record<string, number> = JSON.parse(readFileSync(join(here, 'card-values.json'), 'utf8'))
/** Cost adjustments found by the balance pass (tune-costs.py; see results.md). */
const COST_ADJ: Record<string, number> = existsSync(join(here, 'cost-adj.json')) ? JSON.parse(readFileSync(join(here, 'cost-adj.json'), 'utf8')) : {}

const cards = ROSTER.map((c) => {
  const tier = cardTier(c)
  const traits = TRAITS[c.id]
  if (!traits) throw new Error(`no traits for ${c.id}`)
  // Cost = measured standalone value (card-values.json, produced by cardvalue.ts) on a 2..12 credit scale.
  const v = VALUES[c.id]
  if (v === undefined) throw new Error(`no value for ${c.id}; run cardvalue.ts write`)
  const cost = Math.max(2, Math.min(13, Math.max(2, Math.min(12, Math.round(2 + 9.5 * v))) + (COST_ADJ[c.id] ?? 0)))
  return {
    id: c.id, name: c.name, position: c.position,
    three: c.three, drive: c.drive, def: c.def,
    cost, tier, traits,
    ability: ABILITIES[c.id] ?? null,
  }
})
writeFileSync(join(here, '..', 'cards.json'), '[\n' + cards.map((c) => ' ' + JSON.stringify(c)).join(',\n') + '\n]\n')
console.log(`wrote ${cards.length} cards; tiers:`, cards.reduce((m: any, c) => ((m[c.tier] = (m[c.tier] ?? 0) + 1), m), {}))
