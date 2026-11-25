/**
 * Experiments for the ISO v2 final rules. The measured tables in results.md come from here (and adv.ts).
 *
 *   node experiments.ts <experiment> [matches=20000] [shard=0/1]
 *
 * experiments: mirror | skill | tournament | coaches | calls | cards
 * Results are appended as JSON lines to out/<experiment>.<shard>.jsonl ; `node report.ts` turns them into tables.
 * Sharding (e.g. 3/8 = fourth of eight workers) only splits the list of pairings so they can run in parallel.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { K, buildTeam, loadCards, rngFromSeed, simulateMatch, type Call, type Team } from './iso2.ts'
import { COACHES, DRAFTERS, initWorth, pppMatrix, solveGame } from './bots.ts'
import { playMatch, runCalls, runDraft } from './match.ts'

const [exp = "skill", nArg = "20000", shardArg = "0/1", only = ""] = process.argv.slice(2)
const N = +nArg
const [shard, shards] = shardArg.split('/').map(Number)
const all = loadCards()
initWorth(all)
const outDir = new URL('out/', new URL('.', import.meta.url))
mkdirSync(outDir, { recursive: true })
const outFile = new URL(`${exp}.${shard}.jsonl`, outDir)
writeFileSync(outFile, '')
const emit = (o: object) => { appendFileSync(outFile, JSON.stringify(o) + '\n'); console.log(JSON.stringify(o)) }
const mine = (i: number) => i % shards === shard

interface Side { drafter: string; coach: string }
/** A vs B over n fresh seeds, seats alternating. Returns A's results. */
function duel(tag: string, a: Side, b: Side, n = N) {
  let wins = 0, margin = 0, pts = 0, ot = 0, tb = 0, firstWins = 0, chemA = 0, chemB = 0
  for (let i = 0; i < n; i++) {
    const sa = (i % 2) as 0 | 1
    const pa = { drafter: DRAFTERS[a.drafter], coach: COACHES[a.coach] }
    const pb = { drafter: DRAFTERS[b.drafter], coach: COACHES[b.coach] }
    const m = playMatch(`${tag}|${i}`, all, sa === 0 ? [pa, pb] : [pb, pa])
    if (m.result.winner === sa) wins++
    if (m.result.winner === m.draft.firstDrafter) firstWins++
    margin += m.result.score[sa] - m.result.score[1 - sa]
    pts += m.result.score[0] + m.result.score[1]
    if (m.result.overtimes) ot++
    if (m.result.decidedByTiebreak) tb++
    chemA += m.teams[sa].chem.total; chemB += m.teams[1 - sa].chem.total
  }
  return {
    a: `${a.drafter}/${a.coach}`, b: `${b.drafter}/${b.coach}`, n, winPct: +(100 * wins / n).toFixed(2),
    margin: +(margin / n).toFixed(2), avgScore: +(pts / n / 2).toFixed(1), otPct: +(100 * ot / n).toFixed(2),
    tiebreakPct: +(100 * tb / n).toFixed(3), firstDrafterWinPct: +(100 * firstWins / n).toFixed(2),
    chemA: +(chemA / n).toFixed(2), chemB: +(chemB / n).toFixed(2),
  }
}

/** Pre-drafted roster pairs (two skilled GMs), reused by the coaching experiments. */
function rosterBank(count: number, a = 'builder', b = 'builder'): [Team, Team][] {
  const bank: [Team, Team][] = []
  for (let i = 0; i < count; i++) {
    const d = runDraft(`bank|${a}|${b}|${i}`, all, [DRAFTERS[a], DRAFTERS[b]])
    bank.push([buildTeam(d.rosters[0]), buildTeam(d.rosters[1])])
  }
  return bank
}

if (exp === 'mirror') {
  // Requirement 1c: identical rosters, identical calls -> 50/50.
  const bank = rosterBank(1000)
  for (const mode of ['plain', 'star', 'fly', 'rim']) {
    let w0 = 0, ot = 0, tb = 0
    for (let i = 0; i < N; i++) {
      const t = bank[i % bank.length][i % 2]
      const c = COACHES[mode](t, t, 1, rngFromSeed('x'))
      const calls: [Call, Call][] = [[c, c], [c, c], [c, c], [c, c]]
      const r = simulateMatch(`mirror|${mode}|${i}`, [t, t], calls, (i % 2) as 0 | 1)
      if (r.winner === 0) w0++
      if (r.overtimes) ot++
      if (r.decidedByTiebreak) tb++
    }
    emit({ exp, calls: mode, n: N, seat0WinPct: +(100 * w0 / N).toFixed(2), otPct: +(100 * ot / N).toFixed(2), tiebreakPct: +(100 * tb / N).toFixed(3) })
  }
}

