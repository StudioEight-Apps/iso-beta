import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { DieSize } from '../../game'
import { Die } from './Die'

export type RollTone = 'off' | 'def' | 'ink'

interface Props {
  /** Die shape: d4 triangle, d6 square, d8 diamond, d10 kite, d12 pentagon. */
  size: DieSize
  /** The face it lands on. */
  face: number
  tone: RollTone
  /** Wait this long (ms) before it leaves the hand. */
  delay?: number
  /** How long it tumbles (ms). About a second reads as a real roll. */
  duration?: number
  /** Skip the tumble and show the landed face at once. */
  instant?: boolean
  /** Rolled, then replaced by a reroll: shown struck through and faded. */
  discarded?: boolean
  /** Fired once, when the die comes to rest. */
  onLand?: () => void
  className?: string
}

type Phase = 'wait' | 'roll' | 'land'

/**
 * One physical die. It waits, tumbles with its faces cycling, then lands with the final face large.
 * Transform only, so a tray of six stays smooth on a phone. Reduced motion: it simply appears landed.
 */
export function RollDie({ size, face, tone, delay = 0, duration = 950, instant = false, discarded = false, onLand, className }: Props) {
  const reduce = useReducedMotion()
  const still = instant || !!reduce
  const [phase, setPhase] = useState<Phase>(still && delay === 0 ? 'land' : 'wait')
  const [shown, setShown] = useState(face)
  const landed = useRef(false)
  const cb = useRef(onLand)
  cb.current = onLand
  const dir = useRef<1 | -1>(Math.random() < 0.5 ? 1 : -1)

  useEffect(() => {
    if (phase === 'land') return
    if (instant) {
      setPhase('land')
      return
    }
    if (reduce) {
      const id = window.setTimeout(() => setPhase('land'), Math.min(delay, 400))
      return () => window.clearTimeout(id)
    }
    const a = window.setTimeout(() => setPhase('roll'), delay)
    const b = window.setTimeout(() => setPhase('land'), delay + duration)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [delay, duration, instant, reduce, phase === 'land'])

  useEffect(() => {
    if (phase !== 'roll') return
    let prev = 0
    const id = window.setInterval(() => {
      let n = 1 + Math.floor(Math.random() * size)
      if (n === prev) n = (n % size) + 1
      prev = n
      setShown(n)
    }, 75)
    return () => window.clearInterval(id)
  }, [phase, size])

  useEffect(() => {
    if (phase !== 'land' || landed.current) return
    landed.current = true
    cb.current?.()
  }, [phase])

  const d = dir.current
  const sec = duration / 1000
  return (
    <motion.span
      className={`rolldie rolldie--${phase} rolldie--${tone}${discarded && phase === 'land' ? ' is-void' : ''}${className ? ` ${className}` : ''}`}
      data-die={size}
      initial={still ? false : { opacity: 0, y: -46, rotate: -140 * d, scale: 0.5 }}
      animate={
        phase === 'wait'
          ? { opacity: 0, y: -46, rotate: -140 * d, scale: 0.5 }
          : phase === 'roll'
            ? { opacity: 1, y: [-46, 0, -26, 0, -12, 0, -4, 0], x: [14 * d, 6 * d, -5 * d, 4 * d, -3 * d, 2 * d, 0, 0], rotate: [-140 * d, 90 * d, 260 * d, 420 * d, 540 * d, 640 * d, 700 * d, 720 * d], scale: 1 }
            : { opacity: 1, y: 0, x: 0, rotate: 0, scale: still ? 1 : [1.34, 1] }
      }
      transition={
        phase === 'roll'
          ? { duration: sec, ease: 'easeOut', times: [0, 0.16, 0.32, 0.48, 0.62, 0.76, 0.9, 1], opacity: { duration: 0.12 } }
          : phase === 'land'
            ? { type: 'spring', stiffness: 520, damping: 16 }
            : { duration: 0 }
      }
      aria-label={phase === 'land' ? `d${size} shows ${face}` : `d${size} rolling`}
      role="img"
    >
      <Die size={size} value={phase === 'land' ? face : phase === 'roll' ? shown : `d${size}`} tone={tone} solid={phase === 'land' && !discarded} />
    </motion.span>
  )
}
