/**
 * All measurements quoted in results.md. Usage (from the iso-beta folder):
 *   npx tsx docs/v2/design-b/proto/experiments.ts <name> [--n 20000] [--procs 8]
 *   node    docs/v2/design-b/proto/experiments.ts <name> ...        (Node 23+ runs .ts directly)
 * names: req1 | drafters | coaches | cards | calls | game | all
 * Match i of every experiment uses seed "<name>-<pairing>-<i>", so reruns give identical numbers.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DRAFTERS, habitCoach, heroCoach, mixCoach, playMatch, randomCoach, readerCoach, runDraft, solve } from './bots.ts'
import type { Coach } from './bots.ts'
import { CARDS, CFG, buildSide, card, chemistry, floorOf, payoff, threat } from './engine.ts'
import type { MatchState } from './engine.ts'

type Acc = Record<string, number>
const add = (a: Acc, k: string, v = 1) => { a[k] = (a[k] ?? 0) + v }
const COACHES: Record<string, Coach> = {
  Hero: heroCoach, Random: randomCoach, Mixer: mixCoach, Reader: readerCoach,
  AlwaysInside: habitCoach('AlwaysInside', { emph: 'IN' }), AlwaysOutside: habitCoach('AlwaysOutside', { emph: 'OUT' }),
  AlwaysPaint: habitCoach('AlwaysPaint', { wall: 'PAINT' }), AlwaysArc: habitCoach('AlwaysArc', { wall: 'ARC' }),
  StarGoTo: habitCoach('StarGoTo', { goTo: 'star' }), HelpStar: habitCoach('HelpStar', { help: 'star' }),
}
interface Side { d: string; c: string }
/** One match between strategy A and strategy B; A drafts first on even i. Returns [A won, state, rosters A/B]. */
function duel(tag: string, i: number, A: Side, B: Side, mirror = false): { aWon: boolean; st: MatchState; a: 0 | 1; rookies: number } {
  const seed = `${tag}-${i}`
  const a: 0 | 1 = i % 2 === 0 ? 0 : 1
  const dr = runDraft(seed, a === 0 ? [DRAFTERS[A.d], DRAFTERS[B.d]] : [DRAFTERS[B.d], DRAFTERS[A.d]])
  if (mirror) dr.rosters[1] = [...dr.rosters[0]]
  const st = playMatch(seed, dr.rosters, a === 0 ? [COACHES[A.c], COACHES[B.c]] : [COACHES[B.c], COACHES[A.c]])
  return { aWon: st.winner === a, st, a, rookies: dr.rookies }
}
const pct = (w: number, n: number) => `${((100 * w) / n).toFixed(1)}%`
const ci = (w: number, n: number) => `±${(196 * Math.sqrt(((w / n) * (1 - w / n)) / n)).toFixed(1)}`

interface Exp { each(i: number, acc: Acc): void; report(acc: Acc, n: number): string; defaultN: number }
const S = (d: string, c: string): Side => ({ d, c })

/* ---------------- requirement 1 ---------------- */
const REQ1: [string, string, Side, Side, boolean][] = [
  ['skilled-vs-naive', 'Skilled drafter + skilled coach (FitSpread + Reader) vs naive (TopRated + Hero)', S('FitSpread', 'Reader'), S('TopRated', 'Hero'), false],
  ['expert-vs-naive', 'Expert (Planner + Reader) vs naive (TopRated + Hero)', S('Planner', 'Reader'), S('TopRated', 'Hero'), false],
  ['draft-only', 'Well-built roster vs best-ratings roster, same coach both sides (FitSpread vs TopRated, both Mixer)', S('FitSpread', 'Mixer'), S('TopRated', 'Mixer'), false],
  ['draft-only-stars', 'Same, fit drafter spends stars-first (FitStars vs TopRated, both Mixer)', S('FitStars', 'Mixer'), S('TopRated', 'Mixer'), false],
  ['draft-only-planner', 'Same, expert drafter (Planner vs TopRated, both Mixer)', S('Planner', 'Mixer'), S('TopRated', 'Mixer'), false],
  ['draft-only-hero', 'Well-built vs best-ratings, both coached naively (both Hero)', S('FitSpread', 'Hero'), S('TopRated', 'Hero'), false],
  ['coach-only', 'Same drafter both sides, skilled coach vs naive coach (Reader vs Hero)', S('FitSpread', 'Reader'), S('FitSpread', 'Hero'), false],
  ['coach-vs-random', 'Same drafter both sides, skilled coach vs random tapper (Reader vs Random)', S('FitSpread', 'Reader'), S('FitSpread', 'Random'), false],
  ['expert-vs-skilled', 'Expert drafter vs skilled drafter, same coach (Planner vs FitSpread, both Reader)', S('Planner', 'Reader'), S('FitSpread', 'Reader'), false],
  ['mirror-mixer', 'IDENTICAL rosters, identical coach (Mixer)', S('FitSpread', 'Mixer'), S('FitSpread', 'Mixer'), true],
  ['mirror-hero', 'IDENTICAL rosters, identical fixed calls (Hero)', S('FitSpread', 'Hero'), S('FitSpread', 'Hero'), true],
  ['same-strategy', 'Same strategy both seats, separate drafts (FitSpread + Mixer)', S('FitSpread', 'Mixer'), S('FitSpread', 'Mixer'), false],
]
const req1: Exp = {
  defaultN: 20000,
  each(i, acc) {
    for (const [key, , A, B, mirror] of REQ1) {
      const r = duel(`req1-${key}`, i, A, B, mirror)
      if (r.aWon) add(acc, `${key}|w`)
      if (r.st.winner === 0) add(acc, `${key}|first`)
      add(acc, `${key}|rookies`, r.rookies)
    }
  },
  report(acc, n) {
    let out = `| Matchup | A wins | 95% CI | first drafter wins | rookies handed out |\n|---|---|---|---|---|\n`
    for (const [key, label] of REQ1) out += `| ${label} | ${pct(acc[`${key}|w`] ?? 0, n)} | ${ci(acc[`${key}|w`] ?? 0, n)} | ${pct(acc[`${key}|first`] ?? 0, n)} | ${acc[`${key}|rookies`] ?? 0} |\n`
    return out
  },
}

