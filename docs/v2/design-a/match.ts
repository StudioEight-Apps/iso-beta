/** Glue: run a whole match (deal, draft, four quarters) between two bots. */
import {
  K, applyPick, buildTeam, draftDone, newDraft, rngFromSeed, seatOnClock, simulateMatch,
  type Call, type Card, type DraftState, type MatchResult, type Team,
} from './engine.ts'
import type { Coach, Drafter } from './bots.ts'

export interface Player { drafter: Drafter; coach: Coach }
export interface FullMatch { draft: DraftState; teams: [Team, Team]; calls: [Call, Call][]; result: MatchResult }

export function runDraft(seed: string, all: readonly Card[], drafters: [Drafter, Drafter]): DraftState {
  const d = newDraft(seed, all)
  const rngs = [rngFromSeed(`${seed}|bot0|draft`), rngFromSeed(`${seed}|bot1|draft`)]
  while (!draftDone(d)) {
    const seat = seatOnClock(d)
    applyPick(d, drafters[seat](d, seat, rngs[seat]))
  }
  return d
}

export function runCalls(seed: string, teams: [Team, Team], coaches: [Coach, Coach]): [Call, Call][] {
  const rngs = [rngFromSeed(`${seed}|bot0|coach`), rngFromSeed(`${seed}|bot1|coach`)]
  const calls: [Call, Call][] = []
  for (let q = 1; q <= K.QUARTERS; q++) {
    const seen0 = calls.map((c) => c[1]), seen1 = calls.map((c) => c[0])
    calls.push([coaches[0](teams[0], teams[1], q, rngs[0], seen0), coaches[1](teams[1], teams[0], q, rngs[1], seen1)])
  }
  return calls
}

export function playMatch(seed: string, all: readonly Card[], players: [Player, Player], keepLog = false): FullMatch {
  const draft = runDraft(seed, all, [players[0].drafter, players[1].drafter])
  const teams: [Team, Team] = [buildTeam(draft.rosters[0]), buildTeam(draft.rosters[1])]
  const calls = runCalls(seed, teams, [players[0].coach, players[1].coach])
  const result = simulateMatch(seed, teams, calls, (1 - draft.firstDrafter) as 0 | 1, keepLog)
  return { draft, teams, calls, result }
}
