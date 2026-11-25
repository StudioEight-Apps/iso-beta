# ISO v2 final: measured results

Everything here was measured on the final rules (`rules.md`, `iso2.ts`, `cards.json`) after the judge's changes,
not copied from the two designs. All of it is bots playing bots. **No person has played this game.**

A win rate from 20,000 matches carries about ±0.7 points of sampling noise; 6,000 matches about ±1.3; 4,000 about ±1.5.

## Verdict against the hard requirements

| # | Requirement | Measured on the final rules | Met? |
|---|---|---|---|
| 1a | Clearly better drafter/coach beats a naive one at least 70% | 86.0% to 89.6% for the planning GM against four kinds of naive opponent. 80.9% to 82.7% for a player who only reads the card and its hint line and notices the opponent's habits (20,000 each) | Yes |
| 1b | Well-built roster beats "best individual ratings, no fit" most of the time | 75.8% with the same sharp coach on both sides, 86.1% with the same plain coach; 75.2% against "always take the highest total". The hint-reader's roster wins 77.1% and 73.2% (20,000 each) | Yes |
| 1c | Identical rosters, identical calls: about 50/50 | 49.9%, 50.2%, 50.0%, 50.2% for seat 0 (4 x 20,000). Two equal full players: 49.95% | Yes |
| 2 | No dominant draft rule | "Highest total" averages 40.9% and wins 25.6% against the planning GM. Every one-bar rule (shooters, rim, defence) averages 31% to 36%. Ten degenerate drafts I tried win 5% to 38% against the planning GM | Yes for simple rules. **No rock-paper-scissors at the top**: see weakness 3 |
| 2 | No dominant coaching call | Every call spammed all game loses to the unreadable coach (43% to 46%) and badly to a coach who notices (32% to 37%). One call is the best reply to everything in 2% of pairings on offence, 0.6% on defence | Yes |
| 2 | No dominant card or ability | Owner's win rate runs 46.1% to 55.6% for every card drafted at least 25% of the time. Drafting every ability card you can wins 34.5% against the planning GM. Always making the call that fires your abilities: 49.8% against the unreadable coach, 37.3% against one who notices | Yes, with Curry at the edge (55.6% at the price cap) |
| 3 | Explainable in 60 seconds | 156 words, no dice, no formulas | Written. **Not tested on a person** |
| 4 | At most 4 numbers per card | 3 bars + price. 1 or 2 traits. 13 abilities, each tied to a call, a link or the opponent's centre | Yes |
| 5 | Chemistry and fit legible while drafting | `draftHint()` returns "+3 chem, fills your centre slot" for every undrafted card. Six links plus fit | Logic yes. **No UI built** |
| 6 | Two players, deterministic, 5 to 8 minutes | Replays possession for possession from seed + choices (`selftest.ts`). 10 public picks, 4 commit-reveals each. About 6.5 minutes by the clocks in `rules.md` | Deterministic: yes. **Length untested** |
| 7 | All cards filled | `roster.ts` holds 66 cards, not 65. All 66 have price, tier, traits; 13 have abilities | Yes |
| 8 | No stakes | None | Yes |

## How to reproduce

From the `iso-beta` folder. Needs Node 23.6 or newer (run here on Node 25.9; `npx tsx` 4.23 was also checked on
`selftest.ts` and `play.ts`). Seeds are fixed strings, so a re-run prints the same numbers.

```sh
cd docs/v2/final
node selftest.ts                       # ids match roster.ts, determinism, legal drafts, chem examples
node play.ts demo builder sharp hints reader   # one match in text: seed, drafterA, coachA, drafterB, coachB
sh run_all.sh 20000 6000 4000          # everything below; 28 minutes on a busy 10-core laptop; writes out/report.md
# or one at a time:
node experiments.ts mirror 20000
node experiments.ts skill 20000        # add 0/6 .. 5/6 to split across six workers
node experiments.ts tournament 6000
node experiments.ts coaches 20000
node experiments.ts calls 4000
node experiments.ts cards 20000
node adv.ts draft 4000                 # degenerate drafts
node adv.ts coach 4000                 # call spam, ability spam
node adv.ts shape                      # roster shapes with equal rating totals (exact, no randomness)
node report.ts > out/report.md         # tables from out/*.jsonl
# prices (rewrites costs.json and cards.json):
node calibrate.ts 1500 7 && node gen_cards.ts && node calibrate2.ts 8000 4 9 && node calibrate2.ts 16000 3 9 53.5 46.5
```

