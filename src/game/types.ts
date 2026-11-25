/** Pure data types for the ISO v3 engine. Everything here is JSON-serializable. */

export type Seat = 0 | 1
export type DieSize = 4 | 6 | 8 | 10 | 12
export type ShotType = 'THREE' | 'DRIVE'
export type Position = 'G' | 'F' | 'C'

/** A player card. Five skill dice; everything else on the card is derived from them. */
export interface Card {
  id: string
  name: string
  number: number
  position: Position
  /** 3PT die: rolled on a THREE attempt (worth 3). */
  three: DieSize
  /** DRIVE die: rolled on a DRIVE attempt (worth 2). */
  drive: DieSize
  /** PASS die: rolled when this card passes. 5+ is a dime, 1 is stolen. */
  pass: DieSize
  /** REB die: rolled in the board battle after a miss. */
  reb: DieSize
  /** DEF die: rolled when this card is the matched defender. */
  def: DieSize
}

/** Play and support cards in the shared deck. */
export type PlayCardId =
  | 'pickroll'
  | 'screen'
  | 'kickout'
  | 'fastbreak'
  | 'alleyoop'
  | 'heatcheck'
  | 'wallup'
  | 'closeout'
  | 'zone'
  | 'pickpocket'
  | 'scout'
  | 'crash'
  | 'timeout'

export type CardSide = 'offense' | 'defense' | 'either'

/**
 * 'coinflip' is part of the union for UI staging, but the engine never rests in it:
 * createMatch() resolves the flip from the seed and returns a state already in 'draft'.
 * 'break' is the stop between quarters (and before overtime): both coaches set their five.
 */
export type Phase = 'coinflip' | 'draft' | 'lineup' | 'play' | 'break' | 'gameover'

/** A mid-quarter substitution, called together with the secret pick. `in` takes `out`'s seat. */
export interface SubPick {
  out: string
  in: string
}

export interface OffensePick {
  /** Who takes the shot. Must be on the floor (after this pick's sub) with shots left this quarter. */
  shooterId: string
  shot: ShotType
  /** Optional teammate on the floor who passes to the shooter (rolls his PASS die). */
  passerId?: string | null
  /** Optional play card from hand. */
  cardId?: PlayCardId | null
  sub?: SubPick | null
}

export interface DefensePick {
  /** Player on the other roster to double-team, or null to play straight up. */
  doubleId: string | null
  /** Optional defence or support card from hand. */
  cardId?: PlayCardId | null
  sub?: SubPick | null
}

/* ------------------------------------------------------------------ */
/* Possession result: everything a reveal screen needs, in order        */
/* ------------------------------------------------------------------ */

export type RollPurpose = 'pass' | 'shot' | 'reroll' | 'bonus' | 'defense' | 'help' | 'rebound'

/** One physical die that was rolled. */
export interface DieRoll {
  /** Card id of the player who rolled it, or null for a team die (help, card dice, the d4 contest on an open shot). */
  who: string | null
  seat: Seat
  side: 'off' | 'def'
  purpose: RollPurpose
  die: DieSize
  face: number
  /** Short plain label, e.g. "3PT d12", "DEF d8", "Help d6", "Pick & Roll d4". */
  label: string
  /** True when the die was rolled and then replaced by a reroll (it does not count). */
  discarded: boolean
}

export type ModSource = 'rule' | 'card' | 'ability' | 'chem'

/** A whole-number modifier added to one side's total. */
export interface Modifier {
  side: 'off' | 'def'
  label: string
  value: number
  source: ModSource
}

export type ContestKind = 'shot' | 'catchshoot' | 'putback'
export type ContestOutcome = 'made' | 'missed' | 'blocked' | 'stolen'

/** One shot: dice, modifiers, totals, outcome. */
export interface Contest {
  kind: ContestKind
  shooter: string
  /** Matched defender, or null on an uncontested shot (the defence only rolls a d4). */
  defender: string | null
  shot: ShotType
  /** 0-based seat (PG..C) of the shooter. */
  slot: number
  /** The defence doubled this shooter and rolled the help die. */
  doubled: boolean
  /** The shooter got the open look bonus. */
  open: boolean
  uncontested: boolean
  /** Every die in the order it is rolled. */
  dice: DieRoll[]
  mods: Modifier[]
  /** The face that counts on the shooter's own shot die (after any reroll). */
  natural: number
  offenseTotal: number
  defenseTotal: number
  /** Set when card text decided the shot regardless of totals. */
  auto: { result: 'make' | 'stop'; label: string } | null
  outcome: ContestOutcome
  points: number
}

export interface PassResult {
  passer: string
  /** The passer's matched defender (gets the steal). */
  defender: string
  receiver: string
  roll: DieRoll
  /** Faces at or below this are stolen (0 = cannot be stolen). */
  stealAt: number
  /** Faces at or above this are a dime. */
  dimeAt: number
  stolen: boolean
  dime: boolean
  /** Shot bonus the dime gives (0 when not a dime). */
  bonus: number
}

export interface ReboundResult {
  /** False when the defence simply collects the ball (after a missed putback). */
  contested: boolean
  offRebounder: string
  defRebounder: string
  dice: DieRoll[]
  mods: Modifier[]
  offenseTotal: number
  defenseTotal: number
  winner: 'off' | 'def'
  /** Card id credited with the rebound. */
  rebounder: string
}

