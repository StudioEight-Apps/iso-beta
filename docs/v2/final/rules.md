# ISO v2: final rules

You draft a five under a budget. Chemistry and fit decide how good that five really is. Then the game is
simulated over 100 possessions a side, and your only in-game input is one secret pair of coaching calls per quarter.

This is design A ("GM first") with four changes made by the judge, listed at the bottom. Every rule below is
implemented in `iso2.ts` (constants in the `K` object) and measured in `results.md`.

## The 60-second explanation (verbatim, 156 words)

> You are the GM, then the coach.
>
> Eighteen NBA players are dealt, each with a price. You and your opponent take turns picking five each. You get 17 dollars, so you can't just buy the biggest names.
>
> Every card has three bars: Shoot, Rim and Defence. Players who fit together switch on chemistry: a slasher with a shooter, a playmaker with a centre, a stopper with a rim protector. Each link makes your whole team better. Too many ball-dominant stars, or players out of position, cost you. Every card shows what it would do for your team, like "plus 3 chem, fills your centre spot".
>
> Then the game plays itself. Before each of four quarters you secretly pick how to attack (threes, the rim, feed one player, or move the ball) and what to take away (the three, the paint, or one of their players). Guess right and the quarter tilts your way.
>
> Most points wins.

## 1. The card

Four numbers, nothing else:

| Shown | Meaning | Scale |
|---|---|---|
| SHOOT bar | three-point shooting (`three`) | ratings 4, 6, 8, 10, 12 drawn as 1 to 5 segments |
| RIM bar | scoring at the basket (`drive`) | same |
| DEF bar | defence (`def`) | same |
| Price | draft cost | 1 to 9 dollars |

Plus the position letter (G, F, C), one or two trait tags, and on 13 cards one named ability.

Traits (seven words): **Sniper, Slasher, Playmaker, Anchor, Stopper, Glue, Ball-Dominant**. Traits do one job:
they switch chemistry links on or off. They have no other effect.

Tiers are the ones in `roster.ts`: elite (total 24+ and a 12 somewhere), star (total 24+), starter (18 to 22),
role (16 or less). Tiers are only used to build the deal; they are not shown.

## 2. Match flow (about 6.5 minutes)

| Step | What happens | Time |
|---|---|---|
| Deal | 18 cards face up: 3 elite, 5 star, 5 starter, 5 role, shuffled by the match seed and re-dealt until the table has at least 5 guards, 5 forwards and 3 centres | instant |
| Coin flip | the seed picks who drafts first | instant |
| Draft | 10 public alternating picks in snake order **A B B A A B B A A B**, five each | 20 s a pick, about 3.5 min |
| Lineup | your five are placed automatically and the matchups are shown | 10 s |
| Four quarters | both players secretly lock one pair of calls (commit-reveal), the calls flip over, the quarter is simulated and played back | 15 s to call + 30 s to watch, about 3 min |
| Result | most points wins; ties go to overtime | |

### Draft rules

- Budget: **$17** each. Eight cards are left undrafted.
- A pick is legal if you can pay for it **and still have $1 left for every slot you have yet to fill**.
- If no legal card is left when it is your turn you receive a free **Walk-on** (SHOOT 4, RIM 4, DEF 4, no traits, fits any slot). This only happens to a player who spends down to $1 a slot after the $1 cards are gone.
- Lineup slots are **G, G, F, F, C**. Placement is automatic (`assignSlots`):
  1. your two most dangerous guards (higher of SHOOT and RIM) take the guard slots, your two most dangerous forwards the forward slots, your best-DEF centre the centre slot;
  2. anyone left over fills the empty slots in the order C, F, F, G, G, highest DEF first, and counts as **out of position**.
- Matchups are automatic (`buildTeam`): among the two guard slots, the better defender guards the more dangerous scorer; the same among the two forward slots; centre slot guards centre slot.

### What every undrafted card shows

One line, computed for your roster as it stands (`draftHint`):

- the chem change if you took it now: `+3 chem`, `+0 chem`, `-3 chem`
- the fit: `fills your guard slot` / `fills your forward slot` / `fills your centre slot` / `out of position`
- on tap: the link it would switch on ("Drive & Kick", "Lockdown", ...) or the penalty it would trigger ("One Ball")

