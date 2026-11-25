# Results: ISO v2 design A ("GM FIRST")

All numbers below were produced by `experiments.ts` on the rules in `rules.md` / `engine.ts` and the cards in `cards.json`, and tabulated by `report.ts`. Raw output is in `out/*.jsonl`. With 20,000 matches a win rate carries roughly ±0.7 points of sampling noise (±1.3 for the 6,000-match tournament cells).

## Verdict against the hard requirements

| requirement | target | measured | pass |
|---|---|---|---|
| 1a. better drafter/coach beats a naive one | at least 70% | 85.3% to 90.4% (four kinds of naive opponent, 20,000 matches each) | yes |
| 1b. well-built roster beats "best individual ratings, no fit" | most of the time | 79.6% with equal sharp coaches, 88.4% with equal plain coaches; 74.6% against the big-names roster | yes |
| 1c. identical rosters, identical calls | about 50/50 | 49.5% to 50.3% over 4 x 20,000 matches | yes |
| 2. no dominant draft rule | no simple rule wins regardless | "always take the highest total" averages 43.6% and wins 25.8% against the skilled GM; every one-idea rule (ratings, shooters, rim, defence) averages under 44%; the top of the table is the drafter that reacts to the opponent's roster | yes, with a caveat below |
| 2. no dominant coaching call | no call best regardless | one offensive call is the best reply to every defensive call in 3.0% of roster pairings (0.7% for defence); fixed-call coaches form a cycle (below) | yes |
| 2. no dominant card or ability | none | win rate when drafted ranges 42.6% to 55.5% across all 66 cards; no ability card above 55.5% | yes, with pricing caveats below |
| 3. explainable in 60 seconds | verbatim text | in `rules.md`, about 190 words, no dice notation, no jargon | written, not tested on a human |
| 4. at most 4 numbers per card | 3 bars + price | SHOOT, RIM, DEF, price; 1-2 traits; 13 abilities, all conditional | yes |
| 5. chemistry legible in the draft | one-glance hint | `draftHint()` gives "+3 chem, fills your centre slot" per undrafted card; six links plus fit | yes (logic only, no UI built) |
| 6. two players, deterministic | seed + choices | `selftest.ts` replays a match bit-for-bit; public alternating draft, 4 secret commit-reveal calls each | yes |
| 7. all cards filled | 65 | `roster.ts` actually holds 66 cards; all 66 have price, traits, tier, and 13 have abilities | yes |
| 8. no stakes | none | none | yes |

## How to reproduce

Requires Node 23.6 or newer (developed on Node 25.9, which runs `.ts` files directly). `npx tsx <file>` should work the same way but was **not** tested here because `tsx` is not installed in the repo.

```sh
cd "/Users/michaellewis/Checkup GG/iso-beta/docs/v2/design-a"
node selftest.ts                 # ids match roster.ts, determinism, legal drafts
node play.ts demo                # watch one match in text (seed, drafterA, coachA, drafterB, coachB)
sh run_all.sh 20000 6000         # every experiment below, in parallel; then writes out/report.md
# or one at a time:
node experiments.ts mirror 20000
node experiments.ts skill 20000        # add e.g. 0/4 .. 3/4 to split across four workers
node experiments.ts tournament 6000
node experiments.ts coaches 20000
node experiments.ts calls 4000
node experiments.ts cards 20000
node report.ts                   # tables from out/*.jsonl
# prices: node calibrate.ts 1500 7 && node gen_cards.ts   (rewrites costs.json and cards.json)
```

Seeds are fixed strings inside `experiments.ts`, so a re-run gives the same numbers.

## Who the bots are

Drafters (`bots.ts`): **random** (any legal card); **bigNames** (highest rating total it can afford, every pick: "always take the highest total"); **ratings** (plans the five with the highest rating total the budget buys: "best individual ratings, no fit"); **chemistry** (most chem first, ratings second); **shooters / bullies / stoppers** (plan for one bar only); **heliocentric** (first pick is the best ability star, then builds around him); **builder** (the skilled GM: scores whole fives on ratings + chemistry + fit against an average opponent); **counter** (builder, but scored against the roster the opponent is actually drafting).

Coaches: **plain** (Move the Ball + Straight Up every quarter); **random**; **fly / rim / star / flyPaint / rimLine** (the same bold pair every quarter); **greedy** (best reply to a plain opponent, every quarter); **reader** (assumes you repeat last quarter and plays the best reply); **sharp** (mixes calls in the proportions that cannot be exploited for these two rosters).

