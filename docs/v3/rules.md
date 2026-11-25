# ISO v3 rules

Two coaches. Real cards, real d4 / d6 / d8 / d10 / d12. Every outcome is dice rolled once plus the text on a card. No simulations, no percentages, no decimals. The app runs these exact rules; its dice come from a shared seed instead of a hand.

## The 60-second version

1. **Draft.** Deal 18 player cards face up. Take turns picking one until you each have 7. Seat five at PG, SG, SF, PF, C. The other two are your bench. Each player guards the player in the same seat.
2. **Game.** 4 quarters. Each quarter is 10 plays: 5 possessions each, taking turns. Most points wins. Tied after four: one possession each until someone leads.
3. **A possession.** Both coaches choose in secret, then flip together.
   - Offence: who shoots, a **three** (3 points) or a **drive** (2 points), and if you like a teammate who **passes** him the ball and one **play card**.
   - Defence: one player to **double-team** (or nobody), and if you like one **defence card**.
4. **Roll.** The shooter rolls his 3PT or DRIVE die. His defender rolls his DEF die. The shooter has to roll higher; **ties go to the defence**. Against a three the defence adds 2.
5. **The double team.** If you doubled the shooter, add a d6 to your defence. If you doubled anyone else, the shooter is open: he adds 2.
6. **The pass.** The passer rolls his PASS die. 5 or more is a dime: the shooter adds 2, and the passer gets the assist if it goes in. A 1 is stolen.
7. **Misses.** Each side rolls its best REB die, defence adds 2. If the offence wins, that rebounder gets one putback.
8. **Limits.** Nobody shoots more than twice in a quarter. One sub per quarter during play, any subs you like between quarters. Draw 2 cards at each quarter break.
9. **Abilities.** Star cards have one line of dice text that breaks a rule above. Curry: a natural 10, 11 or 12 on his 3PT die is always in.

That is the whole game. Everything below is detail.

## What you need on a table

- The player cards (66 in the full set; 18 are dealt per game).
- The 40-card play deck.
- One each of d4, d6, d8, d10, d12 per coach. Two d4 helps.
- Something to track score, quarter, and shots taken this quarter (two tokens per player card works: put one on a card each time he shoots, clear them at the quarter break).
- A pad for the box score if you want stats.

## Card anatomy

| On the card | What it is |
| --- | --- |
| Name, photo | First name small over the surname. |
| Positions | The seats he can play, for example `PG / SG`. |
| **3PT** die | Rolled when he shoots a three. |
| **DRIVE** die | Rolled when he drives, and on putbacks. |
| **PASS** die | Rolled when he passes. |
| **REB** die | Rolled in the board battle. |
| **DEF** die | Rolled when the player he guards shoots. |
| OFF stars, DEF stars | 1 to 5. A summary of the dice, nothing else. |
| OVR | One number, also just a summary of the dice. |
| Unique ability | Name plus one sentence of dice text. Every elite and star card has one. Role players have none or a small one. |
| Trait icons | Sniper, Slasher, Playmaker, Anchor, Stopper. Only used for the three team links. (Glue and Ball-Dominant are still in the data but no v3 rule reads them; drop them from the printed card.) |

How the summaries are worked out (so a new card can be rated by hand). Die steps: d4 = 1, d6 = 2, d8 = 3, d10 = 4, d12 = 5.

- **OFF stars**: take the steps of 3PT, DRIVE, PASS. Double the best, add the second best, divide by 3, round.
- **DEF stars**: double the DEF step, add the REB step, divide by 3, round.
- **OVR**: 59 + 3 x the best step of all five + 2 x the second best + the other three. Capped at 99.
- **Tier** (decides the deal, not printed): 3PT + DRIVE + DEF die sizes. 24 or more is a star; a star that owns a d12 among those three is elite; 18 to 22 is a starter; 16 or less is a role player.

All PASS and REB dice are new placeholder values for the designer to tune.

## Match flow

