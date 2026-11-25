# ISO v2, design A: "GM FIRST"

The draft is most of the game. You build a five under a budget, chemistry and fit decide how good that five really is, and then the game is simulated over 100 possessions a side so luck washes out. Your only in-game input is one secret coaching call per quarter.

Every number below is implemented in `engine.ts` (constants in the `K` object) and was measured in `results.md`.

## The 60-second explanation (verbatim)

> You are the GM and the coach.
>
> Eighteen NBA players are dealt face up, each with a price. You and your opponent take turns picking until you each have five. You each have 17 dollars, so you cannot just buy the biggest names.
>
> Every card has three bars: Shoot, Rim and Defence. Players who fit together switch on chemistry links: a slasher with a shooter, a playmaker with a centre, a stopper with a rim protector. Every link makes your whole team better. Too many ball-dominant stars, or players out of position, cost you chemistry. Each card on the table tells you what it would do for your team right now, like "plus 3 chem, fills your centre slot".
>
> Then the game plays itself: four quarters, a hundred shots each. A better scorer against a worse defender means more buckets.
>
> Before each quarter you secretly choose two things. How you attack: threes, the rim, feed one player, or just move the ball. And what you take away: the three, the paint, or one of their players. Guess right and the quarter swings your way. Guess wrong and you have left something open.
>
> Most points after four quarters wins.

## The card

Four numbers, nothing else:

| shown | meaning | scale |
|---|---|---|
| SHOOT bar | how good his three-point shot is (`three`) | 4, 6, 8, 10, 12 shown as 1 to 5 segments |
| RIM bar | how good he is going to the basket (`drive`) | same |
| DEF bar | how well he guards (`def`) | same |
| Price | what he costs in the draft | 1 to 8 dollars (budget 17) |

Plus position (G, F or C), one or two trait tags, and on 13 top cards one named ability.

Traits (seven words, used only by the chemistry links): **Sniper, Slasher, Playmaker, Anchor, Stopper, Glue, Ball-Dominant**.

## Match flow (about 6 to 7 minutes)

1. **Deal** (seeded): 18 cards face up: 3 elite, 5 star, 5 starter, 5 role (tiers as in `roster.ts`), re-dealt until the table has at least 5 guards, 5 forwards and 3 centres.
2. **Coin flip** (seeded) for first pick.
3. **Draft**: public alternating picks in snake order A B B A A B B A A B, five each. About 20 seconds a pick, about 3.5 minutes.
4. **Four quarters**. Before each one both players secretly lock a call (commit-reveal), the calls are revealed, and the quarter is simulated and played back as a fast ticker with highlights. About 10 seconds to call and 30 seconds to watch, about 2.5 to 3 minutes for the game.
5. Most points wins. Ties go to overtime.

### Draft rules

- Budget: **17** each. A pick is legal if you can pay for it **and still have at least 1 dollar left for every slot you have yet to fill**.
- If no legal card is left for you, you get a **Walk-on** (all three bars at the minimum, free, fits any slot). It is the price of spending yourself down to 1 dollar a slot when no 1-dollar cards are left: measured at 0.03 per 100 rosters for a GM who plans his five, 3 to 8 per 100 for a drafter who always grabs the biggest name. It also means the draft can never get stuck.
- Your five are placed automatically into the lineup **G, G, F, F, C**. Players in their natural position go first; anyone left over fills the empty slots (highest DEF first, centre slot first) and counts as out of position.
- **Matchups are automatic**: within the guards, within the forwards, and at centre, your best defender guards their most dangerous scorer.

### What an undrafted card shows you

Each card on the table carries one line computed from your current roster (`draftHint()` in `engine.ts`):

- the chemistry change if you took it now, for example **+3 chem** or **-3 chem**
- which link it completes, for example "Drive & Kick"
- the fit: **fills your centre slot** / **fills your guard slot** / **fills your forward slot** / **out of position**

## Chemistry (six links plus fit)

Chemistry is one number per team.

| link | you need | chem |
|---|---|---|
| Drive & Kick | a Slasher and a Sniper | +3 |
| Pick & Roll | a Playmaker and a centre (two different players) | +3 |
| Lockdown | a Stopper and an Anchor | +3 |
| Spacing | three players with SHOOT at 3 segments or more (8+) | +3 |
| Glue Guy | at least one Glue player (only counts once) | +2 |
| One Ball | each Ball-Dominant player after your first | -3 each |
| Fit | each player out of position in the G, G, F, F, C lineup | -2 each |

