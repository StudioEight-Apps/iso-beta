import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { SessionSnapshot } from '../../session'
import { CheckIcon, CopyIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { buzz } from '../lib/haptics'
import { play } from '../lib/sound'

interface Props {
  snap: SessionSnapshot
  /** Room code we asked for (the snapshot's room may still be null while connecting). */
  room: string
  host: boolean
  /** Two other players already hold this room. */
  full?: boolean
  onExit: () => void
}

const STATUS: Record<SessionSnapshot['connection'], string> = {
  local: 'Local game',
  connecting: 'Connecting',
  'waiting-for-opponent': 'Waiting for your opponent',
  connected: 'Opponent is in. Tipping off',
  reconnecting: 'Reconnecting',
  'opponent-left': 'Opponent left the room',
}

export function roomLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${code}`
}

export function Lobby({ snap, room, host, full = false, onExit }: Props) {
  const code = snap.room ?? room
  const [copied, setCopied] = useState(false)
  const joined = snap.connection === 'connected'
  const was = useRef(joined)

  useEffect(() => {
    if (joined && !was.current) {
      play('lockin')
      buzz([20, 40, 30])
    }
    was.current = joined
  }, [joined])

  const copy = async () => {
    play('select')
    const link = roomLink(code)
    let ok = false
    try {
      await navigator.clipboard.writeText(link)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = link
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  const opp = snap.names[snap.me === 0 ? 1 : 0]

  return (
    <main className="screen lobby">
      <TopBar context={host ? 'Your room' : 'Joining'} onExit={onExit} confirmExit={false} />
      <div className="lobby__body">
        <span className="t-label">{host ? 'Send this code to your opponent' : 'Room'}</span>
        <div className="lobby__code" aria-label={`Room code ${code.split('').join(' ')}`}>
          {code.split('').map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 30, rotateX: -80 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 + i * 0.07 }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        <div className={`lobby__status lobby__status--${full ? 'opponent-left' : snap.connection}`} role="status">
          {joined ? (
            <motion.span className="lobby__in" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
              <CheckIcon /> {opp ? `${opp} is in` : 'Opponent is in'}
            </motion.span>
          ) : (
            <>
              <span className="lobby__pulse" aria-hidden />
              <span>{full ? 'This room is full. Ask for a new code' : STATUS[snap.connection]}</span>
              {!full && snap.connection !== 'opponent-left' && (
                <span className="dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </>
          )}
        </div>

        <div className="lobby__seats">
          <div className="lobby__seat is-in">
            <span className="t-label">You</span>
            <b>{snap.names[snap.me] || 'You'}</b>
          </div>
          <span className="lobby__vs t-wide">vs</span>
          <div className={`lobby__seat${joined ? ' is-in' : ''}`}>
            <span className="t-label">Opponent</span>
            <b>{joined && opp ? opp : 'Waiting'}</b>
          </div>
        </div>
      </div>

      <div className="lobby__foot">
        <button type="button" className="btn btn--ink" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
        <p className="lobby__link">{roomLink(code).replace(/^https?:\/\//, '')}</p>
      </div>
    </main>
  )
}
