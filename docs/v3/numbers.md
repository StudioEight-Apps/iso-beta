# ISO v3 numbers

Measured, not estimated. Script: `tests/numbers.test.ts` (skipped in the normal test run).

```
VITE_ISO_NUMBERS=1 npx vitest run tests/numbers.test.ts --silent=false --disable-console-intercept
```

Run of 2026-11-13: 3,000 bot v bot matches on seeded 18-card pools, both sides using the odds-reading bot (drafts 7, seats by position, picks shots and double teams from the exact dice odds, uses cards and subs). Then 1,000 mirrored pairs (2,000 games) of that bot against a random-choice bot. With 3,000 games a win-rate figure is good to about plus or minus 1 point.

## Headline

| Question | Answer |
| --- | --- |
| Average score per side | **31.7** (winner 35.2, loser 28.2). 80% of team scores fall between 23 and 40. Lowest seen 8, highest 52. |
| Games decided by 5 or fewer | **48.1%** (by 3 or fewer: 31.5%). Average margin 7.1. |
| Overtime | 4.3% of games. |
| Odds-reading bot v random-choice bot, same two rosters played both ways round | Smart bot wins **95.3%**. Average 36.9 to 21.7. |
| First-possession edge | The coach with the first possession wins **43.7%**. That is not the ball: possessions are equal. It is the draft. The first possession goes to the coach who drafted second, and **drafting first wins 56.3%**. |
| Typical best stat line | Top scorer in a game: median **15 points** (1 game in 10 reaches 19+, max seen 30). Top rebounder: median **7** (1 in 10 reaches 10+, max 16). Top passer: median **7 assists** (1 in 10 reaches 10+, max 15). |
| Any double-double (10+ in two categories) | **5.0%** of games have at least one. |
| Any triple-double | **0** in 3,000 games. |

## What 20 possessions a side really produces

Honest version for the "realistic stat lines" goal:

- A team gets 20 possessions plus about 1.8 putbacks. It scores about 1.58 points per possession, which is hot (the NBA is about 1.15). Field goal rate across all shots is 60.8%.
- Per team per game: **6.1 rebounds** (1.8 offensive), **5.8 assists**, **2.2 steals**, **0.9 blocks**, **2.2 turnovers**.
- So a game has about 12 rebounds and 12 assists in total to share. Ten of either for one player needs almost all of his team's and then some. That is why a points and rebounds or points and assists double-double shows up in 1 game in 20 and a triple-double never did.
- Lines that do happen every night: one player with 5+ in two of points, rebounds, assists in **79.9%** of games. A 5 / 5 / 5 line in **2.4%**.
- Best lines seen in the run: 30 points and 10 rebounds (Jokic). Scoring is the easy half: a shooter is capped at 2 shots a quarter, 8 a game, so 24 from threes alone is the regulation ceiling before putbacks and Catch & Shoot.

If triple-doubles at real thresholds are a must, the rules need more events per game, not different scoring. The cheap options, none of them applied:

1. Count an assist on every made shot off a pass, not only dimes. Not measured; since 71% of passes are already dimes, expect roughly a third more assists at most.
2. Play 8 possessions a side per quarter (32 a side). Everything scales by 1.6.
3. Flag "ISO triple-doubles" at 5 / 5 / 5 and say so on the box score. This is a labelling choice, not a stat change.

## How the game is being played (bot v bot)

| | |
| --- | --- |
| Threes as a share of all shots | 54.4% |
| Possessions with a pass | 58.2% (70.6% of those passes are dimes) |
| Possessions with a double team | 62.3% |
| Double teams that read the shooter right | 40.0% |
| Play cards used per game, both coaches | 18.9 (20 are dealt or drawn) |
| Mid-quarter subs per game, both coaches | 3.1 of a possible 8 |
| Putbacks per game | 3.5 |

Reading matters: the defence doubles on most possessions and is wrong 6 times in 10, which hands the shooter +2. A coach who doubles less than the bot, or mixes better, has room to beat it.

