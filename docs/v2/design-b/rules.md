# ISO v2, design B: "Coach First"

Build a six-man roster under a cap, then coach it through six short runs. Every run both coaches secretly make
three small calls, the calls are revealed together, and the run plays itself. There are no dice to read: every
number on screen is a bar, and bigger is better.

Everything below is implemented in `proto/engine.ts` (the constants are the `CFG` block at the top). Measured
results are in `results.md`.

---

## The 60-second explanation (verbatim, about 150 words)

> **You are the GM, then the coach.**
>
> **Draft.** Sixteen players are dealt. You and your opponent take turns picking until you each have six, and you
> have 42 credits to spend. Every card shows three bars (Outside, Inside, Defence) and a price. Players who fit
> together add Chemistry, and every card tells you how much it would add before you pick it. Chemistry makes your
> whole team better.
>
> **Play.** The game is six runs. Before each run you secretly make three calls: who rests (everyone rests once),
> who your go-to scorer is and whether he attacks inside or outside, and on defence which of their players you
> send help at and whether you pack the paint or guard the arc. Both plans flip over and the run plays itself.
> Guess their go-to and you smother him. Get guessed and you struggle. Most points after six runs wins.

---

## 1. The card

Four numbers, all drawn as bars on the same 0 to 13 track:

| Bar | Meaning | Range |
|---|---|---|
| **Outside** | how good his three-point shot is (`three` in roster.ts) | 4 to 12 |
| **Inside** | how good he is attacking the rim (`drive`) | 4 to 12 |
| **Defence** | how well he guards his man (`def`) | 4 to 12 |
| **Cost** | credits to draft him | 2 to 13 |

Plus a position letter (G, F, C), one or two **trait** tags, and on the nine elite cards one named **ability**.

Traits (eight in total, 1 or 2 per card): `Sniper`, `Slasher`, `Playmaker`, `Roller`, `Lockdown`, `Anchor`,
`Glue`, `Alpha`. Traits do two things only: they make chemistry links (section 3), and `Anchor` / `Lockdown`
strengthen your defensive coverage (section 4).

Cost is not hand-picked. It is fitted to how much each card is actually worth in the simulator, then nudged until
no card's owner wins much more than half the time (`proto/cardvalue.ts`, `proto/tune-costs.py`). The reason a
Defence point costs more than a scoring point: a defender guards every shot his man takes, a scorer only uses one
of his two scoring bars on any shot.

## 2. The draft

- **Deal:** 16 cards from the pool of 66: 3 elite, 4 star, 5 starter, 4 role (same tier rule as `roster.ts`),
  shuffled by the match seed.
- **Order:** public alternating picks in snake order, `A B B A A B B A A B B A`. A is decided by the seed.
- **Roster:** six players each. Four cards are left over.
- **Cap:** 42 credits. You may pick any card you can afford. If it is your turn and you cannot afford any card left,
  you are handed a free **Rookie** (F, 4/4/4, no traits). The draft screen greys out picks that would leave you
  unable to fill your roster with the cards remaining, so this should not happen to a player who is paying attention.
  (The bots hit it in about 1 draft in 1,000.)
- **What every undrafted card shows you** (function `draftHint`): the chem it would add to your roster right now,
  for example `+8 chem`, and `fills C` when it fills an empty position slot. Negative numbers show too (`-8 chem`
  on a third Alpha).

## 3. Chemistry and fit

Chemistry is one number for your roster of six. It is fixed once the draft ends.

| Rule | Chem |
|---|---|
| **Fit**: each filled slot out of G, G, F, F, C | +4 each (max +20) |
| **Drive & Kick**: each Slasher paired with a Sniper | +4 per pair (max +12) |
| **Pick & Roll**: each Playmaker paired with a Roller | +4 per pair (max +8) |
| **Lock & Anchor**: each Lockdown paired with an Anchor | +4 per pair (max +8) |
| **Star & Glue**: each Alpha paired with a Glue guy | +4 per pair (max +8) |
| **Complete Team**: someone with 10+ Outside, someone with 10+ Inside, someone with 10+ Defence | +6 |
| **One Ball**: every Alpha beyond your second | -8 each |

A pair is two different cards. A card with two traits can be in several pairs. Range in practice: about 15 (a pile
of stars) to 62 (the maximum).

**What chem does:** every 15 chem adds +1 to every one of your players' three bars for the whole game
(chem 45 = +3.0 on everything). The roster screen shows this as one line: `Chem 45: +3.0 to every bar`.

## 4. The game

Six runs. In a run each team takes **8 shots**: the go-to takes 4, each of the other four players on the floor
takes 1. So a match is 48 shots a side.

### The three calls (secret, both coaches at once, at most two taps each)

1. **Rest** (one tap): which of your six sits this run. Everyone rests exactly once in the six runs, so your
   sixth card is a real player, not a spare.
