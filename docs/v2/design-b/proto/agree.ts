/**
 * Is the strongest drafter secretly just one simple rule? For every pick in Planner-vs-Planner drafts, ask each
 * one-line rule what it would have taken and count how often it matches the Planner's pick.
 *   node docs/v2/design-b/proto/agree.ts [drafts=600]
 */
import { DRAFTERS } from './bots.ts'
import { DRAFT_ORDER, card, dealPool, legalPicks } from './engine.ts'
import { rngFromSeed } from './prng.ts'

const N = +(process.argv[2] ?? 600)
const rules = ['TopRated', 'SpreadRated', 'Stoppers', 'ChemOnly', 'FitShoot', 'FitDrive', 'FitDefend', 'FitSpread', 'FitStars']
const hit: Record<string, number> = Object.fromEntries(rules.map((r) => [r, 0]))
let picks = 0
let any = 0
let priciest = 0
let firstElite = 0
for (let i = 0; i < N; i++) {
  let pool = dealPool(`agree-${i}`)
  const rosters: [string[], string[]] = [[], []]
  const rng = rngFromSeed(`agree-${i}|d`)
  DRAFT_ORDER.forEach((s, k) => {
    if (!legalPicks(pool, rosters[s]).length) { rosters[s].push(`rookie-${s}-${rosters[s].length}`); return }
    const id = DRAFTERS.Planner.pick(pool, rosters[s], rosters[1 - s], rng)!
    picks++
    let matched = false
    for (const r of rules) if (DRAFTERS[r].pick(pool, rosters[s], rosters[1 - s], rng) === id) { hit[r]++; matched = true }
    if (matched) any++
    if (card(id).cost === Math.max(...legalPicks(pool, rosters[s]).map((x) => card(x).cost))) priciest++
    if (k === 0 && card(id).tier === 'elite') firstElite++
    rosters[s].push(id)
    pool = pool.filter((x) => x !== id)
  })
}
console.log(`Planner picks examined: ${picks} (${N} drafts)`)
for (const r of rules) console.log(`  same pick as ${r.padEnd(12)} ${((100 * hit[r]) / picks).toFixed(1)}%`)
console.log(`  same pick as at least one of the nine rules ${((100 * any) / picks).toFixed(1)}%`)
console.log(`  took the most expensive card it could afford ${((100 * priciest) / picks).toFixed(1)}%`)
console.log(`  opened the draft with an elite card ${((100 * firstElite) / N).toFixed(1)}%`)
