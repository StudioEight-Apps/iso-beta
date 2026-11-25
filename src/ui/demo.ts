import { botDefensePick, botDraftPick, botLineup, botOffensePick, currentOffenseSeat, whoseDraftTurn } from '../game'
import { createBotSession } from '../session'
import type { Session } from '../session'

/**
 * Dev aid. `?demo=` fast-forwards a bot game by playing the human seat automatically:
 *   draft | lineup | court | reveal | break | sudden | final | gameover
 * `reveal` and `final` stop one possession early so its reveal plays on arrival. `break` stops at the first
 * quarter break, `sudden` at the start of overtime.
 */
export type DemoKind = 'draft' | 'lineup' | 'court' | 'reveal' | 'break' | 'sudden' | 'final' | 'gameover'

const KINDS: readonly DemoKind[] = ['draft', 'lineup', 'court', 'reveal', 'break', 'sudden', 'final', 'gameover']

export function parseDemo(raw: string | null): DemoKind | null {
  return raw && (KINDS as readonly string[]).includes(raw) ? (raw as DemoKind) : null
}

export interface Demo {
  session: Session
  /** Replay the newest possession's reveal when the match view mounts. */
  replayLast: boolean
}

/** Returns a cancel function. `sudden` replays seeded games until one is tied after four quarters. */
export function startDemo(kind: DemoKind, name: string, seed: string | undefined, onReady: (demo: Demo) => void): () => void {
  let attempt = 0
  let cancelled = false
  let ready = false
  let queued = false
  let unsub: () => void = () => {}
  let session: Session

  const open = () => {
    const s = kind === 'sudden' ? `${seed ?? 'sd'}-${attempt}` : seed
    session = createBotSession({ name, seed: s, thinkMs: kind === 'draft' ? [600, 1800] : [1, 3] })
    unsub = session.subscribe(schedule)
    schedule()
  }

  const finish = (replayLast: boolean) => {
    if (ready) return
    ready = true
    unsub()
    onReady({ session, replayLast })
  }

  const drive = () => {
    queued = false
    if (ready || cancelled) return
    const s = session.getSnapshot()
    const m = s.match
    if (!m) return
    const shown = m.history.length
    if (kind === 'draft') return finish(false)
    if (m.phase === 'draft') {
      if (whoseDraftTurn(m) === s.me) session.act({ type: 'draftPick', cardId: botDraftPick(m, s.me, Math.random) })
      return
    }
    if (m.phase === 'lineup') {
      if (kind === 'lineup') return finish(false)
      if (!s.myPending.lineup) session.act({ type: 'submitLineup', order: botLineup(m, s.me, Math.random) })
      return
    }
    if (kind === 'sudden' && m.overtime && m.phase === 'play') return finish(false)
    if (m.phase === 'break') {
      if (kind === 'break') return finish(false)
      if (!s.myPending.lineup) session.act({ type: 'submitLineup', order: botLineup(m, s.me, Math.random) })
      return
    }
    if (m.phase === 'gameover') {
      if (kind === 'sudden' && attempt < 200) {
        unsub()
        session.dispose()
        attempt++
        open()
        return
      }
      return finish(kind === 'final')
    }
    if (kind === 'court') return finish(false)
    if (kind === 'reveal' && shown >= 1) return finish(true)
    if (s.myPending.pick) return
    if (currentOffenseSeat(m) === s.me) {
      const p = botOffensePick(m, s.me, Math.random)
      session.act({ type: 'submitOffense', shooterId: p.shooterId, shot: p.shot, passerId: p.passerId, cardId: p.cardId, sub: p.sub })
    } else {
      const d = botDefensePick(m, s.me, Math.random)
      session.act({ type: 'submitDefense', doubleId: d.doubleId, cardId: d.cardId, sub: d.sub })
    }
  }

  function schedule() {
    if (queued || ready || cancelled) return
    queued = true
    queueMicrotask(drive)
  }

  open()
  return () => {
    cancelled = true
    unsub()
    if (!ready) session.dispose()
  }
}
