import { useEffect, useRef } from 'react'

/** The ISO mark as a small flat chip (top bar). */
export function Ball({ className }: { className?: string }) {
  return (
    <span className={`ball${className ? ` ${className}` : ''}`} aria-hidden>
      <span className="ball__body">
        <svg viewBox="0 0 100 100">
          <path d="M50 0 V100 M0 50 H100 M16 12 Q52 50 16 88 M84 12 Q48 50 84 88" />
        </svg>
      </span>
    </span>
  )
}

/**
 * The ISO mark in real 3D (iridescent black chrome). three.js loads on demand; until then, and if WebGL
 * is unavailable, the flat chip shows. `dribble` bounces it a few times, or forever while waiting.
 */
export function Ball3D({ dribble, className }: { dribble?: 'once' | 'loop'; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let dispose: (() => void) | null = null
    let cancelled = false
    void import('./ballScene')
      .then((m) => {
        if (cancelled || !canvas.current) return
        dispose = m.mountBall(canvas.current)
        wrap.current?.classList.add('is-3d')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])
  return (
    <span ref={wrap} className={`ball ball--3d${dribble ? ` ball--${dribble}` : ''}${className ? ` ${className}` : ''}`} aria-hidden>
      <span className="ball__shadow" />
      <span className="ball__body">
        <svg viewBox="0 0 100 100">
          <path d="M50 0 V100 M0 50 H100 M16 12 Q52 50 16 88 M84 12 Q48 50 84 88" />
        </svg>
      </span>
      <span className="ball__gl">
        <canvas ref={canvas} />
      </span>
    </span>
  )
}