1. **Coin flip.** Winner drafts first. The other coach gets the first possession of the game.
2. **Deal the pool.** 18 cards face up: 3 elite, 5 star, 5 starter, 5 role.
3. **Draft.** One pick at a time, alternating, until each coach has 7. Four cards go unpicked.
4. **Opening lineups.** Each coach secretly lays five cards in seat order PG SG SF PF C. Reveal together. The other two are the bench.
5. **Deal hands.** Shuffle the play deck. Deal 4 cards each.
6. **Quarter 1.** 10 plays, alternating, 5 possessions each. The coach who drafted second has the ball first in quarters 1 and 3, the other coach in 2 and 4.
7. **Quarter break** (after quarters 1, 2 and 3). Clear the shot tokens. Both coaches secretly set their five for the next quarter (any of their seven, any seats) and reveal together. Then each draws 2 cards. You may never hold more than 6: if you would go over, draw fewer.
8. **After quarter 4.** Higher score wins. If it is tied, take one more break (set your five, no draw), then play **overtime**: one possession each, shot limits cleared before each pair. Still tied, play another pair straight away. Repeat until someone leads after a pair.

### Seats and matchups

- The player in your PG seat guards their PG seat, and so on down to C.
- **Out of position.** A player in a seat that is not printed on his card rolls at -1 on his shot and on his defence.

### Team links (chemistry)

Three bonuses that are on while the right pair is on the floor. The two players must be different cards.

| Link | You need on the floor | What it does |
| --- | --- | --- |
| Drive & Kick | a Slasher and a Sniper | +1 to your drives. |
| Pick & Roll | a Playmaker and a centre (a card whose main position is C) | Your passes are dimes on a 4 or higher. |
| Lockdown | a Stopper and an Anchor | +1 to your defence against drives. |

The older links that needed fractions (Spacing, Glue Guy, One Ball, the per-point team bonus) are cut.

## A possession, step by step

**1. Choose in secret.**

Offence puts down:
- the **shooter** (must be on the floor and must have taken fewer than 2 shots this quarter),
- **three** or **drive**,
- optionally a **passer** (any other teammate on the floor),
- optionally one **play card** from hand,
- optionally a **sub** (see Subs).

Defence puts down:
- one player on the other roster to **double-team**, or nobody,
- optionally one **defence card** from hand,
- optionally a sub.

**2. Reveal together.** Subs happen first, offence then defence. Then cards are shown. Scouting Report cancels the offence card. Timeout draws now.

**3. The pass** (only if a passer was named). The passer rolls his PASS die.
- **1**: stolen. His defender gets a steal, the passer a turnover, the possession is over.
- **5 or more**: a dime. The shooter adds **+2** to his shot.
- Anything else: the pass gets there. No bonus.

**4. The double team.**
- Doubled the shooter: the defence will add a **help d6**.
- Doubled anyone else (the passer, a decoy, a player who was just subbed out): the shooter has an **open look, +2**.
- Doubled nobody: nothing either way.

**5. The shot.**
- Offence rolls the shooter's **3PT** or **DRIVE** die and adds its bonuses.
- Defence rolls the matched defender's **DEF** die, plus the help d6 if it doubled the shooter, and adds its bonuses.
- **Long range:** the defence adds **+2 against every three**.
- **Offence must roll higher. Ties go to the defence.** A made three is 3 points, a made drive is 2.

**6. Stuffed.** If the defence wins by **5 or more**: on a drive it is a **block**, on a three it is a **steal**. Either way there is no rebound, the possession is over.

**7. The board battle** (on any other miss). Each side rolls the REB die of its best rebounder on the floor (biggest REB die; if tied, the bigger position). The defence adds **+2** for inside position. Offence must roll higher.
- Defence wins: its rebounder gets the rebound. Possession over.
- Offence wins: its rebounder gets an offensive rebound and takes one **putback** straight away: his DRIVE die against his own defender's DEF die, worth 2. No cards, no double team. A putback does not count against the two-shot limit. If the putback misses, the defence's best rebounder collects it (no roll) and the possession is over.

