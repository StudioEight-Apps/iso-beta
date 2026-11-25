/**
 * Sanity checks on the engine:  node docs/v2/design-b/proto/verify.ts [matches=2000]
 *  - every match replays identically from (seed, rosters, calls)
 *  - every roster respects the cap, every player rests exactly once in regulation, every run has 16 shots
 *  - reports the range of make chances seen
 */
import { DRAFTERS, mixCoach, playMatch, randomCoach, readerCoach, runDraft } from './bots.ts'
import { CFG, playRun, spent, startMatch } from './engine.ts'

const N = +(process.argv[2] ?? 2000)
let ot = 0
let pmin = 1
let pmax = 0
let longest = 0
const coaches = [mixCoach, readerCoach, randomCoach]
const drafters = Object.values(DRAFTERS)
for (let i = 0; i < N; i++) {
  const seed = `verify-${i}`
  const d = runDraft(seed, [drafters[i % drafters.length], drafters[(i * 7 + 3) % drafters.length]])
  for (const r of d.rosters) {
    if (spent(r) > CFG.CAP) throw new Error(`cap broken ${seed}`)
    if (new Set(r).size !== CFG.ROSTER_SIZE) throw new Error(`roster size ${seed}`)
  }
  const st = playMatch(seed, d.rosters, [coaches[i % 3], coaches[(i + 1) % 3]])
  const again = startMatch(seed, d.rosters)
  for (const h of st.history) playRun(again, h.calls)
  if (JSON.stringify(again) !== JSON.stringify(st)) throw new Error(`replay mismatch ${seed}`)
  for (const s of [0, 1]) if ([...st.rested[s]].sort().join() !== [...st.rosters[s]].sort().join()) throw new Error(`rest rule ${seed}`)
  for (const h of st.history) {
    if (h.shots.length !== 16) throw new Error(`shots ${seed}`)
    for (const x of h.shots) {
      pmin = Math.min(pmin, x.p)
      pmax = Math.max(pmax, x.p)
    }
  }
  if (st.history.length > CFG.RUNS) ot++
  longest = Math.max(longest, st.history.length)
}
console.log(`ok: ${N} matches replay identically; cap, rest rule and shot counts hold; make chances ranged ${(100 * pmin).toFixed(0)}%..${(100 * pmax).toFixed(0)}%; ${ot} overtime games, longest ${longest} runs`)