## 3. Chemistry (six links plus fit)

Chemistry is one whole number per team, fixed when the draft ends.

| Link | You need in your five | Chem |
|---|---|---|
| **Drive & Kick** | a Slasher and a Sniper | +3 |
| **Pick & Roll** | a Playmaker and a centre (two different players) | +3 |
| **Lockdown** | a Stopper and an Anchor | +3 |
| **Spacing** | three players with SHOOT at 3 segments or more (rating 8+) | +3 |
| **Glue Guy** | at least one Glue player (counts once) | +2 |
| **One Ball** | each Ball-Dominant player after your first | -3 each |
| **Fit** | each player out of position | -2 each |

Maximum 14. Each link is on or off; a second Slasher adds nothing. (Exact edge case: a player who carries both
tags of a link switches it on by himself. Only Tyrese Maxey, Slasher + Sniper, does this.)

**What chem does.** Chem bonus = chem x **0.08** bar points. It is added to SHOOT and RIM for every shot your
team takes and subtracted from every shot the other team takes. One chem point is worth about one point of
final margin, so a fully linked five is about 14 points a game better than the same players with no links.

## 4. The game

Four quarters. Each quarter is 25 possessions per team, alternating (seat 0 has the ball first in quarters 1
and 3, seat 1 in quarters 2 and 4). 100 possessions a side, final scores around 105 to 110.

### Coaching calls: one secret pair per quarter

**Attack** with one of:

| Call | Effect this quarter |
|---|---|
| **Move the Ball** | your chem bonus counts 1.8 times on offence |
| **Let It Fly** | +20 points of three-point share for everyone, and +1 SHOOT |
| **Attack the Rim** | -20 points of three-point share for everyone, and +1 RIM |
| **Feed [one of your five]** | he takes 3 times his usual share of the shots |

**Take away** one of:

| Call | Effect this quarter |
|---|---|
| **Straight Up** | your chem bonus counts 1.8 times on defence |
| **Guard the Line** | their SHOOT -3, their RIM +2 |
| **Protect the Paint** | their RIM -3, their SHOOT +2 |
| **Shadow [one of their five]** | he gets -4 SHOOT and -4 RIM, each of his teammates gets +1.5 on both |

Calls from earlier quarters are public once revealed. If a player's clock runs out the missing half defaults to
Move the Ball / Straight Up.

### One possession, exactly

Three seeded random numbers per possession, in this order: who shoots, which shot, make or miss. The stream for
a period is `rngFromSeed(seed + "|q" + quarterNumber)` (overtime: `seed + "|ot" + n`).

1. **Who shoots.** Each player's weight is (the higher of his SHOOT and RIM ratings) squared. A fed player's weight is multiplied by 3. The shooter is drawn in proportion to weight.
2. **Three or drive.** His three-point share is SHOOT² / (SHOOT² + RIM²), plus 0.20 under Let It Fly, minus 0.20 under Attack the Rim, kept between 0.05 and 0.95.
3. **Make or miss.**

```
S     = SHOOT + offence chem bonus + modifiers
R     = RIM   + offence chem bonus + modifiers
Guard = 4 + DEF / 2                     (a defender's DEF counts half: 4 -> 6, 8 -> 8, 12 -> 10)
D3    = Guard(his defender)                                   + defence chem bonus
D2    = 0.65 x Guard(his defender) + 0.35 x Guard(their centre-slot player) + defence chem bonus

Three (3 points): make chance = 35% + 2.5% x (S - D3)     kept between 8% and 65%
Drive (2 points): make chance = 50% + 3.0% x (R - D2)     kept between 15% and 85%

chem bonus = chem x 0.08          (x 1.8 for the offence on Move the Ball, for the defence on Straight Up)
```

Modifiers are the call effects above and the abilities below, all simple additions to S or R. Who shoots and
the base three-point share always use the printed ratings, never the modified ones. There are no rebounds,
fouls or turnovers.

### Abilities (13 cards)

Every ability needs a link you drafted, a call you make, or something about the opponent's five. None is
unconditional and none removes an option from the opponent.