**Order when card text collides.** A Clamp stop beats an automatic make. An automatic make beats the totals. Otherwise compare totals.

**What stacks.** Everything. Bonuses are whole numbers and are simply added: open look +2, dime +2, a play card, an ability, a team link.

### Worked example

Offence floor: Curry (PG), Edwards (SG), Kawhi (SF), Giannis (PF), Embiid (C). Defence floor: Luka, SGA, Tatum, LeBron, Wembanyama.

Offence plays face down: **Giannis drives, Curry passes, Pick & Roll card.** Defence plays face down: **double Curry, Wall Up card.**

1. Flip. Pick & Roll: Giannis will add a d4. Wall Up: the defence will add a d4 because it is a drive.
2. The pass. Curry rolls his PASS d10 and gets a **7**. His team has the Pick & Roll link on (Curry is a Playmaker, Embiid is a centre), so 4 or more is a dime. Dime: Giannis gets +2.
3. The double team is on Curry, but Giannis is shooting. Wrong read: open look, +2.
4. The shot. Giannis rolls DRIVE d12 = **6** and the Pick & Roll d4 = **3**. Add +2 open look, +2 dime, +1 Drive & Kick (Edwards is a Slasher, Curry a Sniper). Offence total **14**.
5. LeBron guards the PF seat. He rolls DEF d8 = **7**, Wall Up d4 = **4**. Defence total **11**.
6. 14 beats 11. Two points for Giannis, assist for Curry. One shot token on Giannis.

Next time down the defence doubles Curry again and this time he shoots the three himself: 3PT d12 = **8** against Luka's DEF d4 = **3** plus help d6 = **4** plus 2 for long range = **9**. No good. Board battle: Embiid REB d12 = 5 against Wembanyama REB d12 = 9 plus 2. Wembanyama's rebound. Had Curry rolled a 10, Splash would have made it automatic.

## Subs and the usage rule

- **Two shots a quarter.** No player may be the shooter more than twice in a quarter. Putbacks are free. A shot he takes off a Kick Out or Catch & Shoot counts. A player at his limit can still pass, defend and rebound.
- **Quarter breaks.** Set any five of your seven, in any seats. Free.
- **During a quarter.** Each coach may make **one** substitution per quarter. Call it with your secret pick: name the player going out and the bench player coming in. He takes the same seat. It happens before anything is rolled, so the player coming in can be your shooter on that very play, and "on the play he is subbed in" abilities work.
- The defence can double-team a bench player if it thinks he is about to come in. If the player you doubled is subbed out on that play, it is a wrong read.
- In overtime the shot limit and the one sub are refreshed before each pair of possessions.

Why the bench matters: your best scorer is done after two shots, so a fresh shooter off the bench is two more good looks, and some cards only fire when they come in.

## The play deck (40 cards, shared)

Shuffle once. Deal 4 each. Draw 2 each at the three quarter breaks. Hand limit 6. At most one card per coach per possession, played face down with your pick. Played cards go to the discard pile whether or not they did anything.

| Card | Count | Who plays it | Text |
| --- | --- | --- | --- |
| Pick & Roll | 4 | Offence | Drive only. Roll a d4 with your DRIVE die and add it. |
| Off-Ball Screen | 4 | Offence | Three only. +2 to the shot. |
| Kick Out | 3 | Offence | If your shooter is double-teamed, the ball goes to your teammate with the biggest 3PT die for an open three (+2, no help die). Your first shooter gets the assist if it drops. |
| Fast Break | 3 | Offence | Ignore the double team this possession (no help die, no open look). +1 to the shot. |
| Alley-Oop | 2 | Offence | A pass into a drive only. If the pass is a dime, the drive is automatically in. |
| Heat Check | 2 | Offence | Only for a shooter who scored on your last possession. +3 to the shot. |
| Wall Up | 4 | Defence | Against a drive, roll a d4 with your DEF die and add it. |
| Closeout | 4 | Defence | Against a three, +2 to your defence. |
| Zone | 3 | Defence | If you double-teamed the wrong player, the shooter gets no open look bonus. |
| Pick Pocket | 3 | Defence | If they pass, the pass is stolen on a 1, 2 or 3. |
| Scouting Report | 2 | Defence | Cancel the play card the offence played this possession. |
| Crash the Glass | 4 | Either | If the shot misses, +3 to your rebound roll. |
| Timeout | 2 | Either | Draw 2 cards. |

