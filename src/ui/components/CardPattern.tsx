import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { rngFromSeed } from '../../game'

/** Seeded abstract plate, unique per card id. Pure SVG, no assets. */
export function CardPattern({ id }: { id: string }) {
  const shapes = useMemo(() => build(id), [id])
  return (
    <svg className="cpat" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {shapes}
    </svg>
  )
}

function build(id: string): ReactNode[] {
  const r = rngFromSeed(`plate:${id}`)
  const motif = Math.floor(r() * 5)
  const out: ReactNode[] = []
  const cx = r() < 0.5 ? -8 + r() * 30 : 78 + r() * 30
  const cy = r() < 0.5 ? -10 + r() * 40 : 100 + r() * 50
  if (motif === 0) {
    // three-point arcs
    const gap = 9 + r() * 7
    for (let i = 1; i < 14; i++) out.push(<circle key={i} cx={cx} cy={cy} r={i * gap} strokeWidth={i % 3 === 0 ? 2.2 : 0.7} />)
  } else if (motif === 1) {
    // speed lines
    const ang = -24 - r() * 40
    const gap = 6 + r() * 6
    for (let i = -12; i < 26; i++) {
      const w = r() < 0.25 ? 3 : 0.8
      out.push(<line key={i} x1={-60} y1={i * gap} x2={200} y2={i * gap} strokeWidth={w} transform={`rotate(${ang} 50 70)`} />)
    }
  } else if (motif === 2) {
    // halftone
    const step = 8 + Math.floor(r() * 3)
    let k = 0
    for (let y = 0; y <= 140; y += step) {
      for (let x = 0; x <= 100; x += step) {
        const d = Math.hypot(x - cx, y - cy) / 150
        const rad = Math.max(0.3, (1 - d) * step * 0.44)
        out.push(<circle key={k++} cx={x + ((y / step) % 2) * (step / 2)} cy={y} r={rad} className="cpat__fill" />)
      }
    }
  } else if (motif === 3) {
    // chevrons
    const gap = 11 + r() * 6
    const peak = 14 + r() * 20
    const flip = r() < 0.5 ? 1 : -1
    for (let i = -3; i < 16; i++) {
      const y = i * gap
      out.push(<polyline key={i} points={`-5,${y} 50,${y + peak * flip} 105,${y}`} strokeWidth={i % 2 ? 0.8 : 2.4} />)
    }
  } else {
    // key + lane
    const w = 34 + r() * 20
    const x = 50 - w / 2 + (r() - 0.5) * 30
    out.push(<rect key="lane" x={x} y={-5} width={w} height={90} strokeWidth={1.6} />)
    out.push(<circle key="ft" cx={x + w / 2} cy={85} r={w / 2} strokeWidth={1.6} />)
    out.push(<circle key="ft2" cx={x + w / 2} cy={85} r={w / 2 + 12} strokeWidth={0.7} strokeDasharray="3 4" />)
    for (let i = 0; i < 9; i++) out.push(<line key={i} x1={-5} y1={100 + i * 6} x2={105} y2={100 + i * 6} strokeWidth={0.6} />)
  }
  return out
}
