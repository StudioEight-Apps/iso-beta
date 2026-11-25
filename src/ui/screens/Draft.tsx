import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DRAFT_ORDER, ROSTER_SIZE, TEAM_SIZE, TOTAL_PICKS, abilityOf, dealPool, getCard, positionsOf, whoseDraftTurn } from '../../game'
import type { MatchState, Seat } from '../../game'
import type { PlayerAction } from '../../session'
import { Card3D } from '../components/Card3D'
import { CardStats, PlayerCard } from '../components/PlayerCard'
import { Sheet } from '../components/Sheet'
import { TopBar } from '../components/TopBar'
import { buzz } from '../lib/haptics'
import { chipLen, chipParts, surname } from '../lib/names'
import { shareCard } from '../lib/shareCard'
import { SLOTS, fitScore } from '../lib/positions'
import { play } from '../lib/sound'
import { seatSeven } from '../lib/v3'
import { teamChem } from '../../game'

interface Props {
  me: Seat
  names: [string, string]
  match: MatchState
  context: string
  onAct: (a: PlayerAction) => void
  onExit: () => void
}

const FLY = { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 } as const

export function Draft({ me, names, match, context, onAct, onExit }: Props) {
  const opp: Seat = me === 0 ? 1 : 0
  const [inspect, setInspect] = useState<string | null>(null)
  const turn = whoseDraftTurn(match)
  const myTurn = turn === me
  const picked = match.draft.pickNumber
  const done = picked >= TOTAL_PICKS

  const reduce = useReducedMotion()
  const seatOfPick = (i: number): Seat => (DRAFT_ORDER[i] === 0 ? match.firstDrafter : match.firstDrafter === 0 ? 1 : 0)

  // Every pick gets its moment: the card turns over centre-stage, then the board carries on.
  const [reveal, setReveal] = useState<{ cardId: string; seat: Seat; n: number } | null>(null)
  const [revealUp, setRevealUp] = useState(false)
  const [inspectBack, setInspectBack] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const prev = useRef(picked)
  useEffect(() => {
    if (picked > prev.current) {
      play('lockin')
      buzz(18)
      const seat = seatOfPick(picked - 1)
      const list = match.draft.picks[seat]
      const cardId = list[list.length - 1]
      if (cardId) {
        setRevealUp(false)
        setReveal({ cardId, seat, n: picked })
      }
    }
    prev.current = picked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked])

  useEffect(() => {
    if (!reveal) return
    const up = window.setTimeout(() => {
      setRevealUp(true)
      play('whoosh')
    }, reduce ? 0 : 140)
    const out = window.setTimeout(() => setReveal(null), reduce ? 900 : 1750)
    return () => {
      window.clearTimeout(up)
      window.clearTimeout(out)
    }
  }, [reveal, reduce])

  useEffect(() => {
    setInspectBack(false)
    setShareNote(null)
  }, [inspect])

  // Close the inspector if the inspected card was taken.
  const inspected = inspect && match.draft.available.includes(inspect) ? getCard(inspect) : null

  // The cards dealt for this game, in dealt order. Drafted cards leave an empty slot.
  const pool = useMemo(() => dealPool(match.seed).map(getCard), [match.seed])

  const revealed = reveal ? getCard(reveal.cardId) : null

  const rail = (seat: Seat) => {
    const seated = seatSeven(match.draft.picks[seat])
    const links = teamChem(seated.floor).links
    const cells: { label: string; id: string | null; off: boolean }[] = [
      ...seated.floor.map((id, i) => ({ label: SLOTS[i] as string, id, off: !!id && fitScore(id, i) === 0 })),
      ...Array.from({ length: ROSTER_SIZE - TEAM_SIZE }, (_, i) => ({ label: 'BN', id: seated.bench[i] ?? null, off: false })),
    ]
    return (
      <div className={`rail rail--v3${turn === seat ? ' is-turn' : ''}`}>
        <div className="rail__head">
          <span className="rail__who t-display">{seat === me ? 'You' : names[seat]}</span>
          <span className="rail__chem" title={links.map((l) => l.name).join(', ')}>
            {links.length === 1 ? '1 link' : `${links.length} links`}
          </span>
          <span className="t-label t-mono">
            {match.draft.picks[seat].length}/{ROSTER_SIZE}
          </span>
        </div>
        <div className="rail__slots">
          {cells.map((cell, i) => {
            const card = cell.id ? getCard(cell.id) : null
            return (
              <div className={`rail__slot${cell.off ? ' is-off' : ''}${i >= TEAM_SIZE ? ' is-bench' : ''}`} key={i}>
                <span className="rail__pos">{cell.label}</span>
                {card && (
                  <motion.div layoutId={`draft-${card.id}`} className="chip" transition={FLY} style={{ '--len': chipLen(surname(card)) } as CSSProperties}>
                    <span className="chip__name">
                      {chipParts(surname(card)).map((part) => (
                        <span key={part}>{part}</span>
                      ))}
                    </span>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <main className="screen draft">
      <TopBar context={context} onExit={onExit} />
      <LayoutGroup>
        <div className={`turn${myTurn ? ' is-me' : ''}`} role="status">
          <div className="turn__txt">
            <span className="t-label">{done ? 'Draft complete' : `Pick ${picked + 1} of ${TOTAL_PICKS}`}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={done ? 'done' : myTurn ? 'me' : 'opp'}
                className="turn__call t-display"
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {done ? 'Rosters set' : myTurn ? 'Your pick' : `${names[opp]} is picking`}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="turn__pips" aria-label="Draft order: one pick each, taking turns">
            {DRAFT_ORDER.map((_, i) => (
              <i key={i} className={`${seatOfPick(i) === me ? 'is-me' : 'is-opp'}${i < picked ? ' is-done' : i === picked ? ' is-now' : ''}`} />
            ))}
          </div>
        </div>

        {rail(opp)}

        <div className="draft__grid">
          {pool.map((card, i) => {
            const open = match.draft.available.includes(card.id)
            return (
              <div className="draft__cell" key={card.id}>
                {open && (
                  <motion.button
                    type="button"
                    layoutId={`draft-${card.id}`}
                    className="draft__card"
                    transition={FLY}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * i, duration: 0.35 } }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      play('tap')
                      setInspect(card.id)
                    }}
                    aria-label={`${card.name}: 3PT d${card.three}, drive d${card.drive}, pass d${card.pass}, rebound d${card.reb}, defence d${card.def}`}
                  >
                    <PlayerCard card={card} holo />
                  </motion.button>
                )}
              </div>
            )
          })}
        </div>

        {rail(me)}
      </LayoutGroup>

      <AnimatePresence>
        {inspected && (
          <Sheet title={myTurn ? 'Your pick' : 'Scouting'} onClose={() => setInspect(null)}>
            <div className="inspect">
              <motion.div className="inspect__card" initial={{ scale: 0.86, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
                <Card3D
                  card={inspected}
                  faceDown={inspectBack}
                  interactive
                  sway
                  back={<CardStats card={inspected} />}
                  onTap={() => {
                    play('tap')
                    setInspectBack((v) => !v)
                  }}
                />
              </motion.div>
              {match.draft.picks[me].length < ROSTER_SIZE && <ChemPreview mine={match.draft.picks[me]} id={inspected.id} />}
              <span className="inspect__hint t-label">{shareNote ?? (inspectBack ? 'Tap to flip back' : 'Tap the card to see what it does')}</span>
            </div>
            <div className="inspect__actions">
            <button
              type="button"
              className="btn btn--court"
              disabled={!myTurn}
              onClick={() => {
                onAct({ type: 'draftPick', cardId: inspected.id })
                setInspect(null)
              }}
            >
              {myTurn ? `Draft ${surname(inspected)}` : `Wait for ${names[opp]}`}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                play('tap')
                void shareCard(inspected)
                  .then((r) => setShareNote(r === 'saved' ? 'Card image saved' : r === 'shared' ? 'Card shared' : null))
                  .catch(() => setShareNote('Could not make the image'))
              }}
            >
              Share card
            </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reveal && revealed && (
          <motion.div
            key={reveal.n}
            className="dpick"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setReveal(null)}
            role="status"
          >
            <motion.span className={`dpick__who t-label${reveal.seat === me ? ' is-me' : ''}`} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              Pick {reveal.n} · {reveal.seat === me ? 'You drafted' : `${names[reveal.seat]} drafted`}
            </motion.span>
            <motion.div className="dpick__card" initial={{ scale: 0.5, y: 80, rotate: reveal.seat === me ? -10 : 10 }} animate={{ scale: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 230, damping: 19 }}>
              <Card3D card={revealed} tone={reveal.seat === me ? 'off' : 'def'} faceDown={!revealUp} sway pose={revealUp ? 'win' : 'idle'} />
            </motion.div>
            <div>
              <motion.div className="dpick__name t-display" initial={{ opacity: 0, y: 14 }} animate={{ opacity: revealUp ? 1 : 0, y: revealUp ? 0 : 14 }} transition={{ delay: 0.22 }}>
                {surname(revealed)}
              </motion.div>
              <motion.div className="dpick__arch t-label" initial={{ opacity: 0 }} animate={{ opacity: revealUp ? 1 : 0 }} transition={{ delay: 0.32 }}>
                {abilityOf(revealed.id)?.name ?? (positionsOf(revealed.id).join(' / ') || revealed.position)} · 3PT d{revealed.three} · DRIVE d{revealed.drive} · DEF d{revealed.def}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

/** What drafting this card would do for my team right now, in one glance. */
function ChemPreview({ mine, id }: { mine: readonly string[]; id: string }) {
  const before = teamChem(seatSeven(mine).floor).links
  const seated = seatSeven([...mine, id])
  const after = teamChem(seated.floor).links
  const gained = after.filter((l) => !before.some((b) => b.id === l.id))
  const slot = seated.floor.indexOf(id)
  const spots = positionsOf(id).join(' / ') || getCard(id).position
  return (
    <div className={`chemline${gained.length > 0 ? ' is-up' : ''}`}>
      <b>{slot >= 0 ? `Starts at ${SLOTS[slot]}` : 'Bench'}</b>
      <span>
        Plays {spots}
        {gained.map((l) => ` · switches on ${l.name}: ${l.text}`).join('')}
      </span>
    </div>
  )
}