18 offence, 16 defence, 6 either. Defence cards are guesses: Wall Up does nothing if they shoot a three. Offence cards with a condition (Pick & Roll, Off-Ball Screen, Alley-Oop, Heat Check) cannot be played unless your pick meets it.

Notes: the Kick Out target must have a shot left this quarter; with a tie on 3PT die the earlier seat gets it. A cancelled Timeout draws nothing.

## Every ability

"Natural" means the face showing on his own die, before any bonus.

### Elite and star cards

| Card | Ability | Text |
| --- | --- | --- |
| Stephen Curry | Splash | A natural 10, 11 or 12 on his 3PT die is automatically in. |
| Kevin Durant | Unguardable | A double team on him rolls a d4 help die instead of a d6. |
| Kawhi Leonard | The Klaw | If his DEF die shows the same number as the shooter's die, or one lower, it is an automatic stop: a block on a drive, a steal on a three. |
| Giannis Antetokounmpo | Freight Train | A natural 11 or 12 on his DRIVE die is automatically in. |
| Joel Embiid | Post Up | +2 on his drives when his defender's DEF die is a d8 or smaller. |
| Nikola Jokic | Hub | His dimes give the shooter +3 instead of +2. |
| Luka Doncic | Maestro | His passes are dimes on a 4 or higher. |
| Shai Gilgeous-Alexander | Isolation | +1 on his shot whenever he is not double-teamed. |
| Jayson Tatum | Tough Shot | If his 3PT die shows a 1 or 2, roll it again once. |
| Victor Wembanyama | Eraser | While he is on the floor, any drive against your team is blocked when your defence wins by 3 or more. He gets the block. |
| Anthony Edwards | Poster | A natural 10 on his DRIVE die is automatically in. |
| LeBron James | Momentum | +2 on his shot if your team scored on its last possession. |
| Anthony Davis | Back Line | Drives by the player he guards are blocked when he wins by 3 or more. |
| Ja Morant | Above the Rim | A natural 11 or 12 on his DRIVE die is automatically in. |
| Damian Lillard | Dame Time | +2 on his shots in the 4th quarter and overtime. |
| Devin Booker | In Rhythm | +2 on his shot if he made his last shot. |
| Donovan Mitchell | Takeover | +2 on his shot if he made his last shot. |
| Jalen Brunson | Clutch Gene | +2 on his shots in the 4th quarter and overtime. |
| Tyrese Haliburton | Table Setter | His passes are never stolen. |
| Jimmy Butler | Jump the Lane | Passes thrown by the player he guards are stolen on a 1 or 2. |
| Karl-Anthony Towns | Pick & Pop | +1 on his threes when a teammate passes him the ball. |
| Paolo Banchero | Mismatch | +2 on his drives when his defender's DEF die is a d8 or smaller. |
| Kyrie Irving | Handles | If his DRIVE die shows a 1 or 2, roll it again once. |
| James Harden | Step Back | If his 3PT die shows a 1 or 2, roll it again once. |
| Paul George | Smother | If his DEF die shows the same number as the shooter's die, it is an automatic stop. |
| Bam Adebayo | Glass Cleaner | +2 whenever he rolls for a rebound. |
| Pascal Siakam | Spin Cycle | If his DRIVE die shows a 1 or 2, roll it again once. |
| De'Aaron Fox | Fifth Gear | +1 on his drives whenever he is not double-teamed. |
| Tyrese Maxey | Heating Up | +2 on his shot if he made his last shot. |
| Trae Young | Lob Threat | His passes are dimes on a 4 or higher. |
| Jalen Williams | Back Cut | +1 on his drives when a teammate passes him the ball. |
| Cade Cunningham | Floor General | His passes are never stolen. |
| Chet Holmgren | Swat | Drives by the player he guards are blocked when he wins by 3 or more. |

