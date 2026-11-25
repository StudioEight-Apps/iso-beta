import type { CSSProperties, PointerEvent } from 'react'
import { abilityOf, defStars, offStars, ovr, playCard } from '../../game'
import type { Card, DieSize, PlayCardDef, PlayCardId } from '../../game'
import { FACES } from '../lib/faceData'
import { firstName, fitLen, surname } from '../lib/names'
import { autoZoom, photoOf } from '../lib/photos'
import { positionsOf } from '../lib/positions'
import { SKILLS, tierOf } from '../lib/traits'
import { Die } from './Die'

interface Props {
  card: Card
  /** Pointer-follow sheen (used on the small grid cards). */
  holo?: boolean
  className?: string
}

function track(e: PointerEvent<HTMLDivElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', ((e.clientX - r.left) / r.width).toFixed(3))
  el.style.setProperty('--my', ((e.clientY - r.top) / r.height).toFixed(3))
  el.style.setProperty('--holo', '1')
}

function untrack(e: PointerEvent<HTMLDivElement>) {
  const el = e.currentTarget
  el.style.setProperty('--holo', '0')
  el.style.setProperty('--mx', '0.5')
  el.style.setProperty('--my', '0.5')
}

/** Arcade power bar: six chunky segments, one lit per two die sides (d4 = 2 ... d12 = 6). Used by pick panels. */
export function PowerBar({ label, size, tone }: { label: string; size: DieSize; tone: 'off' | 'def' }) {
  const on = size / 2
  return (
    <div className={`pbar pbar--${tone}`} role="img" aria-label={`${label} d${size}`}>
      <span className="pbar__label">{label}</span>
      <span className="pbar__track" aria-hidden>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <i key={n} className={n <= on ? 'is-on' : undefined} />
        ))}
      </span>
      <span className="pbar__val">{size}</span>
    </div>
  )
}

/** Surname as one line, or two when hyphenated. */
function nameLines(last: string): string[] {
  const dash = last.indexOf('-')
  return dash > 0 ? [last.slice(0, dash + 1), last.slice(dash + 1)] : [last]
}

/** "PG / SG", falling back to the card's broad position. */
export function positionLine(card: Card): string {
  const all = positionsOf(card.id)
  return all.length ? all.join(' / ') : card.position
}

const STAR = 'M5 0.5 6.4 3.5 9.7 3.9 7.3 6.2 7.9 9.5 5 7.9 2.1 9.5 2.7 6.2 0.3 3.9 3.6 3.5Z'

/** A 1 to 5 star rating. Violet for OFF, cyan for DEF. */
export function Stars({ label, value, tone }: { label: string; value: number; tone: 'off' | 'def' }) {
  return (
    <span className={`stars stars--${tone}`} role="img" aria-label={`${label} ${value} of 5 stars`}>
      <span className="stars__label" aria-hidden>
        {label}
      </span>
      <svg className="stars__row" viewBox="0 0 54 10" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={STAR} transform={`translate(${i * 11} 0)`} className={i < value ? 'is-on' : undefined} />
        ))}
      </svg>
    </span>
  )
}

/** The five skill dice: an outlined polyhedron with its size inside and the skill under it. */
export function SkillDice({ card }: { card: Card }) {
  return (
    <div className="v3c__dice">
      {SKILLS.map((s) => (
        <span key={s.key} className={`v3c__die v3c__die--${s.tone}`}>
          <Die size={card[s.key]} tone={s.tone} title={`${s.label} d${card[s.key]}`} />
          <em aria-hidden>{s.label}</em>
        </span>
      ))}
    </div>
  )
}

/**
 * The trading card front. Photo, OVR badge, small first name over a big surname, positions, star ratings,
 * the five skill dice and the unique ability's name. Sizes itself from its box (5:7 expected) and drops
 * detail as the box gets smaller: under 200px wide the ability eyebrow goes, under 120px only face and name stay.
 */
