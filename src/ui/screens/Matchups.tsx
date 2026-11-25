import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { getCard } from '../../game'
import type { MatchState, Seat } from '../../game'
import { Strip } from '../components/Strip'
import { buzz } from '../lib/haptics'
import { play } from '../lib/sound'
import { SLOTS } from '../lib/positions'

interface Props {
  me: Seat
  names: [string, string]
  match: MatchState
  onDone: () => void
}

/** Both lineups flip face-up together, slot by slot. */
export function Matchups({ me, names, match, onDone }: Props) {
  const reduce = useReducedMotion()
  const opp: Seat = me === 0 ? 1 : 0
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    const ids: number[] = []
    const step = reduce ? 0 : 240
    for (let i = 0; i < 5; i++) {
      ids.push(
        window.setTimeout(() => {
          play('clamp')
          buzz(14)
        }, 500 + i * step),
      )
    }
    ids.push(window.setTimeout(() => finishRef.current(), reduce ? 2600 : 4200))
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [reduce])

  if (!match.lineups) return null
  const lineups = match.lineups

  return (
    <main className="screen matchups" onClick={finish}>
      <div className="matchups__head">
        <span className="t-label c-court">Lineups revealed</span>
        <h1 className="t-display">Matchups</h1>
        <div className="matchups__names t-label">
          <span>{names[me]}</span>
          <span>{names[opp]}</span>
        </div>
      </div>
      <div className="matchups__rows">
        {lineups[me].map((id, i) => (
          <div className="mrow" key={id}>
            <motion.div className="mrow__side" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.5 + i * 0.24 }}>
              <Strip card={getCard(id)} />
            </motion.div>
            <motion.span className="mrow__n t-display" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.56 + i * 0.24 }}>
              {SLOTS[i]}
            </motion.span>
            <motion.div
              className="mrow__side mrow__side--r"
              initial={{ rotateX: 90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.56 + i * 0.24 }}
            >
              <Strip card={getCard(lineups[opp][i])} align="r" />
            </motion.div>
          </div>
        ))}
      </div>
      <motion.p className="matchups__foot t-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
        Tap to tip off
      </motion.p>
    </main>
  )
}
