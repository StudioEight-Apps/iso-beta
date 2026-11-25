/**
 * Price the cards. Step 1: price = worth of the card in an average lineup (plus a manual allowance for abilities
 * that only switch on inside a built roster). Step 2: let two skilled GMs draft thousands of pools and nudge the
 * price of anything they nearly always / nearly never take. Writes costs.json; then run gen_cards.ts.
 * Usage: node calibrate.ts [draftsPerRound=2000] [rounds=5]
 */
import { writeFileSync } from 'node:fs'
import { loadCards } from './engine.ts'
import { DRAFTERS, initWorth } from './bots.ts'
import { runDraft } from './match.ts'

const all = loadCards()
const worth = initWorth(all)
/** Abilities the average-lineup test cannot see (they need a link or a specific opponent). Points per 100 possessions. */
const ALLOWANCE: Record<string, number> = { jokic: 5, giannis: 3, davis: 3, luka: 1.5, morant: -1.5 }
const price = (w: number) => (w >= 10 ? 6 : w >= 6 ? 5 : w >= 3.5 ? 4 : w >= 1 ? 3 : w >= -2 ? 2 : 1)
for (const c of all) c.cost = price(worth.get(c.id)! * 100 + (ALLOWANCE[c.id] ?? 0))

const n = +(process.argv[2] ?? 2000), rounds = +(process.argv[3] ?? 5)
for (let r = 0; r < rounds; r++) {
  const seen = new Map<string, number>(), taken = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const d = runDraft(`cal-${r}-${i}`, all, [DRAFTERS.builder, DRAFTERS.builder])
    for (const c of [...d.available, ...d.rosters[0], ...d.rosters[1]]) seen.set(c.id, (seen.get(c.id) ?? 0) + 1)
    for (const c of [...d.rosters[0], ...d.rosters[1]]) taken.set(c.id, (taken.get(c.id) ?? 0) + 1)
  }
  const moves: string[] = []
  for (const c of all) {
    const rate = (taken.get(c.id) ?? 0) / (seen.get(c.id) ?? 1)
    if (r < rounds - 1) {
      if (rate > 0.85 && c.cost < 8) { c.cost++; moves.push(`${c.id}+`) }
      else if (rate < 0.2 && c.cost > 1) { c.cost--; moves.push(`${c.id}-`) }
    } else moves.push(`${c.id}:$${c.cost}:${(rate * 100).toFixed(0)}%`)
  }
  console.log(`round ${r}:`, moves.join(' '))
}
writeFileSync(new URL('costs.json', new URL('.', import.meta.url)), JSON.stringify(Object.fromEntries(all.map((c) => [c.id, c.cost]))) + '\n')
