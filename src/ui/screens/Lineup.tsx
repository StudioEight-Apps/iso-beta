import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { BENCH_SIZE, TEAM_SIZE, getCard, teamChem } from '../../game'
import type { MatchState, Seat } from '../../game'
import type { PlayerAction } from '../../session'
import { CardPeek } from '../components/CardPeek'
import { CheckIcon, ClampIcon } from '../components/Icons'
import { LineupBoard } from '../components/LineupBoard'
import { TopBar } from '../components/TopBar'
import { buzz } from '../lib/haptics'
import { surname } from '../lib/names'
import { play } from '../lib/sound'
import { seatSeven } from '../lib/v3'

interface Props {
  me: Seat
  names: [string, string]
  match: MatchState
  context: string
  mine: boolean
  theirs: boolean
  onAct: (a: PlayerAction) => void
  onExit: () => void
}

/** Opening lineup: seat five by position, two on the bench. Hidden until both coaches lock in. */
export function Lineup({ me, names, match, context, mine, theirs, onAct, onExit }: Props) {
  const opp: Seat = me === 0 ? 1 : 0
  const [order, setOrder] = useState<string[]>(() => {
    const s = seatSeven(match.draft.picks[me])
    return [...s.floor.filter((id): id is string => id !== null), ...s.bench]
  })
  const [peek, setPeek] = useState<string | null>(null)
  const links = teamChem(order.slice(0, TEAM_SIZE)).links

  return (
    <main className="screen lineup lineup--v3">
      <TopBar context={context} onExit={onExit} />
      <div className="lineup__head">
        <h1 className="t-display">Set your five</h1>
        <p>
          <b>Each seat guards the same seat</b>: your PG on their PG, down to C. The last {BENCH_SIZE} rows are your bench. Drag a row, or tap two rows to swap. A player in a seat that is not on his card rolls at -1.
        </p>
        <div className="chemrow">
          {links.length > 0 ? (
            links.map((l) => (
              <span key={l.id} className="chemrow__l" title={l.text}>
                <b>{l.name}</b> {l.text}
              </span>
            ))
          ) : (
            <span className="chemrow__l">No team links on the floor</span>
          )}
        </div>
      </div>

      <div className="lineup__theirs">
        <span className="t-label">{names[opp]}’s seven · seats hidden</span>
        <div className="lineup__names">
          {match.draft.picks[opp].map((id) => (
            <button type="button" key={id} onClick={() => setPeek(id)} aria-label={`See ${getCard(id).name}'s card`}>
              {surname(getCard(id))}
            </button>
          ))}
        </div>
      </div>

      <LineupBoard order={order} onOrder={setOrder} locked={mine} onPeek={setPeek} />

      <div className="lineup__foot">
        <div className={`oppstat${theirs ? ' is-ready' : ''}`} role="status">
          {theirs ? (
            <>
              <CheckIcon /> {names[opp]} is locked in
            </>
          ) : (
            <>
              {names[opp]} is setting a lineup
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </>
          )}
        </div>
        {mine ? (
          <div className="waitbar" role="status">
            <ClampIcon />
            <span className="t-display">Locked in</span>
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--court"
            onClick={() => {
              play('lockin')
              buzz([14, 30, 22])
              onAct({ type: 'submitLineup', order: order.slice(0, TEAM_SIZE) })
            }}
          >
            Lock in lineup
          </button>
        )}
      </div>

      <AnimatePresence>{peek && <CardPeek key="peek" cardId={peek} title={match.draft.picks[me].includes(peek) ? 'Your player' : 'Their player'} onClose={() => setPeek(null)} />}</AnimatePresence>
    </main>
  )
}
