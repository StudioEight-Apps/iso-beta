import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCard, playCard } from '../../game'
import type { Contest, DieRoll, Modifier, PlayedCard, PossessionResult, Seat, StatCredit } from '../../game'
import { Card3D } from '../components/Card3D'
import type { CardPose } from '../components/Card3D'
import { ClampIcon } from '../components/Icons'
import { PlayCardFace } from '../components/PlayerCard'
import { RollDie } from '../components/RollDie'
import { DiceFloor } from '../components/DiceFloor'
import { buzz } from '../lib/haptics'
import { surname } from '../lib/names'
import { play } from '../lib/sound'
import type { Sfx } from '../lib/sound'
import { STAT_LABEL, lastName, possessive, quarterLabel } from '../lib/v3'

interface Props {
  result: PossessionResult
  me: Seat
  names: [string, string]
  /** Fired when the points should land in the scorebug. */
  onScore: () => void
  onDone: () => void
}

/** One set of dice on the table: a pass, a shot or a board battle. */
interface Tray {
  kind: 'pass' | 'shot' | 'rebound'
  rolls: DieRoll[]
  title: string
  /** Plain words: what is being rolled against what. */
  rule: string
  mods: Modifier[]
  offTotal: number | null
  defTotal: number | null
  /** What the dice meant, shown once they have all landed. */
  outcome: string
  good: 'off' | 'def'
  contest: Contest | null
}

type Beat =
  | { t: 'flip'; ms: number }
  | { t: 'note'; ms: number; seat: Seat; title: string; text: string; sfx: Sfx; focus?: string; card?: Seat; doubled?: boolean }
  | { t: 'roll'; ms: number; tray: number }
  | { t: 'auto'; ms: number; tray: number; title: string; text: string; make: boolean }
  | { t: 'tally'; ms: number; tray: number }
  | { t: 'verdict'; ms: number }

const TUMBLE = 900
const STAGGER = 380
const SLAM = { type: 'spring', stiffness: 600, damping: 22, mass: 0.9 } as const
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

