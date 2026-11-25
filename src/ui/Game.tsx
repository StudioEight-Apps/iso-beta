import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { POSSESSIONS_PER_QUARTER, currentOffenseSeat } from '../game'
import type { MatchState, PlayCardId, Seat } from '../game'
import { useSession } from '../session'
import type { PlayerAction, Session, SessionSnapshot } from '../session'
import { ScoreBug } from './components/ScoreBug'
import { TopBar } from './components/TopBar'
import { CoinFlip } from './screens/CoinFlip'
import { Court } from './screens/Court'
import type { CourtView } from './screens/Court'
import { Draft } from './screens/Draft'
import { GameOver } from './screens/GameOver'
import { Lineup } from './screens/Lineup'
import { Lobby } from './screens/Lobby'
import { Matchups } from './screens/Matchups'
import { Reveal } from './screens/Reveal'
import { QuarterBreak } from './screens/QuarterBreak'
import { QuarterIntro } from './screens/QuarterIntro'
import type { IntroInfo } from './screens/QuarterIntro'
import { handGain } from './lib/v3'

interface GameProps {
  session: Session
  mode: 'bot' | 'host' | 'join'
  room: string
  /** Skip intros and replay the newest reveal (dev aid). */
  replayLast?: boolean
  fastIntro?: boolean
  onExit: () => void
}