## Measured tables

### Mirror: identical rosters, identical calls

| calls (both sides) | matches | seat 0 win % | overtime % | decided by tie-break % |
|---|---|---|---|---|
| plain | 20000 | 49.73 | 2.38 | 0 |
| star | 20000 | 49.52 | 2.34 | 0 |
| fly | 20000 | 50.31 | 2.31 | 0 |
| rim | 20000 | 49.95 | 2.4 | 0 |

### Skill duels

| duel (A vs B) | matches | A win % | avg margin | avg score | chem A v B | OT % |
|---|---|---|---|---|---|---|
| 1a skilled GM + sharp coach vs best-ratings drafter + plain calls | 20000 | 89.21 | 25.78 | 114.1 | 10.49 v -0.33 | 0.9 |
| 1a skilled GM + sharp coach vs big-names drafter + plain calls | 20000 | 85.28 | 20.52 | 109.6 | 10.79 v 2.7 | 1.16 |
| 1a skilled GM + sharp coach vs big-names drafter + random calls | 20000 | 87.66 | 22.49 | 110 | 10.74 v 2.63 | 0.99 |
| 1a skilled GM + sharp coach vs random picks + random calls | 20000 | 90.44 | 25.76 | 110.1 | 10.49 v 2.95 | 0.94 |
| 1b roster only: built roster vs best-ratings roster (both plain coaches) | 20000 | 88.36 | 24.27 | 113.9 | 10.5 v -0.36 | 1.13 |
| 1b roster only: built roster vs best-ratings roster (both sharp coaches) | 20000 | 79.55 | 15.59 | 114.5 | 10.49 v -0.47 | 1.45 |
| 1b roster only: built roster vs big-names roster (both sharp coaches) | 20000 | 74.63 | 12.63 | 109.2 | 10.77 v 2.67 | 1.86 |
| coach only: same GM skill, sharp coach vs always-feed-and-shadow-the-star | 20000 | 61.85 | 5.67 | 108.7 | 10.1 v 10.09 | 1.83 |
| coach only: same GM skill, sharp coach vs plain coach | 20000 | 54.6 | 2.44 | 108.9 | 10.1 v 10.08 | 2.02 |
| coach only: same GM skill, sharp coach vs random coach | 20000 | 69.5 | 9.78 | 109.4 | 10.08 v 10.1 | 1.7 |
| counter-drafting GM vs skilled GM (both sharp) | 20000 | 52.09 | 1.13 | 109.2 | 9.71 v 10.07 | 2.24 |
| two equal skilled players (sanity) | 20000 | 50.16 | -0.11 | 108.5 | 10.08 v 10.11 | 2.06 |

### Draft-strategy round robin, all with the sharp coach (row's win % against column, 6000 matches per cell)

|  | bigNames | ratings | stoppers | chemistry | heliocentric | bullies | counter | shooters | builder | average |
|---|---|---|---|---|---|---|---|---|---|---|
| **bigNames** | - | 57.93 | 56.97 | 30.27 | 27.63 | 68.23 | 23.37 | 58.18 | 25.83 | 43.6 |
| **ratings** | 42.07 | - | 40 | 25.48 | 21.98 | 57.92 | 20.77 | 52.58 | 20.75 | 35.2 |
| **stoppers** | 43.03 | 60 | - | 27.25 | 26.43 | 65.17 | 21.75 | 61.92 | 20.93 | 40.8 |
| **chemistry** | 69.73 | 74.52 | 72.75 | - | 49.77 | 81.62 | 44.4 | 74.45 | 46.67 | 64.2 |
| **heliocentric** | 72.37 | 78.02 | 73.57 | 50.23 | - | 83.1 | 44.9 | 78.2 | 46.22 | 65.8 |
| **bullies** | 31.77 | 42.08 | 34.83 | 18.38 | 16.9 | - | 14.13 | 48.38 | 15.4 | 27.7 |
| **counter** | 76.63 | 79.23 | 78.25 | 55.6 | 55.1 | 85.87 | - | 79.12 | 52.38 | 70.3 |
| **shooters** | 41.82 | 47.42 | 38.08 | 25.55 | 21.8 | 51.62 | 20.88 | - | 22.98 | 33.8 |
| **builder** | 74.17 | 79.25 | 79.07 | 53.33 | 53.78 | 84.6 | 47.62 | 77.02 | - | 68.6 |

