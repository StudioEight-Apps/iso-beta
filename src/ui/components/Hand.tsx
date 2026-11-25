import { motion } from 'motion/react'
import { playCard } from '../../game'
import type { PlayCardId } from '../../game'
import { PlayCardFace } from './PlayerCard'

interface Props {
  hand: readonly PlayCardId[]
  /** Index of the attached card, or null. */
  selected: number | null
  /** Can this card be played from the seat's current role? Others are dimmed but can still be read. */
  usable: (id: PlayCardId) => boolean
  onTap: (index: number) => void
  /** No input (locked in, or a reveal is on top). */
  frozen?: boolean
}

/** Your hand of play cards: a small row at the bottom of the court. Tap one to attach it to this play. */
export function Hand({ hand, selected, usable, onTap, frozen = false }: Props) {
  if (hand.length === 0) {
    return (
      <div className="hand hand--empty" role="status">
        No play cards in hand. You draw 2 at each quarter break.
      </div>
    )
  }
  const mid = (hand.length - 1) / 2
  return (
    <div className="hand" role="group" aria-label="Your play cards">
      {hand.map((id, i) => {
        const def = playCard(id)
        const on = selected === i
        const ok = usable(id)
        return (
          <motion.button
            type="button"
            key={`${id}-${i}`}
            className={`hand__card hand__card--${def.side}${on ? ' is-on' : ''}${ok ? '' : ' is-off'}`}
            style={{ zIndex: on ? 9 : i }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: on ? -12 : 0, opacity: 1, rotate: on ? 0 : (i - mid) * 2.2 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            disabled={frozen}
            aria-pressed={on}
            aria-label={`${def.name}. ${def.text}${ok ? '' : ' Not playable right now.'}`}
            onClick={() => onTap(i)}
          >
            <PlayCardFace card={def} size="md" />
          </motion.button>
        )
      })}
    </div>
  )
}
