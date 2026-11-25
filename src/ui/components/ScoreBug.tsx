import { motion } from 'motion/react'
import type { Seat } from '../../game'
import { quarterLabel } from '../lib/v3'
import { BallIcon } from './Icons'
import { RollingNumber } from './RollingNumber'

interface Props {
  me: Seat
  names: [string, string]
  score: [number, number]
  /** 1..4, or 5+ for overtime pairs. */
  quarter: number
  overtime: boolean
  /** 1-based number of the play being chosen or shown. */
  play: number
  /** Plays in this quarter: 10, or 2 in an overtime pair. */
  plays: number
  offenseSeat: Seat | null
  /** Seat whose score just changed (pulses). */
  bump: Seat | null
}

export function ScoreBug({ me, names, score, quarter, overtime, play, plays, offenseSeat, bump }: Props) {
  const opp: Seat = me === 0 ? 1 : 0
  const q = quarterLabel(quarter, overtime)
  const n = Math.min(Math.max(play, 1), plays)
  const side = (seat: Seat, where: 'l' | 'r') => (
    <div className={`bug__side bug__side--${where}${offenseSeat === seat ? ' has-ball' : ''}`}>
      <div className="bug__name">
        {offenseSeat === seat && (
          <motion.span layoutId="bug-ball" className="bug__ball" transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <BallIcon />
          </motion.span>
        )}
        <span className="bug__nm">{names[seat]}</span>
      </div>
      <span className="bug__role">{offenseSeat === null ? '' : offenseSeat === seat ? 'Ball' : 'Defence'}</span>
    </div>
  )
  return (
    <div className="bug bug--v3" role="group" aria-label={`Scoreboard. ${overtime ? 'Overtime' : `Quarter ${quarter}`}, play ${n} of ${plays}`}>
      {side(me, 'l')}
      <div className={`bug__score${bump === me ? ' is-bump' : ''}`}>
        <RollingNumber value={score[me]} />
      </div>
      <div className="bug__mid">
        <span className="bug__q">{q}</span>
        <span className="bug__play">
          play {n} of {plays}
        </span>
      </div>
      <div className={`bug__score${bump === opp ? ' is-bump' : ''}`}>
        <RollingNumber value={score[opp]} />
      </div>
      {side(opp, 'r')}
    </div>
  )
}