Files: `iso2.ts` (the reference implementation, one module), `cards.json`, `bots.ts` (drafters and coaches used
for measuring), `match.ts`, `experiments.ts`, `adv.ts`, `report.ts`, `calibrate.ts`, `calibrate2.ts`,
`gen_cards.ts`, `play.ts`, `selftest.ts`, `run_all.sh`. Raw output: `out/*.jsonl`, `out/adv.*.txt`, `out/report.md`.

## Who the bots are

Drafters: **random**; **bigNames** (highest rating total it can afford, every pick: "always take the highest
total"); **ratings** (plans the five with the highest rating total the budget buys: "best individual ratings, no
fit"); **shooters / bullies / stoppers** (plan for one bar only); **chemistry** (most chem, ratings as
tie-break); **hints** (new: reads each card's bars and hint line, adds them up, spends evenly, plans nothing;
my stand-in for a casual player who has understood the 60-second explanation); **heliocentric** (takes the best
ability star first, then builds round him); **builder** (the planning GM: scores whole fives on ratings,
chemistry and fit); **counter** (builder, scored against the five the opponent is actually drafting).

Coaches: **plain** (Move the Ball + Straight Up every quarter); **random**; **fly / rim / star / flyPaint /
rimLine** (the same bold pair every quarter); **greedy** (best reply to a plain opponent, every quarter);
**reader** (assumes you repeat last quarter and plays the best reply); **sharp** (mixes calls in the proportions
that cannot be exploited for these two rosters).

## Measured tables (final rules, from `out/report.md`)

### Mirror: identical rosters, identical calls

| calls (both sides) | matches | seat 0 win % | overtime % | decided by tie-break % |
|---|---|---|---|---|
| plain | 20000 | 49.92 | 2.43 | 0 |
| star | 20000 | 50.2 | 2.31 | 0 |
| fly | 20000 | 50 | 2.29 | 0 |
| rim | 20000 | 50.16 | 2.47 | 0 |

### Skill duels

| duel (A vs B) | matches | A win % | avg margin | avg score | chem A v B | OT % |
|---|---|---|---|---|---|---|
| 1a hint-reader (no planning) + reader coach vs big-names drafter + plain calls | 20000 | 80.92 | 16.44 | 107.9 | 8.71 v 2.09 | 1.55 |
| 1a hint-reader (no planning) + reader coach vs big-names drafter + star-ball calls | 20000 | 82.68 | 17.06 | 107.5 | 8.71 v 2 | 1.33 |
| 1a skilled GM + sharp coach vs best-ratings drafter + plain calls | 20000 | 88.01 | 23.41 | 110 | 10.56 v -1.22 | 0.99 |
| 1a skilled GM + sharp coach vs big-names drafter + plain calls | 20000 | 85.99 | 20.39 | 108.2 | 10.72 v 1.72 | 1.24 |
| 1a skilled GM + sharp coach vs big-names drafter + random calls | 20000 | 87.79 | 21.46 | 108.4 | 10.71 v 1.68 | 1.18 |
| 1a skilled GM + sharp coach vs random picks + random calls | 20000 | 89.62 | 23.64 | 108.6 | 10.27 v 2.94 | 0.93 |
| 1b roster only: built roster vs best-ratings roster (both plain coaches) | 20000 | 86.07 | 20.88 | 110.6 | 10.55 v -1.22 | 1.28 |
| 1b roster only: built roster vs best-ratings roster (both sharp coaches) | 20000 | 75.8 | 12.78 | 110.2 | 10.53 v -1.21 | 1.57 |
| 1b roster only: built roster vs big-names roster (both sharp coaches) | 20000 | 75.17 | 12.52 | 107.6 | 10.75 v 1.67 | 1.75 |
| 1b roster only: hint-reader roster vs best-ratings roster (both plain coaches) | 20000 | 77.11 | 14.24 | 110.2 | 9.05 v -0.82 | 1.41 |
| 1b roster only: hint-reader roster vs big-names roster (both plain coaches) | 20000 | 73.18 | 11.45 | 108.1 | 8.74 v 2.06 | 1.71 |
| coach only: same GM skill, reader coach vs always-feed-and-shadow-the-star | 20000 | 71.44 | 10.23 | 108.8 | 9.87 v 9.91 | 1.9 |
| coach only: same GM skill, reader coach vs plain coach | 20000 | 58.98 | 4.13 | 109.7 | 9.87 v 9.9 | 2 |
| coach only: same GM skill, sharp coach vs always-feed-and-shadow-the-star | 20000 | 59.9 | 4.56 | 109.6 | 9.93 v 9.9 | 2.29 |
| coach only: same GM skill, sharp coach vs plain coach | 20000 | 54.02 | 1.87 | 109.5 | 9.89 v 9.89 | 2.02 |
| coach only: same GM skill, sharp coach vs random coach | 20000 | 69.09 | 9.11 | 110.2 | 9.9 v 9.9 | 1.93 |
| counter-drafting GM vs skilled GM (both sharp) | 20000 | 50.91 | 0.49 | 109.5 | 9.76 v 9.89 | 2.23 |
| gradient: skilled GM vs hint-reader (both sharp coaches) | 20000 | 64.6 | 6.49 | 109.1 | 10.02 v 7.86 | 1.98 |
| two equal skilled players (sanity) | 20000 | 49.95 | -0.1 | 109.3 | 9.9 v 9.89 | 2.12 |