2. **Offence** (two taps): your **go-to** (any of your five on the floor) and **Inside** or **Outside**.
3. **Defence** (two taps): which opposing player gets your **Help** (any of their six, you do not know who is
   resting) and **Pack the Paint** or **Guard the Arc**.

The three calls are committed together as one object (`Call` in `engine.ts`) and revealed together.

### Who guards whom

No decision here. Each side's five line up as G, G, F, F, C (anyone left over fills the empty slot). Within a
position, your more dangerous scorer is guarded by their better defender.

### How a shot resolves

```
Attack = shooter's Outside or Inside bar + his team's chem / 15 + ability bonuses
Guard  = his defender's Defence bar     + defender's team chem / 15
         + 4  if the Help was sent at this shooter
         + coverage (see below)
Edge   = Attack - Guard

Inside shot  (2 points): make chance = 50% + 3% x Edge
Outside shot (3 points): make chance = 33% + 2% x Edge        (both kept between 5% and 95%)
```

An even matchup is worth about one point either way (1.00 inside, 0.99 outside), and one point of Edge is worth
the same 0.06 points on either shot.

- **Which shot:** the go-to takes the shot you called. Everyone else takes his own better shot (higher bar; if the
  two bars are equal he follows the go-to's call).
- **Help:** +4 Guard on every shot by the player you named. If that player is resting, the help is wasted.
- **Coverage:** shots your coverage is set for (Inside shots if you Pack the Paint, Outside shots if you Guard the
  Arc) get **+1 Guard, plus +1 for each Anchor (paint) or Lockdown (arc) among your five, up to +2**. Shots it is
  not set for get **-1 Guard**.

One seeded random number per shot decides make or miss (`rngFromSeed(seed + "|run" + n)`, shots in a fixed
order), so the same seed and the same calls always give the same game.

### Abilities (elite cards only, nine in the pool, three in any deal)

| Card | Ability | Effect | What it rewards |
|---|---|---|---|
| Stephen Curry | **Gravity** | On the floor but NOT your go-to: your go-to gets +2. | owning a second scorer |
| LeBron James | **Floor General** | When he IS your go-to: his four teammates each get +2. | the go-to call, good role players |
| Shai Gilgeous-Alexander | **Wrong-Foot** | As your go-to: +2 when the defence's coverage is not set for his shot. | the inside/outside read |
| Damian Lillard | **Late Clock** | As your go-to shooting Outside in runs 5, 6 and overtime: +3. | when you rest him, when you call him |
| Giannis Antetokounmpo | **Downhill** | +1 Inside for each Sniper on the floor with him (max +3). | drafting shooters around him |
| Ja Morant | **Fast Break** | +1 Inside for each Lockdown on the floor with him (max +3). | drafting stoppers around him |
| Anthony Davis | **Rim Runner** | +2 Inside while a Playmaker is on the floor with him. | drafting a passer |
| Kawhi Leonard | **Clamp** | On the floor, when your Help lands on their go-to: the help is +6 instead of +4. | reading the go-to |
| Victor Wembanyama | **No-Fly Zone** | On the floor, when you Pack the Paint: the coverage is worth 1 more. | the coverage call |

None is always on: each needs a specific call, a specific kind of teammate on the floor, or a specific run, and
every one of them switches off for the run its owner rests. None removes an option from the opponent.

### Winning, overtime

Most points after run 6 wins. If tied, play overtime runs (same rules, any one player may rest) until a run ends
with the scores different. Overtime happens in about 3% of matches.

## 5. What it looks like in time

| Phase | Decisions | Clock | Time |
|---|---|---|---|
| Draft | 12 public picks | 15 s each | up to 3 min |
| Six runs | 3 calls each, 5 taps | 25 s to call + about 12 s of playback | about 3.5 min |
| **Total** | | | **about 6 to 7 min** |

Playback shows the eight go-to shots of a run one by one (four each, that is where the reads paid off or did
not), and counts the role players' shots as a quick tally. Three captions do the explaining: "Help was waiting",
"Help went to the wrong man", "He attacked away from the coverage".

## 6. Netcode mapping

- Draft: alternating public picks (existing mechanism).
- Each run: one commit-reveal of `{ sit, goTo, emph, help, wall }` from both players.
- Resolution: `playRun(state, [callA, callB])`, a pure function of the state, the two calls and the match seed.
- No hidden state other than the uncommitted calls. No stakes, no currency outside the 42 draft credits.

## 7. Why this answers the three complaints

- *"Completely random"*: 48 shots a side instead of 12, a go-to who takes half of them, and chem that moves every
  bar. Measured in `results.md`.
- *"Why is double team the only option?"*: the defence now makes two reads (who, and where), the offence makes two
  (who, and how), and the rest call changes who is even on the floor.
- *"Cluttered"*: a card is four bars and two tags. A run is three screens with one question each.