export type StatKey = 'PTS' | 'REB' | 'OREB' | 'AST' | 'STL' | 'BLK' | 'TOV'

export interface StatCredit {
  cardId: string
  seat: Seat
  stat: StatKey
  value: number
}

export interface PlayedCard {
  id: PlayCardId
  seat: Seat
  /** 'played' = took effect, 'cancelled' = Scouting Report, 'noEffect' = its condition never came up. */
  status: 'played' | 'cancelled' | 'noEffect'
}

export type StepKind =
  | 'sub'
  | 'card'
  | 'double'
  | 'pass'
  | 'swing'
  | 'ability'
  | 'shot'
  | 'rebound'
  | 'result'

/**
 * One beat of the reveal, in the order it happens at the table. `text` is plain-words copy that
 * says what is rolled against what. `rolls` are the dice that land on this beat.
 */
export interface RevealStep {
  kind: StepKind
  text: string
  seat: Seat
  rolls: DieRoll[]
  /** Player card involved, if any. */
  who?: string
  /** Play card involved, if any. */
  card?: PlayCardId
  /** Index into PossessionResult.contests / .rebounds for 'shot' / 'rebound' steps. */
  ref?: number
}

export interface PossessionResult {
  /** Global 0-based sequence number (== index in MatchState.history). */
  seq: number
  /** 1..4 regulation; 5+ = overtime pair number (5 is the first pair). */
  quarter: number
  /** 0-based possession index within the quarter (0..9 regulation, 0..1 in an overtime pair). */
  index: number
  overtime: boolean
  offenseSeat: Seat
  defenseSeat: Seat
  /** The two secret picks exactly as revealed. */
  picks: { offense: OffensePick; defense: DefensePick }
  /** Substitutions made on this possession, offence first. */
  subs: { seat: Seat; out: string; in: string; slot: number }[]
  /** Lineups on the floor for this possession (after subs), indexed by seat. */
  floor: [string[], string[]]
  cards: { offense: PlayedCard | null; defense: PlayedCard | null }
  /** Cards drawn by each seat on this possession (Timeout). */
  drawn: [PlayCardId[], PlayCardId[]]
  /** Who the defence double-teamed (null = straight up). */
  doubleId: string | null
  pass: PassResult | null
  /** The shot moved to another player (Kick Out card or Catch & Shoot). */
  swing: { kind: 'kickout' | 'catchshoot'; from: string; to: string } | null
  /** Final shooter of the first shot (after any swing). */
  shooter: string
  shot: ShotType
  /** Every shot this possession, in order: the shot, an extra Catch & Shoot, a putback. */
  contests: Contest[]
  rebounds: ReboundResult[]
  /** Abilities that changed something this possession. */
  abilities: { cardId: string; name: string; text: string }[]
  /** The whole possession as an ordered script for the reveal screen. */
  steps: RevealStep[]
  credits: StatCredit[]
  scored: boolean
  points: number
  /** Score after this possession, indexed by seat. */
  scoreAfter: [number, number]
}

export interface DraftState {
  /** Card ids still on the board. */
  available: string[]
  /** Card ids picked by each seat, in pick order (7 each when done). */
  picks: [string[], string[]]
  /** Number of picks made so far (0..14). */
  pickNumber: number
}

export interface MatchState {
  version: 3
  seed: string
  phase: Phase
  /** Coin-flip winner: drafts first. */
  firstDrafter: Seat
  draft: DraftState
  /** lineups[seat][slot] = card id on the floor, slots PG SG SF PF C. null until the first lineups are revealed. */
  lineups: [string[], string[]] | null
  /** 0 before play; 1..4 regulation; 5+ overtime pairs. During 'break' this is the quarter that just ended. */
  quarter: number
  overtime: boolean
  /** 0-based index of the NEXT possession within the current quarter. */
  possession: number
  /** 10 in regulation, 2 in an overtime pair, 0 before play. */
  possessionsInQuarter: number
  /** Shots taken this quarter per card id, per seat (usage rule). */
  shots: [Record<string, number>, Record<string, number>]
  /** Mid-quarter substitutions used this quarter, per seat. */
  subsUsed: [number, number]
  /** The shared draw pile, top card first. */
  deck: PlayCardId[]
  hands: [PlayCardId[], PlayCardId[]]
  discard: PlayCardId[]
  score: [number, number]
  history: PossessionResult[]
  /** Set when phase === 'gameover'. */
  winner: Seat | null
}

export type MatchEvent =
  | { type: 'draftPick'; seat: Seat; cardId: string }
  /** First lineups: five starters each, in seat order PG SG SF PF C. The other two are the bench. */
  | { type: 'lineupReveal'; lineups: [string[], string[]] }
  /** Quarter break: both coaches set their five for the next quarter, then draw. */
  | { type: 'quarterBreak'; lineups: [string[], string[]] }
  | { type: 'possessionResolve'; offensePick: OffensePick; defensePick: DefensePick; seed: string }

export interface BoxLine {
  cardId: string
  seat: Seat
  pts: number
  reb: number
  oreb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  /** Possessions this card was on the floor for. */
  possessions: number
  /** 10 or more in two of PTS, REB, AST, STL, BLK. */
  doubleDouble: boolean
  /** 10 or more in three of them. */
  tripleDouble: boolean
}
