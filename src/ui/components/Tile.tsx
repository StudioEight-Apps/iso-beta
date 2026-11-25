import type { CSSProperties } from 'react'
import type { Card } from '../../game'
import { fitLen, surname } from '../lib/names'
import { FACES } from '../lib/faceData'
import { autoZoom, photoOf } from '../lib/photos'
import type { Tone } from './Die'
import { SLOTS } from '../lib/positions'

interface Props {
  card: Card
  slot: number
  spent?: boolean
  /** Can be tapped right now. */
  live?: boolean
  selected?: boolean
  tone?: Tone
  onTap?: () => void
}

/** Court chip: a face and a name. Dice and abilities stay off the court and show once a player is tapped. */
export function Tile({ card, slot, spent = false, live = false, selected = false, tone = 'ink', onTap }: Props) {
  const last = surname(card)
  const photo = photoOf(card.id)
  const face = FACES[card.id]
  // Frame on the detected face: it fills about half the chip, sitting a little low so hair has room.
  let fit: CSSProperties | undefined
  if (face) {
    const h = 50 / face.h
    fit = { height: `${h}%`, top: `${54 - face.y * h}%`, left: `${50 - face.x * h * face.a}%`, transform: 'none' }
  }
  // Hyphenated surnames stack on two lines; everything else shrinks to fit. Never an ellipsis.
  const dash = last.indexOf('-')
  const lines = dash > 0 ? [last.slice(0, dash + 1), last.slice(dash + 1)] : [last]
  const cls = `pchip pchip--${tone}${spent ? ' is-spent' : ''}${live ? ' is-live' : ''}${selected ? ' is-on' : ''}`
  const label = `${card.name}, slot ${slot + 1}${spent ? ', no shots left this quarter' : ''}`
  return (
    <button type="button" className={cls} disabled={!live} onClick={onTap} aria-pressed={selected} aria-label={label}>
      <span className="pchip__face">
        <span className="pchip__init" aria-hidden>
          {last.slice(0, 1)}
        </span>
        <img
          src={photo.src}
          alt=""
          draggable={false}
          style={fit ?? (photo.zoom ? ({ '--zoom': photo.zoom } as CSSProperties) : undefined)}
          onLoad={(e) => {
            const img = e.currentTarget
            img.parentElement?.setAttribute('data-ok', '')
            if (!fit && !photo.zoom) img.style.setProperty('--zoom', String(autoZoom(img.naturalWidth, img.naturalHeight)))
          }}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <span className="pchip__pos">{SLOTS[slot]}</span>
        {spent && <span className="pchip__spent">Shot</span>}
      </span>
      <span className="pchip__name" style={{ '--len': fitLen(last, 6) } as CSSProperties}>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </button>
  )
}