### Draft-strategy round robin, all with the sharp coach (row's win % against column, 6000 matches per cell)

|  | bigNames | ratings | heliocentric | stoppers | chemistry | bullies | shooters | builder | hints | counter | average |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **bigNames** | - | 51.13 | 28.07 | 58.02 | 28.72 | 62.08 | 54.32 | 25.62 | 35.33 | 24.42 | 40.9 |
| **ratings** | 48.87 | - | 27.55 | 52.15 | 28.8 | 62.97 | 54.12 | 23.38 | 35.65 | 25.2 | 39.9 |
| **heliocentric** | 71.93 | 72.45 | - | 75.12 | 48.72 | 78.2 | 74.5 | 46.5 | 61.48 | 46.28 | 63.9 |
| **stoppers** | 41.98 | 47.85 | 24.88 | - | 24.57 | 56.07 | 52.97 | 20.73 | 33.85 | 20.13 | 35.9 |
| **chemistry** | 71.28 | 71.2 | 51.28 | 75.43 | - | 77.97 | 71.38 | 47.72 | 61.43 | 46.4 | 63.8 |
| **bullies** | 37.92 | 37.03 | 21.8 | 43.93 | 22.03 | - | 48.57 | 18.43 | 29.23 | 17.43 | 30.7 |
| **shooters** | 45.68 | 45.88 | 25.5 | 47.03 | 28.62 | 51.43 | - | 24.58 | 33.42 | 24.38 | 36.3 |
| **builder** | 74.38 | 76.62 | 53.5 | 79.27 | 52.28 | 81.57 | 75.42 | - | 63.78 | 48.42 | 67.2 |
| **hints** | 64.67 | 64.35 | 38.52 | 66.15 | 38.57 | 70.77 | 66.58 | 36.22 | - | 34.42 | 53.4 |
| **counter** | 75.58 | 74.8 | 53.72 | 79.87 | 53.6 | 82.57 | 75.62 | 51.58 | 65.58 | - | 68.1 |

### Coaching round robin on the same skilled-GM rosters (row's win % against column, 20000 matches per cell)

