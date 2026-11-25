import { useSyncExternalStore } from 'react'
import type { Session, SessionSnapshot } from './types'

/** Subscribe a component to a Session. Re-renders on every snapshot change. */
export function useSession(session: Session): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
}