function buildScript(result: PossessionResult): { beats: Beat[]; trays: Tray[] } {
  const ids = new Set<string>([...result.floor[0], ...result.floor[1]])
  for (const s of result.subs) ids.add(s.out)
  if (result.doubleId) ids.add(result.doubleId)
  /** The engine writes full names; the reveal has room for surnames. */
  const short = (text: string) => {
    let out = text
    for (const id of ids) out = out.split(getCard(id).name).join(lastName(id))
    return out
  }
  const rollMs = (n: number) => TUMBLE + STAGGER * Math.max(0, n - 1) + 260

  const beats: Beat[] = [{ t: 'flip', ms: 850 }]
  const trays: Tray[] = []

  for (const step of result.steps) {
    switch (step.kind) {
      case 'sub': {
        const s = result.subs.find((x) => x.in === step.who)
        beats.push({ t: 'note', ms: 800, seat: step.seat, title: 'Substitution', text: s ? `${lastName(s.in)} comes in for ${lastName(s.out)}.` : short(step.text), sfx: 'whoosh' })
        break
      }
      case 'card': {
        const played = step.seat === result.offenseSeat ? result.cards.offense : result.cards.defense
        const def = step.card ? playCard(step.card) : null
        const tail = played?.status === 'cancelled' ? ' Cancelled by Scouting Report.' : played?.status === 'noEffect' ? ' No effect this time.' : ''
        beats.push({ t: 'note', ms: 950, seat: step.seat, title: def ? def.name : 'Play card', text: def ? `${def.text}${tail}` : short(step.text), sfx: 'clamp', card: step.seat })
        break
      }
      case 'double': {
        const right = /Right read/.test(step.text)
        beats.push({ t: 'note', ms: 850, seat: step.seat, title: 'Double team', text: short(step.text), sfx: right ? 'clamp' : 'fizzle', doubled: right })
        break
      }
      case 'swing':
      case 'ability': {
        const title = step.kind === 'swing' ? (step.card === 'kickout' ? 'Kick Out' : 'Catch & Shoot') : 'Ability'
        beats.push({ t: 'note', ms: 900, seat: step.seat, title, text: short(step.text).replace(/^(Kick Out|Catch & Shoot)\.\s*/, ''), sfx: 'whoosh', focus: step.who })
        break
      }
      case 'pass': {
        const p = result.pass
        if (!p) break
        const steal = p.stealAt > 0 ? `, ${p.stealAt === 1 ? 'a 1' : `${p.stealAt} or less`} is stolen` : ''
        trays.push({
          kind: 'pass',
          rolls: step.rolls,
          title: `${lastName(p.passer)} passes to ${lastName(p.receiver)}`,
          rule: `${possessive(lastName(p.passer))} PASS d${p.roll.die}: ${p.dimeAt}+ is a dime${steal}.`,
          mods: [],
          offTotal: null,
          defTotal: null,
          outcome: p.stolen ? `Stolen by ${lastName(p.defender)}` : p.dime ? `Dime. +${p.bonus} for ${lastName(p.receiver)}` : 'The pass gets there. No bonus.',
          good: p.stolen ? 'def' : 'off',
          contest: null,
        })
        beats.push({ t: 'roll', ms: rollMs(step.rolls.length), tray: trays.length - 1 }, { t: 'tally', ms: 800, tray: trays.length - 1 })
        break
      }
      case 'shot': {
        const c = result.contests[step.ref ?? 0]
        if (!c) break
        const skill = c.shot === 'THREE' ? '3PT' : 'DRIVE'
        const what = c.kind === 'putback' ? 'putback' : c.shot === 'THREE' ? 'three' : 'drive'
        const defDie = c.dice.find((d) => d.purpose === 'defense')
        const offDie = c.dice.find((d) => d.purpose === 'shot')
        const rule = `${possessive(lastName(c.shooter))} ${skill} d${offDie?.die ?? ''} against ${c.defender ? `${possessive(lastName(c.defender))} DEF d${defDie?.die ?? ''}` : `an open-shot d${defDie?.die ?? 4}`}. Higher roll wins, ties go to the defence.`
        const outcome = c.outcome === 'made' ? `Good for ${c.points}` : c.outcome === 'blocked' ? 'Blocked' : c.outcome === 'stolen' ? 'Stolen' : 'No good'
        trays.push({ kind: 'shot', rolls: step.rolls, title: `${lastName(c.shooter)} ${what}`, rule, mods: c.mods, offTotal: c.offenseTotal, defTotal: c.defenseTotal, outcome, good: c.outcome === 'made' ? 'off' : 'def', contest: c })
        const tray = trays.length - 1
        beats.push({ t: 'roll', ms: rollMs(step.rolls.length), tray })
        if (c.auto) {
          const make = c.auto.result === 'make'
          const text = make
            ? c.auto.label === 'Alley-Oop'
              ? 'The pass was a dime. Automatically in.'
              : `A natural ${c.natural} on his ${skill} die. Automatically in.`
            : `${c.defender ? possessive(lastName(c.defender)) : 'The'} DEF die shows ${defDie?.face ?? ''} against a ${c.natural}. Automatic stop.`
          beats.push({ t: 'auto', ms: 1100, tray, title: c.auto.label, text, make })
        }
        beats.push({ t: 'tally', ms: 950, tray })
        break
      }
      case 'rebound': {
        const r = result.rebounds[step.ref ?? 0]
        if (!r || step.rolls.length === 0) {
          beats.push({ t: 'note', ms: 750, seat: step.seat, title: 'Rebound', text: short(step.text), sfx: 'tap' })
          break
        }
        trays.push({
          kind: 'rebound',
          rolls: step.rolls,
          title: 'Board battle',
          rule: `${possessive(lastName(r.offRebounder))} REB d${r.dice[0]?.die ?? ''} against ${possessive(lastName(r.defRebounder))} REB d${r.dice[1]?.die ?? ''}. The offence has to roll higher.`,
          mods: r.mods,
          offTotal: r.offenseTotal,
          defTotal: r.defenseTotal,
          outcome: r.winner === 'off' ? `Offensive board. ${lastName(r.rebounder)} goes back up` : `${lastName(r.rebounder)} has it`,
          good: r.winner,
          contest: null,
        })
        beats.push({ t: 'roll', ms: rollMs(step.rolls.length), tray: trays.length - 1 }, { t: 'tally', ms: 800, tray: trays.length - 1 })
        break
      }
      default:
        break
    }
  }
  beats.push({ t: 'verdict', ms: 2000 })

  // Keep the whole thing between about five and eight seconds.
  const total = beats.reduce((n, b) => n + b.ms, 0)
  if (total > 8200) {
    const k = Math.max(0.6, 8200 / total)
    for (const b of beats) if (b.t !== 'verdict') b.ms = Math.round(b.ms * k)
  } else if (total < 5000) {
    beats[beats.length - 1].ms += 5000 - total
  }
  return { beats, trays }
}