## Shooters (bot v bot, players with 150+ attempts)

Points per shot, best: Maxey 1.83, Lillard 1.81, Mitchell 1.78, Booker 1.73, McCollum 1.73, Curry 1.73, Klay 1.69, Brunson 1.64.
Worst: Davis 1.25, Jokic 1.22, Allen 1.19, Gobert 1.03, Looney 0.85.

No single card runs away with it. Curry is the most used shooter in the run (5,723 attempts, 58.5%) and is sixth by efficiency. Klay at 1.69 on 57% is healthy for a card built around one ability.

## Abilities: how often each one comes into play, per game

Counted whenever the ability changed or could have changed the roll (for pass abilities that is every pass by that player), across the games where the card was drafted or not, so read it as "how visible is this ability", not as power.

Floor General 2.67, Maestro 2.20, Table Setter 1.95, Splash 1.82, Stifle Tower 1.77, Lob Threat 1.41, Hub 1.38, Isolation 1.26, Above the Rim 1.15, Freight Train 1.01, Glass Cleaner 0.98, Step Back 0.95, Tough Shot 0.94, Momentum 0.93, Pick & Pop 0.71, Spin Cycle 0.65, In Rhythm 0.57, Post Up 0.57, Heating Up 0.56, Takeover 0.56, Dame Time 0.52, Mismatch 0.48, Catch & Shoot 0.44, Fifth Gear 0.40, Back Cut 0.37, Handles 0.37, Poster 0.35, Eraser 0.32, Jump the Lane 0.26, Clutch Gene 0.21, Clamp 0.20, Unguardable 0.13, Smother 0.06, The Klaw 0.04, Spark 0.02, Sixth Man 0.01.

Quiet ones worth a look: **The Klaw** and **Smother** almost never fire (a clamp needs the two dice to match). **Sixth Man** and **Spark** almost never fire: they need that role player drafted and then subbed in mid-quarter, which the bot rarely does. **Unguardable** only matters on the possessions where Durant is doubled. I did not measure why each is low beyond the counts.

## Tuning that was done

One rule was added after the first run, and nothing else was touched.

- **First run (no long-range rule):** 40.8 points a side, 68% of shots made, **86% of all shots were threes**. A three used the same contest as a drive for one more point, so driving was pointless. Obviously broken.
- **Fix:** "the defence adds +2 against every three" (`LONG_RANGE = 2`). Result: threes 54% of shots, 31.7 a side, 61% made.
- Two more knobs were tried and **not** kept because they barely moved anything: dimes on 6+ instead of 5+ (30.9 a side) and open look +1 instead of +2 (30.4 a side, but double teams on 85% of possessions, which kills the "or nobody" choice).

## Known issues, not fixed

1. **Offence runs hot.** 1.58 points per possession and 61% shooting. It is not a rule bug: the star cards have bigger offence dice than the average DEF die across from them (many stars carry a d4 DEF), and open looks and dimes stack. The clean fix is roster data, which is the designer's to tune: raise weak DEF dice a step, or trim the d12 scorers. A blunt rule fix would be "ties and one-less go to the defence", which I did not want to add to the 60-second pitch.
2. **Drafting first is worth about 6 points of win rate** (56.3%). Straight alternating picks from a top-heavy pool do that. Options: a snake draft (first, second, second, first, ...), or give the second drafter a fifth starting card. Not applied because the brief fixed the draft order.
3. **Low rebound and block counts** follow from issue 1: fewer misses, fewer boards. Fixing 1 raises both.
4. **OVR over-rewards rebounding.** With the current formula Gobert is 88, level with Curry, and Jarrett Allen (87) is above Booker (86). The star ratings look right; the OVR formula needs a pass, probably weighting 3PT / DRIVE above REB.
5. These are bot numbers. People will double less predictably and use cards worse or better, so treat the close-game share and the 95% as upper bounds on how much skill shows, not a forecast.
