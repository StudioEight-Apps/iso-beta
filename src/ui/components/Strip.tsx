import type { CSSProperties } from 'react'
import type { Card } from '../../game'
import { fitLen, surname } from '../lib/names'
import { Die } from './Die'

/** One-line player strip: surname + three dice. Used in rails, lineup rows and the box score. */
export function Strip({ card, align = 'l', dice = true, className }: { card: Card; align?: 'l' | 'r'; dice?: boolean; className?: string }) {
  const last = surname(card)
  return (
    <span className={`strip strip--${align}${className ? ` ${className}` : ''}`} style={{ '--len': fitLen(last) } as CSSProperties}>
      <span className="strip__id">
        <span className="strip__name">{last}</span>
        <span className="strip__meta">
          {card.position} · #{card.number}
        </span>
      </span>
      {dice && (
        <span className="strip__dice">
          <Die size={card.three} tone="off" title={`3PT d${card.three}`} />
          <Die size={card.drive} tone="off" title={`Drive d${card.drive}`} />
          <Die size={card.def} tone="def" title={`Defense d${card.def}`} />
        </span>
      )}
    </span>
  )
}
