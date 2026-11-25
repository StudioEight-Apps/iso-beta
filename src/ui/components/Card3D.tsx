import { motion, useAnimationFrame, useMotionTemplate, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { TargetAndTransition } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'
import type { Card } from '../../game'
import { tierOf } from '../lib/traits'
import { PlayerCard } from './PlayerCard'

export type CardPose = 'idle' | 'jolt' | 'win' | 'lose'

interface Props {
  card: Card
  /** Frame + edge colour. Defaults to the card's tier colour. */
  tone?: 'off' | 'def'
  /** True = face down. Changing it flips the card with weight. */
  faceDown?: boolean
  /** Follow the pointer / finger. */
  interactive?: boolean
  /** Slow idle sway so the foil shimmers without input. */
  sway?: boolean
  pose?: CardPose
  /** Replaces the plain back (e.g. the abilities panel). */
  back?: ReactNode
  /** Fired on a tap that was not a drag. */
  onTap?: () => void
  className?: string
}

const MAX_TILT = 22
const SLABS = [0.2, 0.4, 0.6, 0.8]

const POSES: Record<CardPose, TargetAndTransition> = {
  idle: { z: 0, y: 0, scale: 1, rotateX: 0, rotateZ: 0 },
  jolt: { z: [0, -50, 0], y: 0, scale: [1, 0.94, 1], rotateX: 0, rotateZ: [0, -7, 5, -3, 0] },
  win: { z: 60, y: -6, scale: 1.07, rotateX: -4, rotateZ: 0 },
  lose: { z: -80, y: 8, scale: 0.94, rotateX: 28, rotateZ: 0 },
}

/**
 * A card with real depth: front, back, edge slabs, pointer tilt, glare and (for elite cards) foil.
 * Sizes itself from its box (5:7 expected). Nothing here uses opacity/filter on the 3D chain,
 * because either would flatten preserve-3d.
 */
export function Card3D({ card, tone, faceDown = false, interactive = false, sway = false, pose = 'idle', back, onTap, className }: Props) {
  const reduce = useReducedMotion()
  const elite = tierOf(card) === 'elite'
  const held = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const rx = useSpring(0, { stiffness: 170, damping: 15 })
  const ry = useSpring(0, { stiffness: 170, damping: 15 })
  const flip = useSpring(faceDown ? 180 : 0, { stiffness: 110, damping: 13, mass: 1.15 })

  useEffect(() => {
    if (reduce) flip.jump(faceDown ? 180 : 0)
    else flip.set(faceDown ? 180 : 0)
  }, [faceDown, flip, reduce])

  useAnimationFrame((t) => {
    if (!sway || reduce || held.current) return
    ry.set(Math.sin(t / 900) * 9)
    rx.set(Math.cos(t / 1300) * 5)
  })

  const rotateY = useTransform(() => ry.get() + flip.get())
  const gx = useTransform(ry, [-MAX_TILT, MAX_TILT], [88, 12])
  const gy = useTransform(rx, [-MAX_TILT, MAX_TILT], [12, 88])
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.38), rgba(255,255,255,0.06) 38%, transparent 62%)`
  const foilPos = useMotionTemplate`${gx}% ${gy}%`
  const foilOpacity = useTransform(() => 0.1 + Math.min(1, Math.hypot(rx.get(), ry.get()) / 14) * 0.38)
  const shadowX = useTransform(ry, (v) => -v * 0.9)
  const shadowY = useTransform(rx, (v) => v * 0.9)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (e.pointerType !== 'mouse' && !held.current) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    held.current = true
    ry.set((x - 0.5) * 2 * MAX_TILT)
    rx.set(-(y - 0.5) * 2 * MAX_TILT)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY }
    if (!interactive) return
    held.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    move(e)
  }
  const dragged = useRef(false)
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    dragged.current = !!s && Math.hypot(e.clientX - s.x, e.clientY - s.y) >= 8
    release()
  }
  const click = () => {
    if (onTap && !dragged.current) onTap()
    dragged.current = false
  }
  const release = () => {
    if (!held.current) return
    held.current = false
    if (!sway) {
      rx.set(0)
      ry.set(0)
    }
  }

  const cls = `c3d c3d--${tone ?? (elite ? 'elite' : 'star')}${elite ? ' is-elite' : ''}${interactive ? ' is-interactive' : ''}${className ? ` ${className}` : ''}`

  return (
    <div className={cls} onPointerDown={down} onPointerMove={move} onClick={click} onPointerUp={up} onPointerCancel={release} onPointerLeave={release}>
      <motion.div className="c3d__shadow" style={{ x: shadowX, y: shadowY }} aria-hidden />
      <motion.div
        className="c3d__pose"
        initial={false}
        animate={reduce ? POSES.idle : POSES[pose]}
        transition={pose === 'jolt' ? { duration: 0.45 } : { type: 'spring', stiffness: 190, damping: 17 }}
      >
        <motion.div className="c3d__body" style={{ rotateX: rx, rotateY }}>
          {SLABS.map((f) => (
            <span key={f} className="c3d__slab" style={{ transform: `translateZ(calc(var(--c3d-t) * ${f - 0.5}))` }} aria-hidden />
          ))}
          <div className={`c3d__face c3d__back${back ? ' has-stats' : ''}`} aria-hidden={!faceDown}>
            {back ?? (
              <div className="c3d__backart">
                <span className="c3d__backring" aria-hidden />
                <span className="c3d__backmark">ISO</span>
              </div>
            )}
          </div>
          <div className="c3d__face c3d__front" aria-hidden={faceDown}>
            <PlayerCard card={card} />
            {elite && <motion.span className="c3d__foil" style={{ backgroundPosition: foilPos, opacity: reduce ? 0.16 : foilOpacity }} aria-hidden />}
            <motion.span className="c3d__glare" style={{ backgroundImage: glare }} aria-hidden />
            {pose === 'win' && !reduce && (
              <motion.span className="c3d__sweep" initial={{ x: '-140%' }} animate={{ x: '140%' }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }} aria-hidden />
            )}
            <motion.span className="c3d__dim" initial={false} animate={{ opacity: pose === 'lose' ? 0.58 : 0 }} transition={{ duration: 0.3 }} aria-hidden />
            <span className="c3d__frame" aria-hidden />
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
