import type { MatchState, PlayCardId, Seat, ShotType, SubPick } from '../game/types'

export type { Seat }

export type ConnectionState =
  | 'local'
  | 'connecting'
  | 'waiting-for-opponent'
  | 'connected'
  | 'reconnecting'
  | 'opponent-left'

export interface SessionSnapshot {
  /** Which seat this client plays. */
  me: Seat
  /** Display names indexed by seat. */
  names: [string, string]
  connection: ConnectionState
  room: string | null
  match: MatchState | null
  /**
   * "Has committed a secret choice for the current step". `lineup` covers the opening lineup and
   * every quarter break; `pick` is this possession's secret pick.
   */
  myPending: { lineup: boolean; pick: boolean }
  oppPending: { lineup: boolean; pick: boolean }
  rematch: { me: boolean; opp: boolean }
}

export type PlayerAction =
  | { type: 'draftPick'; cardId: string }
  /** Five cards for the floor in seat order PG SG SF PF C. Used for the opening lineup and at quarter breaks. */
  | { type: 'submitLineup'; order: string[] }
  | { type: 'submitOffense'; shooterId: string; shot: ShotType; passerId?: string | null; cardId?: PlayCardId | null; sub?: SubPick | null }
  | { type: 'submitDefense'; doubleId: string | null; cardId?: PlayCardId | null; sub?: SubPick | null }
  | { type: 'requestRematch' }

export interface Session {
  /** Stable reference between changes (safe for useSyncExternalStore). */
  getSnapshot(): SessionSnapshot
  subscribe(listener: () => void): () => void
  /** Illegal / out-of-turn actions are ignored. */
  act(action: PlayerAction): void
  dispose(): void
}