There are 33 elite and star cards and 19 different mechanics, so some stars share a mechanic under their own name. Giving each a truly one-off rule is a design pass for the concept owner; the engine only needs a new entry per card.

### Role players with an ability

| Card | Ability | Text |
| --- | --- | --- |
| Klay Thompson | Catch & Shoot | On the play he is subbed in, his three is uncontested. While he is on the floor, if your shooter is double-teamed or blocked, Klay takes an uncontested three instead. |
| Rudy Gobert | Stifle Tower | +1 to your defence against drives while he is on the floor. |
| Jaren Jackson Jr. | Block Party | Drives by the player he guards are blocked when he wins by 3 or more. |
| Naz Reid | Sixth Man | +2 on his shot on the play he is subbed in. |
| Payton Pritchard | Spark | +2 on his shot on the play he is subbed in. |
| Holiday, White, Bridges, Anunoby, Caruso, Dort, H. Jones, Thybulle | Clamp | If his DEF die shows the same number as the shooter's die, it is an automatic stop: a block on a drive, a steal on a three. |

### Rulings

- **Uncontested** (Catch & Shoot): there is no defender. The defence rolls a plain **d4**, plus the usual 2 for long range. No help die, no defence card, no Clamp, and it cannot be stuffed.
- **Catch & Shoot, in full.** Three triggers. (a) Klay is subbed in on this play and shoots a three himself. (b) Klay is on the floor and the defence doubled your shooter: the shot goes to Klay instead, your first shooter gets the assist if it drops. (c) Klay is on the floor and your shooter's drive is blocked: Klay shoots straight after, no assist. Not if Klay has used his two shots. If you also played Kick Out, the Kick Out happens instead of (b).
- **Clamp** compares the two natural faces: the shooter's own die (after a reroll) and the defender's own DEF die. Help dice and bonuses do not matter.
- **Rerolls** are not a choice: a 1 or 2 is rolled again and the second roll stands.
- **"Not double-teamed"** means the help die is not being rolled against him. A wrong double still counts as not double-teamed.
- **Eraser** credits every blocked drive against his team to Wembanyama while he is on the floor.
- **Hot-hand abilities** look at the last shot that player took in this game, putbacks included.

## Stats

Write down only what happens.

| Stat | When |
| --- | --- |
| PTS | The shooter, 2 or 3, on every make. |
| REB | Whoever wins the board battle, and the defender who collects a missed putback. OREB when the offence wins it. |
| AST | The passer when his pass was a **dime** and the shot went in. Also the first shooter on a made Kick Out or a made Catch & Shoot off a double team. A pass that was not a dime is not an assist. |
| STL | The passer's defender when a pass is stolen. The shooter's defender when a three is stuffed by 5 or more, or stopped by Clamp. |
| BLK | The shooter's defender when a drive is stuffed (or stopped by Clamp). Wembanyama, if Eraser is on the floor. |
| TOV | The passer on a stolen pass, the shooter on a stolen three. |

Double-double and triple-double mean 10 or more in two or three of PTS, REB, AST, STL, BLK. They are flagged in the box score if they happen. See `numbers.md` for how often they do: with 20 possessions a side they are rare, and a triple-double did not happen once in 3,000 games.

## Online version: what is the same and what is not

- Same rules, same order of dice.
- Secret picks (shooter, shot, passer, card, sub, double team) are committed as a hash and revealed together, so neither player can change a pick after seeing the other's.
- Dice come from a seed made from both players' secret numbers, so neither can steer them.
- Lineups and quarter-break lineups are commit-reveal too.
- **Known gap:** the deck order is part of the shared match state, so both clients hold both hands. The UI must only show your own. A modified client could read the opponent's hand and the next draws. Fine for a friends beta; hiding it for real needs a different deal scheme.

---

# API for the UI