|  | plain | fly | star | rimLine | greedy | sharp | rim | flyPaint | random | reader | average |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **plain** | - | 52.72 | 54.12 | 54.34 | 39.15 | 45.79 | 49.62 | 48.97 | 65.91 | 41.02 | 50.2 |
| **fly** | 47.28 | - | 51.23 | 24.15 | 42.55 | 45.17 | 49.02 | 72.36 | 63.16 | 28.59 | 47.1 |
| **star** | 45.88 | 48.77 | - | 50.28 | 39.76 | 39.88 | 45.8 | 44.3 | 61.95 | 27.75 | 44.9 |
| **rimLine** | 45.66 | 75.85 | 49.72 | - | 34.08 | 43.8 | 19.33 | 44.87 | 62.66 | 24.25 | 44.5 |
| **greedy** | 60.85 | 57.45 | 60.24 | 65.92 | - | 48.88 | 63.87 | 55.99 | 74.46 | 39.06 | 58.5 |
| **sharp** | 54.21 | 54.83 | 60.12 | 56.2 | 51.12 | - | 56.84 | 55.5 | 69.27 | 51.7 | 56.6 |
| **rim** | 50.38 | 50.98 | 54.2 | 80.67 | 36.13 | 43.16 | - | 22.37 | 65.44 | 27.16 | 47.8 |
| **flyPaint** | 51.03 | 27.64 | 55.7 | 55.13 | 44.01 | 44.5 | 77.63 | - | 65.78 | 30.84 | 50.3 |
| **random** | 34.09 | 36.84 | 38.05 | 37.34 | 25.54 | 30.73 | 34.56 | 34.22 | - | 30.52 | 33.5 |
| **reader** | 58.98 | 71.41 | 72.25 | 75.75 | 60.94 | 48.3 | 72.84 | 69.16 | 69.48 | - | 66.6 |

### Call versus call: points per 100 possessions for the offence, relative to Move the Ball vs Straight Up (exact expectation, 8000 offence-v-defence pairings)

| offence \ defence | Straight Up | Guard the Line | Protect the Paint | Shadow top scorer | Shadow someone else |
|---|---|---|---|---|---|
| **Move the Ball** | 0 | 1.3 | -0.5 | 2.4 | 7.9 |
| **Let It Fly** | 0 | -5.3 | 6.5 | 2.5 | 8.2 |
| **Attack the Rim** | -0.6 | 6.8 | -7.6 | 1.7 | 7 |
| **Feed top scorer** | 0.3 | 1.8 | -0.3 | -7 | 10.6 |
| **Feed someone else** | -6.1 | -4.9 | -6.5 | -0.8 | 1.1 |

|  | Move the Ball | Let It Fly | Attack the Rim | Feed top scorer | Feed someone else |
|---|---|---|---|---|---|
| unexploitable offence mix | 0.345 | 0.296 | 0.178 | 0.122 | 0.059 |
| share of best replies | 0.102 | 0.26 | 0.203 | 0.349 | 0.086 |

|  | Straight Up | Guard the Line | Protect the Paint | Shadow top scorer | Shadow someone else |
|---|---|---|---|---|---|
| unexploitable defence mix | 0.389 | 0.239 | 0.234 | 0.125 | 0.013 |
| share of best replies | 0.122 | 0.237 | 0.344 | 0.129 | 0.167 |

- pairings where one offensive call is the best reply to every defensive call: 2%
- pairings where one defensive call is the best reply to every offensive call: 0.6%
- pairings where a fixed pair of calls is stable (no guessing needed): 13.1%
- average gain from correctly reading an opponent who always plays plain: 2 (on defence) / 2.6 (on offence) points per 100 possessions

### Cards: skilled GM vs skilled GM, 20000 matches (budget 17)

first drafter wins 51.59% | average score 109.3 | overtime 2.27% | median margin 12 | decided by 5 or fewer: 23.6%

