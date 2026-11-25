/** A scripted player that drives a Session to gameover using only its public snapshot. */
import { benchOf, currentOffenseSeat, otherSeat, seatByPosition, subsLeft, whoseDraftTurn } from '../../game'
import type { PlayCardId } from '../../game'
import type { Session } from '../../session/types'

export interface Autoplayer {
  stop(): void
}

export function autoplay(session: Session, opts: { rematches?: number } = {}): Autoplayer {
  let rematchesLeft = opts.rematches ?? 0
  let lastRematchSeed: string | null = null
  const step = () => {
    const s = session.getSnapshot()
    const m = s.match
    if (!m) return
    const opp = otherSeat(s.me)
    switch (m.phase) {
      case 'draft':
        if (whoseDraftTurn(m) === s.me) session.act({ type: 'draftPick', cardId: m.draft.available[0] })
        return
      case 'lineup':
      case 'break':
        if (!s.myPending.lineup) {
          // Rotate the bench in at each break so substitutions are exercised.
          const roster = m.draft.picks[s.me]
          const shift = m.phase === 'break' ? m.quarter % roster.length : 0
          const five = roster.map((_, i) => roster[(i + shift) % roster.length]).slice(0, 5)
          session.act({ type: 'submitLineup', order: seatByPosition(five) as string[] })
        }
        return
      case 'play': {
        if (s.myPending.pick || !m.lineups) return
        const n = m.history.length
        const hand = m.hands[s.me]
        const bench = benchOf(m, s.me)
        // One scripted sub per quarter, on the third possession of the quarter this seat sees.
        const sub = subsLeft(m, s.me) > 0 && bench.length > 0 && m.possession >= 4 ? { out: m.lineups[s.me][n % 5], in: bench[n % bench.length] } : null
        if (currentOffenseSeat(m) === s.me) {
          const floor = sub ? m.lineups[s.me].map((id) => (id === sub.out ? sub.in : id)) : m.lineups[s.me]
          const legal = floor.filter((id) => (m.shots[s.me][id] ?? 0) < 2)
          const shooterId = legal[n % legal.length]
          const shot = n % 3 === 0 ? 'THREE' : 'DRIVE'
          const passerId = n % 2 === 0 ? (floor.find((id) => id !== shooterId) ?? null) : null
          const want: PlayCardId[] = shot === 'THREE' ? ['screen', 'kickout', 'fastbreak', 'crash', 'timeout'] : ['pickroll', 'kickout', 'fastbreak', 'crash', 'timeout']
          if (passerId && shot === 'DRIVE') want.unshift('alleyoop')
          const cardId = want.find((c) => hand.includes(c)) ?? null
          session.act({ type: 'submitOffense', shooterId, shot, passerId, cardId, sub })
        } else {
          const targets = [...m.lineups[opp], null]
          const cardId = hand.find((c) => c === 'wallup' || c === 'closeout' || c === 'zone' || c === 'pickpocket' || c === 'scout') ?? null
          session.act({ type: 'submitDefense', doubleId: targets[(n * 7 + s.me) % targets.length], cardId, sub })
        }
        return
      }
      case 'gameover':
        if (rematchesLeft > 0 && !s.rematch.me && lastRematchSeed !== m.seed) {
          rematchesLeft -= 1
          lastRematchSeed = m.seed
          session.act({ type: 'requestRematch' })
        }
        return
      default:
        return
    }
  }
  const unsubscribe = session.subscribe(step)
  step()
  return { stop: unsubscribe }
}

export async function waitFor(cond: () => boolean, timeoutMs = 20000, label = 'condition'): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
