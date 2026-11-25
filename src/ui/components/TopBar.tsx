import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { play, toggleMuted, useMuted } from '../lib/sound'
import { ExitIcon, SoundOffIcon, SoundOnIcon } from './Icons'
import { Sheet } from './Sheet'
import { Ball } from './Ball'

export function MuteButton() {
  const muted = useMuted()
  return (
    <button type="button" className="iconbtn" onClick={toggleMuted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={muted}>
      {muted ? <SoundOffIcon /> : <SoundOnIcon />}
    </button>
  )
}

interface Props {
  context?: string
  onExit?: () => void
  /** Ask before leaving (mid-game). */
  confirmExit?: boolean
}

export function TopBar({ context, onExit, confirmExit = true }: Props) {
  const [asking, setAsking] = useState(false)
  return (
    <header className="topbar">
      <span className="topbar__mark">
        <Ball />
        ISO
      </span>
      <span className="topbar__ctx t-label">{context}</span>
      <span className="topbar__btns">
        <MuteButton />
        {onExit && (
          <button
            type="button"
            className="iconbtn"
            aria-label="Leave game"
            onClick={() => {
              play('tap')
              if (confirmExit) setAsking(true)
              else onExit()
            }}
          >
            <ExitIcon />
          </button>
        )}
      </span>
      <AnimatePresence>
        {asking && onExit && (
          <Sheet title="Leave game" onClose={() => setAsking(false)}>
            <p className="t-display" style={{ fontSize: 40, marginBottom: 10 }}>
              Walk off the court?
            </p>
            <p style={{ color: 'var(--ink-2)', marginBottom: 18 }}>This game ends for both players.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" className="btn btn--ink" onClick={() => setAsking(false)}>
                Keep playing
              </button>
              <button type="button" className="btn btn--ghost" onClick={onExit}>
                Leave
              </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </header>
  )
}