if (exp === 'skill') {
  const S = (drafter: string, coach: string): Side => ({ drafter, coach })
  const list: [string, Side, Side][] = [
    ['1a skilled GM + sharp coach vs random picks + random calls', S('builder', 'sharp'), S('random', 'random')],
    ['1a skilled GM + sharp coach vs big-names drafter + plain calls', S('builder', 'sharp'), S('bigNames', 'plain')],
    ['1a skilled GM + sharp coach vs big-names drafter + random calls', S('builder', 'sharp'), S('bigNames', 'random')],
    ['1a skilled GM + sharp coach vs best-ratings drafter + plain calls', S('builder', 'sharp'), S('ratings', 'plain')],
    ['1b roster only: built roster vs best-ratings roster (both sharp coaches)', S('builder', 'sharp'), S('ratings', 'sharp')],
    ['1b roster only: built roster vs best-ratings roster (both plain coaches)', S('builder', 'plain'), S('ratings', 'plain')],
    ['1b roster only: built roster vs big-names roster (both sharp coaches)', S('builder', 'sharp'), S('bigNames', 'sharp')],
    ['coach only: same GM skill, sharp coach vs plain coach', S('builder', 'sharp'), S('builder', 'plain')],
    ['coach only: same GM skill, sharp coach vs random coach', S('builder', 'sharp'), S('builder', 'random')],
    ['coach only: same GM skill, sharp coach vs always-feed-and-shadow-the-star', S('builder', 'sharp'), S('builder', 'star')],
    ['two equal skilled players (sanity)', S('builder', 'sharp'), S('builder', 'sharp')],
    ['counter-drafting GM vs skilled GM (both sharp)', S('counter', 'sharp'), S('builder', 'sharp')],
    ['1a hint-reader (no planning) + reader coach vs big-names drafter + plain calls', S('hints', 'reader'), S('bigNames', 'plain')],
    ['1a hint-reader (no planning) + reader coach vs big-names drafter + star-ball calls', S('hints', 'reader'), S('bigNames', 'star')],
    ['1b roster only: hint-reader roster vs big-names roster (both plain coaches)', S('hints', 'plain'), S('bigNames', 'plain')],
    ['1b roster only: hint-reader roster vs best-ratings roster (both plain coaches)', S('hints', 'plain'), S('ratings', 'plain')],
    ['gradient: skilled GM vs hint-reader (both sharp coaches)', S('builder', 'sharp'), S('hints', 'sharp')],
    ['coach only: same GM skill, reader coach vs plain coach', S('builder', 'reader'), S('builder', 'plain')],
    ['coach only: same GM skill, reader coach vs always-feed-and-shadow-the-star', S('builder', 'reader'), S('builder', 'star')],
  ]
  list.forEach(([label, a, b], i) => { if (mine(i)) emit({ exp, label, ...duel(`skill|${i}`, a, b) }) })
}

if (exp === 'tournament') {
  // Requirement 2: round robin of draft strategies, everyone coached by the same sharp coach.
  const names = ['bigNames', 'ratings', 'chemistry', 'shooters', 'bullies', 'stoppers', 'hints', 'heliocentric', 'builder', 'counter']
  let k = 0
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (mine(k++)) emit({ exp, ...duel(`tour|${names[i]}|${names[j]}`, { drafter: names[i], coach: 'sharp' }, { drafter: names[j], coach: 'sharp' }) })
  }
}

if (exp === 'coaches') {
  // Requirement 2: round robin of coaching strategies on the same pre-drafted rosters (two skilled GMs).
  const bank = rosterBank(1500)
  const names = ['plain', 'fly', 'rim', 'star', 'flyPaint', 'rimLine', 'random', 'greedy', 'reader', 'sharp']
  let k = 0
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (!mine(k++)) continue
    let wins = 0, margin = 0
    for (let m = 0; m < N; m++) {
      const pair = bank[m % bank.length]
      const sa = (m % 2) as 0 | 1
      const teams: [Team, Team] = [pair[0], pair[1]]
      const seed = `coach|${names[i]}|${names[j]}|${m}`
      const calls = runCalls(seed, teams, sa === 0 ? [COACHES[names[i]], COACHES[names[j]]] : [COACHES[names[j]], COACHES[names[i]]])
      const r = simulateMatch(seed, teams, calls, 1)
      if (r.winner === sa) wins++
      margin += r.score[sa] - r.score[1 - sa]
    }
    emit({ exp, a: names[i], b: names[j], n: N, winPct: +(100 * wins / N).toFixed(2), margin: +(margin / N).toFixed(2) })
  }
}