| Card | Ability | Exact effect | Needs |
|---|---|---|---|
| Stephen Curry | **Gravity** | Every teammate gets +2 SHOOT | you call Let It Fly |
| LeBron James | **Point Forward** | Every teammate gets +1 SHOOT and +1 RIM | you call Move the Ball |
| Joel Embiid | **Post Up** | He gets +2 RIM | you call Attack the Rim |
| Shai Gilgeous-Alexander | **Isolation Artist** | He gets +2 RIM | you Feed him |
| Luka Doncic | **Maestro** | Every teammate gets +2 SHOOT | you Feed him |
| Kevin Durant | **Co-Star** | He gets +2 SHOOT and +2 RIM | you Feed a teammate |
| Damian Lillard | **Closer** | He gets +3 SHOOT | you Feed him in the 4th quarter or overtime |
| Kawhi Leonard | **Clamp** | The shadowed player loses 6 instead of 4 | you call Shadow |
| Victor Wembanyama | **Eraser** | Opponents lose 5 RIM instead of 3 | you call Protect the Paint |
| Giannis Antetokounmpo | **Runway** | He gets +2 RIM | your Spacing link is on |
| Nikola Jokic | **Hub** | Every teammate gets +1 SHOOT and +1 RIM | your Drive & Kick link is on |
| Anthony Davis | **Back Line** | Opponents get -1.5 RIM | your Lockdown link is on |
| Ja Morant | **Above the Rim** | He gets +2 RIM | the other team's centre-slot player is not an Anchor |

### Overtime and tie-break

Level after four quarters: play a 10-possession-each overtime using both players' 4th-quarter calls (seat 0
first in odd overtimes), up to three times. Still level: higher chem wins, then the player who drafted second.

## 5. Determinism and netcode

- Deal: `rngFromSeed(seed + "|pool")`. Coin flip: `rngFromSeed(seed + "|coinflip")`. Possessions: per period as above. Same generator as `src/game/prng.ts` (xmur3 hash into mulberry32).
- Draft picks are public and alternating. Quarter calls are simultaneous and secret (commit-reveal), four per player. A call is `{ off: 0..7, def: 0..7 }`: 0 = Move the Ball / Straight Up, 1 = Let It Fly / Guard the Line, 2 = Attack the Rim / Protect the Paint, 3 to 7 = Feed / Shadow the player in lineup slot 0 to 4 (G, G, F, F, C).
- `simulateFromIds(seed, [idsA, idsB], calls, secondDrafter)` returns the final score, quarter scores and the full possession log (quarter, seat, shooter slot, defender slot, shot type, make chance, made, points, running score). Both clients get the same result.
- No stakes, no currency outside the $17 draft budget.

## 6. All constants (`K` in `iso2.ts`)

| Constant | Value | Constant | Value |
|---|---|---|---|
| Budget | 17 | Team size | 5 |
| Deal | 3 elite, 5 star, 5 starter, 5 role | Deal minimums | 5 G, 5 F, 3 C |
| Possessions per quarter, per team | 25 | Quarters | 4 |
| Overtime possessions per team | 10 | Maximum overtimes | 3 |
| Link | +3 | Glue Guy | +2 |
| One Ball | -3 each | Out of position | -2 each |
| Chem to bar points | 0.08 | Move the Ball / Straight Up multiplier | 1.8 |
| DEF weight | 0.5 (Guard = 4 + DEF / 2) | Centre's share of rim defence | 0.35 |
| Three: base, slope, floor, ceiling | 35%, 2.5%, 8%, 65% | Drive: base, slope, floor, ceiling | 50%, 3%, 15%, 85% |
| Let It Fly / Attack the Rim share shift | 0.20 | Their bar bonus | +1 |
| Feed multiplier | 3 | Shadow / everyone else | -4 / +1.5 |
| Guard the Line, Protect the Paint | -3 on the covered shot | Conceded on the other shot | +2 |

## 7. What changed from design A, and why

