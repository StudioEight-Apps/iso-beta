import { cardTier, ROSTER } from './roster'
import type { ShotType } from './types'

/**
 * Unique abilities. Every one is dice text: a natural face, a whole-number bonus, a different die,
 * or a reroll. The engine reads `spec`; the card shows `name` and `text`.
 */
export type AbilitySpec =
  /** A natural `min` or higher on that shot die goes in no matter what the defence rolled. */
  | { kind: 'autoMake'; shot: ShotType; min: number }
  /** +bonus on his shots in the 4th quarter and overtime. */
  | { kind: 'clutch'; bonus: number }
  /** +bonus on his shot if he made his previous shot. */
  | { kind: 'hotHand'; bonus: number }
  /** +bonus on his shot if his team scored on its previous possession. */
  | { kind: 'momentum'; bonus: number }
  /** A double team on him rolls this smaller help die. */
  | { kind: 'softHelp'; die: 4 }
  /** +bonus on his shot when the help die is not rolled against him. `shot` limits it to one shot type. */
  | { kind: 'unDoubled'; shot: ShotType | null; bonus: number }
  /** If his shot die shows `max` or lower, roll it again once and keep the second roll. */
  | { kind: 'reroll'; shot: ShotType; max: number }
  /** +bonus on that shot when his defender's DEF die is `maxDef` or smaller. */
  | { kind: 'mismatch'; shot: ShotType; bonus: number; maxDef: number }
  /** +bonus on that shot when a teammate passed him the ball. */
  | { kind: 'offPass'; shot: ShotType; bonus: number }
  /** His passes are dimes one face earlier (4+ instead of 5+). */
  | { kind: 'dime' }
  /** His dimes are worth this much instead of +2. */
  | { kind: 'bigDime'; bonus: number }
  /** His passes are never stolen. */
  | { kind: 'safePass' }
  /** Catch & Shoot (see text). */
  | { kind: 'catchShoot' }
  /** +bonus on his shot on the play he is subbed in. */
  | { kind: 'sixthMan'; bonus: number }
  /** Auto stop when his DEF die equals the shooter's die (range 0) or is equal or one below it (range 1). */
  | { kind: 'clamp'; range: 0 | 1 }
  /** Drives are blocked when the defence wins by `margin`+ instead of 5+. 'team' = any drive against his team. */
  | { kind: 'swat'; scope: 'own' | 'team'; margin: number }
  /** +bonus to his team's defence against drives while he is on the floor. */
  | { kind: 'anchor'; bonus: number }
  /** +bonus when he rolls for a rebound. */
  | { kind: 'glass'; bonus: number }
  /** Passes by the player he guards are stolen on `stealAt` or lower. */
  | { kind: 'jumpLane'; stealAt: number }

export interface Ability {
  name: string
  text: string
  spec: AbilitySpec
}

const CLAMP: Ability = {
  name: 'Clamp',
  text: 'If his DEF die shows the same number as the shooter\'s die, it is an automatic stop: a block on a drive, a steal on a three.',
  spec: { kind: 'clamp', range: 0 },
}