/* ---------------- requirement 2: round robins ---------------- */
function roundRobin(tag: string, names: string[], side: (n: string) => Side, mirror: boolean): Exp {
  return {
    defaultN: 4000,
    each(i, acc) {
      for (let x = 0; x < names.length; x++)
        for (let y = x + 1; y < names.length; y++) if (duel(`${tag}-${names[x]}-${names[y]}`, i, side(names[x]), side(names[y]), mirror).aWon) add(acc, `${x}|${y}`)
    },
    report(acc, n) {
      let out = `| row beats column | ${names.join(' | ')} | avg | worst matchup |\n|---|${names.map(() => '---').join('|')}|---|---|\n`
      for (let x = 0; x < names.length; x++) {
        const row: number[] = []
        for (let y = 0; y < names.length; y++) row.push(x === y ? NaN : x < y ? (acc[`${x}|${y}`] ?? 0) / n : 1 - (acc[`${y}|${x}`] ?? 0) / n)
        const real = row.filter((v) => !Number.isNaN(v))
        const worst = Math.min(...real)
        out += `| **${names[x]}** | ${row.map((v) => (Number.isNaN(v) ? '-' : (100 * v).toFixed(0))).join(' | ')} | ${(100 * real.reduce((a, b) => a + b, 0) / real.length).toFixed(1)} | ${(100 * worst).toFixed(0)} vs ${names[row.indexOf(worst)]} |\n`
      }
      return out
    },
  }
}
const DRAFT_NAMES = (process.env.DRAFTERS ?? 'TopRated,SpreadRated,Stoppers,ChemOnly,FitShoot,FitDrive,FitDefend,FitSpread,FitStars,Planner').split(',')
const drafters = roundRobin('rr-draft', DRAFT_NAMES, (d) => S(d, 'Mixer'), false)
const COACH_NAMES = ['Random', 'Hero', 'AlwaysInside', 'AlwaysOutside', 'AlwaysPaint', 'AlwaysArc', 'StarGoTo', 'HelpStar', 'Mixer', 'Reader']
const coaches = roundRobin('rr-coach', COACH_NAMES, (c) => S(process.env.COACH_ROSTERS ?? 'FitSpread', c), true)

/* ---------------- per-card and per-ability ---------------- */
const cards: Exp = {
  defaultN: 20000,
  each(i, acc) {
    // both seats draft with the strongest drafter and coach with the unexploitable mixer
    const r = duel('cards', i, S('Planner', 'Mixer'), S('Planner', 'Mixer'))
    const all = new Set<string>()
    for (const s of [0, 1] as const) for (const id of r.st.rosters[s]) {
      add(acc, `${id}|own`); all.add(id)
      if (r.st.winner === s) add(acc, `${id}|win`)
    }
    // dealt counts need the pool: recompute cheaply from rosters is not possible, so count via runDraft again
    const pool = runDraft(`cards-${i}`, [DRAFTERS.TopRated, DRAFTERS.TopRated]).pool
    for (const id of pool) add(acc, `${id}|dealt`)
  },
  report(acc) {
    const rows = CARDS.map((c) => ({ c, dealt: acc[`${c.id}|dealt`] ?? 0, own: acc[`${c.id}|own`] ?? 0, win: acc[`${c.id}|win`] ?? 0 })).sort((a, b) => b.win / Math.max(1, b.own) - a.win / Math.max(1, a.own))
    let out = `| Card | tier | cost | dealt | drafted when dealt | owner wins |\n|---|---|---|---|---|---|\n`
    for (const r of rows) out += `| ${r.c.name}${r.c.ability ? ` (${r.c.ability.name})` : ''} | ${r.c.tier} | ${r.c.cost} | ${r.dealt} | ${pct(r.own, Math.max(1, r.dealt))} | ${r.own ? pct(r.win, r.own) : '-'} |\n`
    return out
  },
}