Everything is exported from `src/game/index.ts`. All state is plain JSON.

## Data

| Export | What |
| --- | --- |
| `ROSTER`, `getCard(id)`, `findCard(id)` | `Card { id, name, number, position, three, drive, pass, reb, def }` (die sizes 4 to 12). |
| `offStars(card)`, `defStars(card)`, `ovr(card)`, `cardTier(card)`, `dieStep(die)` | Derived ratings. |
| `positionsOf(id)`, `SLOTS`, `fitScore(id, slot)`, `seatByPosition(ids)` | Seats. |
| `abilityOf(id)` | `{ name, text, spec } \| null`. Show `name` and `text`. `ABILITIES` is the whole table. |
| `traitsOf(id)`, `teamChem(lineup)`, `CHEM_LINKS`, `hasLink` | Team links: `{ id, name, need, text }`. |
| `PLAY_CARDS`, `playCard(id)` | `{ id, name, side: 'offense' \| 'defense' \| 'either', count, text }`. |
| Constants | `TEAM_SIZE 5`, `ROSTER_SIZE 7`, `QUARTERS 4`, `POSSESSIONS_PER_SIDE 5`, `POSSESSIONS_PER_QUARTER 10`, `MAX_SHOTS_PER_QUARTER 2`, `SUBS_PER_QUARTER 1`, `STARTING_HAND 4`, `DRAW_PER_BREAK 2`, `HAND_LIMIT 6`, `HELP_DIE 6`, `OPEN_LOOK 2`, `LONG_RANGE 2`, `DIME_AT 5`, `DIME_BONUS 2`, `STEAL_AT 1`, `STUFF_MARGIN 5`, `BOX_OUT 2`, `UNCONTESTED_DIE 4`, `OUT_OF_POSITION -1`, `TOTAL_PICKS 14`, `POOL_SIZE 18`. |

## Match state

```ts
interface MatchState {
  version: 3
  seed: string
  phase: 'draft' | 'lineup' | 'play' | 'break' | 'gameover'   // 'coinflip' exists in the type for UI staging only
  firstDrafter: Seat
  draft: { available: string[]; picks: [string[], string[]]; pickNumber: number }  // picks = the 7-card rosters
  lineups: [string[], string[]] | null     // five on the floor per seat, index = PG SG SF PF C
  quarter: number                          // 1..4, 5+ = overtime pair. During 'break' it is the quarter just finished
  overtime: boolean
  possession: number                       // next possession index in this quarter
  possessionsInQuarter: number             // 10, or 2 in overtime
  shots: [Record<string, number>, Record<string, number>]   // shots taken this quarter
  subsUsed: [number, number]
  deck: PlayCardId[]                       // do not show
  hands: [PlayCardId[], PlayCardId[]]      // show only snapshot.me's hand
  discard: PlayCardId[]
  score: [number, number]
  history: PossessionResult[]
  winner: Seat | null
}
```

Selectors: `whoseDraftTurn`, `draftSeatAt`, `currentOffenseSeat`, `currentDefenseSeat`, `firstOffenseSeatOfQuarter`, `possessionsLeftInQuarter`, `rosterOf`, `benchOf`, `handOf`, `legalShooters`, `shotsLeft`, `legalDoubles`, `subsLeft`, `playableCards`, `matchupOf`, `slotOf`, `seatOfCard`, `lastResult`, `scoredLastPossession`, `madeLastShot`, `bestRebounder`, `isGameOver`, `boxScore`.

Validation for enabling buttons: `validateOffensePick(state, seat, pick)`, `validateDefensePick(state, seat, pick)`, `isLegalLineup(state, seat, order)`. Each returns `null` when legal, else a plain reason.

Preview for the "what is rolled against what" copy before committing:

