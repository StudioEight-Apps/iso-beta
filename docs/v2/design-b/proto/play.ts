/**
 * Plays one full match between two bots and prints what the players would see.
 *   node docs/v2/design-b/proto/play.ts [seed] [drafterA] [coachA] [drafterB] [coachB]
 * Also replays the recorded choices through the engine to prove the match is deterministic.
 */
import { DRAFTERS, heroCoach, mixCoach, playMatch, randomCoach, readerCoach } from './bots.ts'
import type { Coach } from './bots.ts'
import { CFG, DRAFT_ORDER, card, chemistry, dealPool, draftHint, legalPicks, playRun, spent, startMatch } from './engine.ts'
import { rngFromSeed } from './prng.ts'

const [seed = 'demo-1', dA = 'Planner', cA = 'Reader', dB = 'FitSpread', cB = 'Mixer'] = process.argv.slice(2)
const COACH: Record<string, Coach> = { Hero: heroCoach, Mixer: mixCoach, Reader: readerCoach, Random: randomCoach }
const names = [`A (${dA}/${cA})`, `B (${dB}/${cB})`]
const show = (id: string) => {
  const c = card(id)
  return `${c.name} [${c.position} ${c.three}/${c.drive}/${c.def} $${c.cost}${c.traits.length ? ' ' + c.traits.join('+') : ''}${c.ability ? ' *' + c.ability.name : ''}]`
}

let pool = dealPool(seed)
console.log(`SEED ${seed}\n\nTHE DEAL (16 cards; bars are Outside/Inside/Defence, $ = cost, cap $${CFG.CAP})`)
for (const id of pool) console.log('  ' + show(id))
const rosters: [string[], string[]] = [[], []]
const rngs = [rngFromSeed(`${seed}|draft0`), rngFromSeed(`${seed}|draft1`)]
console.log('\nTHE DRAFT')
DRAFT_ORDER.forEach((s, k) => {
  const d = DRAFTERS[s === 0 ? dA : dB]
  const id = legalPicks(pool, rosters[s]).length ? d.pick(pool, rosters[s], rosters[1 - s], rngs[s]) : null
  if (id === null) {
    rosters[s].push(`rookie-${s}-${rosters[s].length}`)
    console.log(`  ${k + 1}. ${names[s]} cannot afford anyone and is handed a Rookie`)
    return
  }
  const h = draftHint(rosters[s], id)
  rosters[s].push(id)
  pool = pool.filter((x) => x !== id)
  console.log(`  ${String(k + 1).padStart(2)}. ${names[s].padEnd(22)} ${show(id)}   hint: ${h.chem >= 0 ? '+' : ''}${h.chem} chem${h.fills ? `, fills ${h.fills}` : ''}   ($${CFG.CAP - spent(rosters[s])} left)`)
})
for (const s of [0, 1]) {
  const c = chemistry(rosters[s])
  console.log(`\n${names[s]} chem ${c.total}  (fit ${c.fit}, drive&kick ${c.kick}, pick&roll ${c.pnr}, lock&anchor ${c.lock}, star&glue ${c.glue}, one ball ${c.oneBall}, complete team ${c.complete})  = +${(c.total / CFG.CHEM_DIV).toFixed(1)} on every bar`)
}

const st = playMatch(seed, rosters, [COACH[cA], COACH[cB]])
console.log('\nTHE GAME')
let s0 = 0
let s1 = 0
for (const h of st.history) {
  s0 += h.points[0]
  s1 += h.points[1]
  console.log(`\n Run ${h.run}${h.run > CFG.RUNS ? ' (overtime)' : ''}`)
  for (const s of [0, 1] as const) {
    const c = h.calls[s]
    const o = h.calls[1 - s]
    const go = h.shots.filter((x) => x.team === s && x.goTo)
    const helped = o.help === c.goTo ? 'HELP WAS WAITING' : h.floors[s].includes(o.help) ? `help went to ${card(o.help).name}` : `help wasted on resting ${card(o.help).name}`
    const walled = (o.wall === 'PAINT') === (c.emph === 'IN') ? 'into the coverage' : 'away from the coverage'
    console.log(`  ${names[s].padEnd(22)} rests ${card(c.sit).name}; go-to ${card(c.goTo).name} ${c.emph === 'IN' ? 'Inside' : 'Outside'} (${helped}, ${walled}) -> ${go.filter((x) => x.made).length}/4 at ${(100 * go[0].p).toFixed(0)}%; team ${h.points[s]} pts (expected ${h.expected[s].toFixed(1)})`)
  }
  console.log(`  score  A ${s0} - ${s1} B`)
}
console.log(`\nFINAL  A ${st.score[0]} - ${st.score[1]} B   winner: ${names[st.winner!]}`)

// determinism: feed the recorded calls back through the engine
const again = startMatch(seed, rosters)
for (const h of st.history) playRun(again, h.calls)
const same = JSON.stringify(again.history) === JSON.stringify(st.history) && again.winner === st.winner
console.log(`\nreplay from seed + recorded choices is identical: ${same}`)
if (!same) process.exit(1)
