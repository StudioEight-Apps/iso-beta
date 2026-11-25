/**
 * Builds cards.json from src/game/roster.ts (read-only) plus the design-A fields: cost, traits, ability.
 * Usage: node gen_cards.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const HERE = new URL('.', import.meta.url)
const src = readFileSync(new URL('../../../src/game/roster.ts', HERE), 'utf8')

type T = 'Sniper' | 'Slasher' | 'Playmaker' | 'Anchor' | 'Stopper' | 'Glue' | 'Ball-Dominant'
const SN: T = 'Sniper', SL: T = 'Slasher', PM: T = 'Playmaker', AN: T = 'Anchor', ST: T = 'Stopper', GL: T = 'Glue', BD: T = 'Ball-Dominant'

const TRAITS: Record<string, T[]> = {
  curry: [SN, PM], durant: [SN], kawhi: [ST], giannis: [SL, BD], embiid: [AN, BD], jokic: [PM], luka: [PM, BD],
  sga: [SL, BD], tatum: [SN], wemby: [AN], ant: [SL, BD], lebron: [PM, SL], davis: [AN], morant: [SL, BD],
  lillard: [SN, BD], booker: [SN, BD], mitchell: [SL, BD], brunson: [PM, BD], haliburton: [PM, SN], butler: [SL, ST],
  towns: [SN], banchero: [SL, BD], irving: [SL, BD], harden: [PM, BD], george: [SN, ST], adebayo: [AN],
  siakam: [SL], fox: [SL], maxey: [SL, SN], young: [PM, BD], jwill: [SL], cunningham: [PM, BD], holmgren: [AN],
  holiday: [ST, GL], white: [ST], bridges: [ST], anunoby: [ST], dgreen: [PM, GL], gobert: [AN], gordon: [SL, GL],
  klay: [SN], reaves: [PM], murray: [PM], porzingis: [AN], middleton: [SN], jjj: [AN], mccollum: [SN],
  derozan: [SL, BD], wagner: [SL], sengun: [PM], allen: [AN], hart: [GL], lopez: [AN], caruso: [ST], dort: [ST],
  kcp: [GL], hjones: [ST], reid: [SN], portis: [GL], mcconnell: [PM], looney: [GL], dfs: [GL], pritchard: [SN],
  strus: [SN], thybulle: [ST], kuzma: [SL],
}

const ABILITIES: Record<string, { id: string; name: string; text: string }> = {
  curry: { id: 'gravity', name: 'Gravity', text: 'When you call Let It Fly, every teammate gets +2 SHOOT.' },
  lillard: { id: 'closer', name: 'Closer', text: 'In the 4th quarter (and overtime) he gets +3 SHOOT.' },
  kawhi: { id: 'clamp', name: 'Clamp', text: 'When you Shadow a player, that player loses 6 instead of 4.' },
  giannis: { id: 'runway', name: 'Runway', text: '+2 RIM while your Spacing link is on (three shooters around him).' },
  sga: { id: 'iso', name: 'Isolation Artist', text: '+2 RIM in any quarter you Feed him.' },
  wemby: { id: 'eraser', name: 'Eraser', text: 'When you call Protect the Paint, opponents lose 5 RIM instead of 3.' },
  lebron: { id: 'pointforward', name: 'Point Forward', text: 'When you call Move the Ball, every teammate gets +1 SHOOT and +1 RIM.' },
  davis: { id: 'backline', name: 'Back Line', text: 'While your Lockdown link is on, opponents get -1.5 RIM.' },
  morant: { id: 'abovetherim', name: 'Above the Rim', text: '+2 RIM when the other team has no Anchor at centre.' },
  jokic: { id: 'hub', name: 'Hub', text: 'While your Drive & Kick link is on, every teammate gets +1 SHOOT and +1 RIM.' },
  durant: { id: 'costar', name: 'Co-Star', text: '+2 SHOOT and +2 RIM in any quarter you Feed a teammate.' },
  luka: { id: 'maestro', name: 'Maestro', text: 'In any quarter you Feed him, every teammate gets +2 SHOOT.' },
  embiid: { id: 'postup', name: 'Post Up', text: '+2 RIM when you call Attack the Rim.' },
}

/** Prices come from calibrate.ts (costs.json). Without that file a rough price from the rating total is used. */
const costFile = new URL('costs.json', HERE)
const COST_OVERRIDE: Record<string, number> = existsSync(costFile) ? JSON.parse(readFileSync(costFile, 'utf8')) : {}

function baseCost(sum: number, hasAbility: boolean): number {
  const c = sum >= 28 ? 6 : sum >= 26 ? 5 : sum >= 24 ? 4 : sum >= 22 ? 3 : sum >= 18 ? 2 : 1
  return Math.min(6, c + (hasAbility ? 1 : 0))
}

const re = /\{ id: '([^']+)', name: '((?:[^'\\]|\\.)+)', number: \d+, position: '([GFC])', three: (\d+), drive: (\d+), def: (\d+) \}/g
const cards: unknown[] = []
for (const m of src.matchAll(re)) {
  const [, id, rawName, position, t, d, f] = m
  const three = +t, drive = +d, def = +f
  const sum = three + drive + def
  const tier = sum >= 24 ? (Math.max(three, drive, def) >= 12 ? 'elite' : 'star') : sum >= 18 ? 'starter' : 'role'
  const ability = ABILITIES[id]
  if (!TRAITS[id]) throw new Error(`no traits for ${id}`)
  cards.push({
    id, name: rawName.replace(/\\'/g, "'"), position, three, drive, def,
    cost: COST_OVERRIDE[id] ?? baseCost(sum, !!ability), tier, traits: TRAITS[id], ...(ability ? { ability } : {}),
  })
}
for (const id of Object.keys(TRAITS)) if (!cards.some((c: any) => c.id === id)) throw new Error(`unknown id ${id}`)
const note = 'ISO v2 design A. Bars: three=SHOOT, drive=RIM, def=DEF (scale 4-12). cost is the draft price.'
writeFileSync(
  new URL('cards.json', HERE),
  `{\n "note": ${JSON.stringify(note)},\n "cards": [\n${cards.map((c) => '  ' + JSON.stringify(c)).join(',\n')}\n ]\n}\n`,
)
console.log(`wrote ${cards.length} cards`)