```ts
previewShot(state, seat, offensePick, { doubleId?, defCard?, dime? }): ShotPlan | null
// ShotPlan: shooter, shot, defender | null, uncontested, doubled, open,
//           offDie, offBonusDie, defDie, helpDie, defBonusDie, mods: Modifier[],
//           autoMin, autoAll, autoLabel, rerollMax, clampRange, clampLabel, stuffMargin
previewPass(state, seat, passerId, defCard?): { die, stealAt, dimeAt, bonus } | null
shotOdds(plan): { make, stuffed }   // exact share of dice combinations. Optional hint only; the game never uses it.
```

## Actions (through a `Session`, `src/session`)

```ts
type PlayerAction =
  | { type: 'draftPick'; cardId: string }
  | { type: 'submitLineup'; order: string[] }        // five ids in seat order. Used in phase 'lineup' AND 'break'
  | { type: 'submitOffense'; shooterId: string; shot: 'THREE' | 'DRIVE';
      passerId?: string | null; cardId?: PlayCardId | null; sub?: { out: string; in: string } | null }
  | { type: 'submitDefense'; doubleId: string | null;
      cardId?: PlayCardId | null; sub?: { out: string; in: string } | null }
  | { type: 'requestRematch' }
```

`SessionSnapshot` is unchanged in shape: `me`, `names`, `connection`, `room`, `match`, `myPending { lineup, pick }`, `oppPending { lineup, pick }`, `rematch`. `pending.lineup` is true for the opening lineup and for each quarter break. `createBotSession` (local) and `createOnlineSession` (online) both speak this.

Engine events, if a screen drives the engine directly: `draftPick`, `lineupReveal { lineups }`, `quarterBreak { lineups }`, `possessionResolve { offensePick, defensePick, seed }`. `applyEvent`, `tryApplyEvent`, `validateEvent`, `replay`, `createMatch`. For table play or a pass-and-play mode with real dice: `resolvePossessionWithDice(state, offensePick, defensePick, faces[])`.

## The per-possession result

`state.history[n]`, also `lastResult(state)`.

```ts
interface PossessionResult {
  seq: number; quarter: number; index: number; overtime: boolean
  offenseSeat: Seat; defenseSeat: Seat
  picks: { offense: OffensePick; defense: DefensePick }      // exactly what was revealed
  subs: { seat: Seat; out: string; in: string; slot: number }[]
  floor: [string[], string[]]                                // who was on the floor (after subs)
  cards: { offense: PlayedCard | null; defense: PlayedCard | null }
  //        PlayedCard = { id, seat, status: 'played' | 'cancelled' | 'noEffect' }
  drawn: [PlayCardId[], PlayCardId[]]                        // Timeout draws
  doubleId: string | null
  pass: PassResult | null
  //        { passer, defender, receiver, roll: DieRoll, stealAt, dimeAt, stolen, dime, bonus }
  swing: { kind: 'kickout' | 'catchshoot'; from: string; to: string } | null
  shooter: string; shot: ShotType                            // who finally took the first shot
  contests: Contest[]                                        // every shot, in order
  rebounds: ReboundResult[]
  abilities: { cardId: string; name: string; text: string }[]   // abilities that came into play
  steps: RevealStep[]                                        // the ordered script, see below
  credits: StatCredit[]                                      // { cardId, seat, stat: 'PTS'|'REB'|'OREB'|'AST'|'STL'|'BLK'|'TOV', value }
  scored: boolean; points: number; scoreAfter: [number, number]
}

interface DieRoll {
  who: string | null        // card id of the roller; null for a team die (help d6, card d4, the open-shot d4)
  seat: Seat; side: 'off' | 'def'
  purpose: 'pass' | 'shot' | 'reroll' | 'bonus' | 'defense' | 'help' | 'rebound'
  die: 4 | 6 | 8 | 10 | 12
  face: number
  label: string             // "3PT d12", "DEF d8", "Help d6", "Pick & Roll d4", "Wall Up d4", "REB d10", "Open shot d4"
  discarded: boolean        // true for a shot die that was rerolled away
}

interface Modifier { side: 'off' | 'def'; label: string; value: number; source: 'rule' | 'card' | 'ability' | 'chem' }

interface Contest {
  kind: 'shot' | 'catchshoot' | 'putback'
  shooter: string; defender: string | null; shot: ShotType; slot: number
  doubled: boolean; open: boolean; uncontested: boolean
  dice: DieRoll[]           // in roll order: shot, (reroll), (card d4), DEF, (help), (card d4)
  mods: Modifier[]          // labelled whole numbers, e.g. Open look +2, Dime +2, Long range +2 (def)
  natural: number           // the face that counts on the shooter's own die
  offenseTotal: number; defenseTotal: number
  auto: { result: 'make' | 'stop'; label: string } | null    // "Splash", "Alley-Oop", "Clamp", "The Klaw"
  outcome: 'made' | 'missed' | 'blocked' | 'stolen'
  points: number
}

interface ReboundResult {
  contested: boolean        // false = the defence simply collects a missed putback
  offRebounder: string; defRebounder: string
  dice: DieRoll[]           // [offence REB, defence REB], empty when not contested
  mods: Modifier[]; offenseTotal: number; defenseTotal: number
  winner: 'off' | 'def'; rebounder: string
}

interface RevealStep {
  kind: 'sub' | 'card' | 'double' | 'pass' | 'swing' | 'shot' | 'rebound' | 'result'
  text: string              // plain-words copy for this beat
  seat: Seat
  rolls: DieRoll[]          // the dice that land on this beat, in order
  who?: string; card?: PlayCardId
  ref?: number              // index into contests (kind 'shot') or rebounds (kind 'rebound')
}
```

