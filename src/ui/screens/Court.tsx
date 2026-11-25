import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import {
  HELP_DIE,
  MAX_SHOTS_PER_QUARTER,
  OPEN_LOOK,
  abilityOf,
  benchOf,
  cardFitsRole,
  getCard,
  playCard,
  positionsOf,
  previewPass,
  previewShot,
  shotPoints,
  shotsLeft,
  subsLeft,
  teamChem,
  validateDefensePick,
  validateOffensePick,
} from '../../game'
import type { MatchState, OffensePick, PlayCardId, PossessionResult, Seat, ShotPlan, ShotType, SubPick } from '../../game'
import type { PlayerAction } from '../../session'
import { CardPeek } from '../components/CardPeek'
import { Die } from '../components/Die'
import { Hand } from '../components/Hand'
import { BallIcon, CheckIcon, ClampIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { Tile } from '../components/Tile'
import { buzz } from '../lib/haptics'
import { surname } from '../lib/names'
import { SLOTS } from '../lib/positions'
import { play } from '../lib/sound'
import { lastName, possessive } from '../lib/v3'

export interface CourtView {
  quarter: number
  overtime: boolean
  offenseSeat: Seat | null
  last: PossessionResult | null
}

interface Props {
  me: Seat
  names: [string, string]
  match: MatchState
  view: CourtView
  /** A reveal or interstitial is on top: no input. */
  frozen: boolean
  myCommitted: boolean
  oppCommitted: boolean
  onAct: (a: PlayerAction) => void
}

const SHOT_WORD: Record<ShotType, string> = { THREE: 'Three', DRIVE: 'Drive' }
const SHOT_SKILL: Record<ShotType, string> = { THREE: '3PT', DRIVE: 'DRIVE' }
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** "Curry's 3PT d12 against Holiday's DEF d10 +2. Higher roll wins, ties go to the defence." */
function rollLine(plan: ShotPlan): string {
  const total = (side: 'off' | 'def') => plan.mods.filter((m) => m.side === side).reduce((n, m) => n + m.value, 0)
  let off = `${possessive(lastName(plan.shooter))} ${SHOT_SKILL[plan.shot]} d${plan.offDie}`
  if (plan.offBonusDie) off += ` + d${plan.offBonusDie.die}`
  if (total('off')) off += ` ${signed(total('off'))}`
  let def = plan.defender ? `${possessive(lastName(plan.defender))} DEF d${plan.defDie}` : `an open-shot d${plan.defDie}`
  if (plan.helpDie) def += ` + help d${plan.helpDie}`
  if (plan.defBonusDie) def += ` + d${plan.defBonusDie.die}`
  if (total('def')) def += ` ${signed(total('def'))}`
  return `${off} against ${def}. Higher roll wins, ties go to the defence.`
}

/** The whole-number modifiers behind the line above, by name. */
function modsLine(plan: ShotPlan): string {
  const parts = plan.mods.map((m) => `${m.label} ${signed(m.value)}${m.side === 'def' ? ' defence' : ''}`)
  if (plan.autoMin !== null) parts.push(`${plan.autoLabel}: a natural ${plan.autoMin}+ is automatic`)
  if (plan.rerollMax > 0) parts.push(`rerolls a 1 to ${plan.rerollMax}`)
  return parts.join(' · ')
}

export function Court({ me, names, match, view, frozen, myCommitted, oppCommitted, onAct }: Props) {
  const opp: Seat = me === 0 ? 1 : 0
  const [shooter, setShooter] = useState<string | null>(null)
  const [shot, setShot] = useState<ShotType | null>(null)
  const [passer, setPasser] = useState<string | null>(null)
  const [doubleId, setDoubleId] = useState<string | null>(null)
  /** Index in my hand of the attached card. */
  const [cardIdx, setCardIdx] = useState<number | null>(null)
  /** Index of the card whose text is showing. */
  const [tipIdx, setTipIdx] = useState<number | null>(null)
  const [sub, setSub] = useState<SubPick | null>(null)
  const [subOpen, setSubOpen] = useState(false)
  const [peek, setPeek] = useState<string | null>(null)
  /** What I committed, kept only to show my own choice back to me while waiting. */
  const [sent, setSent] = useState<string | null>(null)

  const step = match.history.length
  useEffect(() => {
    setShooter(null)
    setShot(null)
    setPasser(null)
    setDoubleId(null)
    setCardIdx(null)
    setTipIdx(null)
    setSub(null)
    setSubOpen(false)
    setSent(null)
  }, [step, match.quarter])

  useEffect(() => {
    if (tipIdx === null) return
    const id = window.setTimeout(() => setTipIdx(null), 5200)
    return () => window.clearTimeout(id)
  }, [tipIdx])

  if (!match.lineups) return null
  const lineups = match.lineups
  const onOffense = view.offenseSeat === me
  const role: 'off' | 'def' = onOffense ? 'off' : 'def'
  const canPick = !frozen && !myCommitted && match.phase === 'play'

  const myFloor = sub ? lineups[me].map((id) => (id === sub.out ? sub.in : id)) : lineups[me]
  const oppFloor = lineups[opp]
  const oppBench = benchOf(match, opp)
  const myBench = benchOf(match, me)
  const hand = match.hands[me]
  const cardId: PlayCardId | null = cardIdx !== null ? (hand[cardIdx] ?? null) : null
  const canSub = canPick && subsLeft(match, me) > 0 && myBench.length > 0
  const links = teamChem(myFloor).links

  const pick: OffensePick | null = shooter && shot ? { shooterId: shooter, shot, passerId: passer, cardId, sub } : null
  const offError = onOffense && pick && canPick ? validateOffensePick(match, me, pick) : null
  const defError = !onOffense && canPick ? validateDefensePick(match, me, { doubleId, cardId, sub }) : null
  const plan = onOffense && shooter && shot ? previewShot(match, me, { shooterId: shooter, shot, passerId: passer, cardId, sub }) : null
  const pass = onOffense && passer ? previewPass(match, me, passer) : null

  const tapMine = (id: string) => {
    if (!canPick || !onOffense) return
    play('tap')
    buzz(8)
    if (shooter === id) {
      setShooter(null)
      setShot(null)
      setPasser(null)
    } else if (shooter === null) {
      if (shotsLeft(match, me, id) <= 0) return
      setShooter(id)
      setShot(null)
    } else {
      setPasser((cur) => (cur === id ? null : id))
    }
  }
  const tapTheirs = (id: string) => {
    if (!canPick || onOffense) return
    play('tap')
    buzz(8)
    setDoubleId((cur) => (cur === id ? null : id))
  }
  const tapCard = (i: number) => {
    const id = hand[i]
    if (!id) return
    play('select')
    buzz(8)
    const fits = canPick && cardFitsRole(id, onOffense)
    if (cardIdx === i) {
      setCardIdx(null)
      setTipIdx(null)
      return
    }
    setTipIdx(i)
    if (fits) setCardIdx(i)
  }

  const applySub = (next: SubPick | null) => {
    setSub(next)
    setSubOpen(false)
    if (next) {
      if (shooter === next.out) {
        setShooter(null)
        setShot(null)
      }
      if (passer === next.out) setPasser(null)
    } else if (sub) {
      if (shooter === sub.in) {
        setShooter(null)
        setShot(null)
      }
      if (passer === sub.in) setPasser(null)
    }
  }

  const cardTag = cardId ? ` + ${playCard(cardId).name}` : ''
  const subTag = sub ? ` · ${lastName(sub.in)} in` : ''
  const commitOffense = () => {
    if (!pick || offError) return
    play('lockin')
    buzz([14, 30, 22])
    setSent(`${lastName(pick.shooterId)} ${SHOT_WORD[pick.shot].toLowerCase()}${passer ? `, pass from ${lastName(passer)}` : ''}${cardTag}${subTag}`)
    onAct({ type: 'submitOffense', shooterId: pick.shooterId, shot: pick.shot, passerId: passer, cardId, sub })
  }
  const commitDefense = () => {
    if (defError) return
    play('lockin')
    buzz([14, 30, 22])
    setSent(`${doubleId ? `Double team on ${lastName(doubleId)}` : 'No double team'}${cardTag}${subTag}`)
    onAct({ type: 'submitDefense', doubleId, cardId, sub })
  }

  const row = (seat: Seat) => {
    const mine = seat === me
    const floor = mine ? myFloor : oppFloor
    return (
      <div className={`ct__row ct__row--${mine ? 'me' : 'opp'}`}>
        {floor.map((id, slot) => {
          const left = shotsLeft(match, seat, id)
          const shootable = left > 0
          const live = canPick && (mine ? onOffense && (shooter === null ? shootable : true) : !onOffense)
          const selected = mine ? shooter === id : doubleId === id
          const isPasser = mine && passer === id
          const cameIn = mine && sub?.in === id
          const offSeat = view.offenseSeat === seat
          return (
            <div className={`ct__cell${isPasser ? ' is-passer' : ''}`} key={id}>
              <Tile card={getCard(id)} slot={slot} spent={offSeat && !shootable} live={live} selected={selected} tone={mine ? 'off' : 'def'} onTap={() => (mine ? tapMine(id) : tapTheirs(id))} />
              {isPasser && <span className="ct__badge ct__badge--pass">Pass</span>}
              {cameIn && <span className="ct__badge ct__badge--sub">Sub</span>}
              {!mine && doubleId === id && <span className="ct__badge ct__badge--dbl">Double</span>}
              {offSeat && (
                <span className="ct__shots" aria-label={`${left} of ${MAX_SHOTS_PER_QUARTER} shots left this quarter`}>
                  {Array.from({ length: MAX_SHOTS_PER_QUARTER }, (_, i) => (
                    <i key={i} className={i < left ? 'is-left' : ''} />
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const last = view.last
  const lastWord = last ? (last.scored ? `+${last.points}` : (last.contests[last.contests.length - 1]?.outcome ?? 'stolen') === 'blocked' ? 'Blocked' : last.pass?.stolen || last.contests[last.contests.length - 1]?.outcome === 'stolen' ? 'Stolen' : 'Stopped') : ''

  /* ---------- the one plain line ---------- */
  let line: string
  let fine = ''
  if (onOffense) {
    if (!shooter) line = `Tap who shoots. Each player gets ${MAX_SHOTS_PER_QUARTER} shots a quarter.`
    else if (!shot || !plan) {
      const c = getCard(shooter)
      const guard = lineups[opp][myFloor.indexOf(shooter)]
      line = `${lastName(shooter)}: 3PT d${c.three} or DRIVE d${c.drive}, guarded by ${possessive(lastName(guard))} DEF d${getCard(guard).def}. Choose a shot.`
      fine = passer ? `${lastName(passer)} passes first.` : 'Tap a teammate if you want him to pass first.'
    } else {
      line = rollLine(plan)
      const bits: string[] = []
      if (pass && passer) bits.push(`${lastName(passer)} passes first on his PASS d${pass.die}: ${pass.dimeAt}+ is a dime (+${pass.bonus})${pass.stealAt > 0 ? `, ${pass.stealAt === 1 ? 'a 1' : `${pass.stealAt} or less`} is stolen` : ''}`)
      const m = modsLine(plan)
      if (m) bits.push(m)
      if (!passer) bits.push('Tap a teammate to pass first')
      fine = bits.join(' · ')
    }
  } else if (doubleId) {
    const onFloor = oppFloor.includes(doubleId)
    const guard = onFloor ? lineups[me][oppFloor.indexOf(doubleId)] : null
    line = guard
      ? `Double ${lastName(doubleId)}. If he shoots you add a help d${HELP_DIE} to ${possessive(lastName(guard))} DEF d${getCard(guard).def}. If anyone else shoots, that shooter gets +${OPEN_LOOK}.`
      : `Double ${lastName(doubleId)} off the bench. It only pays if he is subbed in and shoots. Anyone else gets +${OPEN_LOOK}.`
  } else {
    line = 'Tap a player to double-team him, or play it straight: their shot die against your matched DEF die, ties go to you.'
  }
  const error = onOffense ? offError : defError
  const focus = onOffense ? shooter : doubleId
  const tip = tipIdx !== null && hand[tipIdx] ? playCard(hand[tipIdx]) : null
  const tipFits = tip ? cardFitsRole(tip.id, onOffense) : false

  return (
    <div className={`ct ct--${role}${frozen ? ' is-frozen' : ''}`}>
      <div className="ct__floor">
        <div className="ct__tag">
          <span className="ct__who">{names[opp]}</span>
          {oppBench.length > 0 && (
            <span className="ct__bench">
              <em>Bench</em>
              {oppBench.map((id) => (
                <button type="button" key={id} className={`ct__benchbtn${doubleId === id ? ' is-on' : ''}`} disabled={!canPick || onOffense} onClick={() => tapTheirs(id)} aria-pressed={doubleId === id} aria-label={`${getCard(id).name}, on their bench${onOffense ? '' : '. Tap to double-team him.'}`}>
                  {surname(getCard(id))}
                </button>
              ))}
            </span>
          )}
          <span className={`ct__opp${oppCommitted ? ' is-ready' : ''}`} role="status">
            {oppCommitted ? (
              <>
                <CheckIcon /> Ready
              </>
            ) : match.phase === 'play' && !frozen ? (
              <span className="dots" aria-label="Choosing">
                <i />
                <i />
                <i />
              </span>
            ) : null}
          </span>
        </div>
        {row(opp)}
        <div className="ct__mid" aria-live="polite">
          {last && (
            <span className={`ct__last${last.scored ? ' is-make' : ' is-stop'}`}>
              <em>Last play</em>
              {surname(getCard(last.shooter))} {SHOT_SKILL[last.shot]}
              <strong>{lastWord}</strong>
            </span>
          )}
        </div>
        {row(me)}
        <div className="ct__tag ct__tag--me">
          <span className="ct__who">You</span>
          <span className="ct__links">{links.length > 0 ? links.map((l) => l.name).join(' · ') : ''}</span>
        </div>
      </div>

      <div className="ct__dock">
        <AnimatePresence>
          {tip && (
            <motion.div key={`tip-${tipIdx}`} className={`ct__tip ct__tip--${tip.side}`} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }} role="status">
              <b>{tip.name}</b>
              <span>{tip.text}</span>
              {!tipFits && <em>{tip.side === 'offense' ? 'Offence card. Play it when you have the ball.' : 'Defence card. Play it when they have the ball.'}</em>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`ct__role ct__role--${role}`}>
          <span className="ct__roleicon">{onOffense ? <BallIcon /> : <ClampIcon />}</span>
          <span className="ct__roletxt">{onOffense ? 'You have the ball' : 'You are on defence'}</span>
          {!myCommitted && (
            <button
              type="button"
              className={`ct__sub${sub ? ' is-on' : ''}`}
              disabled={!canSub && !sub}
              onClick={() => {
                play('tap')
                setSubOpen(true)
              }}
            >
              {sub ? `${surname(getCard(sub.in))} in` : canSub || frozen ? 'Sub' : 'Sub used'}
            </button>
          )}
        </div>

        {myCommitted ? (
          <div className={`ct__wait ct__wait--${role}`} role="status">
            <motion.span className="ct__waiticon" animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>
              <ClampIcon />
            </motion.span>
            <div>
              <b>Locked in</b>
              <span>
                {sent ? `${sent}. ` : ''}Waiting for {names[opp]}
                <span className="dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="ct__line">
              <p>
                {line}
                {focus && (
                  <button type="button" className="ct__cardbtn" onClick={() => setPeek(focus)}>
                    Card
                  </button>
                )}
              </p>
              {error ? <small className="is-err">{sentence(error)}</small> : fine ? <small>{fine}</small> : null}
            </div>

            {onOffense && shooter && (
              <div className="ct__shots2">
                {(['THREE', 'DRIVE'] as const).map((s) => {
                  const c = getCard(shooter)
                  const die = s === 'THREE' ? c.three : c.drive
                  return (
                    <button
                      type="button"
                      key={s}
                      className={`ct__shot${shot === s ? ' is-on' : ''}`}
                      aria-pressed={shot === s}
                      onClick={() => {
                        play('select')
                        buzz(8)
                        setShot(s)
                      }}
                    >
                      <Die size={die} tone="off" solid={shot === s} title={`${SHOT_SKILL[s]} d${die}`} />
                      <span>
                        <b>{SHOT_WORD[s]}</b>
                        <em>
                          d{die} · {shotPoints(s)} points
                        </em>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        <Hand hand={hand} selected={cardIdx} usable={(id) => cardFitsRole(id, onOffense)} onTap={tapCard} frozen={frozen || myCommitted} />

        {!myCommitted &&
          (onOffense ? (
            <button type="button" className="btn btn--off" disabled={!canPick || !pick || !!offError} onClick={commitOffense}>
              {pick ? `Lock in ${lastName(pick.shooterId)} ${SHOT_WORD[pick.shot].toLowerCase()}` : shooter ? 'Choose three or drive' : 'Pick your shooter'}
            </button>
          ) : (
            <button type="button" className="btn btn--def" disabled={!canPick || !!defError} onClick={commitDefense}>
              {doubleId ? `Lock in double on ${lastName(doubleId)}` : 'Lock in, no double team'}
            </button>
          ))}
      </div>

      <AnimatePresence>
        {subOpen && <SubSheet key="sub" floor={lineups[me]} bench={myBench} current={sub} shots={(id) => shotsLeft(match, me, id)} onPick={applySub} onClose={() => setSubOpen(false)} />}
        {peek && <CardPeek key="peek" cardId={peek} title={onOffense ? 'Your shooter' : 'Their player'} onClose={() => setPeek(null)} />}
      </AnimatePresence>
    </div>
  )
}

/** Engine reasons are lower-case fragments; show them as a sentence. */
function sentence(s: string): string {
  const t = s.charAt(0).toUpperCase() + s.slice(1)
  return /[.!?]$/.test(t) ? t : `${t}.`
}

interface SubSheetProps {
  floor: string[]
  bench: string[]
  current: SubPick | null
  shots: (id: string) => number
  onPick: (sub: SubPick | null) => void
  onClose: () => void
}

/** One sub per quarter during play: who comes in, and for whom. He takes the same seat. */
function SubSheet({ floor, bench, current, shots, onPick, onClose }: SubSheetProps) {
  const [incoming, setIncoming] = useState<string | null>(current?.in ?? null)
  const [out, setOut] = useState<string | null>(current?.out ?? null)
  const person = (id: string, on: boolean, onTap: () => void, seat?: number) => {
    const c = getCard(id)
    const a = abilityOf(id)
    return (
      <button type="button" key={id} className={`subrow${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onTap}>
        <span className="subrow__seat">{seat !== undefined ? SLOTS[seat] : 'BN'}</span>
        <span className="subrow__name">{surname(c)}</span>
        <span className="subrow__meta">
          {positionsOf(id).join(' / ') || c.position}
          {a ? ` · ${a.name}` : ''}
        </span>
        <span className="subrow__shots">{shots(id)} shots left</span>
      </button>
    )
  }
  return (
    <Sheet title="Substitution" onClose={onClose}>
      <p className="subsheet__lead">One sub per quarter during play. He takes the same seat and can shoot on this very play. It is revealed with your pick.</p>
      <span className="t-label subsheet__h">Coming in</span>
      <div className="subsheet__list">{bench.map((id) => person(id, incoming === id, () => setIncoming(id)))}</div>
      <span className="t-label subsheet__h">Going out</span>
      <div className="subsheet__list">{floor.map((id, i) => person(id, out === id, () => setOut(id), i))}</div>
      <div className="subsheet__foot">
        <button type="button" className="btn btn--court" disabled={!incoming || !out} onClick={() => incoming && out && onPick({ in: incoming, out })}>
          {incoming && out ? `${lastName(incoming)} in for ${lastName(out)}` : 'Choose both players'}
        </button>
        {current && (
          <button type="button" className="btn btn--ghost" onClick={() => onPick(null)}>
            Cancel the sub
          </button>
        )}
      </div>
    </Sheet>
  )
}