### Coaching round robin on the same skilled-GM rosters (row's win % against column, 20000 matches per cell)

|  | plain | fly | star | rimLine | greedy | sharp | rim | flyPaint | random | reader | average |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **plain** | - | 50.91 | 54.55 | 55.67 | 38.79 | 44.99 | 52.22 | 48.31 | 65.67 | 40.02 | 50.1 |
| **fly** | 49.09 | - | 52.59 | 27.82 | 43.02 | 45.38 | 53.77 | 71.97 | 64.58 | 30.9 | 48.8 |
| **star** | 45.45 | 47.41 | - | 51.73 | 38.58 | 38.82 | 48.17 | 43.92 | 60.84 | 27.34 | 44.7 |
| **rimLine** | 44.33 | 72.18 | 48.27 | - | 32.49 | 42.32 | 21.23 | 42.35 | 59.28 | 24.27 | 43.0 |
| **greedy** | 61.21 | 56.98 | 61.42 | 67.51 | - | 49.14 | 66.8 | 58.01 | 75.49 | 40.64 | 59.7 |
| **sharp** | 55.01 | 54.62 | 61.18 | 57.68 | 50.86 | - | 59.84 | 56.55 | 69.68 | 50.9 | 57.4 |
| **rim** | 47.78 | 46.23 | 51.83 | 78.77 | 33.2 | 40.16 | - | 21.24 | 61.8 | 25.16 | 45.1 |
| **flyPaint** | 51.69 | 28.03 | 56.08 | 57.65 | 41.99 | 43.45 | 78.76 | - | 66.78 | 31.01 | 50.6 |
| **random** | 34.33 | 35.42 | 39.16 | 40.72 | 24.51 | 30.32 | 38.2 | 33.22 | - | 30.02 | 34.0 |
| **reader** | 59.98 | 69.1 | 72.66 | 75.73 | 59.36 | 49.1 | 74.84 | 68.99 | 69.98 | - | 66.6 |

### Call versus call: points per 100 possessions for the offence, relative to Move the Ball vs Straight Up (exact expectation, 8000 offence-v-defence pairings)

| offence \ defence | Straight Up | Guard the Line | Protect the Paint | Shadow top scorer | Shadow someone else |
|---|---|---|---|---|---|
| **Move the Ball** | 0 | 1.2 | -0.3 | 2.3 | 7.9 |
| **Let It Fly** | 0.5 | -4.7 | 7.2 | 3 | 8.7 |
| **Attack the Rim** | -1.7 | 5.5 | -8.4 | 0.5 | 5.9 |
| **Feed top scorer** | 0.3 | 1.6 | 0 | -7.2 | 10.6 |
| **Feed someone else** | -6.2 | -5 | -6.4 | -1 | 0.9 |

|  | Move the Ball | Let It Fly | Attack the Rim | Feed top scorer | Feed someone else |
|---|---|---|---|---|---|
| unexploitable offence mix | 0.292 | 0.261 | 0.119 | 0.164 | 0.164 |
| share of best replies | 0.095 | 0.24 | 0.142 | 0.337 | 0.187 |

|  | Straight Up | Guard the Line | Protect the Paint | Shadow top scorer | Shadow someone else |
|---|---|---|---|---|---|
| unexploitable defence mix | 0.355 | 0.269 | 0.182 | 0.158 | 0.036 |
| share of best replies | 0.131 | 0.242 | 0.334 | 0.131 | 0.161 |

- pairings where one offensive call is the best reply to every defensive call: 3%
- pairings where one defensive call is the best reply to every offensive call: 0.7%
- pairings where a fixed pair of calls is stable (no guessing needed): 13.5%
- average gain from correctly reading an opponent who always plays plain: 2 (on defence) / 3.4 (on offence) points per 100 possessions

### Cards: skilled GM vs skilled GM, 20000 matches (budget 17)

first drafter wins 51.34% | average score 108.4 | overtime 2.15% | median margin 13 | decided by 5 or fewer: 23%