**To animate a possession:** walk `steps` in order. For each step show `text`, and tumble each die in `rolls` in order (colour by `side`: violet for `off`, cyan for `def`; grey out `discarded`). On a `shot` step, `contests[ref]` has the modifiers to count up and the totals. On the `result` step update the score from `scoreAfter`. Step order is always: subs, cards, pass, swing, double team, shot, (swing + extra shot for Catch & Shoot off a block), rebound, putback shot, second rebound, result. A stolen pass goes straight from `pass` to `result`.

Example `text` values produced by the engine:

- `Stephen Curry passes to Giannis Antetokounmpo and rolls his PASS d10: 7. A 1 is stolen, 4+ is a dime. A dime: +2 for Giannis Antetokounmpo.`
- `Double team on Stephen Curry. Wrong read: Giannis Antetokounmpo gets an open look (+2).`
- `Drive. Giannis Antetokounmpo rolls his DRIVE d12 plus a d4 against LeBron James's DEF d8 plus a d4. 14 against 11. Good for 2.`
- `Board battle. Joel Embiid rolls his REB d12 against Victor Wembanyama's REB d12 plus 2 for inside position. 5 against 11. Victor Wembanyama has it.`

The step text uses full names. If the reveal needs surnames only, build the line from the structured fields instead.

## Box score

`boxScore(state)` returns, per drafted card: `pts, reb, oreb, ast, stl, blk, tov, fgm, fga, tpm, tpa, possessions, doubleDouble, tripleDouble`.

## Bots

`botDraftPick`, `botLineup` (opening lineup and breaks), `botOffensePick`, `botDefensePick`, `botPossessionPick`, `draftValue`, `trackTendencies`. Baseline for testing: `randomOffensePick`, `randomDefensePick`, `randomLineup`.

## Removed from v2

`SIM_COUNT`, `setScoringMode`, the 1000-play scoring path, `matchupBoosts`, `matchupProbability`, `CHEM_PER_POINT`, `TeamChem.score/bonus`, `legalLocks`, `POSSESSIONS_PER_ROUND`, `REGULATION_ROUNDS`, `firstOffenseSeatOfRound`, `possessionsLeftInRound`, `state.round`, `state.used`, `state.suddenDeath`, `DefensePick.lockId`, and the flat fields on `PossessionResult` (`offenseRoll`, `defenseRoll`, `helpRoll`, `sims`, `makes`, `boosts`, `wasLocked`, `lockedId`, `defender`, `slot`). The screens under `src/ui` still use these and will not compile until they are moved to the shapes above.
