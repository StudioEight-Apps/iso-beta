import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function BallIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden {...p}>
      <circle cx="12" cy="12" r="9.2" fill="var(--off)" stroke="none" />
      <g stroke="var(--off-ink)">
        <path d="M2.8 12h18.4M12 2.8v18.4" />
        <path d="M5.6 5.4c3 2.6 3 10.6 0 13.2M18.4 5.4c-3 2.6-3 10.6 0 13.2" />
      </g>
    </svg>
  )
}

/** The lock: a clamp with two jaws. */
export function ClampIcon(p: P) {
  return (
    <svg {...base} strokeWidth={2.4} strokeLinecap="square" strokeLinejoin="miter" aria-hidden {...p}>
      <path d="M9 4H4v16h5" />
      <path d="M15 4h5v16h-5" />
      <path d="M9.5 12h5" />
    </svg>
  )
}

export function SoundOnIcon(p: P) {
  return (
    <svg {...base} aria-hidden {...p}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
    </svg>
  )
}

export function SoundOffIcon(p: P) {
  return (
    <svg {...base} aria-hidden {...p}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  )
}

export function CloseIcon(p: P) {
  return (
    <svg {...base} aria-hidden {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function CopyIcon(p: P) {
  return (
    <svg {...base} aria-hidden {...p}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
    </svg>
  )
}

export function CheckIcon(p: P) {
  return (
    <svg {...base} strokeWidth={2.6} aria-hidden {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ArrowIcon(p: P) {
  return (
    <svg {...base} strokeWidth={2.4} aria-hidden {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function GripIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
      {[7, 12, 17].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.5" />
          <circle cx="15" cy={y} r="1.5" />
        </g>
      ))}
    </svg>
  )
}

export function ExitIcon(p: P) {
  return (
    <svg {...base} aria-hidden {...p}>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
    </svg>
  )
}
