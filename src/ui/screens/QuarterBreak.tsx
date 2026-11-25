import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { DRAW_PER_BREAK, HAND_LIMIT, QUARTERS, TEAM_SIZE, benchOf, boxScore, firstOffenseSeatOfQuarter } from '../../game'
import type { BoxLine, MatchState, Seat } from '../../game'
import type { PlayerAction } from '../../session'
import { BoxTable } from '../components/BoxTable'
import { CardPeek } from '../components/CardPeek'
import { CheckIcon, ClampIcon } from '../components/Icons'
import { LineupBoard } from '../components/LineupBoard'
import { TopBar } from '../components/TopBar'
import { buzz } from '../lib/haptics'
import { play } from '../lib/sound'

interface Props {
  me: Seat
  names: [string, string]
  match: MatchState
  context: string
  mine: boolean
  theirs: boolean
  onAct: (a: PlayerAction) => void
  onExit: () => void
}

/** Between quarters: the score, a short box score, and your five for the next quarter. Subs are free here. */
export function QuarterBreak({ me, names, match, context, mine, theirs, onAct, onExit }: Props) {
  const opp: Seat = me === 0 ? 1 : 0
  const [order, setOrder] = useState<string[]>(() => [...(match.lineups?.[me] ?? match.draft.picks[me].slice(0, TEAM_SIZE)), ...benchOf(match, me)])
  const [peek, setPeek] = useState<string | null>(null)

  useEffect(() => {
    play('buzzer')
    buzz([80, 40, 80])
  }, [])

  const toOvertime = match.quarter >= QUARTERS
  const next = match.quarter + 1
  const box = boxScore(match)
  const top = (seat: Seat): BoxLine[] =>
    match.draft.picks[seat]
      .map((id) => box[id])
      .filter((l) => l.pts + l.reb + l.ast > 0)
      .sort((a, b) => b.pts - a.pts || b.reb + b.ast - (a.reb + a.ast))
      .slice(0, 3)
  const diff = match.score[me] - match.score[opp]
  const hand = match.hands[me].length
  const draws = toOvertime ? 0 : Math.max(0, Math.min(DRAW_PER_BREAK, HAND_LIMIT - hand))
  const ball = firstOffenseSeatOfQuarter(match, next) === me ? 'You have the ball first.' : `${names[opp]} has the ball first.`

  return (
    <main className="screen screen--scroll qb">
      <TopBar context={context} onExit={onExit} />

      <section className="qb__hero">
        <span className="t-label">{toOvertime ? 'Tied after four quarters' : `End of Q${match.quarter}`}</span>
        <div className="qb__score t-display">
          <span className={diff >= 0 ? 'is-up' : ''}>
            <em className="t-label">You</em>
            {match.score[me]}
          </span>
          <i />
          <span className={diff <= 0 ? 'is-up' : ''}>
            <em className="t-label">{names[opp]}</em>
            {match.score[opp]}
          </span>
        </div>
        <p className="qb__lede">{diff === 0 ? 'All square.' : diff > 0 ? `You lead by ${diff}.` : `You trail by ${-diff}.`}</p>
      </section>

      <section className="qb__box">
        <BoxTable title="You" score={match.score[me]} lines={top(me)} tone="off" compact />
        <BoxTable title={names[opp]} score={match.score[opp]} lines={top(opp)} tone="def" compact />
      </section>

      <section className="qb__set">
        <h2 className="qb__h t-display">{toOvertime ? 'Set your five for overtime' : `Set your five for Q${next}`}</h2>
        <p className="qb__copy">
          Subs are free at the break and everyone gets their 2 shots back. Drag a row, or tap two rows to swap them.{' '}
          {toOvertime ? 'No cards are drawn before overtime. One possession each until someone leads.' : draws > 0 ? `You draw ${draws} play ${draws === 1 ? 'card' : 'cards'} when the quarter starts.` : `Your hand is full at ${HAND_LIMIT}, so you draw nothing.`}{' '}
          {ball}
        </p>
        <LineupBoard order={order} onOrder={setOrder} locked={mine} onPeek={setPeek} />
      </section>

      <div className="qb__foot">
        <div className={`oppstat${theirs ? ' is-ready' : ''}`} role="status">
          {theirs ? (
            <>
              <CheckIcon /> {names[opp]} is locked in
            </>
          ) : (
            <>
              {names[opp]} is setting a five
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </>
          )}
        </div>
        {mine ? (
          <div className="waitbar" role="status">
            <ClampIcon />
            <span className="t-display">Locked in</span>
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : (
          <motion.button
            type="button"
            className="btn btn--court"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              play('lockin')
              buzz([14, 30, 22])
              onAct({ type: 'submitLineup', order: order.slice(0, TEAM_SIZE) })
            }}
          >
            {toOvertime ? 'Lock in for overtime' : `Lock in for Q${next}`}
          </motion.button>
        )}
      </div>

      <AnimatePresence>{peek && <CardPeek key="peek" cardId={peek} title="Your player" onClose={() => setPeek(null)} />}</AnimatePresence>
    </main>
  )
}
