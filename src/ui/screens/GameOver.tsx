import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { boxScore, getCard } from '../../game'
import type { BoxLine, MatchState, Seat } from '../../game'
import { BoxTable } from '../components/BoxTable'
import { Card3D } from '../components/Card3D'
import { CardPeek } from '../components/CardPeek'
import { CheckIcon } from '../components/Icons'
import { RollingNumber } from '../components/RollingNumber'
import { TopBar } from '../components/TopBar'
import { buzz } from '../lib/haptics'
import { firstName, surname } from '../lib/names'
import { play } from '../lib/sound'
import { gameScore, statLine } from '../lib/v3'

interface Props {
  me: Seat
  names: [string, string]
  match: MatchState
  context: string
  rematch: { me: boolean; opp: boolean }
  canRematch: boolean
  onRematch: () => void
  onExit: () => void
}

export function GameOver({ me, names, match, context, rematch, canRematch, onRematch, onExit }: Props) {
  const opp: Seat = me === 0 ? 1 : 0
  const won = match.winner === me
  const box = boxScore(match)
  const overtime = match.history.some((r) => r.overtime)
  const [peek, setPeek] = useState<string | null>(null)

  useEffect(() => {
    play('buzzer')
    buzz(won ? [40, 50, 40, 50, 120] : [120])
  }, [won])

  /** Everyone who played, biggest night first; unused bench at the bottom. */
  const lines = (seat: Seat): BoxLine[] => match.draft.picks[seat].map((id) => box[id]).sort((a, b) => Number(b.possessions > 0) - Number(a.possessions > 0) || b.pts - a.pts || gameScore(b) - gameScore(a))

  // Player of the game: the best line on the winning side.
  const winner: Seat = match.winner ?? me
  const potg = lines(winner).reduce((best, l) => (gameScore(l) > gameScore(best) ? l : best))
  const potgCard = getCard(potg.cardId)
  const feats = Object.values(box).filter((l) => l.doubleDouble || l.tripleDouble)

  return (
    <main className="screen screen--scroll over over--v3">
      <TopBar context={context} onExit={onExit} confirmExit={false} />
      <section className={`over__hero${won ? ' is-win' : ' is-loss'}`}>
        <motion.span className="t-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          Final{overtime ? ' · overtime' : ''}
        </motion.span>
        <h1 className="over__title t-display">
          <motion.span initial={{ y: '110%' }} animate={{ y: '0%' }} transition={{ type: 'spring', stiffness: 170, damping: 18, delay: 0.1 }}>
            {won ? 'You win' : `${names[opp]} wins`}
          </motion.span>
        </h1>
        <motion.div className="over__score t-display" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.35 }}>
          <span className={won ? 'is-w' : ''}>
            <RollingNumber value={match.score[me]} />
          </span>
          <i />
          <span className={won ? '' : 'is-w'}>
            <RollingNumber value={match.score[opp]} />
          </span>
        </motion.div>
      </section>

      <motion.section className="potg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
        <div className="potg__card">
          <Card3D card={potgCard} tone={winner === me ? 'off' : 'def'} sway onTap={() => setPeek(potg.cardId)} />
        </div>
        <div className="potg__txt">
          <span className="t-label">Player of the game</span>
          <span className="potg__name">
            <small>{firstName(potgCard)}</small>
            <b>{surname(potgCard)}</b>
          </span>
          <span className="potg__line">{statLine(potg)}</span>
          <span className="potg__fg">
            {potg.fgm} of {potg.fga} shots{potg.tpa > 0 ? ` · ${potg.tpm} of ${potg.tpa} threes` : ''}
          </span>
          <button type="button" className="potg__btn" onClick={() => setPeek(potg.cardId)}>
            See the card
          </button>
        </div>
      </motion.section>

      {feats.length > 0 && (
        <div className="feats">
          {feats.map((l) => (
            <span key={l.cardId} className={`feat${l.tripleDouble ? ' feat--td' : ''}`}>
              <b>{l.tripleDouble ? 'Triple-double' : 'Double-double'}</b> {surname(getCard(l.cardId))} · {statLine(l)}
            </span>
          ))}
        </div>
      )}

      <motion.div className="over__boxes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.4 }}>
        <BoxTable title={/^you$/i.test(names[me]) ? 'You' : `${names[me]} · you`} score={match.score[me]} lines={lines(me)} tone="off" />
        <BoxTable title={names[opp]} score={match.score[opp]} lines={lines(opp)} tone="def" />
      </motion.div>
      <p className="over__note">Every number is counted from the dice. Assists come from dimes, rebounds from board battles, blocks and steals from stops by 5 or more and from abilities.</p>

      <div className="over__foot">
        {rematch.opp && !rematch.me && (
          <motion.p className="over__ask" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} role="status">
            <CheckIcon /> {names[opp]} wants to run it back
          </motion.p>
        )}
        {canRematch && (
          <button
            type="button"
            className="btn btn--off"
            disabled={rematch.me}
            onClick={() => {
              play('lockin')
              onRematch()
            }}
          >
            {rematch.me ? (
              <>
                Waiting for {names[opp]}
                <span className="dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </>
            ) : (
              'Run it back'
            )}
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Back to home
        </button>
      </div>

      <AnimatePresence>{peek && <CardPeek key="peek" cardId={peek} title="Player of the game" onClose={() => setPeek(null)} />}</AnimatePresence>
    </main>
  )
}
