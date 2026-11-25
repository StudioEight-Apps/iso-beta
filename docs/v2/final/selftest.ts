/** Sanity checks: card ids match roster.ts, the engine is deterministic, drafts stay legal.  node selftest.ts */
import { readFileSync } from 'node:fs'
import { K, buildTeam, computeChem, draftHint, loadCards, newDraft } from './iso2.ts'
import { COACHES, DRAFTERS, initWorth } from './bots.ts'
import { playMatch } from './match.ts'

const all = loadCards()
initWorth(all)
const ok = (cond: boolean, msg: string) => { if (!cond) { console.error('FAIL', msg); process.exitCode = 1 } else console.log('ok  ', msg) }

const src = readFileSync(new URL('../../../src/game/roster.ts', import.meta.url), 'utf8')
const ids = [...src.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1])
ok(ids.length === all.length && ids.every((id, i) => all[i].id === id), `cards.json has the same ${ids.length} ids as roster.ts, in order`)
ok(all.every((c) => c.traits.length >= 1 && c.traits.length <= 2), 'every card has 1 or 2 traits')
ok(all.every((c) => c.cost >= 1 && c.cost <= 9), 'every price is 1..9')
ok(all.filter((c) => c.ability).length === 13, '13 abilities')

const p = { drafter: DRAFTERS.builder, coach: COACHES.sharp }
const q = { drafter: DRAFTERS.bigNames, coach: COACHES.random }
const a = playMatch('selftest-1', all, [p, q], true), b = playMatch('selftest-1', all, [p, q], true)
ok(JSON.stringify(a.result) === JSON.stringify(b.result), 'same seed and same choices give the identical game, possession by possession')
ok(a.result.log.length >= K.POSS_PER_QUARTER * 2 * K.QUARTERS, 'a game is at least 200 possessions')

let spent = true, five = true, walkons = 0, minPool = true
for (let i = 0; i < 300; i++) {
  const d0 = newDraft(`selftest-${i}`, all)
  const n = (pos: string) => d0.available.filter((c) => c.position === pos).length
  if (d0.available.length !== 18 || n('G') < 5 || n('F') < 5 || n('C') < 3) minPool = false
  const m = playMatch(`selftest-${i}`, all, [i % 2 ? p : q, { drafter: DRAFTERS.random, coach: COACHES.plain }])
  for (const s of [0, 1] as const) {
    if (m.draft.rosters[s].reduce((x, c) => x + c.cost, 0) > K.BUDGET) spent = false
    if (m.draft.rosters[s].length !== 5) five = false
    walkons += m.draft.rosters[s].filter((c) => c.id === 'walkon').length
  }
}
ok(minPool, 'every deal has 18 cards with at least 5 G, 5 F, 3 C')
ok(spent && five, 'every drafted roster has five cards within budget')
console.log(`     walk-ons handed out in 300 drafts (one side picking at random): ${walkons}`)
let w2 = 0
for (let i = 0; i < 300; i++) {
  const m = playMatch(`selftest-b-${i}`, all, [p, { drafter: DRAFTERS[['bigNames', 'ratings', 'chemistry', 'builder'][i % 4]], coach: COACHES.plain }])
  for (const s of [0, 1] as const) w2 += m.draft.rosters[s].filter((c) => c.id === 'walkon').length
}
console.log(`     walk-ons handed out in 300 drafts between non-random drafters: ${w2}`)

const byId = (id: string) => all.find((c) => c.id === id)!
const t = [byId('haliburton'), byId('butler'), byId('bridges'), byId('gobert'), byId('holiday')]
ok(computeChem(t).total === 14, 'Haliburton, Holiday, Butler, Bridges, Gobert = 14 chem (all five links)')
ok(computeChem([byId('luka'), byId('harden'), byId('young'), byId('booker'), byId('irving')]).total === 3 + 3 - 12 - 6, 'Luka, Harden, Young, Booker, Irving = Spacing +3, Drive & Kick +3, One Ball -12, three out of position -6 = -12')
const h = draftHint([byId('butler'), byId('haliburton')], byId('gobert'))
ok(h.chemDelta === 6 && h.fit === 'fills your centre slot', `hint for Gobert with Butler + Haliburton: +${h.chemDelta} chem, ${h.fit} (${h.links.join(', ')})`)
ok(buildTeam(t).cards.map((c) => c.position).join('') === 'GGFFC', 'lineup is G G F F C')