1. **DEF counts half on any one shot (Guard = 4 + DEF / 2).** In design A (and B) a point of DEF was worth about twice a point of SHOOT or RIM, because a defender is in every shot his man takes and a scorer uses one bar at a time. Five 6/6/12 players beat every other shape with the same rating totals by 5 to 23 points per 100 possessions, and Luka cost $3. With the half weight the three bars are worth about the same, a balanced five is the best shape (measured in `results.md`), and prices read more like an NBA fan expects.
2. **Prices recalibrated in two passes**, the second one new: after pricing by measured worth and pick rate (`calibrate.ts`), prices are nudged by results (`calibrate2.ts`): a card whose owner wins more than 54% of skilled-versus-skilled games gets dearer, under 46% cheaper. Design A tuned to pick rate only and left Wembanyama (43.8%) and Morant (42.6%) as traps. Price range is now $1 to $9.
3. **Lillard's Closer needs a call.** It was "+3 SHOOT in the 4th quarter", which is always on. It is now "+3 SHOOT when you Feed him in the 4th quarter or overtime", which the opponent can anticipate with Shadow.
4. **The 60-second explanation was cut from 198 words to 156**, and the rules text now matches the code (design A's rules said the centre supplies 25% of rim defence; its engine and all its measurements used 35%).

Taken from design B: the finding that DEF was mispriced, the "your call was worth +2 points" read-out after each
quarter and the caption style for highlights (`screens.md`), and greying out picks that would strand you.
Not taken: the six-man roster with a rest call, and per-run go-to and help calls (five taps, six times a match).
They add 30 decisions and one more hidden-information layer for a game that measured as more luck-driven.

## 8. All 66 cards

`roster.ts` holds 66 cards, not 65; all 66 are here and in `cards.json`. Bars are 1 to 5 segments (ratings 4 to 12).

| Card | Pos | Price | SHOOT | RIM | DEF | Traits | Ability |
|---|---|---|---|---|---|---|---|
| Stephen Curry | G | $9 | █████ | ██░░░ | ██░░░ | Sniper, Playmaker | Gravity |
| Kevin Durant | F | $6 | ████░ | ████░ | ███░░ | Sniper | Co-Star |
| Kawhi Leonard | F | $7 | ███░░ | ███░░ | █████ | Stopper | Clamp |
| Giannis Antetokounmpo | F | $5 | █░░░░ | █████ | ████░ | Slasher, Ball-Dominant | Runway |
| Joel Embiid | C | $3 | █░░░░ | ████░ | ████░ | Anchor, Ball-Dominant | Post Up |
| Nikola Jokic | C | $6 | ███░░ | ████░ | ██░░░ | Playmaker | Hub |
| Luka Doncic | G | $4 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant | Maestro |
| Shai Gilgeous-Alexander | G | $6 | ███░░ | █████ | ███░░ | Slasher, Ball-Dominant | Isolation Artist |
| Jayson Tatum | F | $5 | ████░ | ███░░ | ███░░ | Sniper |  |
| Victor Wembanyama | C | $7 | ██░░░ | ████░ | █████ | Anchor | Eraser |
| Anthony Edwards | G | $3 | ███░░ | ████░ | ███░░ | Slasher, Ball-Dominant |  |
| LeBron James | F | $7 | ██░░░ | █████ | ███░░ | Playmaker, Slasher | Point Forward |
| Anthony Davis | C | $8 | █░░░░ | ████░ | █████ | Anchor | Back Line |
| Ja Morant | G | $4 | ██░░░ | █████ | ██░░░ | Slasher, Ball-Dominant | Above the Rim |
| Damian Lillard | G | $5 | █████ | ███░░ | █░░░░ | Sniper, Ball-Dominant | Closer |
| Devin Booker | G | $2 | ████░ | ████░ | █░░░░ | Sniper, Ball-Dominant |  |
| Donovan Mitchell | G | $2 | ████░ | ████░ | █░░░░ | Slasher, Ball-Dominant |  |
| Jalen Brunson | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant |  |
| Tyrese Haliburton | G | $5 | ████░ | ███░░ | ██░░░ | Playmaker, Sniper |  |
| Jimmy Butler | F | $4 | ██░░░ | ████░ | ████░ | Slasher, Stopper |  |
| Karl-Anthony Towns | C | $3 | ████░ | ███░░ | ██░░░ | Sniper |  |
| Paolo Banchero | F | $3 | ██░░░ | ████░ | ███░░ | Slasher, Ball-Dominant |  |
| Kyrie Irving | G | $3 | ████░ | ████░ | █░░░░ | Slasher, Ball-Dominant |  |
| James Harden | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant |  |
| Paul George | F | $6 | ████░ | ███░░ | ███░░ | Sniper, Stopper |  |
| Bam Adebayo | C | $4 | █░░░░ | ████░ | ████░ | Anchor |  |
| Pascal Siakam | F | $2 | ██░░░ | ████░ | ███░░ | Slasher |  |
| De'Aaron Fox | G | $3 | ███░░ | ████░ | ██░░░ | Slasher |  |
| Tyrese Maxey | G | $4 | ████░ | ████░ | █░░░░ | Slasher, Sniper |  |
| Trae Young | G | $3 | ████░ | ████░ | █░░░░ | Playmaker, Ball-Dominant |  |
| Jalen Williams | F | $4 | ███░░ | ████░ | ███░░ | Slasher |  |
| Cade Cunningham | G | $3 | ███░░ | ████░ | ██░░░ | Playmaker, Ball-Dominant |  |
| Chet Holmgren | C | $5 | ███░░ | ███░░ | ████░ | Anchor |  |
| Jrue Holiday | G | $5 | ███░░ | ██░░░ | ███░░ | Stopper, Glue |  |
| Derrick White | G | $4 | ███░░ | ██░░░ | ███░░ | Stopper |  |
| Mikal Bridges | F | $4 | ███░░ | ██░░░ | ███░░ | Stopper |  |
| OG Anunoby | F | $3 | ██░░░ | ██░░░ | ████░ | Stopper |  |
| Draymond Green | F | $3 | █░░░░ | ██░░░ | ████░ | Playmaker, Glue |  |
| Rudy Gobert | C | $4 | █░░░░ | ██░░░ | █████ | Anchor |  |
| Aaron Gordon | F | $2 | █░░░░ | ███░░ | ███░░ | Slasher, Glue |  |
| Klay Thompson | G | $5 | ████░ | █░░░░ | ██░░░ | Sniper |  |
| Austin Reaves | G | $2 | ███░░ | ███░░ | █░░░░ | Playmaker |  |
| Jamal Murray | G | $2 | ███░░ | ███░░ | █░░░░ | Playmaker |  |
| Kristaps Porzingis | C | $4 | ███░░ | ██░░░ | ███░░ | Anchor |  |
| Khris Middleton | F | $3 | ███░░ | ██░░░ | ██░░░ | Sniper |  |
| Jaren Jackson Jr. | F | $2 | ██░░░ | ██░░░ | ████░ | Anchor |  |
| CJ McCollum | G | $2 | ███░░ | ███░░ | █░░░░ | Sniper |  |
| DeMar DeRozan | F | $1 | █░░░░ | ████░ | ██░░░ | Slasher, Ball-Dominant |  |
| Franz Wagner | F | $1 | ██░░░ | ███░░ | ███░░ | Slasher |  |
| Alperen Sengun | C | $1 | █░░░░ | ███░░ | ██░░░ | Playmaker |  |
| Jarrett Allen | C | $3 | █░░░░ | ███░░ | ████░ | Anchor |  |
| Josh Hart | G | $1 | █░░░░ | ██░░░ | ██░░░ | Glue |  |
| Brook Lopez | C | $1 | ██░░░ | █░░░░ | ██░░░ | Anchor |  |
| Alex Caruso | G | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Luguentz Dort | G | $1 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Kentavious Caldwell-Pope | G | $1 | ██░░░ | █░░░░ | ██░░░ | Glue |  |
| Herbert Jones | F | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Naz Reid | C | $1 | ██░░░ | ██░░░ | █░░░░ | Sniper |  |
| Bobby Portis | F | $1 | ██░░░ | ██░░░ | █░░░░ | Glue |  |
| T.J. McConnell | G | $1 | █░░░░ | ██░░░ | ██░░░ | Playmaker |  |
| Kevon Looney | C | $2 | █░░░░ | █░░░░ | ███░░ | Glue |  |
| Dorian Finney-Smith | F | $1 | ██░░░ | █░░░░ | ██░░░ | Glue |  |
| Payton Pritchard | G | $1 | ███░░ | █░░░░ | █░░░░ | Sniper |  |
| Max Strus | G | $1 | ███░░ | █░░░░ | █░░░░ | Sniper |  |
| Matisse Thybulle | G | $2 | █░░░░ | █░░░░ | ███░░ | Stopper |  |
| Kyle Kuzma | F | $1 | ██░░░ | ██░░░ | █░░░░ | Slasher |  |