| card | price | ability | times dealt | picked % | first pick % | win % when picked |
|---|---|---|---|---|---|---|
| towns | 3 |  | 4548 | 88.8 | 47.3 | 46.4 |
| jwill | 4 |  | 4484 | 88.7 | 39.7 | 49.2 |
| wemby | 7 | Eraser | 7257 | 84.2 | 48.4 | 46.2 |
| maxey | 4 |  | 3734 | 82.7 | 32 | 51.1 |
| siakam | 2 |  | 4429 | 82.6 | 33.8 | 48.8 |
| gobert | 4 |  | 5959 | 81.8 | 24.9 | 51.3 |
| holmgren | 5 |  | 4549 | 81.7 | 21.1 | 52.6 |
| dgreen | 3 |  | 5817 | 80.8 | 12.8 | 50.9 |
| booker | 2 |  | 3927 | 80.3 | 30.8 | 49.2 |
| tatum | 5 |  | 4393 | 79.9 | 31.2 | 49.2 |
| butler | 4 |  | 4377 | 79.5 | 29.6 | 50.9 |
| george | 6 |  | 4453 | 79 | 30.1 | 48.5 |
| haliburton | 5 |  | 3885 | 78.9 | 24.2 | 51.8 |
| morant | 4 | Above the Rim | 6094 | 78.5 | 25.9 | 46.6 |
| gordon | 2 |  | 5924 | 77.8 | 12.2 | 51.6 |
| dort | 1 |  | 6136 | 76.4 | 8.2 | 51.7 |
| mitchell | 2 |  | 3937 | 75.6 | 23.6 | 50.1 |
| reaves | 2 |  | 4925 | 73 | 6.4 | 50.8 |
| murray | 2 |  | 4952 | 72.8 | 6.4 | 49.7 |
| adebayo | 4 |  | 4674 | 72.3 | 18.6 | 48.4 |
| fox | 3 |  | 3787 | 71.7 | 17.4 | 51 |
| durant | 6 | Co-Star | 4524 | 70.2 | 20.8 | 49.4 |
| harden | 3 |  | 3868 | 69.8 | 15.3 | 49.9 |
| wagner | 1 |  | 5811 | 69.7 | 14.7 | 50.4 |
| brunson | 3 |  | 3893 | 69.6 | 15.3 | 49.9 |
| young | 3 |  | 3801 | 68.3 | 15.1 | 50.3 |
| allen | 3 |  | 5868 | 68.3 | 13.8 | 52.1 |
| pritchard | 1 |  | 6236 | 68.2 | 4.6 | 51.4 |
| strus | 1 |  | 6122 | 67.8 | 4.4 | 50.9 |
| dfs | 1 |  | 6925 | 67.2 | 1.3 | 51.4 |
| embiid | 3 | Post Up | 4509 | 66.8 | 18.7 | 49.5 |
| lebron | 7 | Point Forward | 7083 | 65.9 | 14.8 | 49.8 |
| lillard | 5 | Closer | 5991 | 64 | 18.2 | 53.3 |
| bridges | 4 |  | 5768 | 63.4 | 4.8 | 50 |
| hjones | 2 |  | 7105 | 63 | 3.5 | 51 |
| jjj | 2 |  | 5880 | 62.2 | 6.3 | 49.2 |
| anunoby | 3 |  | 5764 | 60.1 | 6 | 48.7 |
| luka | 4 | Maestro | 3782 | 56.8 | 8.1 | 49.7 |
| porzingis | 4 |  | 5867 | 56.6 | 9.2 | 51.9 |
| ant | 3 |  | 3919 | 56.5 | 10.3 | 50.5 |
| looney | 2 |  | 7360 | 51.7 | 8.5 | 51.3 |
| middleton | 3 |  | 5859 | 48.2 | 1.8 | 50.1 |
| cunningham | 3 |  | 3799 | 46.6 | 7.9 | 48.5 |
| giannis | 5 | Runway | 7160 | 45.8 | 3.1 | 49.5 |
| mccollum | 2 |  | 4975 | 45.1 | 2.8 | 47.7 |
| irving | 3 |  | 3773 | 43.3 | 7.3 | 46.8 |
| portis | 1 |  | 7045 | 41.7 | 1.7 | 49.9 |
| curry | 9 | Gravity | 6006 | 41.2 | 8.6 | 55.6 |
| caruso | 2 |  | 6291 | 40.4 | 1.1 | 48.3 |
| thybulle | 2 |  | 6271 | 39.7 | 0.8 | 50.8 |
| kcp | 1 |  | 6292 | 39.2 | 0.2 | 48.5 |
| white | 4 |  | 4983 | 37.5 | 0.6 | 49.7 |
| sga | 6 | Isolation Artist | 6111 | 37.2 | 5.6 | 50.6 |
| mcconnell | 1 |  | 6320 | 35.2 | 1.4 | 46.1 |
| holiday | 5 |  | 4975 | 34.7 | 0.6 | 52.5 |
| hart | 1 |  | 6369 | 30.5 | 0.6 | 46.8 |
| jokic | 6 | Hub | 4582 | 29.9 | 1.1 | 49.9 |
| davis | 8 | Back Line | 7206 | 29.7 | 5.1 | 51 |
| lopez | 1 |  | 7181 | 29.4 | 3.7 | 52.3 |
| kawhi | 7 | Clamp | 7092 | 27.8 | 3 | 50.6 |
| klay | 5 |  | 5027 | 24.6 | 1 | 48.8 |
| derozan | 1 |  | 5731 | 24.4 | 1.1 | 50.6 |
| kuzma | 1 |  | 7123 | 19.2 | 1 | 49.3 |
| sengun | 1 |  | 5915 | 17.1 | 1.3 | 43.9 |
| banchero | 3 |  | 4373 | 12.2 | 0.3 | 50.1 |
| reid | 1 |  | 7224 | 4.9 | 0 | 46.4 |