| card | price | ability | times dealt | picked % | first pick % | win % when picked |
|---|---|---|---|---|---|---|
| murray | 1 |  | 4952 | 88.3 | 29.7 | 49.8 |
| reaves | 1 |  | 4925 | 87.2 | 28.9 | 49.6 |
| bridges | 3 |  | 5768 | 84.6 | 16.4 | 51.6 |
| wemby | 8 | Eraser | 7257 | 84.3 | 60.8 | 43.8 |
| allen | 4 |  | 5868 | 83.2 | 35.2 | 53.7 |
| haliburton | 4 |  | 3885 | 82.1 | 30.5 | 52.3 |
| jwill | 4 |  | 4484 | 79.8 | 25 | 49 |
| klay | 3 |  | 5027 | 78.5 | 8.9 | 55.3 |
| dfs | 1 |  | 6925 | 77.3 | 8.9 | 50.5 |
| maxey | 3 |  | 3734 | 75.8 | 17.6 | 50.9 |
| middleton | 2 |  | 5859 | 75.8 | 10.3 | 51.3 |
| hjones | 2 |  | 7105 | 74.7 | 8.9 | 50.7 |
| gobert | 6 |  | 5959 | 74.1 | 30.7 | 52.9 |
| mccollum | 1 |  | 4975 | 74 | 17.9 | 46.9 |
| holmgren | 6 |  | 4549 | 73.6 | 26 | 49 |
| anunoby | 3 |  | 5764 | 73.1 | 13.7 | 49.2 |
| george | 5 |  | 4453 | 72.4 | 21.8 | 48.9 |
| adebayo | 5 |  | 4674 | 71.4 | 27.9 | 49.9 |
| lebron | 6 | Point Forward | 7083 | 70.5 | 14 | 50 |
| durant | 5 | Co-Star | 4524 | 69.4 | 19.2 | 47.4 |
| davis | 8 | Back Line | 7206 | 68.9 | 20.7 | 52.2 |
| white | 3 |  | 4983 | 68.9 | 7.7 | 53.1 |
| mitchell | 2 |  | 3937 | 68.6 | 16.5 | 53.7 |
| wagner | 2 |  | 5811 | 68.4 | 11.1 | 50.8 |
| irving | 2 |  | 3773 | 67.2 | 15.7 | 51.5 |
| giannis | 5 | Runway | 7160 | 65.2 | 6 | 51.3 |
| luka | 3 | Maestro | 3782 | 64.3 | 10.8 | 50.7 |
| porzingis | 4 |  | 5867 | 61.6 | 16.8 | 51.9 |
| towns | 3 |  | 4548 | 60.5 | 17.8 | 46.2 |
| kcp | 1 |  | 6292 | 59.7 | 4.2 | 47.7 |
| fox | 3 |  | 3787 | 58 | 9.8 | 52.2 |
| siakam | 3 |  | 4429 | 57.5 | 9.9 | 46.8 |
| embiid | 5 | Post Up | 4509 | 56.4 | 18.9 | 47 |
| derozan | 1 |  | 5731 | 56.2 | 5.7 | 51.5 |
| pritchard | 1 |  | 6236 | 56 | 2.4 | 50.6 |
| strus | 1 |  | 6122 | 55.1 | 1.9 | 49.7 |
| dort | 2 |  | 6136 | 53.3 | 3.7 | 47.1 |
| holiday | 4 |  | 4975 | 53.2 | 3.1 | 54.3 |
| lillard | 4 | Closer | 5991 | 52.9 | 9.2 | 54.9 |
| caruso | 2 |  | 6291 | 52.6 | 4.2 | 46.9 |
| cunningham | 3 |  | 3799 | 52.5 | 7.9 | 46.4 |
| jjj | 3 |  | 5880 | 52.3 | 7.6 | 48.2 |
| thybulle | 2 |  | 6271 | 51.7 | 4.1 | 48 |
| mcconnell | 1 |  | 6320 | 51.5 | 4.1 | 46.2 |
| gordon | 3 |  | 5924 | 50.2 | 1.9 | 47.5 |
| kawhi | 6 | Clamp | 7092 | 47.6 | 8.2 | 52.7 |
| curry | 7 | Gravity | 6006 | 47.4 | 10.6 | 55.5 |
| tatum | 5 |  | 4393 | 45.2 | 8.5 | 43.3 |
| jokic | 4 | Hub | 4582 | 45.1 | 2.4 | 53.6 |
| dgreen | 4 |  | 5817 | 44.9 | 2.7 | 49.8 |
| hart | 1 |  | 6369 | 43.4 | 1.4 | 47.4 |
| brunson | 3 |  | 3893 | 39.5 | 3.4 | 47.6 |
| harden | 3 |  | 3868 | 38.7 | 3.7 | 48.7 |
| young | 3 |  | 3801 | 38.5 | 3.7 | 50.2 |
| looney | 3 |  | 7360 | 36.1 | 9.3 | 52.7 |
| butler | 5 |  | 4377 | 35.9 | 4 | 47.3 |
| ant | 4 |  | 3919 | 32.6 | 2.2 | 51.1 |
| portis | 1 |  | 7045 | 31.7 | 0.5 | 50.6 |
| banchero | 3 |  | 4373 | 29.2 | 1.3 | 45.4 |
| booker | 3 |  | 3927 | 26.2 | 1.1 | 47.5 |
| lopez | 1 |  | 7181 | 25.9 | 4.8 | 52.3 |
| morant | 5 | Above the Rim | 6094 | 25.1 | 1.8 | 42.6 |
| sga | 6 | Isolation Artist | 6111 | 20.8 | 1.7 | 50.9 |
| sengun | 1 |  | 5915 | 19.6 | 1.3 | 47.8 |
| kuzma | 1 |  | 7123 | 16.2 | 0.3 | 52.8 |
| reid | 1 |  | 7224 | 1.8 | 0 | 43.2 |


