import type { DieSize } from '../../game'

export type Tone = 'off' | 'def' | 'ink' | 'court'

export const OUTLINE: Record<number, string> = {
  4: '50,7 95,88 5,88',
  6: '11,11 89,11 89,89 11,89',
  8: '50,3 93,50 50,97 7,50',
  10: '50,3 91,40 50,97 9,40',
  12: '50,4 96,38 78,93 22,93 4,38',
}

/** Inner facet lines: enough to read as a solid, quiet enough to keep the number clear. */
export const FACETS: Record<number, string> = {
  4: 'M50 7 L50 60 M5 88 L50 60 L95 88',
  6: 'M11 11 L26 26 M89 11 L74 26 M89 89 L74 74 M11 89 L26 74 M26 26 H74 V74 H26 Z',
  8: 'M7 50 H93 M50 3 L28 50 L50 97 M50 3 L72 50 L50 97',
  10: 'M9 40 L50 62 L91 40 M50 62 V97 M50 3 L30 51 M50 3 L70 51',
  12: 'M50 4 V24 M96 38 L76 44 M78 93 L66 76 M22 93 L34 76 M4 38 L24 44 M50 24 L76 44 L66 76 H34 L24 44 Z',
}

export const TEXT_Y: Record<number, number> = { 4: 68, 6: 51, 8: 51, 10: 47, 12: 54 }
export const TEXT_SCALE: Record<number, number> = { 4: 0.78, 6: 1, 8: 0.9, 10: 0.86, 12: 0.94 }

interface DieProps {
  size: DieSize | 6
  /** Text inside. Defaults to the die size. */
  value?: number | string
  tone?: Tone
  /** Solid fill (used for rolled dice and selected states). */
  solid?: boolean
  className?: string
  title?: string
}

/** A polyhedron glyph whose silhouette encodes the die size. Sized by CSS (width). */
export function dieFontSize(size: number, text: string): number {
  return (text.length > 2 ? 27 : text.length > 1 ? 36 : 44) * (TEXT_SCALE[size] ?? 1)
}

export function Die({ size, value, tone = 'ink', solid = false, className, title }: DieProps) {
  const text = String(value ?? size)
  const fs = dieFontSize(size, text)
  return (
    <svg
      className={`die die--${tone}${solid ? ' die--solid' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? `d${size}`}
    >
      <polygon className="die__body" points={OUTLINE[size]} />
      <path className="die__facets" d={FACETS[size]} />
      <text className="die__num" x="50" y={TEXT_Y[size]} fontSize={fs} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </svg>
  )
}
