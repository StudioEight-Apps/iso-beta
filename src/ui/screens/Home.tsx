import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Die } from '../components/Die'
import { ArrowIcon, ClampIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { MuteButton } from '../components/TopBar'
import { play } from '../lib/sound'
import { Ball3D } from '../components/Ball'

interface Props {
  name: string
  onName: (name: string) => void
  initialCode: string
  error: string | null
  onBot: () => void
  onHost: () => void
  onJoin: (code: string) => void
}

const CODE_RE = /[^A-HJ-NP-Z2-9]/g

export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(CODE_RE, '').slice(0, 5)
}

const LETTERS = ['I', 'S', 'O']

export function Home({ name, onName, initialCode, error, onBot, onHost, onJoin }: Props) {
  const [joining, setJoining] = useState(initialCode.length > 0)
  const [code, setCode] = useState(initialCode)
  const [how, setHow] = useState(false)

  const submitJoin = (e: FormEvent) => {
    e.preventDefault()
    if (code.length === 5) onJoin(code)
  }

  return (
    <main className="screen screen--scroll home">
      <div className="home__bar">
        <span className="t-label">Private beta</span>
        <MuteButton />
      </div>

      <section className="home__hero">
        <motion.div className="home__kicker t-wide" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.5 }}>
          Real cards <span className="c-off">/</span> real dice
        </motion.div>
        <h1 className="home__title" aria-label="ISO">
          {LETTERS.map((ch, i) => (
            <span className={`home__letter${ch === 'O' ? ' home__letter--ball' : ''}`} key={ch} aria-hidden>
              <motion.span
                initial={{ y: '108%', skewY: 9 }}
                animate={{ y: '0%', skewY: 0 }}
                transition={{ type: 'spring', stiffness: 150, damping: 17, delay: 0.08 + i * 0.09 }}
              >
                {ch === 'O' ? <Ball3D dribble="once" /> : ch}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.div className="home__rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
        <div className="home__dice" aria-hidden>
          {([4, 6, 8, 10, 12] as const).map((s, i) => (
            <motion.span
              key={s}
              initial={{ opacity: 0, y: -26, rotate: -60 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.7 + i * 0.07 }}
            >
              <Die size={s} tone={i === 4 ? 'off' : i === 2 ? 'def' : 'ink'} solid={i === 4} />
            </motion.span>
          ))}
        </div>
      </section>

      <motion.section className="home__panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <label className="field">
          <span className="t-label">Your name</span>
          <input
            className="field__in"
            value={name}
            maxLength={12}
            placeholder="PLAYER"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => onName(e.target.value)}
          />
        </label>

        <AnimatePresence mode="wait" initial={false}>
          {joining ? (
            <motion.form key="join" className="home__actions" onSubmit={submitJoin} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
              <label className="field">
                <span className="t-label">Room code</span>
                <input
                  className="field__in field__in--code"
                  value={code}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="·····"
                  aria-label="Room code"
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                />
              </label>
              <button type="submit" className="btn btn--off" disabled={code.length !== 5}>
                Join game <ArrowIcon />
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => setJoining(false)}>
                Back
              </button>
            </motion.form>
          ) : (
            <motion.div key="main" className="home__actions" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18 }}>
              <button type="button" className="btn btn--off" onClick={onHost}>
                Play a friend <ArrowIcon />
              </button>
              <div className="home__pair">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    play('tap')
                    setJoining(true)
                  }}
                >
                  Join with code
                </button>
                <button type="button" className="btn btn--ghost" onClick={onBot}>
                  Practice vs bot
                </button>
              </div>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  play('tap')
                  setHow(true)
                }}
              >
                How to play
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {error && (
          <p className="home__err" role="alert">
            {error}
          </p>
        )}
      </motion.section>

      <AnimatePresence>
        {how && (
          <Sheet title="How to play · 60 seconds" onClose={() => setHow(false)}>
            <HowTo />
            <button type="button" className="btn btn--ink" style={{ marginTop: 18 }} onClick={() => setHow(false)}>
              Got it
            </button>
          </Sheet>
        )}
      </AnimatePresence>
    </main>
  )
}

function HowTo() {
  return (
    <div className="how">
      <p className="how__lead t-display">Real cards, real dice. The shooter rolls, his defender rolls, higher roll wins.</p>
      <ol className="how__steps">
        <li>
          <span className="how__art how__art--n">1</span>
          <div>
            <b>Draft seven.</b>
            <span>18 players are dealt. Take turns picking until you each have 7. Seat five at PG, SG, SF, PF and C. The other two are your bench. Each seat guards the same seat.</span>
          </div>
        </li>
        <li>
          <span className="how__art">
            <Die size={12} tone="off" />
          </span>
          <div>
            <b>With the ball: pick a shooter.</b>
            <span>Choose a three (3 points, his 3PT die) or a drive (2 points, his DRIVE die). A teammate can pass first: 5 or more on his PASS die is a dime, worth +2 and the assist. A 1 is stolen.</span>
          </div>
        </li>
        <li>
          <span className="how__art how__art--lock">
            <ClampIcon />
          </span>
          <div>
            <b>Without it: call a double team.</b>
            <span>Both coaches choose in secret and flip together. Double the right player and you add a d6 to your defence. Double the wrong one and the shooter is open: he adds 2.</span>
          </div>
        </li>
        <li>
          <span className="how__art">
            <Die size={8} tone="def" />
          </span>
          <div>
            <b>Roll.</b>
            <span>Shot die against the defender's DEF die. The shooter has to roll higher, ties go to the defence, and the defence adds 2 against every three. On a miss the best REB dice battle for the board. An offensive board is one putback.</span>
          </div>
        </li>
        <li>
          <span className="how__art how__art--n">5</span>
          <div>
            <b>Abilities and play cards.</b>
            <span>Star cards have one line of dice text that breaks a rule. Curry: a natural 10, 11 or 12 on his 3PT die is always in. You also hold play cards like Pick &amp; Roll or Wall Up. Play at most one each possession.</span>
          </div>
        </li>
        <li>
          <span className="how__art how__art--n">6</span>
          <div>
            <b>Four quarters, and a bench that matters.</b>
            <span>Each quarter is 10 plays, 5 possessions each. Nobody shoots more than twice a quarter. One sub per quarter during play, free subs and 2 new cards at every break. Most points wins. Tied after four: one possession each until someone leads.</span>
          </div>
        </li>
      </ol>
      <p className="how__foot">It plays the same on a table with the printed cards and a d4, d6, d8, d10 and d12.</p>
    </div>
  )
}
