/**
 * Balance numbers for docs/v3/numbers.md. Skipped by default (a few thousand full matches).
 * Run with:  VITE_ISO_NUMBERS=1 npx vitest run tests/numbers.test.ts
 * Optional:  VITE_ISO_GAMES=3000 (bot v bot)  VITE_ISO_PAIRS=1000 (smart v random, mirrored)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  applyEvent,
  botDefensePick,
  botDraftPick,
  botLineup,
  botOffensePick,
  boxScore,
  createMatch,
  currentOffenseSeat,
  firstOffenseSeatOfQuarter,
  mulberry32,
  otherSeat,
  randomDefensePick,
  randomLineup,
  randomOffensePick,
  setFixedPool,
  whoseDraftTurn,
} from '../src/game'
import type { MatchEvent, MatchState, Seat } from '../src/game'
import { TEST_POOL } from './setup'

const env = import.meta.env as Record<string, string | undefined>
const enabled = Boolean(env.VITE_ISO_NUMBERS)
const GAMES = Number(env.VITE_ISO_GAMES ?? 3000)
const PAIRS = Number(env.VITE_ISO_PAIRS ?? 1000)

type Brain = 'smart' | 'random'

function draft(seed: string, rand: () => number): { state: MatchState; events: MatchEvent[] } {
  let s = createMatch(seed)
  const events: MatchEvent[] = []
  while (s.phase === 'draft') {
    const seat = whoseDraftTurn(s) as Seat
    const e: MatchEvent = { type: 'draftPick', seat, cardId: botDraftPick(s, seat, rand) }
    events.push(e)
    s = applyEvent(s, e)
  }
  return { state: s, events }
}

function finish(start: MatchState, brains: [Brain, Brain], rand: () => number, tag: string): MatchState {
  let s = start
  let n = 0
  while (s.phase !== 'gameover') {
    if (++n > 400) throw new Error('game did not finish')
    if (s.phase === 'lineup' || s.phase === 'break') {
      const five = (seat: Seat) => (brains[seat] === 'smart' ? botLineup(s, seat, rand) : randomLineup(s, seat))
      const next = applyEvent(s, { type: s.phase === 'lineup' ? 'lineupReveal' : 'quarterBreak', lineups: [five(0), five(1)] })
      if (next === s) throw new Error('lineup rejected')
      s = next
    } else {
      const off = currentOffenseSeat(s) as Seat
      const def = otherSeat(off)
      const offensePick = brains[off] === 'smart' ? botOffensePick(s, off, rand) : randomOffensePick(s, off, rand)
      const defensePick = brains[def] === 'smart' ? botDefensePick(s, def, rand) : randomDefensePick(s, def, rand)
      const next = applyEvent(s, { type: 'possessionResolve', offensePick, defensePick, seed: `${tag}:${n}` })
      if (next === s) throw new Error('possession rejected')
      s = next
    }
  }
  return s
}

const pct = (a: number, b: number) => Math.round((1000 * a) / Math.max(1, b)) / 10
const avg = (xs: number[]) => Math.round((100 * xs.reduce((a, b) => a + b, 0)) / Math.max(1, xs.length)) / 100
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]

describe.skipIf(!enabled)('v3 balance numbers', () => {
  beforeAll(() => setFixedPool(null))
  afterAll(() => setFixedPool(TEST_POOL))

  it('bot v bot, and smart v random on mirrored rosters', () => {
    const rand = mulberry32(20261113)
    const scores: number[] = []
    const winScores: number[] = []
    const loseScores: number[] = []
    const margins: number[] = []
    let overtime = 0
    let firstBallWins = 0
    let firstDrafterWins = 0
    let poss = 0
    let shots = 0
    let makes = 0
    let threes = 0
    let passes = 0
    let dimes = 0
    let doubles = 0
    let rightDoubles = 0
    let cards = 0
    let subs = 0
    let putbacks = 0
    const team = { reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, oreb: 0 }
    const topPts: number[] = []
    const topReb: number[] = []
    const topAst: number[] = []
    let dd = 0
    let td = 0
    let five55 = 0
    let five555 = 0
    let bestLine = { pts: 0, reb: 0, ast: 0, id: '' }
    const byShooter = new Map<string, { fga: number; fgm: number; pts: number }>()
    const byAbility = new Map<string, number>()

    for (let g = 0; g < GAMES; g++) {
      const d = draft(`num-${g}`, rand)
      const s = finish(d.state, ['smart', 'smart'], rand, `g${g}`)
      const w = s.winner as Seat
      scores.push(s.score[0], s.score[1])
      winScores.push(s.score[w])
      loseScores.push(s.score[otherSeat(w)])
      margins.push(s.score[w] - s.score[otherSeat(w)])
      if (s.history.length > 40) overtime++
      if (w === firstOffenseSeatOfQuarter(s, 1)) firstBallWins++
      if (w === s.firstDrafter) firstDrafterWins++
      for (const r of s.history) {
        poss++
        if (r.pass) passes++
        if (r.pass?.dime) dimes++
        if (r.doubleId !== null) {
          doubles++
          if (r.doubleId === r.picks.offense.shooterId) rightDoubles++
        }
        if (r.cards.offense) cards++
        if (r.cards.defense) cards++
        subs += r.subs.length
        for (const a of r.abilities) byAbility.set(a.name, (byAbility.get(a.name) ?? 0) + 1)
        for (const c of r.contests) {
          shots++
          if (c.kind === 'putback') putbacks++
          if (c.shot === 'THREE') threes++
          if (c.outcome === 'made') makes++
          const b = byShooter.get(c.shooter) ?? { fga: 0, fgm: 0, pts: 0 }
          b.fga++
          if (c.outcome === 'made') b.fgm++
          b.pts += c.points
          byShooter.set(c.shooter, b)
        }
      }
      const box = Object.values(boxScore(s))
      for (const l of box) {
        team.reb += l.reb
        team.ast += l.ast
        team.stl += l.stl
        team.blk += l.blk
        team.tov += l.tov
        team.oreb += l.oreb
      }
      topPts.push(Math.max(...box.map((l) => l.pts)))
      topReb.push(Math.max(...box.map((l) => l.reb)))
      topAst.push(Math.max(...box.map((l) => l.ast)))
      if (box.some((l) => l.doubleDouble)) dd++
      if (box.some((l) => l.tripleDouble)) td++
      if (box.some((l) => [l.pts, l.reb, l.ast].filter((v) => v >= 5).length >= 2)) five55++
      if (box.some((l) => l.pts >= 5 && l.reb >= 5 && l.ast >= 5)) five555++
      for (const l of box) {
        if (l.pts + l.reb + l.ast > bestLine.pts + bestLine.reb + bestLine.ast) bestLine = { pts: l.pts, reb: l.reb, ast: l.ast, id: l.cardId }
      }
    }

    // smart v random, same two rosters played both ways round
    let smartWins = 0
    let smartPts = 0
    let randomPts = 0
    for (let g = 0; g < PAIRS; g++) {
      const d = draft(`mir-${g}`, rand)
      for (const smartSeat of [0, 1] as const) {
        const brains: [Brain, Brain] = smartSeat === 0 ? ['smart', 'random'] : ['random', 'smart']
        const s = finish(d.state, brains, rand, `m${g}-${smartSeat}`)
        if (s.winner === smartSeat) smartWins++
        smartPts += s.score[smartSeat]
        randomPts += s.score[otherSeat(smartSeat)]
      }
    }

    const shooters = [...byShooter.entries()].filter(([, b]) => b.fga >= 150).map(([id, b]) => ({ id, fga: b.fga, fg: pct(b.fgm, b.fga), pps: Math.round((100 * b.pts) / b.fga) / 100 }))
    shooters.sort((a, b) => b.pps - a.pps)
    const out = {
      games: GAMES,
      avgScorePerSide: avg(scores),
      avgWinner: avg(winScores),
      avgLoser: avg(loseScores),
      scoreP10P90: [quantile(scores, 0.1), quantile(scores, 0.9)],
      minMaxScore: [Math.min(...scores), Math.max(...scores)],
      avgMargin: avg(margins),
      decidedBy5OrFewerPct: pct(margins.filter((m) => m <= 5).length, GAMES),
      decidedBy3OrFewerPct: pct(margins.filter((m) => m <= 3).length, GAMES),
      overtimePct: pct(overtime, GAMES),
      firstPossessionWinPct: pct(firstBallWins, GAMES),
      firstDrafterWinPct: pct(firstDrafterWins, GAMES),
      pointsPerPossession: Math.round((100 * scores.reduce((a, b) => a + b, 0)) / poss) / 100,
      fgPct: pct(makes, shots),
      threeShare: pct(threes, shots),
      putbacksPerGame: avg([putbacks / GAMES]),
      passPct: pct(passes, poss),
      dimePctOfPasses: pct(dimes, passes),
      doublePct: pct(doubles, poss),
      rightReadPctOfDoubles: pct(rightDoubles, doubles),
      cardsPerGame: avg([cards / GAMES]),
      midQuarterSubsPerGame: avg([subs / GAMES]),
      perTeamPerGame: {
        reb: avg([team.reb / GAMES / 2]),
        oreb: avg([team.oreb / GAMES / 2]),
        ast: avg([team.ast / GAMES / 2]),
        stl: avg([team.stl / GAMES / 2]),
        blk: avg([team.blk / GAMES / 2]),
        tov: avg([team.tov / GAMES / 2]),
      },
      topScorer: { avg: avg(topPts), median: quantile(topPts, 0.5), p90: quantile(topPts, 0.9), max: Math.max(...topPts) },
      topRebounder: { avg: avg(topReb), median: quantile(topReb, 0.5), p90: quantile(topReb, 0.9), max: Math.max(...topReb) },
      topAssists: { avg: avg(topAst), median: quantile(topAst, 0.5), p90: quantile(topAst, 0.9), max: Math.max(...topAst) },
      anyDoubleDoublePct: pct(dd, GAMES),
      anyTripleDoublePct: pct(td, GAMES),
      any5and5Pct: pct(five55, GAMES),
      any5and5and5Pct: pct(five555, GAMES),
      bestLineSeen: bestLine,
      smartVsRandom: { games: PAIRS * 2, smartWinPct: pct(smartWins, PAIRS * 2), smartAvg: avg([smartPts / PAIRS / 2]), randomAvg: avg([randomPts / PAIRS / 2]) },
      bestShooters: shooters.slice(0, 8),
      worstShooters: shooters.slice(-5),
      abilityTriggersPerGame: Object.fromEntries([...byAbility.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((100 * v) / GAMES) / 100])),
    }
    console.log(JSON.stringify(out, null, 1))
    expect(out.avgScorePerSide).toBeGreaterThan(15)
  }, 1_800_000)
})