Best possible is 14. Every chem point is worth **0.08 of a bar point on everything your team does**, on both ends: it is added to your shooter's SHOOT and RIM on offence and to your defender's DEF on defence. A 14-chem team therefore plays as if every bar were about 1.1 points higher (a bar segment is 2 points); in the simulation one chem point is worth roughly 1 point of final margin, so a fully linked five is about 13 points a game better than the same ratings with no links.

## The game

Each quarter is 25 possessions per team, alternating (100 per team per game, final scores look like real ones, about 105 to 110). Quarter 1 and 3 start with seat 0, quarters 2 and 4 with seat 1.

### One possession, exactly

1. **Who shoots.** Each of the five has a weight equal to (his better scoring bar) squared, so a 12 shoots more than an 8. A fed player's weight is tripled.
2. **Three or drive.** His share of threes is SHOOT² / (SHOOT² + RIM²), so players lean to what they are good at. *Let It Fly* adds 20 points of share, *Attack the Rim* removes 20 (kept between 5% and 95%).
3. **Does it go in.**
   - Three (3 points): chance = 35% + 2.5% × (S − D), kept between 8% and 65%
   - Drive (2 points): chance = 50% + 3% × (R − Dr), kept between 15% and 85%
   - S = shooter's SHOOT + chemistry bonus + modifiers
   - R = shooter's RIM + chemistry bonus + modifiers
   - D = his defender's DEF + the defence's chemistry bonus
   - Dr = 75% his defender's DEF + 25% the DEF of the defence's centre-slot player + the defence's chemistry bonus (the big man helps at the rim, which is why the centre slot matters)
   - chemistry bonus = chem × 0.08, or chem × 0.08 × 1.8 on the "play your game" calls below

There are no rebounds, fouls or turnovers. Three seeded random numbers per possession (who, which shot, make or miss), drawn from `rngFromSeed(seed + "|q" + quarter)`.

### Coaching calls (one secret pair per quarter)

Attack with one of:

| call | effect |
|---|---|
| **Move the Ball** | your chemistry counts 1.8 times on offence this quarter |
| **Let It Fly** | more threes (+20 share) and +1 SHOOT for everyone |
| **Attack the Rim** | more drives (−20 three share) and +1 RIM for everyone |
| **Feed [one of your five]** | he takes three times his usual share of the shots |

Take away one of:

| call | effect |
|---|---|
| **Straight Up** | your chemistry counts 1.8 times on defence this quarter |
| **Guard the Line** | their SHOOT −3, but their RIM +2 |
| **Protect the Paint** | their RIM −3, but their SHOOT +2 |
| **Shadow [one of their five]** | he gets −4 SHOOT and −4 RIM, everyone else gets +1.5 on both |

Every bold call has a call that punishes it (Let It Fly runs into Guard the Line, Feed runs into Shadow) and a call it punishes. The two plain calls are the safe ones and get stronger the more chemistry you drafted. Calls from earlier quarters are public, so you can read tendencies. The measured call-versus-call table is in `results.md`.

### Abilities (13 cards)

All are conditional: each needs a link you drafted, a call you made, or something about the opponent's roster.

| card | ability | text |
|---|---|---|
| Stephen Curry | Gravity | When you call Let It Fly, every teammate gets +2 SHOOT. |
| Damian Lillard | Closer | In the 4th quarter and overtime he gets +3 SHOOT. |
| Kawhi Leonard | Clamp | When you Shadow a player, that player loses 6 instead of 4. |
| Giannis Antetokounmpo | Runway | +2 RIM while your Spacing link is on. |
| Shai Gilgeous-Alexander | Isolation Artist | +2 RIM in any quarter you Feed him. |
| Victor Wembanyama | Eraser | When you call Protect the Paint, opponents lose 5 RIM instead of 3. |
| LeBron James | Point Forward | When you call Move the Ball, every teammate gets +1 SHOOT and +1 RIM. |
| Anthony Davis | Back Line | While your Lockdown link is on, opponents get −1.5 RIM. |
| Ja Morant | Above the Rim | +2 RIM when the other team's centre-slot player is not an Anchor. |
| Nikola Jokic | Hub | While your Drive & Kick link is on, every teammate gets +1 SHOOT and +1 RIM. |
| Kevin Durant | Co-Star | +2 SHOOT and +2 RIM in any quarter you Feed a teammate. |
| Luka Doncic | Maestro | In any quarter you Feed him, every teammate gets +2 SHOOT. |
| Joel Embiid | Post Up | +2 RIM when you call Attack the Rim. |