## Reading the tables

**Requirement 1.** The skilled GM with a sharp coach beats every naive opponent 85% to 90% of the time. Roster alone (same coach on both benches) is worth 75% to 88%. Coaching alone (same GM skill on both sides) is worth 54.6% against a coach who never makes a read, 61.9% against one who always feeds and shadows the star, and 69.5% against random calls. That is the intended split: the draft is most of the game, the four calls are a real but smaller lever. Identical rosters with identical calls are a coin flip (49.5% to 50.3%).

**Requirement 2, drafting.** No one-idea rule survives. The interesting part of the table is the top four: chemistry-first and heliocentric are close to each other, builder beats both (53%), and counter, the only drafter that looks at what the other player is building, beats builder 52.4% in the tournament and 52.1% over 20,000 matches in the skill duels. So the best measured play depends on the opponent's picks. Caveat: I did not find a rock-paper-scissors cycle among the strong drafters; they are ordered counter > builder > heliocentric ≈ chemistry. "Collect the links" on its own gets 46.7% against the skilled GM, so it is a good rule of thumb but not the best play.

**Requirement 2, coaching.** The fixed-call coaches form a clean cycle: Let It Fly + Guard the Line beats Let It Fly + Protect the Paint 72%, which beats Attack the Rim + Protect the Paint 79%, which beats Attack the Rim + Guard the Line 79%, which beats Let It Fly + Guard the Line 72%. Above them: greedy beats plain 61%, reader beats greedy 59%, and sharp holds reader to 49%. In the exact call-versus-call table every bold offensive call has one defensive call that costs it roughly 5 to 8 points per 100 possessions and one that gifts it 5 to 11; the plain calls sit in the middle. The unexploitable mix uses every option (offence 29 / 26 / 12 / 16 / 16, defence 36 / 27 / 18 / 16 / 4).

**Requirement 2, cards and abilities.** Between two skilled GMs no card wins more than 55.5% of the matches it is drafted into, and none of the 13 ability cards is a must-win (Curry 55.5, Lillard 54.9, Jokic 53.6, Kawhi 52.7, Davis 52.2, Giannis 51.3, SGA 50.9, Luka 50.7, LeBron 50.0, Durant 47.4, Embiid 47.0, Wembanyama 43.8, Morant 42.6).

## What I changed along the way (and why)

