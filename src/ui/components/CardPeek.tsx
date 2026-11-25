import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getCard } from '../../game'
import { play } from '../lib/sound'
import { Card3D } from './Card3D'
import { CardStats } from './PlayerCard'
import { Sheet } from './Sheet'

interface Props {
  cardId: string
  title: string
  onClose: () => void
  /** Buttons under the card. */
  children?: ReactNode
}

/** A glass sheet with one big card. Tap the card to flip it and read the ability. */
export function CardPeek({ cardId, title, onClose, children }: Props) {
  const card = getCard(cardId)
  const [back, setBack] = useState(false)
  useEffect(() => setBack(false), [cardId])
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="peek">
        <motion.div className="peek__card" initial={{ scale: 0.86, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
          <Card3D
            card={card}
            faceDown={back}
            interactive
            sway
            back={<CardStats card={card} />}
            onTap={() => {
              play('tap')
              setBack((v) => !v)
            }}
          />
        </motion.div>
        <span className="peek__hint t-label">{back ? 'Tap to flip back' : 'Tap the card for his ability'}</span>
      </div>
      {children}
    </Sheet>
  )
}