/** REB and OREB are credited together for an offensive board; show it once. */
function creditChips(credits: StatCredit[]): { key: string; who: string; text: string; seat: Seat }[] {
  const out: { key: string; who: string; text: string; seat: Seat }[] = []
  credits.forEach((c, i) => {
    if (c.stat === 'REB' && credits.some((o) => o.stat === 'OREB' && o.cardId === c.cardId)) return
    out.push({ key: `${c.cardId}-${c.stat}-${i}`, who: surname(getCard(c.cardId)), text: c.stat === 'PTS' ? `+${c.value} PTS` : `+${c.value} ${STAT_LABEL[c.stat]}`, seat: c.seat })
  })
  return out
}

export function Reveal({ result, me, names, onScore, onDone }: Props) {
  const reduce = useReducedMotion()
  const { beats, trays } = useMemo(() => buildScript(result), [result])
  const lastBeat = beats.length - 1
  const [at, setAt] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const [up, setUp] = useState<[boolean, boolean]>([!!reduce, !!reduce])
  const finished = useRef(false)
  const scored = useRef(false)
  const cb = useRef({ onScore, onDone })
  cb.current = { onScore, onDone }
  const quiet = useRef(false)
  quiet.current = skipped

  const beat = beats[at]
  const out = beat.t === 'verdict'
  const myBall = result.offenseSeat === me
  const speed = reduce ? 0.5 : 1

  // Both picks arrive face down, then turn over one after the other.
  useEffect(() => {
    if (reduce) return
    const a = window.setTimeout(() => setUp(([, d]) => [true, d]), 240)
    const b = window.setTimeout(() => setUp(([s]) => [s, true]), 420)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [reduce])

  // The clock: every beat holds for its time, then the next one starts. The verdict ends the reveal.
  useEffect(() => {
    const id = window.setTimeout(
      () => {
        if (at < lastBeat) setAt(at + 1)
        else if (!finished.current) {
          finished.current = true
          cb.current.onDone()
        }
      },
      Math.round(beat.ms * speed),
    )
    return () => window.clearTimeout(id)
  }, [at, lastBeat, beat.ms, speed])

  useEffect(() => {
    if (beat.t === 'flip') play('whoosh')
    if (beat.t === 'note') {
      play(beat.sfx)
      buzz(beat.doubled ? [30, 40, 60] : 12)
    }
    if (beat.t === 'roll' && !reduce) play('rattle')
    if (beat.t === 'auto') {
      play('lockin')
      buzz([20, 30, 60])
    }
    let timer: number | undefined
    if (beat.t === 'verdict') {
      play(result.scored ? 'swish' : 'clank')
      buzz(result.scored ? [20, 30, 20, 30, 60] : [70])
      if (!scored.current) {
        scored.current = true
        timer = window.setTimeout(() => cb.current.onScore(), result.scored && !reduce && !quiet.current ? 520 : 0)
      }
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  // Guarantee the score lands even if the verdict effect's timer was cleared by an unmount race.
  useEffect(
    () => () => {
      if (scored.current) cb.current.onScore()
    },
    [],
  )

  const tap = () => {
    if (!out) {
      setSkipped(true)
      setAt(lastBeat)
    } else if (!finished.current) {
      finished.current = true
      cb.current.onDone()
    }
  }

  /* ---------- what is on the table at this beat ---------- */
  let trayIdx = -1
  let focus = result.swing?.from ?? result.contests[0]?.shooter ?? result.shooter
  let focusContest: Contest | null = null
  let doubledShown = false
  const cardShown: [boolean, boolean] = [false, false]
  for (let i = 0; i <= at; i++) {
    const b = beats[i]
    if (b.t === 'note') {
      if (b.focus) focus = b.focus
      if (b.card !== undefined) cardShown[b.card] = true
      if (b.doubled) doubledShown = true
    } else if (b.t === 'roll' || b.t === 'tally' || b.t === 'auto') {
      trayIdx = b.tray
      const c = trays[b.tray].contest
      if (c) {
        focus = c.shooter
        focusContest = c
      }
    }
  }
  if (out) {
    // Land on the dice that decided it: the last shot, not the board battle after it.
    trayIdx = trays.length - 1
    for (let i = trays.length - 1; i >= 0; i--) {
      if (trays[i].kind === 'shot') {
        trayIdx = i
        break
      }
    }
    cardShown[0] = cardShown[1] = true
    const lastShot = result.contests[result.contests.length - 1]
    if (lastShot) {
      focus = lastShot.shooter
      focusContest = lastShot
    }
  }
  const tray = trayIdx >= 0 ? trays[trayIdx] : null
  const rolling = beat.t === 'roll'
  const settled = tray !== null && !rolling && (beat.t !== 'auto' || out)
  const instant = skipped || !!reduce

  const offFloor = result.floor[result.offenseSeat]
  const defFloor = result.floor[result.defenseSeat]
  const matched = defFloor[offFloor.indexOf(focus)] ?? null
  const uncontested = focusContest !== null && focusContest.defender === null
  const defenderId = focusContest ? focusContest.defender : matched
  const shooter = getCard(focus)
  const defender = defenderId ? getCard(defenderId) : null

  const made = focusContest ? focusContest.outcome === 'made' : false
  const shotTag = focusContest ? (focusContest.kind === 'putback' ? 'Putback' : focusContest.shot === 'THREE' ? 'Three' : 'Drive') : result.picks.offense.shot === 'THREE' ? 'Three' : 'Drive'
  const decided = out || (settled && tray?.kind === 'shot')
  const shooterPose: CardPose = decided ? ((out ? result.scored : made) ? 'win' : 'lose') : beat.t === 'note' && beat.doubled ? 'jolt' : 'idle'
  const defenderPose: CardPose = decided ? ((out ? result.scored : made) ? 'lose' : 'win') : 'idle'
  const shake = !reduce && ((beat.t === 'note' && !!beat.doubled) || (out && !result.scored))

  /* ---------- the verdict ---------- */
  const finalShot = result.contests[result.contests.length - 1] ?? null
  const word = result.scored ? 'Bucket' : result.pass?.stolen || finalShot?.outcome === 'stolen' ? 'Stolen' : finalShot?.outcome === 'blocked' ? 'Blocked' : 'Stopped'
  let why = ''
  if (result.pass?.stolen) why = `${possessive(lastName(result.pass.passer))} pass was picked off by ${lastName(result.pass.defender)}.`
  else if (finalShot) {
    const o = finalShot.offenseTotal
    const d = finalShot.defenseTotal
    if (finalShot.auto) why = `${finalShot.auto.label}: ${finalShot.auto.result === 'make' ? 'automatically in' : 'automatic stop'}.`
    else if (finalShot.outcome === 'made') why = `${lastName(finalShot.shooter)} rolled ${o} against ${d}. Higher roll wins.`
    else if (o === d) why = `${o} against ${d}. Ties go to the defence.`
    else why = `${lastName(finalShot.shooter)} rolled ${o} against ${d}.${d - o >= 3 && finalShot.outcome !== 'missed' ? ` The defence won by ${d - o}.` : ''}`
    if (finalShot.kind === 'putback') why = `Putback. ${why}`
  }
  const chips = creditChips(result.credits)
  const drew = result.drawn[me].length

  const caption =
    beat.t === 'note'
      ? { title: beat.title, text: beat.text, tone: beat.seat === result.offenseSeat ? 'off' : 'def' }
      : beat.t === 'auto'
        ? { title: beat.title, text: beat.text, tone: beat.make ? 'off' : 'def' }
        : tray
          ? { title: tray.title, text: tray.rule, tone: 'ink' }
          : { title: `${lastName(focus)} ${result.picks.offense.shot === 'THREE' ? 'three' : 'drive'}`, text: result.doubleId ? 'The defence called a double team.' : 'No double team.', tone: 'ink' }

  const sidePlayed = (seat: Seat): PlayedCard | null => (seat === result.offenseSeat ? result.cards.offense : result.cards.defense)
  const playedCard = (seat: Seat) => {
    const p = sidePlayed(seat)
    if (!p || !cardShown[seat]) return null
    return (
      <motion.span className={`fo__play fo__play--${seat === result.offenseSeat ? 'off' : 'def'}${p.status !== 'played' ? ' is-void' : ''}`} initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: seat === result.offenseSeat ? -18 : 18 }} animate={{ scale: 1, opacity: 1, rotate: seat === result.offenseSeat ? -6 : 6 }} transition={SLAM}>
        <PlayCardFace card={playCard(p.id)} size="md" />
        {p.status !== 'played' && <em>{p.status === 'cancelled' ? 'Cancelled' : 'No effect'}</em>}
      </motion.span>
    )
  }

  const die = (r: DieRoll, order: number) => (
    <span className={`fo__die${r.discarded ? ' is-void' : ''}`} key={`${trayIdx}-${order}`}>
      <RollDie
        size={r.die}
        face={r.face}
        tone={r.side}
        delay={order * STAGGER * speed}
        duration={TUMBLE}
        instant={instant}
        discarded={r.discarded}
        onLand={() => {
          if (quiet.current) return
          play('land')
          buzz(14)
        }}
      />
      <em>{r.label}</em>
      {r.who && <small>{surname(getCard(r.who))}</small>}
    </span>
  )

  const column = (side: 'off' | 'def') => {
    if (!tray) return null
    const rolls = tray.rolls.map((r, i) => ({ r, i })).filter((x) => x.r.side === side)
    const mods = tray.mods.filter((m) => m.side === side)
    const total = side === 'off' ? tray.offTotal : tray.defTotal
    return (
      <div className={`fo__col fo__col--${side}`}>
        <div className="fo__dice">{rolls.map((x) => die(x.r, x.i))}</div>
        <div className="fo__mods">
          {settled &&
            mods.map((m, i) => (
              <motion.span key={i} className={`fo__mod fo__mod--${m.source}`} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}>
                {m.label} {signed(m.value)}
              </motion.span>
            ))}
        </div>
        {total !== null && (
          <div className="fo__total" aria-label={`${side === 'off' ? 'Offence' : 'Defence'} total ${total}`}>
            {settled ? (
              <motion.b initial={reduce ? false : { scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SLAM}>
                {total}
              </motion.b>
            ) : (
              <b className="is-pending">?</b>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <motion.div className={`fo${out ? (result.scored ? ' is-make' : ' is-stop') : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={tap} role="dialog" aria-label="Possession result">
      <div className="fo__dim" />
      <AnimatePresence>
        {out && <motion.div key="flash" className={`fo__flash fo__flash--${result.scored ? 'make' : 'stop'}`} initial={{ opacity: 0.8 }} animate={{ opacity: 0.14 }} transition={{ duration: 0.7, ease: 'easeOut' }} />}
      </AnimatePresence>

      <motion.div className="fo__stage" animate={{ x: shake ? [0, -11, 9, -7, 5, -2, 0] : 0 }} transition={{ duration: 0.42 }}>
        <span className="fo__ctx t-label">
          {quarterLabel(result.quarter, result.overtime)} · play {result.index + 1} · {myBall ? 'your ball' : `${names[result.offenseSeat]} has the ball`}
        </span>

        {/* the two picks, turned over together */}
        <div className="fo__face">
          <motion.div className="fo__slot fo__slot--off" initial={reduce ? false : { x: '-70vw', rotate: -14, scale: 0.7 }} animate={{ x: 0, rotate: -3, scale: 1 }} transition={{ type: 'spring', stiffness: 210, damping: 22 }}>
            <span className="fo__tag fo__tag--off">{shotTag}</span>
            <div className="fo__card">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={shooter.id} className="fo__cardin" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                  <Card3D card={shooter} tone="off" faceDown={!up[0] && !out} sway={!decided} pose={shooterPose} />
                </motion.div>
              </AnimatePresence>
              {doubledShown && focusContest?.doubled !== false && result.doubleId === focus && (
                <motion.span className="fo__stamp" initial={reduce ? false : { scale: 3, opacity: 0, rotate: -24 }} animate={{ scale: 1, opacity: 1, rotate: -9 }} transition={SLAM}>
                  <ClampIcon /> Doubled
                </motion.span>
              )}
              {playedCard(result.offenseSeat)}
            </div>
            <span className="fo__name">{surname(shooter)}</span>
          </motion.div>

          <span className="fo__vs t-wide">vs</span>

          <motion.div className="fo__slot fo__slot--def" initial={reduce ? false : { x: '70vw', rotate: 14, scale: 0.7 }} animate={{ x: 0, rotate: 3, scale: 1 }} transition={{ type: 'spring', stiffness: 210, damping: 22, delay: 0.06 }}>
            <span className="fo__tag fo__tag--def">{uncontested ? 'Wide open' : 'Defender'}</span>
            <div className="fo__card">
              {defender && !uncontested ? (
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={defender.id} className="fo__cardin" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                    <Card3D card={defender} tone="def" faceDown={!up[1] && !out} sway={!decided} pose={defenderPose} />
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="fo__open">
                  <b>Open</b>
                  <span>Nobody on him. The defence rolls a d4.</span>
                </div>
              )}
              {playedCard(result.defenseSeat)}
            </div>
            <span className="fo__name">{defender && !uncontested ? surname(defender) : 'No defender'}</span>
          </motion.div>
        </div>

        {/* what is happening, in plain words */}
        <div className="fo__cap" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${at}-${caption.title}`} className={`fo__capin fo__capin--${caption.tone}${beat.t === 'auto' ? ' is-auto' : ''}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}>
              <b>{caption.title}</b>
              <span>{caption.text}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* the dice */}
        <div className="fo__table">
          {tray ? (
            <div className={`fo__tray fo__tray--${tray.kind}`} key={trayIdx}>
              <DiceFloor
                id={tray.rolls}
                dice={tray.rolls.map((r, i) => ({ size: r.die, face: r.face, side: r.side, delay: i * STAGGER * speed, duration: TUMBLE, discarded: r.discarded }))}
                instant={instant}
                solo={tray.kind === 'pass'}
              />
              {tray.kind === 'pass' ? (
                <div className="fo__col fo__col--off fo__col--solo">
                  <div className="fo__dice">{tray.rolls.map((r, i) => die(r, i))}</div>
                </div>
              ) : (
                <>
                  {column('off')}
                  <span className="fo__cmp" aria-hidden>
                    {settled && tray.offTotal !== null && tray.defTotal !== null ? (tray.offTotal > tray.defTotal ? '>' : tray.offTotal === tray.defTotal ? '=' : '<') : 'vs'}
                  </span>
                  {column('def')}
                </>
              )}
              {!out && (
                <div className="fo__read">
                  {settled && (
                  <motion.span className={`fo__readin fo__readin--${tray.good}`} initial={reduce ? false : { scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SLAM}>
                    {tray.outcome}
                  </motion.span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="fo__tray fo__tray--idle" aria-hidden>
              <span className="t-label">Dice next</span>
            </div>
          )}
        </div>

        {/* the verdict, then the stat sheet */}
        <div className="fo__out" aria-live="assertive">
          {out && (
            <div className="fo__verdict">
              <motion.span className="fo__big t-display" initial={reduce ? false : { scale: 2.8, opacity: 0, rotate: result.scored ? -5 : 4 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={SLAM}>
                {word}
                {result.scored && <b className="t-mono">+{result.points}</b>}
              </motion.span>
              <motion.span className="fo__why" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                {why}
              </motion.span>
              <div className="fo__credits">
                {chips.map((c, i) => (
                  <motion.span key={c.key} className={`fo__credit fo__credit--${c.seat === result.offenseSeat ? 'off' : 'def'}`} initial={reduce ? false : { opacity: 0, y: 12, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3 + i * 0.16, type: 'spring', stiffness: 420, damping: 24 }}>
                    <b>{c.who}</b> {c.text}
                  </motion.span>
                ))}
                {drew > 0 && (
                  <motion.span className="fo__credit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    You drew {drew} {drew === 1 ? 'card' : 'cards'}
                  </motion.span>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {out && result.scored && !reduce && (
        <motion.span className="fo__fly t-mono" initial={{ y: 0, scale: 0.4, opacity: 0 }} animate={{ y: [0, 0, -520], scale: [0.4, 1.5, 0.6], opacity: [0, 1, 0] }} transition={{ duration: 0.95, times: [0, 0.3, 1], ease: 'easeIn' }} aria-hidden>
          +{result.points}
        </motion.span>
      )}

      <span className="fo__skip t-label">{out ? 'Tap to continue' : 'Tap to skip'}</span>
    </motion.div>
  )
}