export function Game({ session, mode, room, replayLast = false, fastIntro = false, onExit }: GameProps) {
  const snap = useSession(session)
  const act = (a: PlayerAction) => session.act(a)
  const context = mode === 'bot' ? 'Practice' : `Room ${snap.room ?? room}`

  return (
    <>
      {snap.match ? (
        <MatchView key={snap.match.seed} snap={snap} match={snap.match} context={context} replayLast={replayLast} fastIntro={fastIntro} onAct={act} onExit={onExit} />
      ) : (
        <Lobby snap={snap} room={room} host={mode === 'host'} full={netError(snap) === 'room-full'} onExit={onExit} />
      )}
      <AnimatePresence>
        {snap.match && (snap.connection === 'reconnecting' || snap.connection === 'connecting' || snap.connection === 'waiting-for-opponent') && (
          <motion.div key="conn" className="conn t-label" role="status" initial={{ y: -60, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: -60, opacity: 0, x: '-50%' }}>
            {snap.connection === 'waiting-for-opponent' ? 'Opponent dropped · holding the game' : 'Reconnecting'}
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </motion.div>
        )}
        {snap.match && netError(snap) === 'desync' && (
          <motion.div key="desync" className="conn-block" role="alertdialog" aria-label="Out of sync" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="conn-block__box">
              <span className="t-label c-court">Game stopped</span>
              <h2 className="conn-block__title t-display">Out of sync</h2>
              <p style={{ color: 'var(--ink-2)' }}>The two devices disagreed about a move, so this game can’t continue. Start a new room.</p>
              <button type="button" className="btn btn--ink" onClick={onExit}>
                Back to home
              </button>
            </div>
          </motion.div>
        )}
        {snap.match && netError(snap) !== 'desync' && snap.connection === 'opponent-left' && (
          <motion.div key="left" className="conn-block" role="alertdialog" aria-label="Opponent left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="conn-block__box">
              <span className="t-label c-court">Game over</span>
              <h2 className="conn-block__title t-display">Opponent left</h2>
              <p style={{ color: 'var(--ink-2)' }}>{snap.names[snap.me === 0 ? 1 : 0]} walked off the court. This room is closed.</p>
              <button type="button" className="btn btn--ink" onClick={onExit}>
                Back to home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** The online session adds an optional `error` field to its snapshots; read it without depending on src/net. */
export function netError(snap: SessionSnapshot): string | null {
  const e = (snap as SessionSnapshot & { error?: unknown }).error
  return typeof e === 'string' ? e : null
}

interface MatchProps {
  snap: SessionSnapshot
  match: MatchState
  context: string
  replayLast: boolean
  fastIntro: boolean
  onAct: (a: PlayerAction) => void
  onExit: () => void
}

type Stage = 'coin' | 'draft' | 'lineup' | 'matchups' | 'court' | 'break' | 'gameover'

interface BugView extends CourtView {
  score: [number, number]
  /** 1-based play number within the quarter. */
  play: number
  plays: number
}

/** Everything the court and the scorebug need to draw the game as it stood before result #shown was revealed. */
function viewAt(match: MatchState, shown: number): BugView {
  const h = match.history
  const last = shown > 0 ? h[shown - 1] : null
  if (shown >= h.length) {
    const playing = match.phase === 'play'
    return {
      quarter: Math.max(1, match.quarter),
      overtime: match.overtime,
      offenseSeat: currentOffenseSeat(match),
      last,
      score: match.score,
      play: playing ? match.possession + 1 : Math.max(1, match.possession),
      plays: match.possessionsInQuarter || POSSESSIONS_PER_QUARTER,
    }
  }
  const next = h[shown]
  return {
    quarter: next.quarter,
    overtime: next.overtime,
    offenseSeat: next.offenseSeat,
    last,
    score: last ? last.scoreAfter : [0, 0],
    play: next.index + 1,
    plays: next.overtime ? 2 : POSSESSIONS_PER_QUARTER,
  }
}

function MatchView({ snap, match, context, replayLast, fastIntro, onAct, onExit }: MatchProps) {
  const me = snap.me
  const [flipDone, setFlipDone] = useState(() => fastIntro || match.draft.pickNumber > 0 || match.phase !== 'draft')
  const [draftDone, setDraftDone] = useState(() => match.phase !== 'draft')
  const [matchupsDone, setMatchupsDone] = useState(() => fastIntro || match.lineups !== null)
  const [shown, setShown] = useState(() => Math.max(0, match.history.length - (replayLast ? 1 : 0)))
  const [landed, setLanded] = useState(-1)
  const [intro, setIntro] = useState<IntroInfo | null>(null)

  // Let the last pick finish flying into its rail before the screen changes.
  useEffect(() => {
    if (match.phase === 'draft' || draftDone) return
    const id = window.setTimeout(() => setDraftDone(true), 1100)
    return () => window.clearTimeout(id)
  }, [match.phase, draftDone])

  // A new quarter (or overtime pair) started: show what was drawn and who has the ball.
  const prevQuarter = useRef(match.quarter)
  const prevHand = useRef<PlayCardId[]>(match.hands[me])
  useEffect(() => {
    if (match.quarter !== prevQuarter.current && match.phase === 'play') {
      setIntro({
        quarter: match.quarter,
        overtime: match.overtime,
        drawn: handGain(prevHand.current, match.hands[me]),
        handSize: match.hands[me].length,
        firstBall: currentOffenseSeat(match) ?? me,
        opening: prevQuarter.current === 0,
      })
    }
    prevQuarter.current = match.quarter
    prevHand.current = match.hands[me]
  }, [match, me])

  const revealing = shown < match.history.length ? match.history[shown] : null
  const view = viewAt(match, shown)
  const score: [number, number] = revealing && landed === revealing.seq ? revealing.scoreAfter : view.score

  const stage: Stage = !flipDone
    ? 'coin'
    : !draftDone
      ? 'draft'
      : match.phase === 'lineup'
        ? 'lineup'
        : !matchupsDone
          ? 'matchups'
          : revealing
            ? 'court'
            : match.phase === 'gameover'
              ? 'gameover'
              : match.phase === 'break'
                ? 'break'
                : 'court'

  const finishReveal = () => setShown((n) => n + 1)

  const bump: Seat | null = revealing && landed === revealing.seq && revealing.scored ? revealing.offenseSeat : null

  return (
    <AnimatePresence mode="wait" initial={false}>
      {stage === 'coin' && (
        <Fade key="coin">
          <CoinFlip me={me} names={snap.names} winner={match.firstDrafter} onDone={() => setFlipDone(true)} />
        </Fade>
      )}
      {stage === 'draft' && (
        <Fade key="draft">
          <Draft me={me} names={snap.names} match={match} context={context} onAct={onAct} onExit={onExit} />
        </Fade>
      )}
      {stage === 'lineup' && (
        <Fade key="lineup">
          <Lineup me={me} names={snap.names} match={match} context={context} mine={snap.myPending.lineup} theirs={snap.oppPending.lineup} onAct={onAct} onExit={onExit} />
        </Fade>
      )}
      {stage === 'matchups' && (
        <Fade key="matchups">
          <Matchups me={me} names={snap.names} match={match} onDone={() => setMatchupsDone(true)} />
        </Fade>
      )}
      {stage === 'court' && (
        <Fade key="court">
          <main className="screen play">
            <div className="play__top">
              <TopBar context={context} onExit={onExit} />
              <ScoreBug me={me} names={snap.names} score={score} quarter={view.quarter} overtime={view.overtime} play={view.play} plays={view.plays} offenseSeat={view.offenseSeat} bump={bump} />
            </div>
            <Court me={me} names={snap.names} match={match} view={view} frozen={revealing !== null || intro !== null} myCommitted={snap.myPending.pick} oppCommitted={snap.oppPending.pick} onAct={onAct} />
            <AnimatePresence>
              {revealing && <Reveal key={`rv-${revealing.seq}`} result={revealing} me={me} names={snap.names} onScore={() => setLanded(revealing.seq)} onDone={finishReveal} />}
              {!revealing && intro && <QuarterIntro key={`qi-${intro.quarter}`} info={intro} me={me} names={snap.names} onDone={() => setIntro(null)} />}
            </AnimatePresence>
          </main>
        </Fade>
      )}
      {stage === 'break' && (
        <Fade key={`break-${match.quarter}`}>
          <QuarterBreak me={me} names={snap.names} match={match} context={context} mine={snap.myPending.lineup} theirs={snap.oppPending.lineup} onAct={onAct} onExit={onExit} />
        </Fade>
      )}
      {stage === 'gameover' && (
        <Fade key="gameover">
          <GameOver
            me={me}
            names={snap.names}
            match={match}
            context={context}
            rematch={snap.rematch}
            canRematch={snap.connection !== 'opponent-left'}
            onRematch={() => onAct({ type: 'requestRematch' })}
            onExit={onExit}
          />
        </Fade>
      )}
    </AnimatePresence>
  )
}

function Fade({ children }: { children: ReactNode }) {
  return (
    <motion.div className="stagewrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
      {children}
    </motion.div>
  )
}