if (exp === 'calls') {
  // Requirement 2: the call-versus-call payoff, exactly (expected points per 100 possessions, no sampling noise).
  const count = Math.min(N, 4000)
  const bank = rosterBank(count)
  const grp = (c: number, best: number) => (c < 3 ? c : c - 3 === best ? 3 : 4)
  const sum = Array.from({ length: 5 }, () => new Array(5).fill(0)), cnt = Array.from({ length: 5 }, () => new Array(5).fill(0))
  const offMix = new Array(5).fill(0), defMix = new Array(5).fill(0)
  const offBest = new Array(5).fill(0), defBest = new Array(5).fill(0)
  let games = 0, pureEq = 0, offDominant = 0, defDominant = 0, valueOverPlain = 0, exploitPlainOff = 0, exploitPlainDef = 0
  for (const [A, B] of bank) for (const [o, d] of [[A, B], [B, A]] as const) {
    const m = pppMatrix(o, d, 1)
    const bo = o.offOrder.map((i) => i).reduce((b, i) => (Math.max(o.cards[i].three, o.cards[i].drive) > Math.max(o.cards[b].three, o.cards[b].drive) ? i : b))
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { sum[grp(i, bo)][grp(j, bo)] += 100 * (m[i][j] - m[0][0]); cnt[grp(i, bo)][grp(j, bo)]++ }
    const g = solveGame(m, 4000)
    g.row.forEach((p, i) => (offMix[grp(i, bo)] += p)); g.col.forEach((p, j) => (defMix[grp(j, bo)] += p))
    if (Math.max(...g.row) > 0.98 && Math.max(...g.col) > 0.98) pureEq++
    // a call is dominant if it is a best reply to every opposing call
    const colBest = (j: number) => m.reduce((b, r, i) => (r[j] > m[b][j] ? i : b), 0)
    const rowBest = (i: number) => m[i].reduce((b, x, j) => (x < m[i][b] ? j : b), 0)
    const cb = Array.from({ length: 8 }, (_, j) => colBest(j)), rb = Array.from({ length: 8 }, (_, i) => rowBest(i))
    if (cb.every((x) => x === cb[0])) offDominant++
    if (rb.every((x) => x === rb[0])) defDominant++
    cb.forEach((x) => (offBest[grp(x, bo)] += 1 / 8)); rb.forEach((x) => (defBest[grp(x, bo)] += 1 / 8))
    valueOverPlain += 100 * (g.value - m[0][0])
    exploitPlainOff += 100 * (Math.max(...m.map((r) => r[0])) - m[0][0])
    exploitPlainDef += 100 * (m[0][0] - Math.min(...m[0]))
    games++
  }
  const r1 = (x: number) => +x.toFixed(1), r3 = (x: number) => +x.toFixed(3)
  emit({
    exp, rosterPairs: count, games,
    groups: { off: ['Move the Ball', 'Let It Fly', 'Attack the Rim', 'Feed top scorer', 'Feed someone else'], def: ['Straight Up', 'Guard the Line', 'Protect the Paint', 'Shadow top scorer', 'Shadow someone else'] },
    payoffPer100VsPlain: sum.map((r, i) => r.map((x, j) => r1(x / cnt[i][j]))),
    sharpOffMix: offMix.map((x) => r3(x / games)), sharpDefMix: defMix.map((x) => r3(x / games)),
    shareOfBestReplies: { off: offBest.map((x) => r3(x / games)), def: defBest.map((x) => r3(x / games)) },
    pctGamesWithDominantOffCall: r1(100 * offDominant / games), pctGamesWithDominantDefCall: r1(100 * defDominant / games),
    pctGamesWherePureCallsAreStable: r1(100 * pureEq / games),
    avgGainPer100FromReadingAPlainOffence: r1(exploitPlainDef / games), avgGainPer100FromReadingAPlainDefence: r1(exploitPlainOff / games),
  })
}

if (exp === 'cards') {
  // Requirement 2: no must-pick card or ability. Skilled GM vs skilled GM, sharp coaches.
  const st = new Map<string, { seen: number; picked: number; wins: number; first: number }>()
  for (const c of all) st.set(c.id, { seen: 0, picked: 0, wins: 0, first: 0 })
  let firstWins = 0, pts = 0, ot = 0
  const margins: number[] = []
  for (let i = 0; i < N; i++) {
    const p = { drafter: DRAFTERS.builder, coach: COACHES.sharp }
    const m = playMatch(`cards|${i}`, all, [p, p])
    for (const c of m.draft.available) st.get(c.id)!.seen++
    for (const s of [0, 1] as const) m.draft.rosters[s].forEach((c, k) => {
      const x = st.get(c.id); if (!x) return
      x.seen++; x.picked++; if (m.result.winner === s) x.wins++; if (k === 0) x.first++
    })
    if (m.result.winner === m.draft.firstDrafter) firstWins++
    pts += m.result.score[0] + m.result.score[1]
    if (m.result.overtimes) ot++
    margins.push(Math.abs(m.result.score[0] - m.result.score[1]))
  }
  margins.sort((a, b) => a - b)
  emit({
    exp, n: N, budget: K.BUDGET, firstDrafterWinPct: +(100 * firstWins / N).toFixed(2), avgScore: +(pts / N / 2).toFixed(1),
    otPct: +(100 * ot / N).toFixed(2), medianMargin: margins[N >> 1], within5Pct: +(100 * margins.filter((x) => x <= 5).length / N).toFixed(1),
    cards: all.map((c) => {
      const x = st.get(c.id)!
      return { id: c.id, cost: c.cost, ability: c.ability?.name ?? '', dealt: x.seen, pickPct: +(100 * x.picked / Math.max(1, x.seen)).toFixed(1), firstPickPct: +(100 * x.first / Math.max(1, x.seen)).toFixed(1), winPctWhenPicked: +(100 * x.wins / Math.max(1, x.picked)).toFixed(1) }
    }),
  })
}
