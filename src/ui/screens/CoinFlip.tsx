import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Seat } from '../../game'
import { Ball3D } from '../components/Ball'
import { buzz } from '../lib/haptics'
import { play } from '../lib/sound'

interface Props {
  me: Seat
  names: [string, string]
  winner: Seat
  onDone: () => void
}

const SLAM = { type: 'spring', stiffness: 520, damping: 20, mass: 0.9 } as const

/**
 * Tip-off: an arcade VS screen. Both names slam in, VS hits, the ball goes up and comes down on the
 * side that picks first. Purely cosmetic: the engine already decided who drafts first from the seed.
 */
export function CoinFlip({ me, names, winner, onDone }: Props) {
  const reduce = useReducedMotion()
  /** 0 names in · 1 VS · 2 ball in the air · 3 landed */
  const [beat, setBeat] = useState(0)
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    const t = reduce ? [0, 80, 160, 2400] : [450, 1050, 2250, 4300]
    play('whoosh')
    const ids = [
      window.setTimeout(() => {
        setBeat(1)
        play('clamp')
        buzz(30)
      }, t[0]),
      window.setTimeout(() => {
        setBeat(2)
        play('coin')
      }, t[1]),
      window.setTimeout(() => {
        setBeat(3)
        play('land')
        buzz([20, 40, 60])
      }, t[2]),
      window.setTimeout(() => finishRef.current(), t[3]),
    ]
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [reduce])

  const opp: Seat = me === 0 ? 1 : 0
  const iWon = winner === me
  const landed = beat >= 3
  const drop = iWon ? '-25dvh' : '25dvh'

  return (
    <main className={`screen tip${landed ? (iWon ? ' is-me' : ' is-opp') : ''}`} onClick={finish}>
      <motion.div className="tip__side tip__side--me" initial={{ x: reduce ? 0 : '-105%' }} animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 170, damping: 20 }}>
        <span className="tip__tag t-label">Player 1 · you</span>
        <span className="tip__name t-display">{names[me]}</span>
      </motion.div>
      <motion.div className="tip__side tip__side--opp" initial={{ x: reduce ? 0 : '105%' }} animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 170, damping: 20, delay: 0.06 }}>
        <span className="tip__name t-display">{names[opp]}</span>
        <span className="tip__tag t-label">Player 2</span>
      </motion.div>

      <motion.div className="tip__shake" animate={beat === 1 && !reduce ? { x: [0, -10, 8, -6, 4, 0] } : { x: 0 }} transition={{ duration: 0.36 }}>
        {beat >= 1 && beat < 3 && (
          <motion.span className="tip__vs" initial={{ scale: 4, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={SLAM}>
            VS
          </motion.span>
        )}
        {beat >= 2 && (
          <motion.div
            className="tip__ball"
            initial={{ y: 0, scale: 0.3, opacity: 0 }}
            animate={landed ? { y: drop, scale: 0.78, opacity: 1 } : { y: reduce ? 0 : [0, -70, 0], scale: [0.3, 1.25, 1], opacity: 1 }}
            transition={landed ? { type: 'spring', stiffness: 150, damping: 15 } : { duration: reduce ? 0.1 : 1.15, times: [0, 0.5, 1], ease: 'easeInOut' }}
          >
            <Ball3D />
          </motion.div>
        )}
      </motion.div>

      <div className="tip__call" aria-live="polite">
        {landed ? (
          <>
            <motion.span className="t-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Tip-off
            </motion.span>
            <motion.p className="tip__result t-display" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SLAM}>
              {iWon ? 'You pick first' : `${names[opp]} picks first`}
            </motion.p>
            <motion.span className="tip__note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              {iWon ? `${names[opp]} gets the ball first.` : 'You get the ball first.'}
            </motion.span>
          </>
        ) : (
          <span className="t-label tip__wait">{beat >= 2 ? 'Ball is up' : 'Tip-off'}</span>
        )}
      </div>
    </main>
  )
}
