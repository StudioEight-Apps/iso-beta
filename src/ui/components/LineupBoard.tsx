import { Reorder } from 'motion/react'
import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { TEAM_SIZE, abilityOf, fitScore, getCard, positionsOf } from '../../game'
import { buzz } from '../lib/haptics'
import { firstName, surname } from '../lib/names'
import { SLOTS } from '../lib/positions'
import { play } from '../lib/sound'
import { GripIcon } from './Icons'

interface Props {
  /** All seven cards: the first five are the floor in seat order PG SG SF PF C, the last two the bench. */
  order: string[]
  onOrder: (next: string[]) => void
  locked: boolean
  /** Open the big card for a player. */
  onPeek?: (id: string) => void
}

/** Seven rows: five seats and a two-man bench. Drag to reorder, or tap two rows to swap them. */
export function LineupBoard({ order, onOrder, locked, onPeek }: Props) {
  const [sel, setSel] = useState<string | null>(null)
  /** Set when a press starts on the Card button, so the row does not also treat it as a swap tap. */
  const skip = useRef(false)

  const tap = (id: string) => {
    if (skip.current) {
      skip.current = false
      return
    }
    if (locked) return
    if (sel === null) {
      play('tap')
      setSel(id)
      return
    }
    if (sel !== id) {
      const a = order.indexOf(sel)
      const b = order.indexOf(id)
      const next = [...order]
      next[a] = id
      next[b] = sel
      onOrder(next)
      play('select')
      buzz(12)
    }
    setSel(null)
  }

  return (
    <div className={`lb${locked ? ' is-locked' : ''}`}>
      <div className="lb__seats" aria-hidden>
        {order.map((_, i) => (
          <span key={i} className={`lb__seat${i >= TEAM_SIZE ? ' lb__seat--bench' : ''}`}>
            {i < TEAM_SIZE ? SLOTS[i] : 'BN'}
          </span>
        ))}
      </div>
      <Reorder.Group
        as="div"
        axis="y"
        values={order}
        onReorder={(next) => {
          if (!locked) onOrder(next as string[])
        }}
        className="lb__rows"
      >
        {order.map((id, i) => {
          const card = getCard(id)
          const bench = i >= TEAM_SIZE
          const off = !bench && fitScore(id, i) === 0
          const ability = abilityOf(id)
          return (
            <Reorder.Item
              as="div"
              key={id}
              value={id}
              drag={locked ? false : 'y'}
              className={`lb__row${sel === id ? ' is-sel' : ''}${bench ? ' is-bench' : ''}${off ? ' is-off' : ''}`}
              whileDrag={{ scale: 1.03, zIndex: 5 }}
              onDragStart={() => {
                skip.current = false
                setSel(null)
                play('tap')
              }}
              onDragEnd={() => buzz(10)}
              onTap={() => tap(id)}
              role="button"
              tabIndex={0}
              aria-label={`${card.name}, ${bench ? 'bench' : SLOTS[i]}${off ? ', out of position' : ''}. Tap to select for a swap.`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  tap(id)
                }
              }}
            >
              <span className="lb__id" style={{ '--len': Math.max(8, surname(card).length) } as CSSProperties}>
                <small>{firstName(card)}</small>
                <b>{surname(card)}</b>
              </span>
              <span className="lb__meta">
                <span className="lb__pos">{positionsOf(id).join(' / ') || card.position}</span>
                {off ? <span className="lb__warn">Out of position, -1</span> : ability ? <span className="lb__abil">{ability.name}</span> : null}
              </span>
              {onPeek && (
                <button
                  type="button"
                  className="lb__peek"
                  aria-label={`See ${card.name}'s card`}
                  onPointerDown={() => {
                    skip.current = true
                  }}
                  onClick={() => onPeek(id)}
                >
                  Card
                </button>
              )}
              <span className="lb__grip" aria-hidden>
                <GripIcon />
              </span>
            </Reorder.Item>
          )
        })}
      </Reorder.Group>
    </div>
  )
}