## Judge's adversarial tests on the final rules (`adv.ts`, 4,000 matches a row)

### Degenerate drafts, all coached by the same sharp coach

| Draft rule | vs planning GM | vs "highest total" |
|---|---|---|
| Follow the hint line greedily, stars first (`hint`) | 38.0% | 64.5% |
| Follow the hint line, chem counted double (`hintHeavy`) | 37.4% | 65.0% |
| Two most expensive cards, then follow hints (`starsAndScrubs`) | 34.3% | 60.5% |
| Every ability card you can afford, then plan (`abilityStack`) | 34.5% | 63.7% |
| Five shooters (highest SHOOT) | 27.2% | 49.9% |
| All defence (highest DEF) | 22.7% | 43.3% |
| Centres and DEF (`bigMen`) | 19.6% | 37.3% |
| Most scoring per dollar (hunting cheap low-DEF scorers) | 7.0% | 23.6% |
| Most measured worth per dollar | 5.0% | 18.3% |
| Cheapest cards | 5.0% | 18.6% |

Nothing here beats the planning GM, and the bargain-hunting rules are the worst of all, so the price list has no
cheap exploit that I could find.

### Call spam, on two skilled GMs' rosters

| Coach | vs sharp (unreadable) | vs plain | vs reader (notices habits) |
|---|---|---|---|
| Always the call that fires my own abilities (`abilitySpam`) | 49.8% | 60.4% | 37.3% |
| Always Move the Ball + Shadow their star | 44.1% | 44.3% | 36.5% |
| Always Feed my star + Straight Up | 42.8% | 52.3% | 31.9% |
| Always Let It Fly + Straight Up | 46.1% | 50.8% | 34.6% |
| Always Move the Ball + Protect the Paint | 45.5% | 50.2% | 35.3% |
| Always Move the Ball + Guard the Line | 45.7% | 47.2% | 34.5% |
| Greedy (best reply to plain, never changes) | 50.6% | 60.6% | 39.0% |
| Reader | 48.8% | 59.3% | 50.2% |
| Ability-stacking draft + ability spam, vs planning GM + sharp | 34.6% | | |

### Roster shape with equal rating totals (exact expected margin per 100 possessions under best play, row vs column)

Seven made-up fives, every player's three bars adding to 24, no chemistry.

| | all shooters | all rim | mixed | flat 8/8/8 | one star | no defence | all defence |
|---|---|---|---|---|---|---|---|
| **all shooters** (10/6/8 x5) | - | +5.7 | -4.6 | +0.9 | -1.2 | +2.8 | +2.9 |
| **all rim** (6/10/8 x5) | -5.7 | - | -9.7 | -4.3 | -7.0 | -4.2 | -1.1 |
| **mixed** (two shooters, two slashers, one 8/8/8) | +4.6 | +9.7 | - | +5.5 | +2.9 | +5.5 | +8.3 |
| **flat** (8/8/8 x5) | -0.9 | +4.3 | -5.5 | - | -2.6 | 0.0 | +2.8 |
| **one star** (12/12/8 + four 7/7/8) | +1.2 | +7.0 | -2.9 | +2.6 | - | +2.8 | +5.6 |
| **no defence** (10/10/4 x5) | -2.8 | +4.2 | -5.5 | 0.0 | -2.8 | - | +3.1 |
| **all defence** (6/6/12 x5) | -2.9 | +1.1 | -8.3 | -2.8 | -5.6 | -3.1 | - |

