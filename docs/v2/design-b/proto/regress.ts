/** Balance tool: how much is a bar point of each kind (and a chem point) worth in expected points per run? */
import { rosterValue } from './bots.ts'
import { CFG, card, chemistry, dealPool } from './engine.ts'
import { rngFromSeed } from './prng.ts'
for (const kv of (process.argv[2] ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); (CFG as any)[k] = +v }
const rng = rngFromSeed('regress')
const X: number[][] = [], Y: number[] = []
const feats = (r: string[]) => {
  const cs = r.map(card)
  const top = [...cs].sort((a, b) => Math.max(b.three, b.drive) - Math.max(a.three, a.drive))
  return [
    cs.reduce((s, c) => s + Math.max(c.three, c.drive), 0), cs.reduce((s, c) => s + Math.min(c.three, c.drive), 0), cs.reduce((s, c) => s + c.def, 0),
    chemistry(r).total, Math.max(top[0].three, top[0].drive) + Math.max(top[1].three, top[1].drive),
  ]
}
for (let i = 0; i < 6000; i++) {
  const pool = dealPool(`rg${i}`)
  for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]] }
  const a = pool.slice(0, 6), b = pool.slice(6, 12)
  const fa = feats(a), fb = feats(b)
  X.push([1, ...fa.map((v, k) => v - fb[k])]); Y.push(rosterValue(a, b))
}
const p = X[0].length
const A = Array.from({ length: p }, () => new Array(p + 1).fill(0))
for (let i = 0; i < X.length; i++) for (let r = 0; r < p; r++) { for (let c = 0; c < p; c++) A[r][c] += X[i][r] * X[i][c]; A[r][p] += X[i][r] * Y[i] }
for (let c = 0; c < p; c++) { let m = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]]; for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k] } }
const beta = A.map((row, i) => row[p] / row[i])
console.log('points per run per unit of (my - their):', ['const', 'best scoring bar', 'other scoring bar', 'defence bar', 'chem', 'top-2 scorers extra'].map((n, i) => `${n}=${beta[i].toFixed(4)}`).join('  '))
