# Design B "Coach First": measured results

Requirement 1 passes for drafting and coaching together (78.5%) and for drafting alone with the better drafters
(70.1%). Coaching alone is worth 65 to 67%, which is under the 70% line on its own. Requirement 2 passes for
coaching calls, abilities and cards, with one caveat for drafting: a look-ahead drafter beats every one-line rule,
and nothing I built beats it. Details and the honest list of weaknesses are at the bottom.

All numbers below are bots playing bots. Nothing here has been played by a person.

Raw output of the final run is in `results-raw.txt`.

## How to reproduce

From the `iso-beta` folder. Every match uses a fixed seed (`<experiment>-<pairing>-<i>`), so reruns print the
same numbers. `node` (v23.6 or later) works in place of `npx tsx`.

```
npx tsx docs/v2/design-b/proto/experiments.ts all --procs 9       # everything below, about 10 minutes on 10 cores
npx tsx docs/v2/design-b/proto/experiments.ts req1     --n 20000  # requirement 1 table
npx tsx docs/v2/design-b/proto/experiments.ts drafters --n 4000   # draft-rule round robin
npx tsx docs/v2/design-b/proto/experiments.ts coaches  --n 4000   # coaching-habit round robin
npx tsx docs/v2/design-b/proto/experiments.ts cards    --n 20000  # per-card table
npx tsx docs/v2/design-b/proto/experiments.ts calls    --n 4000   # what good coaches actually call
npx tsx docs/v2/design-b/proto/experiments.ts game     --n 20000  # shape of a game
npx tsx docs/v2/design-b/proto/shape.ts                           # roster shape vs being read (exact, no randomness)
npx tsx docs/v2/design-b/proto/agree.ts 500                       # is the best drafter secretly one rule?
npx tsx docs/v2/design-b/proto/verify.ts 2000                     # determinism and rule checks
npx tsx docs/v2/design-b/proto/play.ts demo-3                     # one full match, printed
```

Any rule constant can be overridden for a run, for example `--set CAP=40,HELP=5`.

