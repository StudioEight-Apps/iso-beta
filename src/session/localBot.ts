import {
  applyEvent,
  botDefensePick,
  botDraftPick,
  botLineup,
  botOffensePick,
  createMatch,
  currentOffenseSeat,
  isLegalLineup,
  validateDefensePick,
  validateEvent,
  validateOffensePick,
  whoseDraftTurn,
} from '../game'
import type { DefensePick, MatchState, OffensePick } from '../game'
import type { PlayerAction, Seat, Session, SessionSnapshot } from './types'

export interface BotSessionOptions {
  /** The human's display name. */
  name: string
  /** Bot display name. Default 'CPU'. */
  botName?: string
  /** Fixed match seed (tests). Default: random. */
  seed?: string
  /** Randomness source for seeds, bot choices and think time (tests). Default Math.random. */
  random?: () => number
  /** [min, max] bot think time in ms. Default [600, 1800]. */
  thinkMs?: [number, number]
}

const HUMAN: Seat = 0
const BOT: Seat = 1

type SecretPick = { role: 'offense'; pick: OffensePick } | { role: 'defense'; pick: DefensePick }

/** Human (seat 0) vs bot (seat 1), fully local. */
export function createBotSession(opts: BotSessionOptions): Session {
  const random = opts.random ?? Math.random
  const [thinkMin, thinkMax] = opts.thinkMs ?? [600, 1800]
  const names: [string, string] = [opts.name.trim() || 'You', opts.botName ?? 'CPU']

  const makeSeed = () =>
    `${Math.floor(random() * 0x100000000).toString(36)}-${Math.floor(random() * 0x100000000).toString(36)}`

  let match: MatchState = createMatch(opts.seed ?? makeSeed())
  let humanLineup: string[] | null = null
  let botLineupOrder: string[] | null = null
  let humanPick: SecretPick | null = null
  let botPick: SecretPick | null = null
  let rematch = { me: false, opp: false }
  let disposed = false

  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Identifies the step the pending bot timer was scheduled for. */
  let timerKey: string | null = null

  const buildSnapshot = (): SessionSnapshot => ({
    me: HUMAN,
    names,
    connection: 'local',
    room: null,
    match,
    myPending: { lineup: humanLineup !== null, pick: humanPick !== null },
    oppPending: { lineup: botLineupOrder !== null, pick: botPick !== null },
    rematch: { ...rematch },
  })
  let snapshot = buildSnapshot()

  const emit = () => {
    snapshot = buildSnapshot()
    for (const l of [...listeners]) l()
  }

  /** What the bot owes right now, as a step key; null when it owes nothing. */
  const botStepKey = (): string | null => {
    switch (match.phase) {
      case 'draft':
        return whoseDraftTurn(match) === BOT ? `draft:${match.draft.pickNumber}` : null
      case 'lineup':
        return botLineupOrder === null ? 'lineup' : null
      case 'break':
        return botLineupOrder === null ? `break:${match.history.length}` : null
      case 'play':
        return botPick === null ? `play:${match.history.length}` : null
      case 'gameover':
        return rematch.me && !rematch.opp ? 'rematch' : null
      default:
        return null
    }
  }

  const scheduleBot = () => {
    if (disposed) return
    const key = botStepKey()
    if (key === null || key === timerKey) return
    if (timer !== null) clearTimeout(timer)
    timerKey = key
    const delay = thinkMin + random() * (thinkMax - thinkMin)
    timer = setTimeout(() => {
      timer = null
      timerKey = null
      if (disposed || botStepKey() !== key) return
      botAct()
    }, delay)
  }

  const tryResolve = () => {
    if ((match.phase === 'lineup' || match.phase === 'break') && humanLineup && botLineupOrder) {
      match = applyEvent(match, { type: match.phase === 'lineup' ? 'lineupReveal' : 'quarterBreak', lineups: [humanLineup, botLineupOrder] })
      humanLineup = null
      botLineupOrder = null
    } else if (match.phase === 'play' && humanPick && botPick) {
      const offense = humanPick.role === 'offense' ? humanPick.pick : botPick.role === 'offense' ? botPick.pick : null
      const defense = humanPick.role === 'defense' ? humanPick.pick : botPick.role === 'defense' ? botPick.pick : null
      humanPick = null
      botPick = null
      if (offense && defense) {
        match = applyEvent(match, {
          type: 'possessionResolve',
          offensePick: offense,
          defensePick: defense,
          seed: makeSeed(),
        })
      }
    }
  }

  /** The bot only ever sees `match` (public state) — never humanPick / humanLineup. */
  const botAct = () => {
    switch (match.phase) {
      case 'draft':
        match = applyEvent(match, { type: 'draftPick', seat: BOT, cardId: botDraftPick(match, BOT, random) })
        break
      case 'lineup':
      case 'break':
        botLineupOrder = botLineup(match, BOT, random)
        break
      case 'play':
        botPick =
          currentOffenseSeat(match) === BOT
            ? { role: 'offense', pick: botOffensePick(match, BOT, random) }
            : { role: 'defense', pick: botDefensePick(match, BOT, random) }
        break
      case 'gameover':
        rematch = { me: false, opp: false }
        match = createMatch(makeSeed())
        humanLineup = null
        botLineupOrder = null
        humanPick = null
        botPick = null
        break
      default:
        return
    }
    tryResolve()
    emit()
    scheduleBot()
  }

  const act = (action: PlayerAction) => {
    if (disposed) return
    switch (action.type) {
      case 'draftPick': {
        const event = { type: 'draftPick', seat: HUMAN, cardId: action.cardId } as const
        if (validateEvent(match, event) !== null) return
        match = applyEvent(match, event)
        break
      }
      case 'submitLineup': {
        if ((match.phase !== 'lineup' && match.phase !== 'break') || humanLineup !== null) return
        if (!isLegalLineup(match, HUMAN, action.order)) return
        humanLineup = [...action.order]
        break
      }
      case 'submitOffense': {
        if (match.phase !== 'play' || humanPick !== null) return
        const pick: OffensePick = {
          shooterId: action.shooterId,
          shot: action.shot,
          passerId: action.passerId ?? null,
          cardId: action.cardId ?? null,
          sub: action.sub ? { out: action.sub.out, in: action.sub.in } : null,
        }
        if (validateOffensePick(match, HUMAN, pick) !== null) return
        humanPick = { role: 'offense', pick }
        break
      }
      case 'submitDefense': {
        if (match.phase !== 'play' || humanPick !== null) return
        const pick: DefensePick = {
          doubleId: action.doubleId ?? null,
          cardId: action.cardId ?? null,
          sub: action.sub ? { out: action.sub.out, in: action.sub.in } : null,
        }
        if (validateDefensePick(match, HUMAN, pick) !== null) return
        humanPick = { role: 'defense', pick }
        break
      }
      case 'requestRematch': {
        if (match.phase !== 'gameover' || rematch.me) return
        rematch = { ...rematch, me: true }
        break
      }
      default:
        return
    }
    tryResolve()
    emit()
    scheduleBot()
  }

  scheduleBot()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    act,
    dispose() {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      timerKey = null
      listeners.clear()
    },
  }
}