export function PlayerCard({ card, holo = false, className }: Props) {
  const last = surname(card)
  const first = firstName(card)
  const tier = tierOf(card)
  const photo = photoOf(card.id)
  const face = FACES[card.id]
  const ability = abilityOf(card.id)
  const style = { '--len': fitLen(last, 4), '--flen': Math.max(6, first.length) } as CSSProperties
  const frame = face
    ? ({ '--fx': face.x, '--fy': face.y, '--fh': face.h, '--fa': face.a } as CSSProperties)
    : photo.zoom
      ? ({ '--zoom': photo.zoom } as CSSProperties)
      : undefined
  return (
    <div
      className={`pcard v3c v3c--${tier}${holo ? ' v3c--holo' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      onPointerMove={holo ? track : undefined}
      onPointerLeave={holo ? untrack : undefined}
      onPointerUp={holo ? untrack : undefined}
    >
      <div className="v3c__in">
        {tier === 'elite' && <span className="v3c__aura" aria-hidden />}
        <div className="v3c__shot" aria-hidden>
          <span className="v3c__init">{last.slice(0, 1)}</span>
          <img
            className={face ? undefined : 'is-auto'}
            src={photo.src}
            alt=""
            draggable={false}
            style={frame}
            onLoad={(e) => {
              const img = e.currentTarget
              img.parentElement?.setAttribute('data-ok', '')
              if (!face && !photo.zoom) img.style.setProperty('--zoom', String(autoZoom(img.naturalWidth, img.naturalHeight)))
            }}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
        <div className="v3c__ovr" role="img" aria-label={`Overall ${ovr(card)}`}>
          <b>{ovr(card)}</b>
          <i>OVR</i>
        </div>
        <div className="v3c__body">
          <div className="v3c__id">
            <span className="v3c__first">{first}</span>
            <span className="v3c__name">
              {nameLines(last).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </div>
          <div className="v3c__meta">
            <span className="v3c__pos">{positionLine(card)}</span>
            <span className="v3c__rate">
              <Stars label="OFF" value={offStars(card)} tone="off" />
              <Stars label="DEF" value={defStars(card)} tone="def" />
            </span>
          </div>
          <SkillDice card={card} />
          {ability && (
            <div className="v3c__abil">
              <i>Unique ability</i>
              <b>{ability.name}</b>
            </div>
          )}
        </div>
        <div className="v3c__sheen" aria-hidden />
        {tier === 'elite' && <span className="v3c__edge" aria-hidden />}
      </div>
    </div>
  )
}

/** The card's back: the ability in full, then every die and when it is rolled. */
export function CardStats({ card }: { card: Card }) {
  const ability = abilityOf(card.id)
  const last = surname(card)
  return (
    <div className={`cstat cstat--${tierOf(card)}`} style={{ '--len': fitLen(last, 6) } as CSSProperties}>
      <div className="cstat__head">
        <div className="cstat__who">
          <span className="cstat__first">{firstName(card)}</span>
          <span className="cstat__name">{last}</span>
        </div>
        <div className="cstat__ovr">
          <b>{ovr(card)}</b>
          <i>OVR</i>
        </div>
      </div>
      <div className="cstat__meta">
        <span>{positionLine(card)}</span>
        <Stars label="OFF" value={offStars(card)} tone="off" />
        <Stars label="DEF" value={defStars(card)} tone="def" />
      </div>
      <div className="cstat__abil">
        <i>{ability ? 'Unique ability' : 'No unique ability'}</i>
        {ability ? (
          <>
            <b>{ability.name}</b>
            <span>{ability.text}</span>
          </>
        ) : (
          <span>A role player. His value is his dice and the seat he fills.</span>
        )}
      </div>
      <div className="cstat__rows">
        {SKILLS.map((s) => (
          <div key={s.key} className={`cstat__row cstat__row--${s.tone}`}>
            <Die size={card[s.key]} tone={s.tone} title={`${s.label} d${card[s.key]}`} />
            <b>{s.label}</b>
            <em>d{card[s.key]}</em>
            <span>{s.what}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Face-down card. */
export function CardBack({ className }: { className?: string }) {
  return (
    <div className={`cback${className ? ` ${className}` : ''}`} aria-label="Hidden">
      <span>ISO</span>
    </div>
  )
}

const SIDE_LABEL: Record<PlayCardDef['side'], string> = { offense: 'Offence', defense: 'Defence', either: 'Either side' }

/**
 * A play or support card from the shared deck: who can play it (violet offence, cyan defence, white either),
 * its name, and its effect in one plain sentence. 'md' is a 5:7 card that fills its box's width; 'sm' is a compact row.
 */
export function PlayCardFace({ card, size = 'md', className }: { card: PlayCardDef | PlayCardId; size?: 'sm' | 'md'; className?: string }) {
  const def = typeof card === 'string' ? playCard(card) : card
  return (
    <div className={`deckc deckc--${def.side} deckc--${size}${className ? ` ${className}` : ''}`} data-card={def.id}>
      <span className="deckc__side">{SIDE_LABEL[def.side]}</span>
      <span className="deckc__name">{def.name}</span>
      <span className="deckc__text">{def.text}</span>
      <span className="deckc__mark" aria-hidden>
        ISO
      </span>
    </div>
  )
}
