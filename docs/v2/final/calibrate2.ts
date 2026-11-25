/**
 * Price pass 2: nudge prices by RESULTS, not by popularity. Two skilled GMs (builder + sharp coach) play thousands
 * of full matches; a card whose owner wins too often gets dearer, one whose owner loses too often gets cheaper.
 * Rewrites costs.json and the cost field of cards.json after every round.
 *   node calibrate2.ts [matchesPerRound=8000] [rounds=3] [procs=8]
 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadCards } from './iso2.ts'
import { COACHES, DRAFTERS, initWorth } from './bots.ts'
import { playMatch } from './match.ts'

const HERE = new URL('.', import.meta.url)
const args = process.argv.slice(2)

if (args[0] === 'worker') {
  const [, tag, from, to] = args
  const all = loadCards()
  initWorth(all)
  const st: Record<string, [number, number, number]> = {} // dealt, picked, wins
  for (const c of all) st[c.id] = [0, 0, 0]
  const p = { drafter: DRAFTERS.builder, coach: COACHES.sharp }
  for (let i = +from; i < +to; i++) {
    const m = playMatch(`${tag}|${i}`, all, [p, p])
    for (const c of m.draft.available) st[c.id][0]++
    for (const s of [0, 1] as const) for (const c of m.draft.rosters[s]) {
      if (!st[c.id]) continue
      st[c.id][0]++; st[c.id][1]++
      if (m.result.winner === s) st[c.id][2]++
    }
  }
  console.log(JSON.stringify(st))
} else {
  const n = +(args[0] ?? 8000), rounds = +(args[1] ?? 3), procs = +(args[2] ?? 8)
  const HI = +(args[3] ?? 54), LO = +(args[4] ?? 46), MAXC = 9
  const run = (tag: string, a: number, b: number) => new Promise<Record<string, [number, number, number]>>((res, rej) => {
    const ch = spawn(process.execPath, [fileURLToPath(import.meta.url), 'worker', tag, String(a), String(b)], { stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    ch.stdout.on('data', (d) => (out += d))
    ch.on('close', (code) => (code === 0 ? res(JSON.parse(out)) : rej(new Error(`worker exit ${code}`))))
  })
  for (let r = 0; r < rounds; r++) {
    const per = Math.ceil(n / procs)
    const parts = await Promise.all(Array.from({ length: procs }, (_, k) => run(`cal2-${r}`, k * per, Math.min(n, (k + 1) * per))))
    const file = JSON.parse(readFileSync(new URL('cards.json', HERE), 'utf8'))
    const moves: string[] = []
    let worst = 0
    for (const c of file.cards) {
      let dealt = 0, picked = 0, wins = 0
      for (const p of parts) { dealt += p[c.id][0]; picked += p[c.id][1]; wins += p[c.id][2] }
      const rate = (100 * picked) / Math.max(1, dealt), win = (100 * wins) / Math.max(1, picked)
      const se = 50 / Math.sqrt(Math.max(1, picked))
      worst = Math.max(worst, picked > 300 ? Math.abs(win - 50) : 0)
      if (r === rounds - 1) continue // last round only measures
      if ((win > HI && win - 50 > 2 * se) || rate > 93) { if (c.cost < MAXC) { c.cost++; moves.push(`${c.id}+ (${win.toFixed(0)}%w ${rate.toFixed(0)}%p)`) } }
      else if ((win < LO && 50 - win > 2 * se) || rate < 12) { if (c.cost > 1) { c.cost--; moves.push(`${c.id}- (${win.toFixed(0)}%w ${rate.toFixed(0)}%p)`) } }
    }
    console.log(`round ${r}: worst |win-50| = ${worst.toFixed(1)}; moves: ${moves.join(' ') || 'none'}`)
    writeFileSync(new URL('cards.json', HERE), `{\n "note": ${JSON.stringify(file.note)},\n "cards": [\n${file.cards.map((c: unknown) => '  ' + JSON.stringify(c)).join(',\n')}\n ]\n}\n`)
    writeFileSync(new URL('costs.json', HERE), JSON.stringify(Object.fromEntries(file.cards.map((c: any) => [c.id, c.cost]))) + '\n')
  }
}
