/** Turns out/*.jsonl (written by experiments.ts) into the markdown tables used in results.md.  node report.ts */
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('out/', new URL('.', import.meta.url))
const rows: any[] = []
for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl')).sort())
  for (const l of readFileSync(new URL(f, dir), 'utf8').split('\n')) if (l.trim()) rows.push(JSON.parse(l))
const of = (e: string) => rows.filter((r) => r.exp === e)
const table = (head: string[], body: (string | number)[][]) =>
  console.log(`| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${body.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`)

if (of('mirror').length) {
  console.log('### Mirror: identical rosters, identical calls\n')
  table(['calls (both sides)', 'matches', 'seat 0 win %', 'overtime %', 'decided by tie-break %'], of('mirror').map((r) => [r.calls, r.n, r.seat0WinPct, r.otPct, r.tiebreakPct]))
}
if (of('skill').length) {
  console.log('### Skill duels\n')
  table(['duel (A vs B)', 'matches', 'A win %', 'avg margin', 'avg score', 'chem A v B', 'OT %'],
    of('skill').sort((a, b) => (a.label < b.label ? -1 : 1)).map((r) => [`${r.label}`, r.n, r.winPct, r.margin, r.avgScore, `${r.chemA} v ${r.chemB}`, r.otPct]))
}
const grid = (e: string, title: string) => {
  const rs = of(e)
  if (!rs.length) return
  const names: string[] = []
  const strip = (s: string) => s.split('/')[0]
  for (const r of rs) for (const x of [strip(r.a), strip(r.b)]) if (!names.includes(x)) names.push(x)
  const w = new Map<string, number>()
  for (const r of rs) { w.set(`${strip(r.a)}>${strip(r.b)}`, r.winPct); w.set(`${strip(r.b)}>${strip(r.a)}`, +(100 - r.winPct).toFixed(2)) }
  console.log(`### ${title} (row's win % against column, ${rs[0].n} matches per cell)\n`)
  table(['', ...names, 'average'], names.map((a) => {
    const v = names.map((b) => (a === b ? '-' : w.get(`${a}>${b}`) ?? '?'))
    const nums = v.filter((x) => typeof x === 'number') as number[]
    return [`**${a}**`, ...v, (nums.reduce((s, x) => s + x, 0) / nums.length).toFixed(1)]
  }))
}
grid('tournament', 'Draft-strategy round robin, all with the sharp coach')
grid('coaches', 'Coaching round robin on the same skilled-GM rosters')
for (const r of of('calls')) {
  console.log(`### Call versus call: points per 100 possessions for the offence, relative to Move the Ball vs Straight Up (exact expectation, ${r.games} offence-v-defence pairings)\n`)
  table(['offence \\ defence', ...r.groups.def], r.groups.off.map((o: string, i: number) => [`**${o}**`, ...r.payoffPer100VsPlain[i]]))
  table(['', ...r.groups.off], [['unexploitable offence mix', ...r.sharpOffMix], ['share of best replies', ...r.shareOfBestReplies.off]])
  table(['', ...r.groups.def], [['unexploitable defence mix', ...r.sharpDefMix], ['share of best replies', ...r.shareOfBestReplies.def]])
  console.log(`- pairings where one offensive call is the best reply to every defensive call: ${r.pctGamesWithDominantOffCall}%`)
  console.log(`- pairings where one defensive call is the best reply to every offensive call: ${r.pctGamesWithDominantDefCall}%`)
  console.log(`- pairings where a fixed pair of calls is stable (no guessing needed): ${r.pctGamesWherePureCallsAreStable}%`)
  console.log(`- average gain from correctly reading an opponent who always plays plain: ${r.avgGainPer100FromReadingAPlainOffence} (on defence) / ${r.avgGainPer100FromReadingAPlainDefence} (on offence) points per 100 possessions\n`)
}
for (const r of of('cards')) {
  console.log(`### Cards: skilled GM vs skilled GM, ${r.n} matches (budget ${r.budget})\n`)
  console.log(`first drafter wins ${r.firstDrafterWinPct}% | average score ${r.avgScore} | overtime ${r.otPct}% | median margin ${r.medianMargin} | decided by 5 or fewer: ${r.within5Pct}%\n`)
  table(['card', 'price', 'ability', 'times dealt', 'picked %', 'first pick %', 'win % when picked'],
    [...r.cards].sort((a: any, b: any) => b.pickPct - a.pickPct).map((c: any) => [c.id, c.cost, c.ability || '', c.dealt, c.pickPct, c.firstPickPct, c.winPctWhenPicked]))
}
