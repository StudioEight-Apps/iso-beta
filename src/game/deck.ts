import { rngFromSeed } from './prng'
import type { CardSide, PlayCardId } from './types'

export interface PlayCardDef {
  id: PlayCardId
  name: string
  /** Who may play it: the side with the ball, the side without, or either. */
  side: CardSide
  /** Copies in the 40-card deck. */
  count: number
  /** Card text. Dice and whole numbers only. */
  text: string
}

export const PLAY_CARDS: readonly PlayCardDef[] = [
  { id: 'pickroll', name: 'Pick & Roll', side: 'offense', count: 4, text: 'Drive only. Roll a d4 with your DRIVE die and add it.' },
  { id: 'screen', name: 'Off-Ball Screen', side: 'offense', count: 4, text: 'Three only. +2 to the shot.' },
  { id: 'kickout', name: 'Kick Out', side: 'offense', count: 3, text: 'If your shooter is double-teamed, the ball goes to your teammate with the biggest 3PT die for an open three (+2, no help die). Your first shooter gets the assist if it drops.' },
  { id: 'fastbreak', name: 'Fast Break', side: 'offense', count: 3, text: 'Ignore the double team this possession (no help die, no open look). +1 to the shot.' },
  { id: 'alleyoop', name: 'Alley-Oop', side: 'offense', count: 2, text: 'A pass into a drive only. If the pass is a dime, the drive is automatically in.' },
  { id: 'heatcheck', name: 'Heat Check', side: 'offense', count: 2, text: 'Only for a shooter who scored on your last possession. +3 to the shot.' },
  { id: 'wallup', name: 'Wall Up', side: 'defense', count: 4, text: 'Against a drive, roll a d4 with your DEF die and add it.' },
  { id: 'closeout', name: 'Closeout', side: 'defense', count: 4, text: 'Against a three, +2 to your defence.' },
  { id: 'zone', name: 'Zone', side: 'defense', count: 3, text: 'If you double-teamed the wrong player, the shooter gets no open look bonus.' },
  { id: 'pickpocket', name: 'Pick Pocket', side: 'defense', count: 3, text: 'If they pass, the pass is stolen on a 1, 2 or 3.' },
  { id: 'scout', name: 'Scouting Report', side: 'defense', count: 2, text: 'Cancel the play card the offence played this possession.' },
  { id: 'crash', name: 'Crash the Glass', side: 'either', count: 4, text: 'If the shot misses, +3 to your rebound roll.' },
  { id: 'timeout', name: 'Timeout', side: 'either', count: 2, text: 'Draw 2 cards.' },
]

const BY_ID: ReadonlyMap<string, PlayCardDef> = new Map(PLAY_CARDS.map((c) => [c.id, c]))

export const DECK_SIZE = PLAY_CARDS.reduce((n, c) => n + c.count, 0)
/** Cards dealt to each coach before the first possession. */
export const STARTING_HAND = 4
/** Cards each coach draws at every quarter break in regulation. */
export const DRAW_PER_BREAK = 2
/** You never hold more than this: draw fewer if you would go over. */
export const HAND_LIMIT = 6

export function playCard(id: PlayCardId): PlayCardDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`unknown play card: ${id}`)
  return def
}

export function isPlayCardId(v: unknown): v is PlayCardId {
  return typeof v === 'string' && BY_ID.has(v)
}

/** The full deck, unshuffled. */
export function fullDeck(): PlayCardId[] {
  const out: PlayCardId[] = []
  for (const c of PLAY_CARDS) for (let i = 0; i < c.count; i++) out.push(c.id)
  return out
}

/** The shuffled draw pile for a match, top card first. Same seed, same order. */
export function shuffledDeck(seed: string): PlayCardId[] {
  const rng = rngFromSeed(`${seed}|deck`)
  const deck = fullDeck()
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = deck[i]
    deck[i] = deck[j]
    deck[j] = t
  }
  return deck
}

/** Can a card of this side be played by a coach who is on offence (true) or defence (false)? */
export function cardFitsRole(id: PlayCardId, onOffense: boolean): boolean {
  const side = playCard(id).side
  return side === 'either' || (side === 'offense') === onOffense
}
