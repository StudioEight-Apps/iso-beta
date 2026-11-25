import type { Card } from '../../game'

const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv)$/i

/** Name parts with any trailing Jr./Sr./II dropped, so "Jaren Jackson Jr." reads as JACKSON. */
function parts(card: Card): string[] {
  const all = card.name.trim().split(/\s+/)
  while (all.length > 1 && SUFFIX.test(all[all.length - 1])) all.pop()
  return all
}

export function surname(card: Card): string {
  const p = parts(card)
  return (p[p.length - 1] ?? card.name).toUpperCase()
}

export function firstName(card: Card): string {
  return parts(card).slice(0, -1).join(' ').toUpperCase()
}

/** Length of the longest unbreakable piece of a surname (hyphenated names wrap to two lines). */
export function fitLen(name: string, min = 5): number {
  return Math.max(min, ...name.split('-').map((p, i, all) => p.length + (i < all.length - 1 ? 1 : 0)))
}

/** For very small chips: split a long surname into two balanced lines (at the hyphen when there is one). */
export function chipParts(name: string): string[] {
  const dash = name.indexOf('-')
  if (dash > 0) return [name.slice(0, dash + 1), name.slice(dash + 1)]
  if (name.length > 9) {
    const mid = Math.ceil(name.length / 2)
    return [name.slice(0, mid), name.slice(mid)]
  }
  return [name]
}

export function chipLen(name: string): number {
  return Math.max(5, ...chipParts(name).map((p) => p.length))
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}
