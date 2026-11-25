/**
 * Controlled check that the coaching reads interact with roster shape. No randomness: exact expected points.
 *   node docs/v2/design-b/proto/shape.ts
 * Five made-up offences with the SAME total of scoring bars face the same plain defence (all Defence 8, no traits,
 * equal chem). For each we print what a run is worth
 *   - if the defence guesses blindly (help and wall picked at random),
 *   - if the defence plays its best unexploitable mix (the offence mixing as well as it can),
 *   - and how many go-to/shot options the offence actually keeps alive in that mix.
 */
import { solve } from './bots.ts'
import { N_DEF, N_OFF, ROOKIE, buildSideCards, payoff } from './engine.ts'
import type { Card, Position } from './engine.ts'

const POS: Position[] = ['G', 'G', 'F', 'F', 'C']
const mk = (tag: string, bars: [number, number][]): Card[] => bars.map(([three, drive], i) => ({ ...ROOKIE, id: `${tag}${i}`, name: `${tag}${i}`, position: POS[i], three, drive, def: 8 }))
const defence = mk('d', [[4, 4], [4, 4], [4, 4], [4, 4], [4, 4]])
const shapes: [string, [number, number][]][] = [
  ['One star, inside only (12 + four 6s)', [[4, 12], [4, 6], [4, 6], [4, 6], [4, 6]]],
  ['Two stars, inside only (10,10,6,6,4)', [[4, 10], [4, 10], [4, 6], [4, 6], [4, 4]]],
  ['Balanced, inside only (8,8,8,6,6)', [[4, 8], [4, 8], [4, 8], [4, 6], [4, 6]]],
  ['Balanced, inside + outside (8,8,8,6,6)', [[8, 4], [4, 8], [8, 4], [4, 6], [6, 4]]],
  ['One two-way star (12/12 + four 6s)', [[12, 12], [6, 4], [4, 6], [6, 4], [4, 6]]],
]
console.log('| Offence (same defence, same chem) | points per run vs blind defence | vs best defence | lost to being read | go-to/shot options kept alive (5%+) | top option share |')
console.log('|---|---|---|---|---|---|')
for (const [name, bars] of shapes) {
  const m = payoff(buildSideCards(mk('o', bars), defence, 0, 0, 1))
  let blind = -Infinity
  for (let o = 0; o < N_OFF; o++) {
    let v = 0
    for (let d = 0; d < N_DEF; d++) v += m[o * N_DEF + d] / N_DEF
    blind = Math.max(blind, v)
  }
  const sol = solve(m, 20000)
  const alive = [...sol.off].filter((p) => p >= 0.05).length
  console.log(`| ${name} | ${blind.toFixed(2)} | ${sol.value.toFixed(2)} | ${(blind - sol.value).toFixed(2)} | ${alive} | ${(100 * Math.max(...sol.off)).toFixed(0)}% |`)
}