Files in `proto/`: `engine.ts` (the rules), `bots.ts` (drafters, coaches, match driver), `experiments.ts`,
`play.ts`, `verify.ts`, `shape.ts`, `agree.ts`, `prng.ts` (copy of the app's seeded RNG), and the balance tools
`cardvalue.ts`, `build-cards.ts`, `tune-costs.py`, `regress.ts` with their saved outputs `card-values.json` and
`cost-adj.json`.

## The bots

| Name | What it does |
|---|---|
| **TopRated** (naive drafter) | takes the card with the biggest three bars added together. Ignores chem and fit. |
| **FitSpread** (skilled drafter) | takes the card with the biggest "bars + chem hint", spending evenly. This is what the draft screen invites. |
| **FitStars** | same score, but buys the expensive cards first. |
| **Planner** (expert drafter) | for each candidate, plays out the rest of the draft for both sides and scores the two finished rosters with the run solver. Sees denial and budget shape. |
| **Hero** (naive coach) | same go-to every run (best scorer, his better shot), always helps on their best scorer, rests cheapest first. |
| **Mixer** | solves each run as a small matrix game and mixes its calls so they cannot be read. |
| **Reader** (skilled coach) | Mixer plus a tally of what the opponent has called so far, and leans into it. |

All drafters, including the naive one, budget sensibly, so nobody loses by going broke.

## Requirement 1: skill counts (20,000 matches per row)

| Matchup | A wins | 95% CI |
|---|---|---|
| **Skilled drafter + skilled coach vs naive** (FitSpread + Reader vs TopRated + Hero) | **78.5%** | ±0.6 |
| Expert vs naive (Planner + Reader vs TopRated + Hero) | 82.9% | ±0.5 |
| **Well-built roster vs best-ratings roster**, same coach (FitSpread vs TopRated, both Mixer) | **64.8%** | ±0.7 |
| Same, stars-first fit drafter (FitStars vs TopRated, both Mixer) | 70.1% | ±0.6 |
| Same, expert drafter (Planner vs TopRated, both Mixer) | 70.1% | ±0.6 |
| Well-built vs best-ratings, both coached naively (both Hero) | 61.0% | ±0.7 |
| Coaching only: same drafter, Reader vs Hero | 65.3% | ±0.7 |
| Coaching only: same drafter, Reader vs random tapper | 67.1% | ±0.7 |
| Expert drafter vs skilled drafter, same coach (Planner vs FitSpread, both Reader) | 72.6% | ±0.6 |
| **Identical rosters, identical coach** (Mixer both) | **50.3%** | ±0.7 |
| **Identical rosters, identical fixed calls** (Hero both) | **49.6%** | ±0.7 |
| Same strategy both seats, separate drafts (FitSpread + Mixer) | 49.6% | ±0.7 |

Read against the requirement:

- Clearly better drafter and coach beats naive at least 70%: **78.5%**, and 82.9% for the expert.
- Well-built roster beats best-individual-ratings roster most of the time: **64.8% to 70.1%** depending on how
  well it is built.
- Identical rosters and calls are a coin flip: **50.3% and 49.6%**.
- Drafting is the bigger lever (expert drafter over a merely good one: 72.6%), coaching is worth 65 to 67% on
  its own.

Rookies were handed out 89 times in 240,000 drafts in this table, always to a drafter squeezed by a
budget-hungry opponent.

## Requirement 2: no dominant strategy

### 2a. Ten draft strategies, round robin (4,000 matches per pairing, both sides coached by Mixer)

Row's win % against column.

| | TopRated | SpreadRated | Stoppers | ChemOnly | FitShoot | FitDrive | FitDefend | FitSpread | FitStars | Planner | avg |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **TopRated** (biggest bars) | - | 53 | 43 | 37 | 38 | 41 | 34 | 37 | 30 | 29 | 38.1 |
| **SpreadRated** (biggest bars, even spend) | 47 | - | 36 | 35 | 39 | 40 | 31 | 34 | 29 | 24 | 34.9 |
| **Stoppers** (Defence only) | 57 | 64 | - | 43 | 45 | 47 | 40 | 42 | 36 | 32 | 45.2 |
| **ChemOnly** (biggest chem hint) | 63 | 65 | 57 | - | 54 | 56 | 50 | 48 | 46 | 34 | 52.6 |
| **FitShoot** (fit, leaning Outside) | 62 | 61 | 55 | 46 | - | 54 | 46 | 47 | 42 | 31 | 49.3 |
| **FitDrive** (fit, leaning Inside) | 59 | 60 | 53 | 44 | 46 | - | 44 | 44 | 40 | 29 | 46.7 |
| **FitDefend** (fit, leaning Defence) | 66 | 69 | 60 | 50 | 54 | 56 | - | 50 | 46 | 35 | 53.8 |
| **FitSpread** (bars + chem, even spend) | 63 | 66 | 58 | 52 | 53 | 56 | 50 | - | 46 | 28 | 52.5 |
| **FitStars** (bars + chem, stars first) | 70 | 71 | 64 | 54 | 58 | 60 | 54 | 54 | - | 43 | 58.7 |
| **Planner** (look-ahead) | 71 | 76 | 68 | 66 | 69 | 71 | 65 | 72 | 57 | - | 68.2 |

What this shows, plainly:

- "Always take the highest total" is the second-worst strategy (38%). "Always take the best chem" is mid-table
  (53%) and loses 34 to 66 to the Planner. "Always take Defence" loses to every fit-aware drafter.
- The best one-line rule is FitStars. It beats every other one-line rule (54 to 71%) and loses 43 to 57 to the
  Planner.
- The Planner beats all nine. It is not a rule: it searches, and its answer depends on what the opponent has
  taken. It makes the same pick as the best one-line rule only 30% of the time, the same pick as any of the nine
  rules 56% of the time, takes the most expensive affordable card 23% of the time, and opens with an elite card
  24% of the time (`agree.ts`, 6,000 picks).
- I could not build anything that beats the Planner, so I cannot show a rock-paper-scissors cycle at the top.
  What I can show is that the best play is not any fixed recipe.

### 2b. Ten coaching styles, round robin (4,000 matches per pairing, identical rosters both sides)

The six "Always" and "Star" rows are a Mixer with one habit frozen.

| | Random | Hero | AlwaysInside | AlwaysOutside | AlwaysPaint | AlwaysArc | StarGoTo | HelpStar | Mixer | Reader | avg |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Random** | - | 36 | 38 | 45 | 37 | 37 | 47 | 36 | 38 | 33 | 38.4 |
| **Hero** | 64 | - | 56 | 50 | 43 | 55 | 65 | 38 | 47 | 33 | 50.0 |
| **AlwaysInside** | 62 | 44 | - | 51 | 36 | 58 | 55 | 48 | 45 | 39 | 48.7 |
| **AlwaysOutside** | 55 | 50 | 49 | - | 53 | 34 | 53 | 45 | 43 | 37 | 46.6 |
| **AlwaysPaint** | 63 | 57 | 64 | 47 | - | 50 | 58 | 53 | 51 | 45 | 54.2 |
| **AlwaysArc** | 63 | 45 | 42 | 66 | 50 | - | 59 | 51 | 49 | 40 | 51.7 |
| **StarGoTo** (always feature the best scorer) | 53 | 35 | 45 | 47 | 42 | 41 | - | 33 | 40 | 36 | 41.1 |
| **HelpStar** (always help on their best scorer) | 64 | 62 | 52 | 55 | 47 | 49 | 67 | - | 47 | 46 | 54.5 |
| **Mixer** | 62 | 53 | 55 | 57 | 49 | 51 | 60 | 53 | - | 51 | 54.6 |
| **Reader** | 67 | 67 | 61 | 63 | 55 | 60 | 64 | 54 | 49 | - | 60.2 |

- Every frozen habit has a clear counter: AlwaysInside loses 36 to 64 to AlwaysPaint, AlwaysOutside loses 34 to
  66 to AlwaysArc, StarGoTo loses 33 to 67 to HelpStar, and every habit loses to the Reader (46 or lower).
- The two safest habits are Pack the Paint (54.2% average) and Help on the star (54.5%). Both still lose to a
  coach who notices.
- Reader and Mixer are level with each other (49 to 51), which is what should happen between two coaches who
  cannot be read.

### 2c. What good coaches actually call (two Mixers, 48,280 team-runs)

- Go-to is the floor's best scorer 32.6% of the time, second-best 26.3%, third 20.9%, fourth 13.0%, fifth 7.2%.
- Go-to attacks Inside 48.8%, Outside 51.2%.
- Pack the Paint 61.0%, Guard the Arc 39.0%. The coverage matched the go-to's shot 48.2% of the time.
- Help landed on the go-to 37.6%, on another player 50.6%, on someone resting 11.8%.

No call is used all the time and none is never used.

### 2d. The reads depend on how the roster is built (`shape.ts`, exact values, no randomness)

Five made-up offences with the same total of scoring bars, against the same plain defence.

| Offence | points per run if the defence guesses blindly | if the defence plays its best | lost to being read | options kept alive | top option share |
|---|---|---|---|---|---|
| One star, inside only (12 + four 6s) | 8.10 | 7.04 | **1.06** | 1 | 100% |
| Two stars, inside only (10, 10, 6, 6, 4) | 7.74 | 7.04 | 0.70 | 2 | 50% |
| Balanced, inside only (8, 8, 8, 6, 6) | 7.38 | 6.80 | 0.58 | 3 | 34% |
| Balanced, inside + outside (8, 8, 8, 6, 6) | 7.35 | 7.15 | **0.20** | 4 | 26% |
| One two-way star (12/12 + four 6s) | 8.08 | 7.48 | 0.60 | 2 | 50% |

A one-star, one-dimensional team is the best offence on paper and loses a full point a run once the defence
reads it. The balanced inside-and-outside team is the worst on paper and the best once both coaches are
thinking. In real drafted rosters the effect is smaller, because the cap and chem already push everyone toward
similar shapes: help found the go-to 39.7% of the time against top-heavy floors and 36.8% against balanced ones.

### 2e. No card or ability wins by itself (20,000 Planner-vs-Planner matches)

"Owner wins" is how often the player who drafted the card won. 50% means the card is fairly priced.

| Elite card | cost | drafted when dealt | owner wins |
|---|---|---|---|
| Victor Wembanyama (No-Fly Zone) | 13 | 96.5% | 56.2% |
| Anthony Davis (Rim Runner) | 13 | 83.2% | 53.1% |
| Giannis Antetokounmpo (Downhill) | 12 | 87.0% | 51.3% |
| Damian Lillard (Late Clock) | 6 | 73.5% | 50.9% |
| Ja Morant (Fast Break) | 9 | 85.8% | 50.3% |
| Stephen Curry (Gravity) | 11 | 88.7% | 50.1% |
| Kawhi Leonard (Clamp) | 9 | 94.6% | 49.9% |
| Shai Gilgeous-Alexander (Wrong-Foot) | 10 | 90.7% | 49.6% |
| LeBron James (Floor General) | 9 | 82.2% | 48.5% |

Across all 66 cards the owner's win rate runs from 46.1% (Kyle Kuzma) to 56.2% (Wembanyama). 59 of 66 sit
between 47% and 53%. The full table is in `results-raw.txt`.

## Shape of a game (20,000 matches, two skilled players)

- Average final score 51 points a team, average margin 10.
- Decided by 5 or fewer: 32.5%. By 20 or more: 12.5%. Overtime: 3.3%.
- Team trailing after run 3 came back to win: 22.8%.
- The team whose calls earned more expected points won 62.3% of the time. That is the luck left in one game
  between equals.
- Every match in `verify.ts` (2,000) replays identically from seed plus recorded choices.

## What I changed along the way

Early passes used 1,000 matches per pairing, so those figures are rougher than the final ones.

1. **First version failed requirement 2 twice.** Chasing the chem number alone tied the best drafter I had
   (about 63% average), and "never send help" was the best coaching habit (55% average, even against the
   Reader).
2. **Cost by total rating was wrong.** A Defence point is worth about 0.09 points a run, a point on a player's
   better scoring bar about 0.06, a point on his other scoring bar about 0.01 (`regress.ts`). Cost is now
   fitted to measured value, then nudged card by card.
3. **Chem was too strong** at one bar point per 10 chem. Settled on one per 15.
4. **"Stay home" removed.** Help is now always sent at someone, worth +4, with no penalty elsewhere. The read is
   who, not whether.
5. **Traits got a job in the run:** Anchors strengthen Pack the Paint, Lockdowns strengthen Guard the Arc.
6. **One Ball relaxed** from "every Alpha after the first, -6" to "every Alpha after the second, -8". Under the
   old rule Curry, Kawhi and LeBron were trap cards (owners won 43 to 47%).
7. **Cap raised from 36 to 42.** At 36 the elite cards were being left on the table (Curry drafted 37% of the
   time, Kawhi 24 to 42%).
8. **Big men trimmed.** Every link is now +4, No-Fly Zone went from +2 to +1, Rim Runner from +3 to +2, and
   Davis lost his Roller tag. Before that, Wembanyama, Davis and Adebayo owners were winning 55 to 57%.
9. **Planner added** as the expert drafter, because my first analytic drafter only tied chem-chasing.
10. **Tried and rejected:** matching up by rank instead of by position (the fifth-best scorer became the go-to
    as often as the best), and "half man, half team" defence (small gain, one more formula). Both are still
    switches in `CFG`.

## Weaknesses and things I could not verify

1. **No human has played it.** The 60-second explanation, the 6 to 7 minute match length and the "two taps"
   claim are designed, not tested. Win rates are bot against bot, and a real "good" player may sit anywhere
   between FitSpread and Planner.
2. **Coaching alone does not reach 70%** (65 to 67%). The 70% line is cleared by drafting plus coaching, or by
   drafting alone with FitStars or Planner. The plain hint-follower (FitSpread) is at 64.8% on drafting alone.
3. **The Planner is unbeaten.** It is a search, not a rule, but I have no strategy that beats it, so "no dominant
   strategy" is shown for one-line rules and for calls, not proven for all possible play.
4. **Wembanyama is the closest thing to an auto-pick:** drafted 96.5% of the time he is dealt, owner wins 56.2%,
   already at the maximum cost of 13.
5. **Star guards are cheap and that will look wrong.** Jokic, Doncic, Cunningham and Young cost 3; Booker,
   Brunson and Irving cost 4. The placeholder ratings give them Defence 4, the lowest there is, and the engine
   lets the offence attack the weakest defender four times a run. Raising their Defence to 6 would fix the look
   without touching the rules, but every cost must then be refitted.
6. **Costs are fitted to the placeholder ratings and to my own Planner.** Any ratings change means rerunning
   `cardvalue.ts`, `build-cards.ts` and `tune-costs.py`. A stronger drafter than the Planner might find
   mispriced cards I did not. The saved `cost-adj.json` is the result of several tuning passes made while the
   rules were still moving, so the exact file is not regenerated by one command.
7. **Role players get the ball.** Under best play the fourth or fifth scorer is the go-to 20% of the time,
   because the defence's best stopper takes the star. That is sound basketball and may still feel odd.
8. **The rest call is thin.** It matters (help lands on a resting player 11.8% of the time, abilities switch
   off, Lillard should rest early), but the bots pick it almost at random and I did not measure whether good
   rest timing wins games.
9. **The Mixer is not perfectly unreadable.** It guesses which opposing player is resting rather than solving
   that hidden information exactly.
10. **One game is still swingy.** Between equals the better-called side wins 62%, one game in eight is a
    blowout, and one comeback in four or five.
11. **Slight edge to drafting second** in some rows (first drafter won 47.6% to 48.5% in three of the
    twelve rows, 49.2% to 50.8% in the rest).
12. **Scores look like 51 to 43,** not like an NBA final score.
13. **`roster.ts` has 66 cards, not 65.** All 66 are in `cards.json`.
14. **Abilities exist only on the nine elite cards.** Stars such as Jokic, Doncic and Durant have none.
15. **Pack the Paint is the safer coverage** (called 61% of the time by good coaches, 54% average as a frozen
    habit). It is not dominant, but it is the default a lazy player will learn.
16. **No UI was built.** The "grey out picks that would strand you" behaviour exists only as the bots' budgeting
    rule. The engine itself allows any affordable pick and hands out a Rookie if you get stuck.