The balanced five beats every other shape. On design A's original rules the same test had the all-defence five
beating every other shape by 5 to 23 points; that is the main thing the DEF change fixed.

## What I measured on the two designs versus what they claimed

Re-runs (in a scratch copy, fixed seeds):

| Claim | Designer's number | My re-run |
|---|---|---|
| A: mirror, 4 x 20,000 | 49.52 to 50.31 | identical |
| A: skilled vs random / big-names+plain / big-names+random / ratings+plain | 90.44 / 85.28 / 87.66 / 89.21 | identical |
| A: built vs best-ratings roster, sharp / plain; vs big-names | 79.55 / 88.36 / 74.63 | identical |
| B: all twelve requirement-1 rows (78.5, 82.9, 64.8, 70.1, 70.1, 61.0, 65.3, 67.1, 72.6, 50.3, 49.6, 49.6) | as listed | identical |
| B: determinism (`verify.ts`) | 2,000 matches | 500 matches replayed identically |

Both designers' numbers are honest. What did not hold, or was missed:

- **A's rules text does not match A's code.** Rules: the centre supplies 25% of rim defence. Engine and every measurement: 35%.
- **A's 60-second explanation is 198 words**, about 80 seconds read aloud.
- **A's "all abilities are conditional" was not true of Closer** (+3 SHOOT every 4th quarter, no call or link needed).
- **A's Drive & Kick fires for one player holding both tags** (Maxey alone). The rules say "a Slasher and a Sniper"; the copy already in `src/game/chem.ts` requires two different players.
- **Both designs: DEF was worth about twice a scoring bar.** In A, five 6/6/12 players beat every equal-total shape by 5 to 23 points per 100 possessions. A priced it out (Gobert $6, Luka $3), so it was not exploitable, but the bars misled.
- **A: a human-style drafter is well short of the planning bot.** A drafter that only follows the hint line won 35% to 37% against A's skilled GM and 61% to 65% against "highest total" with the same coach (3,000 each). A's headline 85% to 90% is the planning bot's number.
- **B: the lazy coaching default is nearly free.** Always Pack the Paint + always help on their best scorer wins 49.5% against B's unreadable coach and 42.3% against its Reader (2,000 mirror matches each). B's coaching edge exists only against an opponent with a readable habit.
- **B: nothing I tried was dominant.** Wembanyama-first 51.0% against FitStars and 46.2% against Planner (600); elites-first 48.3% / 41.7%; anchors-first 43.3%; cheap-scorer hunting 11.8% to 22.1%.
- **A: nothing I tried was dominant.** Call spam 41% to 45% against sharp, 31% to 39% against reader; bargain hunting 3% to 5%; all-defence 24%; five shooters 22.5% (3,000 each).

### Scores (1 to 10)

| Criterion | A "GM first" | B "Coach first" | Final |
|---|---|---|---|
| Skill counts (measured) | 9 | 7 | 9 |
| No dominant strategy (measured) | 7 | 6 | 7 |
| Explainable in 60 seconds | 6 | 7 | 7 |
| Roster building, chemistry, abilities matter | 8 | 6 | 9 |
| Low on-screen clutter | 8 | 6 | 8 |
| Fun and drama for two friends | 5 | 7 | 6 |
| Build effort on the existing codebase | 8 | 5 | 8 |
| **Total** | **51** | **44** | **54** |

Why A: the owner asked for roster building first and a simulation second, and A measures 75% to 88% for the roster
alone where B measures 65% to 70%. B's game is 48 shots a side and 30 secret taps; between equal players the
better-called side still loses 38% of the time. A's seven traits and six links are also already in
`src/game/traits.ts` and `src/game/chem.ts`. B is the better evening for two friends who want to out-guess each
other, and that is the main thing the final spec gives up.