### Overtime and tie-break

Level after four quarters: play a 10-possession-each overtime with both players' 4th-quarter calls, up to three times. Still level (never seen in 80,000 mirror matches): higher chemistry wins, then the player who drafted second.

## Determinism and netcode

- The deal, the coin flip and every possession come from the shared match seed through the same `xmur3` + `mulberry32` generator as `src/game/prng.ts`.
- Draft picks are public and alternating. Quarter calls are simultaneous and secret (commit-reveal), four per match per player.
- Given the seed, the ten picks and the eight calls, `simulateMatch()` returns the same game on both clients.
- No stakes or real-money mechanics anywhere.

## Watching the game

The simulation is instant; the client plays each quarter back in about 30 seconds: a running score, and a handful of highlight beats chosen from the possession log (a made three by the fed player, a shadowed star getting stopped, any 8-0 run, lead changes, and the last three possessions of a one-score game). `play.ts` prints a text version: calls, quarter scores, biggest run, hot hands.

## All 66 cards

Bars are 1 to 5 segments (ratings 4 to 12). The same data, machine readable, is in `cards.json`.

| card | pos | price | SHOOT | RIM | DEF | traits | ability |
|---|---|---|---|---|---|---|---|
| Stephen Curry | G | $7 | █████ | ██░░░ | ██░░░ | Sniper, Playmaker | Gravity |
| Kevin Durant | F | $5 | ████░ | ████░ | ███░░ | Sniper | Co-Star |
| Kawhi Leonard | F | $6 | ███░░ | ███░░ | █████ | Stopper | Clamp |
| Giannis Antetokounmpo | F | $5 | █░░░░ | █████ | ████░ | Slasher, Ball-Dominant | Runway |
| Joel Embiid | C | $5 | █░░░░ | ████░ | ████░ | Anchor, Ball-Dominant | Post Up |
| Nikola Jokic | C | $4 | ███░░ | ████░ | ██░░░ | Playmaker | Hub |
| Luka Doncic | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant | Maestro |
| Shai Gilgeous-Alexander | G | $6 | ███░░ | █████ | ███░░ | Slasher, Ball-Dominant | Isolation Artist |
| Jayson Tatum | F | $5 | ████░ | ███░░ | ███░░ | Sniper |  |
| Victor Wembanyama | C | $8 | ██░░░ | ████░ | █████ | Anchor | Eraser |
| Anthony Edwards | G | $4 | ███░░ | ████░ | ███░░ | Slasher, Ball-Dominant |  |
| LeBron James | F | $6 | ██░░░ | █████ | ███░░ | Playmaker, Slasher | Point Forward |
| Anthony Davis | C | $8 | █░░░░ | ████░ | █████ | Anchor | Back Line |
| Ja Morant | G | $5 | ██░░░ | █████ | ██░░░ | Slasher, Ball-Dominant | Above the Rim |
| Damian Lillard | G | $4 | █████ | ███░░ | █░░░░ | Sniper, Ball-Dominant | Closer |
| Devin Booker | G | $3 | ████░ | ████░ | █░░░░ | Sniper, Ball-Dominant |  |
| Donovan Mitchell | G | $2 | ████░ | ████░ | █░░░░ | Slasher, Ball-Dominant |  |
| Jalen Brunson | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant |  |
| Tyrese Haliburton | G | $4 | ████░ | ███░░ | ██░░░ | Playmaker, Sniper |  |
| Jimmy Butler | F | $5 | ██░░░ | ████░ | ████░ | Slasher, Stopper |  |
| Karl-Anthony Towns | C | $3 | ████░ | ███░░ | ██░░░ | Sniper |  |
| Paolo Banchero | F | $3 | ██░░░ | ████░ | ███░░ | Slasher, Ball-Dominant |  |
| Kyrie Irving | G | $2 | ████░ | ████░ | █░░░░ | Slasher, Ball-Dominant |  |
| James Harden | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant |  |
| Paul George | F | $5 | ████░ | ███░░ | ███░░ | Sniper, Stopper |  |
| Bam Adebayo | C | $5 | █░░░░ | ████░ | ████░ | Anchor |  |
| Pascal Siakam | F | $3 | ██░░░ | ████░ | ███░░ | Slasher |  |
| De'Aaron Fox | G | $3 | ███░░ | ████░ | ██░░░ | Slasher |  |
| Tyrese Maxey | G | $3 | ████░ | ████░ | █░░░░ | Slasher, Sniper |  |
| Trae Young | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant |  |
| Jalen Williams | F | $4 | ███░░ | ████░ | ███░░ | Slasher |  |
| Cade Cunningham | G | $3 | ███░░ | ████░ | ██░░░ | Playmaker, Ball-Dominant |  |
| Chet Holmgren | C | $6 | ███░░ | ███░░ | ████░ | Anchor |  |
| Jrue Holiday | G | $4 | ███░░ | ██░░░ | ███░░ | Stopper, Glue |  |
| Derrick White | G | $3 | ███░░ | ██░░░ | ███░░ | Stopper |  |
| Mikal Bridges | F | $3 | ███░░ | ██░░░ | ███░░ | Stopper |  |
| OG Anunoby | F | $3 | ██░░░ | ██░░░ | ████░ | Stopper |  |
| Draymond Green | F | $4 | █░░░░ | ██░░░ | ████░ | Playmaker, Glue |  |
| Rudy Gobert | C | $6 | █░░░░ | ██░░░ | █████ | Anchor |  |
| Aaron Gordon | F | $3 | █░░░░ | ███░░ | ███░░ | Slasher, Glue |  |
| Klay Thompson | G | $3 | ████░ | █░░░░ | ██░░░ | Sniper |  |
| Austin Reaves | G | $1 | ███░░ | ███░░ | █░░░░ | Playmaker |  |
| Jamal Murray | G | $1 | ███░░ | ███░░ | █░░░░ | Playmaker |  |
| Kristaps Porzingis | C | $4 | ███░░ | ██░░░ | ███░░ | Anchor |  |
| Khris Middleton | F | $2 | ███░░ | ██░░░ | ██░░░ | Sniper |  |
| Jaren Jackson Jr. | F | $3 | ██░░░ | ██░░░ | ████░ | Anchor |  |
| CJ McCollum | G | $1 | ███░░ | ███░░ | █░░░░ | Sniper |  |
| DeMar DeRozan | F | $1 | █░░░░ | ████░ | ██░░░ | Slasher, Ball-Dominant |  |
| Franz Wagner | F | $2 | ██░░░ | ███░░ | ███░░ | Slasher |  |
| Alperen Sengun | C | $1 | █░░░░ | ███░░ | ██░░░ | Playmaker |  |
| Jarrett Allen | C | $4 | █░░░░ | ███░░ | ████░ | Anchor |  |
| Josh Hart | G | $1 | █░░░░ | ██░░░ | ██░░░ | Glue |  |
| Brook Lopez | C | $1 | ██░░░ | █░░░░ | ██░░░ | Anchor |  |
| Alex Caruso | G | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Luguentz Dort | G | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Kentavious Caldwell-Pope | G | $1 | ██░░░ | █░░░░ | ██░░░ | Glue |  |
| Herbert Jones | F | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Naz Reid | C | $1 | ██░░░ | ██░░░ | █░░░░ | Sniper |  |
| Bobby Portis | F | $1 | ██░░░ | ██░░░ | █░░░░ | Glue |  |
| T.J. McConnell | G | $1 | █░░░░ | ██░░░ | ██░░░ | Playmaker |  |
| Kevon Looney | C | $3 | █░░░░ | █░░░░ | ███░░ | Glue |  |
| Dorian Finney-Smith | F | $1 | ██░░░ | █░░░░ | ██░░░ | Glue |  |
| Payton Pritchard | G | $1 | ███░░ | █░░░░ | █░░░░ | Sniper |  |
| Max Strus | G | $1 | ███░░ | █░░░░ | █░░░░ | Sniper |  |
| Matisse Thybulle | G | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Kyle Kuzma | F | $1 | ██░░░ | ██░░░ | █░░░░ | Slasher |  |
