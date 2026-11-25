/**
 * Watch one full match between two bots: deal, draft (with the hints a player would see), calls, quarters, highlights.
 *   node play.ts [seed=demo] [drafterA=builder] [coachA=sharp] [drafterB=bigNames] [coachB=plain]
 */
import {
  K, applyPick, buildTeam, defCallName, draftDone, draftHint, legalPicks, loadCards, newDraft, offCallName,
  rngFromSeed, seatOnClock, simulateMatch, type Card, type Team,
} from './engine.ts'
import { COACHES, DRAFTERS, initWorth } from './bots.ts'
import { runCalls } from './match.ts'

const [seed = 'demo', dA = 'builder', cA = 'sharp', dB = 'bigNames', cB = 'plain'] = process.argv.slice(2)
const all = loadCards()
initWorth(all)
const bar = (n: number) => '#'.repeat((n - 2) / 2).padEnd(5, '.')
const line = (c: Card) =>
  `${c.name.padEnd(24)} ${c.position}  $${c.cost}  SHOOT ${bar(c.three)}  RIM ${bar(c.drive)}  DEF ${bar(c.def)}  ${c.traits.join(', ')}${c.ability ? `  * ${c.ability.name}` : ''}`

const d = newDraft(seed, all)
const names = [`A (${dA}/${cA})`, `B (${dB}/${cB})`]
console.log(`SEED ${seed}   budget $${K.BUDGET} each   first pick: ${names[d.firstDrafter]}\n\nTHE DEAL`)
for (const c of d.available) console.log('  ' + line(c))
console.log('\nDRAFT')
const drafters = [DRAFTERS[dA], DRAFTERS[dB]]
const rngs = [rngFromSeed(`${seed}|bot0|draft`), rngFromSeed(`${seed}|bot1|draft`)]
while (!draftDone(d)) {
  const seat = seatOnClock(d)
  const before = d.rosters[seat].slice()
  const pick = legalPicks(d, seat).length ? drafters[seat](d, seat, rngs[seat]) : null
  const hint = pick ? draftHint(before, pick) : null
  applyPick(d, pick)
  console.log(`  ${d.pick}. ${names[seat].padEnd(22)} ${(pick?.name ?? 'Walk-on').padEnd(24)} $${pick?.cost ?? 0}  ` +
    (hint ? `[${hint.chemDelta >= 0 ? '+' : ''}${hint.chemDelta} chem, ${hint.fit}${hint.links.length ? ': ' + hint.links.join(', ') : ''}]` : '') + `  ($${d.budget[seat]} left)`)
}
const teams: [Team, Team] = [buildTeam(d.rosters[0]), buildTeam(d.rosters[1])]
teams.forEach((t, s) => {
  const c = t.chem
  console.log(`\nTEAM ${names[s]}   CHEM ${c.total}  [${[c.driveKick && 'Drive & Kick +3', c.pickRoll && 'Pick & Roll +3', c.lockdown && 'Lockdown +3', c.spacing && 'Spacing +3', c.glue && 'Glue Guy +2', c.ballDominant && `One Ball ${c.ballDominant * K.ONE_BALL}`, c.outOfPosition && `Out of position ${c.outOfPosition * K.OUT_OF_POSITION}`].filter(Boolean).join(', ') || 'no links'}]`)
  t.cards.forEach((k, i) => console.log(`  ${'GGFFC'[i]}  ${line(k)}`))
})

const calls = runCalls(seed, teams, [COACHES[cA], COACHES[cB]])
const r = simulateMatch(seed, teams, calls, (1 - d.firstDrafter) as 0 | 1, true)
const pts = [new Map<string, number>(), new Map<string, number>()]
console.log('\nTHE GAME')
let lead = 0, changes = 0
for (let q = 1; q <= r.quarters.length; q++) {
  const c = calls[Math.min(q, K.QUARTERS) - 1]
  const label = q <= K.QUARTERS ? `Q${q}` : `OT${q - K.QUARTERS}`
  console.log(`  ${label}  A: ${offCallName(c[0].off, teams[0])} / ${defCallName(c[0].def, teams[1])}    B: ${offCallName(c[1].off, teams[1])} / ${defCallName(c[1].def, teams[0])}`)
  const poss = r.log.filter((p) => p.quarter === q)
  // highlight: the biggest unanswered run of the quarter
  let run = [0, 0], best = { pts: 0, seat: 0 }
  const qp = [new Map<string, number>(), new Map<string, number>()]
  for (const p of poss) {
    if (p.points) {
      run[p.seat] += p.points; run[1 - p.seat] = 0
      if (run[p.seat] > best.pts) best = { pts: run[p.seat], seat: p.seat }
      const n = teams[p.seat].cards[p.shooter].name
      pts[p.seat].set(n, (pts[p.seat].get(n) ?? 0) + p.points)
      qp[p.seat].set(n, (qp[p.seat].get(n) ?? 0) + p.points)
    }
    const l = Math.sign(p.score[0] - p.score[1])
    if (l !== 0 && l !== lead) { if (lead !== 0) changes++; lead = l }
  }
  const hot = [0, 1].map((s) => [...qp[s].entries()].sort((a, b) => b[1] - a[1])[0]).map((e, s) => (e ? `${e[0]} ${e[1]}` : '-') + ` (${'AB'[s]})`)
  const end = poss[poss.length - 1].score
  console.log(`      ${r.quarters[q - 1][0]}-${r.quarters[q - 1][1]} in the quarter, ${end[0]}-${end[1]} overall.  Biggest run: ${best.pts}-0 by ${'AB'[best.seat]}.  Hot hands: ${hot.join(', ')}`)
}
console.log(`\nFINAL  A ${r.score[0]} - ${r.score[1]} B   winner: ${names[r.winner]}${r.decidedByTiebreak ? ' (tie-break)' : ''}   lead changes: ${changes}`)
for (const s of [0, 1]) console.log(`  ${'AB'[s]} scoring: ` + [...pts[s].entries()].sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${p}`).join(', '))
