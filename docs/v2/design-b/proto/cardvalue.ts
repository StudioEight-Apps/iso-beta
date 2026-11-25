/**
 * Balance tool: standalone value of every card in expected points per run, net of chemistry.
 * Fits  value(A vs B) = sum_A v[c] - sum_B v[c] + k * (chemA - chemB)  over random six-card rosters from random deals.
 * Usage: node docs/v2/design-b/proto/cardvalue.ts [samples] [write]
 * 'write' saves card-values.json, which build-cards.ts turns into costs (cost = 2 + 9.5 x value, rounded).
 */
import { rosterValue } from './bots.ts'
import { CARDS, chemistry, dealPool } from './engine.ts'
import { rngFromSeed } from './prng.ts'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const N = +(process.argv[2] ?? 20000)
const rng = rngFromSeed('cardvalue')
const idx = new Map(CARDS.map((c, i) => [c.id, i]))
const p = CARDS.length + 2
const A = Array.from({ length: p }, () => new Float64Array(p + 1))
for (let i = 0; i < N; i++) {
  const pool = dealPool(`cv${i}`)
  for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]] }
  const a = pool.slice(0, 6), b = pool.slice(6, 12)
  const x = new Float64Array(p)
  for (const id of a) x[idx.get(id)!] += 1
  for (const id of b) x[idx.get(id)!] -= 1
  x[p - 2] = chemistry(a).total - chemistry(b).total
  x[p - 1] = 1
  const y = rosterValue(a, b)
  for (let r = 0; r < p; r++) if (x[r] !== 0) { for (let c = 0; c < p; c++) A[r][c] += x[r] * x[c]; A[r][p] += x[r] * y }
}
for (let r = 0; r < p - 2; r++) A[r][r] += 1e-6 // card values are only identified up to a constant; ridge pins it
for (let c = 0; c < p; c++) { let m = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]]; for (let r = 0; r < p; r++) if (r !== c && A[r][c] !== 0) { const f = A[r][c] / A[c][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k] } }
const beta = A.map((row, i) => row[p] / row[i])
const vmin = Math.min(...beta.slice(0, CARDS.length))
const rows = CARDS.map((c, i) => ({ id: c.id, v: beta[i] - vmin, cost: c.cost, tier: c.tier, bars: `${c.three}/${c.drive}/${c.def}` })).sort((a, b) => b.v - a.v)
// credits per point of value, fitted through the current costs
const sxy = rows.reduce((s, r) => s + r.v * r.cost, 0), sx = rows.reduce((s, r) => s + r.v, 0), sy = rows.reduce((s, r) => s + r.cost, 0), sxx = rows.reduce((s, r) => s + r.v * r.v, 0)
const slope = (rows.length * sxy - sx * sy) / (rows.length * sxx - sx * sx), icpt = (sy - slope * sx) / rows.length
console.log(`chem point = ${beta[p - 2].toFixed(4)} pts/run; cost ~= ${icpt.toFixed(2)} + ${slope.toFixed(2)} * value`)
if (process.argv[3] === 'write') writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'card-values.json'), JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, +r.v.toFixed(3)])), null, 1) + '\n')
for (const r of rows) console.log(`${r.id.padEnd(11)} ${r.tier.padEnd(7)} ${r.bars.padEnd(9)} value ${r.v.toFixed(2)}  cost ${String(r.cost).padStart(2)}  fair ${(icpt + slope * r.v).toFixed(1)}  ${Math.abs(icpt + slope * r.v - r.cost) >= 1.5 ? '<<' : ''}`)