1. **Call numbers.** First version: Let It Fly / Attack the Rim only shifted shot selection, conceding 1.5 on the other shot when defended. Result: Attack the Rim was used 1% of the time and Straight Up 2% in the unexploitable mix, i.e. dead options. Changed to +1 on the chosen shot, concede 2 instead of 1.5, open teammates +1.5 on a Shadow. All eight call families are now live.
2. **Centre weight.** Rim defence was 50% the centre-slot player; elite rim protectors were worth 17 points per 100 possessions and were must-picks at any price. Cut to 25%.
3. **Chemistry weight.** At 0.12 bar points per chem the "most chemistry first" drafter was within 4 points of the skilled GM (a simple rule that was nearly optimal). Cut to 0.08: the skilled GM now beats it 53%, and built-versus-best-ratings fell from 84% to 80%.
4. **Play-your-game multiplier.** After change 3 the plain calls dropped to 7% / 1% usage, so their chemistry multiplier went from 1.5 to 1.8 (now 29% / 36%).
5. **Prices.** Started from rating totals, which made Gobert (3 dollars) and Wembanyama an automatic first pick. Now: price = measured worth in an average lineup, then nudged up or down while two skilled GMs draft 1,500 pools a round, until nothing was taken over 85% or under 20% of the time (`calibrate.ts`). The price ceiling had to go from 6 to 8 for Wembanyama and Davis.
6. **Traits.** Kuzma (was only Ball-Dominant) and Naz Reid were never drafted; gave them Slasher and Sniper. Kuzma is now taken 16% of the time, Reid still under 2%.

## Honest weaknesses and things not verified

- **Not played by a human.** Everything is bot against bot. The 60-second explanation, the 5-8 minute match length and the "few highlight moments" are design estimates; `play.ts` only prints quarter summaries, runs and hot hands. No UI was built and nothing under `src/` was touched.
- **Blowouts.** Between two equally skilled bots the median margin is 13 points and only 23% of games finish within 5. Skill shows clearly, but many games will be decided by half-time. More possessions make this worse, fewer make luck matter more.
- **Prices are tuned to pick rate, not win rate, and it shows.** Wembanyama at 8 dollars is taken 84% of the time (61% as a first pick) yet his teams win only 43.8%: the skilled-GM bot overrates him and the price overshoots. Morant (42.6%) and Tatum (43.3%) are also overpriced; Curry, Klay and Lillard (about 55%) slightly underpriced. A second calibration pass on win rate would tighten this. It also means the "builder" bot is not the skill ceiling.
- **Prices do not match real-world reputation.** In this model a guard with the lowest DEF bar is a liability, so Luka costs 3 and Mitchell and Irving cost 2, while Gobert costs 6. That will look wrong to an NBA fan even though it is balanced in the sim. Fixing it means changing placeholder ratings (for example fewer 4s on DEF for star guards), which I left alone.
- **Dead and near-dead cards.** Naz Reid (1.8% picked), Kuzma (16%), Sengun (20%), SGA (21% at 6 dollars), Morant (25%), Booker (26%).
- **No cycle among the strong draft strategies.** The top of the tournament is ordered, not circular. The opponent-aware drafter is the best bot measured; I cannot show that a human could not find a simpler rule that matches it.
- **Reader beats most fixed habits.** The coach that best-replies to your last quarter averages 66.6% in the coaching round robin because most opponents there repeat themselves. It is held to 49% by the sharp mix, so it is not dominant, but human players who repeat calls will be punished hard (which may be the point).
- **Some quarters need no guess.** In 13.5% of roster pairings one fixed pair of calls is stable, so there is no mind game on that side of the ball in those games.
- **Chemistry tuning is fragile.** How often the plain calls are worth using depends on the 1.8 multiplier and on typical chemistry (about 10 for skilled drafters). If chemistry values or links change, re-run `experiments.ts calls`.
- **First pick.** The first drafter wins 51.3% between skilled bots (20,000 matches), a small but real edge despite the snake order.
- **Usage looks unrealistic.** Shot share is the scoring bar squared, and Feed triples it, so a fed star can take over half the shots and score 50 or 60. It reads oddly in a box score; lowering the Feed multiplier from 3 to 2 would calm it but needs a re-run.
- **Walk-ons.** A drafter who always takes the biggest name gets stuck with a Walk-on in 3% to 8% of rosters. Planned drafters almost never do (0.03%). A new player may hit this and find it harsh.
- **Abilities were not tested one at a time.** I measured win rate when the card is drafted, not each ability switched on versus off, so an individual ability's size is unverified. Lillard's Closer and Morant's Above the Rim are the least decision-driven (a quarter number and the opponent's centre).
- **Bench / sixth man: not included.** I judged it would add a second screen of decisions for little skill; it is the obvious next thing to try if the four calls feel too thin.
- **The tournament cells use 6,000 matches**, not 20,000, because of machine load; everything quoted for requirement 1 uses 20,000.
- **No rebounds, fouls, turnovers or fatigue**, and matchups are automatic. Simple to explain, less like basketball.