/* ---------------- what the unexploitable mix actually calls ---------------- */
const calls: Exp = {
  defaultN: 4000,
  each(i, acc) {
    const r = duel('calls', i, S('FitSpread', 'Mixer'), S('FitSpread', 'Mixer'))
    for (const h of r.st.history) for (const s of [0, 1] as const) {
      const c = h.calls[s], o = h.calls[s === 0 ? 1 : 0]
      const floor = [...h.floors[s]].sort((x, y) => threat(card(y)) - threat(card(x)) || card(y).cost - card(x).cost)
      add(acc, 'runs')
      add(acc, `goRank${floor.indexOf(c.goTo) + 1}`)
      add(acc, `emph${c.emph}`)
      add(acc, `wall${c.wall}`)
      if (o.help === c.goTo) add(acc, 'helpHit')
      else add(acc, h.floors[s].includes(o.help) ? 'helpMiss' : 'helpWasted')
      if ((o.wall === 'PAINT') === (c.emph === 'IN')) add(acc, 'wallHit')
      // predictability: how concentrated is this roster's unexploitable go-to mix, by how top-heavy the floor is
      const cs = floor.map(card)
      const gap = threat(cs[0]) - threat(cs[2])
      const bucket = gap >= 4 ? 'topHeavy' : gap >= 2 ? 'middle' : 'balanced'
      add(acc, `${bucket}|n`)
      if (o.help === c.goTo) add(acc, `${bucket}|helpHit`)
      add(acc, `${bucket}|exp`, h.expected[s])
      const sd = buildSide(h.floors[s], h.floors[s === 0 ? 1 : 0], r.st.chem[s], r.st.chem[s === 0 ? 1 : 0], h.run)
      const sol = solve(payoff(sd), 400)
      let top = 0, viable = 0
      for (let g = 0; g < 5; g++) { const p = sol.off[g * 2] + sol.off[g * 2 + 1]; if (p > top) top = p; if (p >= 0.1) viable++ }
      add(acc, `${bucket}|top`, top); add(acc, `${bucket}|viable`, viable); add(acc, `${bucket}|value`, sol.value)
    }
  },
  report(acc) {
    const n = acc.runs
    const f = (k: string) => pct(acc[k] ?? 0, n)
    let out = `Calls made by two Mixer coaches (${n} team-runs):\n\n`
    out += `- Go-to is the floor's #1 scorer ${f('goRank1')}, #2 ${f('goRank2')}, #3 ${f('goRank3')}, #4 ${f('goRank4')}, #5 ${f('goRank5')}\n`
    out += `- Go-to attacks Inside ${f('emphIN')}, Outside ${f('emphOUT')}\n- Wall the Paint ${f('wallPAINT')}, Wall the Arc ${f('wallARC')}; wall matched the go-to's shot ${f('wallHit')}\n`
    out += `- Help landed on the go-to ${f('helpHit')}, on the wrong man ${f('helpMiss')}, on a resting player ${f('helpWasted')}\n\n`
    out += `| Floor type (gap between #1 and #3 scorer) | team-runs | go-to options used 10%+ | share of the top option | opponent's help found the go-to | unexploitable points per run | actual expected points per run |\n|---|---|---|---|---|---|---|\n`
    for (const b of ['topHeavy', 'middle', 'balanced']) {
      const m = acc[`${b}|n`] ?? 1
      out += `| ${b} | ${m} | ${((acc[`${b}|viable`] ?? 0) / m).toFixed(2)} | ${pct(acc[`${b}|top`] ?? 0, m)} | ${pct(acc[`${b}|helpHit`] ?? 0, m)} | ${((acc[`${b}|value`] ?? 0) / m).toFixed(2)} | ${((acc[`${b}|exp`] ?? 0) / m).toFixed(2)} |\n`
    }
    return out
  },
}