## Weaknesses of the final spec, and what I could not verify

1. **Nobody has played it.** The 156-word explanation, the 6.5-minute length, the highlight rules and every screen are designed, not tested. The "hints" bot is my guess at a casual player, not a measurement of one.
2. **Coaching is a small lever.** With equal rosters the unreadable coach beats a coach who never makes a read 54.0%, and a coach who notices habits beats him 59.0%. A correct read is worth about 1 to 3 points in a quarter whose random spread is about 8 points either way, so a player will often guess right and lose the quarter. The quarter card's "your call was worth +2" line exists to make reads visible. Coaching only becomes decisive against a predictable opponent (reader beats every frozen habit 69% to 76%).
3. **No rock-paper-scissors among the best drafters.** The two whole-five planners (builder, counter) beat everything else, and "collect links" and "star first, then build" sit just under them (46% to 48%). Counter-drafting the opponent's actual five is worth 50.9% (20,000), which is close to nothing: the draft is mostly solitaire plus taking a card the other player needs. No simple rule is dominant, but there is one best way of thinking.
4. **The planning bot is not the skill ceiling**, and prices were tuned against it. A better drafter may find mispriced cards.
5. **Prices still look odd in places.** Booker and Mitchell cost $2, Embiid $3, Klay ($5) costs more than Luka ($4), and Paul George costs the same $6 as Durant and Gilgeous-Alexander. Low DEF and the Ball-Dominant tag are why. Prices are measured worth, not fame. Fixing the look means changing the placeholder ratings (no star below DEF 6) and re-running the two calibrate commands.
6. **Curry is underpriced at the $9 cap** (owner wins 55.6%, drafted 41% of the time). Wembanyama (46.2%) and Morant (46.6%) are slightly overpriced. Everything else drafted at least a quarter of the time is between 46.1% and 53.3%.
7. **Dead or nearly dead cards:** Naz Reid is drafted 4.9% of the time he is dealt, Banchero 12%, Sengun 17%, Kuzma 19%, DeRozan 24%, Klay 25%.
8. **Ball-Dominant is a pure penalty tag.** Seventeen stars carry it and it never helps. It is why several famous scorers are cheap.
9. **Box scores are unrealistic.** A fed star takes about half his team's shots; 60 to 80 point games happen (Haliburton scored 78 in one demo).
10. **Blowouts are common.** Between equal planning bots the median margin is 12 and 23.6% of games finish within 5.
11. **Small first-pick edge:** the first drafter wins 51.6%.
12. **Some call options are close to dead.** In the unexploitable mix "Shadow someone other than their top scorer" is used 1.3% of the time and "Feed someone else" 5.9%. In 13.1% of roster pairings a fixed pair of calls is stable, so there is no guessing game on that side of the ball.
13. **Defence is now slightly under-valued** rather than over-valued: with equal totals an all-defence five loses to a flat 8/8/8 five by 2.8 points per 100.
14. **The original concept's bench ("moving players in and out") is not in the game**, and "battleship-style anticipating" survives only as four secret call pairs. This was a choice: the owner asked for roster building first.
15. **Drive & Kick edge case:** one player with both tags (Maxey) switches it on alone in `iso2.ts`, which is what was measured. `src/game/chem.ts` requires two different players, uses PG/SG/SF/PF/C slots and a chem factor of 0.1. Port from `iso2.ts`; do not assume the code already in `src/game` matches.
16. **Sample sizes below 20,000:** the draft round robin is 6,000 a cell, the adversarial tables 4,000 a row, the adversarial runs on the two original designs 2,000 to 3,000 (600 against B's slow Planner).
17. **Abilities were not tested switched on versus off**, only by owner win rate and by the ability-stacking and ability-spam tests.
18. **Walk-ons:** a greedy stars-first drafter ends up with a free minimum-rated Walk-on in about 2% to 18% of rosters depending on the opponent; a player who spends evenly almost never does. The draft screen must grey out picks that break the $1-a-slot rule, as specified.
