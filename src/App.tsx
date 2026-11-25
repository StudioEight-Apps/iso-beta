import { MotionConfig } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createOnlineSession, makeRoomCode } from './net'
import { createBotSession } from './session'
import type { Session } from './session'
import { Game } from './ui/Game'
import { parseDemo, startDemo } from './ui/demo'
import { installAudioUnlock, play } from './ui/lib/sound'
import { readStore, writeStore } from './ui/lib/storage'
import { Home, cleanCode } from './ui/screens/Home'

const NAME_KEY = 'iso.name'

interface Active {
  session: Session
  mode: 'bot' | 'host' | 'join'
  room: string
  replayLast: boolean
  fastIntro: boolean
}

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').slice(0, 12)
}

export default function App() {
  const [name, setName] = useState(() => cleanName(readStore(NAME_KEY) ?? ''))
  const [active, setActive] = useState<Active | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [booting, setBooting] = useState(() => parseDemo(params().get('demo')) !== null)
  const sessionRef = useRef<Session | null>(null)
  const seedUsed = useRef(false)
  const [initialCode] = useState(() => cleanCode(params().get('room') ?? ''))

  useEffect(() => {
    installAudioUnlock()
  }, [])

  // Dev aid: ?demo=reveal|court|break|final|gameover|draft|lineup (optionally &seed=...)
  useEffect(() => {
    const kind = parseDemo(params().get('demo'))
    if (!kind) return
    let cancelled = false
    const seed = params().get('seed') ?? undefined
    const cancel = startDemo(kind, name.trim() || 'YOU', seed, (demo) => {
      if (cancelled) {
        demo.session.dispose()
        return
      }
      sessionRef.current = demo.session
      setActive({ session: demo.session, mode: 'bot', room: '', replayLast: demo.replayLast, fastIntro: kind !== 'draft' })
      setBooting(false)
    })
    return () => {
      cancelled = true
      cancel()
      sessionRef.current?.dispose()
      sessionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      sessionRef.current?.dispose()
    },
    [],
  )

  const playerName = () => name.trim() || 'YOU'

  const start = (next: Active) => {
    sessionRef.current?.dispose()
    sessionRef.current = next.session
    setError(null)
    setActive(next)
  }

  const exit = () => {
    sessionRef.current?.dispose()
    sessionRef.current = null
    setActive(null)
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }

  const onName = (raw: string) => {
    const v = cleanName(raw)
    setName(v)
    writeStore(NAME_KEY, v)
  }

  const bot = () => {
    play('lockin')
    const seed = seedUsed.current ? undefined : (params().get('seed') ?? undefined)
    seedUsed.current = true
    start({ session: createBotSession({ name: playerName(), seed }), mode: 'bot', room: '', replayLast: false, fastIntro: false })
  }

  const online = (room: string, host: boolean) => {
    play('lockin')
    try {
      // A blank name must not reach the opponent as "YOU".
      const session = createOnlineSession({ room, name: name.trim() || (host ? 'HOST' : 'GUEST'), host })
      start({ session, mode: host ? 'host' : 'join', room, replayLast: false, fastIntro: false })
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'unknown error'
      setError(`Online play isn’t available right now (${detail}). Practice vs bot still works.`)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      {booting ? null : active ? (
        <Game key={active.mode + active.room} session={active.session} mode={active.mode} room={active.room} replayLast={active.replayLast} fastIntro={active.fastIntro} onExit={exit} />
      ) : (
        <Home name={name} onName={onName} initialCode={initialCode} error={error} onBot={bot} onHost={() => online(makeRoomCode(), true)} onJoin={(code) => online(code, false)} />
      )}
    </MotionConfig>
  )
}
