import { useEffect, useRef, useState } from 'react'
import type { FloorDie } from './diceScene'

/** When each roll first hit the floor, so a re-mounted floor shows it landed instead of rolling again. */
const started = new WeakMap<object, number>()

interface Props {
  /** Stable identity of this roll (the engine's roll list). */
  id: object
  dice: FloorDie[]
  instant: boolean
  /** One group in the middle (a pass) instead of offence left, defence right. */
  solo?: boolean
}

/**
 * The floor the dice land on: real 3D iridescent dice, thrown in and settling on the rolled face.
 * three.js loads on demand. If WebGL is unavailable the flat dice below it still show the roll.
 */
export function DiceFloor({ id, dice, instant, solo = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ok, setOk] = useState(false)
  const first = useRef({ dice, instant, solo })
  useEffect(() => {
    let dispose: (() => void) | null = null
    let cancelled = false
    void import('./diceScene')
      .then((m) => {
        if (cancelled || !canvas.current) return
        if (!started.has(id)) started.set(id, performance.now())
        dispose = m.mountDice(canvas.current, first.current.dice, { instant: first.current.instant, solo: first.current.solo, startedAt: started.get(id) ?? performance.now() })
        setOk(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [id])
  return (
    <div className={`dfloor${ok ? ' is-3d' : ''}`} aria-hidden>
      <canvas ref={canvas} />
    </div>
  )
}
