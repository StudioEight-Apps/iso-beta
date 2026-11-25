import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { DRAW_PER_BREAK, HAND_LIMIT, POSSESSIONS_PER_QUARTER, POSSESSIONS_PER_SIDE, playCard } from '../../game'
import type { PlayCardId, Seat } from '../../game'
import { PlayCardFace } from '../components/PlayerCard'
import { buzz } from '../lib/haptics'
import { play } from '../lib/sound'
import { quarterLabel } from '../lib/v3'

export interface IntroInfo {
  quarter: number
  overtime: boolean
  /** Play cards that just came into my hand. */
  drawn: PlayCardId[]
  handSize: number
  firstBall: Seat
  /** The very first quarter: the cards are the opening deal. */
  opening: boolean
}

interface Props {
  info: IntroInfo
  me: Seat
  names: [string, string]
  onDone: () => void
}

/** Start of a quarter: the cards you drew turn over, and you are told who has the ball. */
export function QuarterIntro({ info, me, names, onDone }: Props) {
  const reduce = useReducedMotion()
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    play(info.opening ? 'whoosh' : 'buzzer')
    buzz([60, 40, 60])
    const ids = info.drawn.map((_, i) => window.setTimeout(() => play('land'), 500 + i * 220))
    ids.push(window.setTimeout(() => finishRef.current(), 2600 + info.drawn.length * 450))
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [info])

  const ball = info.firstBall === me ? 'Your ball first' : `${names[info.firstBall]} has the ball first`
  const again = info.overtime && info.quarter > 5
  const short = info.drawn.length < (info.opening ? 0 : DRAW_PER_BREAK) && !info.overtime

  return (
    <motion.div className={`qi${info.overtime ? ' qi--ot' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={finish} role="dialog" aria-label={info.overtime ? 'Overtime' : `Quarter ${info.quarter}`}>
      <div className="qi__in">
        <motion.span className="t-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {info.opening ? 'Tip-off' : again ? 'Still tied' : info.overtime ? 'Tied after four' : 'New quarter'}
        </motion.span>
        <motion.h2 className="qi__title t-display" initial={reduce ? false : { y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.06 }}>
          {info.overtime ? 'Overtime' : quarterLabel(info.quarter, false)}
        </motion.h2>

        {info.drawn.length > 0 && (
          <>
            <span className="qi__sub t-label">{info.opening ? 'Your opening hand' : `You drew ${info.drawn.length}`}</span>
            <div className={`qi__cards qi__cards--${info.drawn.length > 2 ? 'many' : 'few'}`}>
              {info.drawn.map((id, i) => (
                <motion.div
                  key={`${id}-${i}`}
                  className="qi__card"
                  initial={reduce ? false : { y: 90, opacity: 0, rotateY: 180, scale: 0.7 }}
                  animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1, rotate: (i - (info.drawn.length - 1) / 2) * 4 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.45 + i * 0.22 }}
                >
                  <PlayCardFace card={playCard(id)} size="md" />
                </motion.div>
              ))}
            </div>
          </>
        )}

        <motion.p className="qi__note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + info.drawn.length * 0.22 }}>
          {info.overtime
            ? `One possession each. Lead after the pair and it is over. Shot counts and subs are fresh. ${ball}.`
            : `${POSSESSIONS_PER_QUARTER} plays, ${POSSESSIONS_PER_SIDE} possessions each. ${ball}.`}
          {short ? ` Your hand is at the limit of ${HAND_LIMIT}, so you drew fewer.` : ''}
        </motion.p>
        <span className="qi__hand t-label">
          Hand {info.handSize} of {HAND_LIMIT} · tap to play
        </span>
      </div>
    </motion.div>
  )
}
