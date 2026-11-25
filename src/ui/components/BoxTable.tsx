import type { CSSProperties } from 'react'
import { getCard } from '../../game'
import type { BoxLine } from '../../game'
import { surname } from '../lib/names'

interface Props {
  title: string
  score: number
  /** Lines to list, already in the order wanted. */
  lines: BoxLine[]
  /** Short version for the quarter break: no steals/blocks columns, no totals. */
  compact?: boolean
  tone: 'off' | 'def'
}

const sum = (lines: BoxLine[], k: 'pts' | 'reb' | 'ast' | 'stl' | 'blk') => lines.reduce((n, l) => n + l[k], 0)

/** One team's box score. Every number is counted from what actually happened on the dice. */
export function BoxTable({ title, score, lines, compact = false, tone }: Props) {
  const cell = (n: number, big = false) => <td className={`${n >= 10 ? 'is-dd' : ''}${big ? ' bx__pts' : ''}${n === 0 ? ' is-zero' : ''}`}>{n}</td>
  return (
    <section className={`bx bx--${tone}${compact ? ' bx--compact' : ''}`}>
      <header className="bx__head">
        <span className="bx__team">{title}</span>
        <span className="bx__final t-display">{score}</span>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">PTS</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            {!compact && <th scope="col">STL</th>}
            {!compact && <th scope="col">BLK</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.cardId} className={l.possessions === 0 ? 'is-dnp' : ''}>
              <th scope="row">
                <span className="bx__name" style={{ '--len': surname(getCard(l.cardId)).length } as CSSProperties}>
                  {surname(getCard(l.cardId))}
                </span>
                {l.tripleDouble ? <em className="bx__badge bx__badge--td">Triple-double</em> : l.doubleDouble ? <em className="bx__badge">Double-double</em> : null}
              </th>
              {cell(l.pts, true)}
              {cell(l.reb)}
              {cell(l.ast)}
              {!compact && cell(l.stl)}
              {!compact && cell(l.blk)}
            </tr>
          ))}
        </tbody>
        {!compact && (
          <tfoot>
            <tr>
              <th scope="row">Team</th>
              <td className="bx__pts">{sum(lines, 'pts')}</td>
              <td>{sum(lines, 'reb')}</td>
              <td>{sum(lines, 'ast')}</td>
              <td>{sum(lines, 'stl')}</td>
              <td>{sum(lines, 'blk')}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  )
}