export const ABILITIES: Readonly<Record<string, Ability>> = {
  // elite and star cards: one each
  curry: { name: 'Splash', text: 'A natural 10, 11 or 12 on his 3PT die is automatically in.', spec: { kind: 'autoMake', shot: 'THREE', min: 10 } },
  durant: { name: 'Unguardable', text: 'A double team on him rolls a d4 help die instead of a d6.', spec: { kind: 'softHelp', die: 4 } },
  kawhi: { name: 'The Klaw', text: 'If his DEF die shows the same number as the shooter\'s die, or one lower, it is an automatic stop: a block on a drive, a steal on a three.', spec: { kind: 'clamp', range: 1 } },
  giannis: { name: 'Freight Train', text: 'A natural 11 or 12 on his DRIVE die is automatically in.', spec: { kind: 'autoMake', shot: 'DRIVE', min: 11 } },
  embiid: { name: 'Post Up', text: '+2 on his drives when his defender\'s DEF die is a d8 or smaller.', spec: { kind: 'mismatch', shot: 'DRIVE', bonus: 2, maxDef: 8 } },
  jokic: { name: 'Hub', text: 'His dimes give the shooter +3 instead of +2.', spec: { kind: 'bigDime', bonus: 3 } },
  luka: { name: 'Maestro', text: 'His passes are dimes on a 4 or higher.', spec: { kind: 'dime' } },
  sga: { name: 'Isolation', text: '+1 on his shot whenever he is not double-teamed.', spec: { kind: 'unDoubled', shot: null, bonus: 1 } },
  tatum: { name: 'Tough Shot', text: 'If his 3PT die shows a 1 or 2, roll it again once.', spec: { kind: 'reroll', shot: 'THREE', max: 2 } },
  wemby: { name: 'Eraser', text: 'While he is on the floor, any drive against your team is blocked when your defence wins by 3 or more. He gets the block.', spec: { kind: 'swat', scope: 'team', margin: 3 } },
  ant: { name: 'Poster', text: 'A natural 10 on his DRIVE die is automatically in.', spec: { kind: 'autoMake', shot: 'DRIVE', min: 10 } },
  lebron: { name: 'Momentum', text: '+2 on his shot if your team scored on its last possession.', spec: { kind: 'momentum', bonus: 2 } },
  davis: { name: 'Back Line', text: 'Drives by the player he guards are blocked when he wins by 3 or more.', spec: { kind: 'swat', scope: 'own', margin: 3 } },
  morant: { name: 'Above the Rim', text: 'A natural 11 or 12 on his DRIVE die is automatically in.', spec: { kind: 'autoMake', shot: 'DRIVE', min: 11 } },
  lillard: { name: 'Dame Time', text: '+2 on his shots in the 4th quarter and overtime.', spec: { kind: 'clutch', bonus: 2 } },
  booker: { name: 'In Rhythm', text: '+2 on his shot if he made his last shot.', spec: { kind: 'hotHand', bonus: 2 } },
  mitchell: { name: 'Takeover', text: '+2 on his shot if he made his last shot.', spec: { kind: 'hotHand', bonus: 2 } },
  brunson: { name: 'Clutch Gene', text: '+2 on his shots in the 4th quarter and overtime.', spec: { kind: 'clutch', bonus: 2 } },
  haliburton: { name: 'Table Setter', text: 'His passes are never stolen.', spec: { kind: 'safePass' } },
  butler: { name: 'Jump the Lane', text: 'Passes thrown by the player he guards are stolen on a 1 or 2.', spec: { kind: 'jumpLane', stealAt: 2 } },
  towns: { name: 'Pick & Pop', text: '+1 on his threes when a teammate passes him the ball.', spec: { kind: 'offPass', shot: 'THREE', bonus: 1 } },
  banchero: { name: 'Mismatch', text: '+2 on his drives when his defender\'s DEF die is a d8 or smaller.', spec: { kind: 'mismatch', shot: 'DRIVE', bonus: 2, maxDef: 8 } },
  irving: { name: 'Handles', text: 'If his DRIVE die shows a 1 or 2, roll it again once.', spec: { kind: 'reroll', shot: 'DRIVE', max: 2 } },
  harden: { name: 'Step Back', text: 'If his 3PT die shows a 1 or 2, roll it again once.', spec: { kind: 'reroll', shot: 'THREE', max: 2 } },
  george: { name: 'Smother', text: CLAMP.text, spec: { kind: 'clamp', range: 0 } },
  adebayo: { name: 'Glass Cleaner', text: '+2 whenever he rolls for a rebound.', spec: { kind: 'glass', bonus: 2 } },
  siakam: { name: 'Spin Cycle', text: 'If his DRIVE die shows a 1 or 2, roll it again once.', spec: { kind: 'reroll', shot: 'DRIVE', max: 2 } },
  fox: { name: 'Fifth Gear', text: '+1 on his drives whenever he is not double-teamed.', spec: { kind: 'unDoubled', shot: 'DRIVE', bonus: 1 } },
  maxey: { name: 'Heating Up', text: '+2 on his shot if he made his last shot.', spec: { kind: 'hotHand', bonus: 2 } },
  young: { name: 'Lob Threat', text: 'His passes are dimes on a 4 or higher.', spec: { kind: 'dime' } },
  jwill: { name: 'Back Cut', text: '+1 on his drives when a teammate passes him the ball.', spec: { kind: 'offPass', shot: 'DRIVE', bonus: 1 } },
  cunningham: { name: 'Floor General', text: 'His passes are never stolen.', spec: { kind: 'safePass' } },
  holmgren: { name: 'Swat', text: 'Drives by the player he guards are blocked when he wins by 3 or more.', spec: { kind: 'swat', scope: 'own', margin: 3 } },

  // the cards the concept was written around, and small role-player abilities
  klay: {
    name: 'Catch & Shoot',
    text: 'On the play he is subbed in, his three is uncontested. While he is on the floor, if your shooter is double-teamed or blocked, Klay takes an uncontested three instead. Uncontested: the defence only rolls a d4.',
    spec: { kind: 'catchShoot' },
  },
  gobert: { name: 'Stifle Tower', text: '+1 to your defence against drives while he is on the floor.', spec: { kind: 'anchor', bonus: 1 } },
  jjj: { name: 'Block Party', text: 'Drives by the player he guards are blocked when he wins by 3 or more.', spec: { kind: 'swat', scope: 'own', margin: 3 } },
  reid: { name: 'Sixth Man', text: '+2 on his shot on the play he is subbed in.', spec: { kind: 'sixthMan', bonus: 2 } },
  pritchard: { name: 'Spark', text: '+2 on his shot on the play he is subbed in.', spec: { kind: 'sixthMan', bonus: 2 } },
  holiday: CLAMP,
  white: CLAMP,
  bridges: CLAMP,
  anunoby: CLAMP,
  caruso: CLAMP,
  dort: CLAMP,
  hjones: CLAMP,
  thybulle: CLAMP,
}

export function abilityOf(id: string): Ability | null {
  return ABILITIES[id] ?? null
}

/** The ability spec of `id` if it is of `kind`, else null. */
export function abilitySpec<K extends AbilitySpec['kind']>(id: string, kind: K): Extract<AbilitySpec, { kind: K }> | null {
  const a = ABILITIES[id]
  return a && a.spec.kind === kind ? (a.spec as Extract<AbilitySpec, { kind: K }>) : null
}

/** Elite and star cards that are missing an ability (must be empty; checked by a test). */
export function starsWithoutAbility(): string[] {
  return ROSTER.filter((c) => (cardTier(c) === 'elite' || cardTier(c) === 'star') && !ABILITIES[c.id]).map((c) => c.id)
}