/* ---------------- shape of a game ---------------- */
const game: Exp = {
  defaultN: 20000,
  each(i, acc) {
    const r = duel('game', i, S('FitSpread', 'Reader'), S('FitSpread', 'Reader'))
    const st = r.st
    add(acc, 'pts', st.score[0] + st.score[1])
    add(acc, 'ot', st.history.length > CFG.RUNS ? 1 : 0)
    const m = Math.abs(st.score[0] - st.score[1])
    add(acc, 'margin', m)
    if (m <= 5) add(acc, 'close')
    if (m >= 20) add(acc, 'blowout')
    let lead = 0, changes = 0, s0 = 0, s1 = 0, trailedAtHalf = -1
    st.history.forEach((h, k) => {
      s0 += h.points[0]; s1 += h.points[1]
      const l = Math.sign(s0 - s1)
      if (l !== 0 && lead !== 0 && l !== lead) changes++
      if (l !== 0) lead = l
      if (k === 2) trailedAtHalf = s0 === s1 ? -1 : s0 < s1 ? 0 : 1
    })
    add(acc, 'leadChanges', changes)
    if (trailedAtHalf >= 0) { add(acc, 'halfDecided'); if (st.winner === trailedAtHalf) add(acc, 'comeback') }
    // luck check: how often does the side with more EXPECTED points (from the calls actually made) win
    let e0 = 0, e1 = 0
    for (const h of st.history) { e0 += h.expected[0]; e1 += h.expected[1] }
    if ((e0 > e1) === (st.winner === 0)) add(acc, 'deserved')
    add(acc, 'chem', st.chem[0] + st.chem[1])
  },
  report(acc, n) {
    return [
      `- average final score per team: ${(acc.pts / n / 2).toFixed(1)} points; average margin ${(acc.margin / n).toFixed(1)}`,
      `- decided by 5 or fewer: ${pct(acc.close ?? 0, n)}; by 20 or more: ${pct(acc.blowout ?? 0, n)}; went to overtime: ${pct(acc.ot ?? 0, n)}`,
      `- lead changes between runs: ${(acc.leadChanges / n).toFixed(2)} per game; team trailing after run 3 came back to win: ${pct(acc.comeback ?? 0, acc.halfDecided ?? 1)}`,
      `- the team whose calls earned more expected points won: ${pct(acc.deserved ?? 0, n)}`,
      `- average team chem: ${(acc.chem / n / 2).toFixed(1)}`,
    ].join('\n') + '\n'
  },
}

const EXPS: Record<string, Exp> = { req1, drafters, coaches, cards, calls, game }

/* ---------------- runner: shards across processes ---------------- */
const argv = process.argv.slice(2)
const flag = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
for (const kv of (flag('set') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); (CFG as any)[k] = v === 'true' ? true : v === 'false' ? false : +v }
async function main() {
  const name = argv[0]
  if (!name || (name !== 'all' && !EXPS[name])) { console.error(`usage: experiments.ts <${Object.keys(EXPS).join('|')}|all> [--n N] [--procs P]`); process.exit(1) }
  const names = name === 'all' ? Object.keys(EXPS) : [name]
  const shard = flag('shard')
  if (shard) {
    const [k, p] = shard.split('/').map(Number)
    const n = +flag('n')!
    const acc: Acc = {}
    for (let i = k; i < n; i += p) EXPS[name].each(i, acc)
    process.stdout.write(JSON.stringify(acc))
    return
  }
  const procs = +(flag('procs') ?? 8)
  for (const nm of names) {
    const n = +(flag('n') ?? EXPS[nm].defaultN)
    const t0 = Date.now()
    const parts = await Promise.all(Array.from({ length: procs }, (_, k) => new Promise<Acc>((res, rej) => {
      const extra = flag('set') ? ['--set', flag('set')!] : []
      const ch = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), nm, '--n', String(n), '--shard', `${k}/${procs}`, ...extra], { stdio: ['ignore', 'pipe', 'inherit'] })
      let buf = ''
      ch.stdout.on('data', (d) => (buf += d))
      ch.on('close', (code) => (code === 0 ? res(JSON.parse(buf || '{}')) : rej(new Error(`shard ${k} exit ${code}`))))
    })))
    const acc: Acc = {}
    for (const p of parts) for (const [k, v] of Object.entries(p)) add(acc, k, v)
    console.log(`\n### ${nm}  (n = ${n} matches per row/pairing, ${((Date.now() - t0) / 1000).toFixed(0)}s)\n`)
    console.log(EXPS[nm].report(acc, n))
    if (argv.includes('--json')) console.log('JSON:' + JSON.stringify(acc))
  }
}
main()
