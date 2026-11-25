# ISO v2 final: screens

Five screens, in order. The rule for every screen: one question, one place to look, and nothing on screen that
the player does not need to answer that question. Everything else is one tap away, never zero.

Global rules

- A card always shows the same things in the same places: name, position letter, three bars (SHOOT, RIM, DEF, each 1 to 5 segments), price. Nothing else is ever printed on the card face at rest.
- Trait tags and the ability name are small chips under the bars. Ability TEXT is never on the face; it is on the card's detail sheet (tap and hold, or tap the chip).
- No raw ratings (4 to 12), no percentages, no formulas, no dice anywhere in the UI.
- One accent colour means "good for you", one means "bad for you". Chem deltas, call results and highlights all reuse those two.
- Engine functions named below are in `iso2.ts`.

---

## 1. Draft (team builder)

The question: **which card do I take?**

| Zone | Always on screen | Hidden until tapped |
|---|---|---|
| Top bar | Whose pick it is, pick clock (20 s), your money left (`$11`), opponent's money left | Draft order strip (A B B A A B B A A B) |
| The table (18 cards, scrollable grid, 3 across on a phone) | Per card: name, position letter, 3 bars, price. **One hint line** under the card, computed for YOUR roster right now: `+3 chem · fills C` / `+0 chem · fills G` / `-3 chem · out of position`. Hint is green when chem is positive, red when negative, grey at zero | Card detail sheet: trait tags explained in one line each, ability name + text, which link the pick would switch on ("Drive & Kick with Curry"), who on the table would complete a link with it |
| Unaffordable cards | Greyed, price in red. A card is unaffordable if you cannot pay for it and still keep $1 for each empty slot (`legalPicks`) | Tap shows "You need $1 for each empty slot" |
| Your five (bottom strip, slots G G F F C) | Filled slots show the mini card (name + 3 bars). Empty slots show the slot letter. **Chem total** as one number with the lit link icons next to it (up to 5 icons) | Chem breakdown sheet: the seven rules as a checklist with what you have and what is missing ("Lockdown: have Stopper, need Anchor") |
| Opponent's five (collapsed tab) | Their chem total and a count of filled slots | Their full roster, same strip as yours |

Data: `draftHint(roster, card)` gives `chemDelta`, `fit`, `links`. `computeChem(roster)` gives the breakdown.
`legalPicks(draft, seat)` gives what can be tapped.

Not on this screen: abilities' text, formulas, the opponent's hint lines, any rating number, tier labels.

Interaction: tap a card once to select (it lifts, hint line enlarges), tap "Draft" to confirm. If the clock runs
out the highest-priced legal card with the best hint is taken (`autoPick`, to be written in the client; not part
of the engine).

---

## 2. Lineup (10 seconds, no decision)

The question: **what did I build, and who guards whom?** This is a reveal screen, not a choice screen.

| Zone | Always on screen | Hidden until tapped |
|---|---|---|
| Two rows of five | Your five and theirs, face to face in matchup order (best defender in a position group on the most dangerous scorer in that group, centre on centre). Each card: name, 3 bars | Card detail sheet |
| Between each pair | One arrow per matchup, coloured by who has the edge when your man shoots (your better scoring bar against his DEF) | Nothing |
| Chem | Both chem totals, big, side by side, with lit link icons | Breakdown sheet for either side |
| Abilities | The names of the abilities on the floor as chips under their cards, with a dot if the ability is already live (link-based ones) or needs a call (call-based ones) | Ability text |
| Footer | "Tip-off" button, 10 s auto-advance | |

Data: `buildTeam(roster)` gives `cards` (slot order), `offOrder`, `defOrder`, `chem`.

Not on this screen: prices (the draft is over), money left, any call options.

---

## 3. Coaching call (before each quarter, 15 s)

The question: **how do I attack, and what do I take away?** Two rows, one tap each.

| Zone | Always on screen | Hidden until tapped |
|---|---|---|
| Header | Quarter number, score, clock | |
| ATTACK row (4 buttons) | `Move the Ball` · `Let It Fly` · `Attack the Rim` · `Feed...` | Each button's one-line effect appears under the row when selected ("More threes, everyone shoots a bit better. Runs into Guard the Line."). `Feed...` opens your five as mini cards; tap one |
| TAKE AWAY row (4 buttons) | `Straight Up` · `Guard the Line` · `Protect the Paint` · `Shadow...` | Same one-line effect. `Shadow...` opens their five; tap one |
| Ability prompts | A small star on any button that would switch on one of YOUR abilities this quarter (for example a star on `Let It Fly` if you own Curry). No text | Tap the star: ability name + text |
| Opponent's tells | A strip of their calls from earlier quarters as icon pairs (Q1: threes / shadow Luka). Empty in Q1 | Nothing |
| Your five (collapsed) | Hidden by default | Pull up to see both fives with bars |
| Lock button | "Lock in" (greyed until both rows are chosen). After locking: "Waiting for opponent" | |

Timeout: if the clock runs out, the unchosen row defaults to `Move the Ball` / `Straight Up`.

Data: the call is `{ off: 0..7, def: 0..7 }` (0 plain, 1 line/threes, 2 rim/paint, 3..7 player in slot 0..4),
sent through the existing commit-reveal.

Not on this screen: the opponent's current choice (obviously), any probability, any "recommended" marker, the
possession log.

---

## 4. Quarter playback (about 30 s per quarter)

The question: **did my call work, and who is winning?**

Sequence

1. **Reveal (3 s).** Both call pairs flip over side by side. If a call ran into its counter, both icons shake
   and one caption shows: "They were waiting for the three" / "Shadow found Curry" / "Nobody home in the paint".
   At most one caption per side.
2. **Ticker (about 22 s).** The 50 possessions of the quarter are replayed fast. Only the scoreboard and one
   line of text move. Most possessions are a score tick only. The client stops for a beat (about 1.5 s, with a
   card flash and caption) on **at most five highlights per quarter**, chosen from the log in this priority
   order:
   1. the last three possessions of the 4th quarter or overtime when the margin is 3 or less (always shown, one by one)
   2. a lead change
   3. a run of 8-0 or better (shown once, at the basket that completes it)
   4. a made three by a fed player, or a miss by a shadowed player
   5. a basket where an ability was live for the shooter (caption is the ability name)
3. **Quarter card (5 s).** Quarter score, running score, and two lines, both in plain points:
   - `Your attack call: +2 pts` (what your call was worth against their actual defence, compared with Move the Ball)
   - `Your defence call: -1 pt` (what your call saved or cost against their actual attack, compared with Straight Up)
   These are exact expected values from `shotTable(...).ppp`, times 25 possessions, rounded to whole points.
   They exist because one quarter's score is noisy: this is the only place the player sees whether the READ
   was right, separate from whether shots fell.

| Zone | Always on screen | Hidden until tapped |
|---|---|---|
| Scoreboard | Score, quarter, possession progress bar | |
| Call strip | Both revealed call pairs as icons | Tap: the one-line effect of each |
| Ticker line | Last event in words: "Curry three. 61-58" | |
| Highlight flash | Shooter's card (name + bars), caption | |
| Top scorers | Your leading scorer and theirs, points so far | Full box score (points per player) |

Not on this screen: per-shot probabilities, the full 200-line log (it is in a "Play by play" drawer on the final
screen), both teams' bars (only the highlighted card flashes).

Data: `simulateMatch(seed, teams, calls, secondDrafter, true).log`, one entry per possession with quarter, seat,
shooter slot, defender slot, shot type, make chance, made, points, running score.

---

## 5. Final

The question: **who won, and why?**

| Zone | Always on screen | Hidden until tapped |
|---|---|---|
| Result | Winner, final score, quarter-by-quarter line (4 numbers a side) | |
| Why (three lines, the biggest three shown) | `Chemistry: you 11, them 5` · `Calls: you +6 pts, them +1 pt` (sum of the quarter cards) · `Shooting luck: you -4 pts` (actual points minus expected points) | Tap any line for the per-quarter split |
| Player of the game | One card: highest scorer on the winning side, with points | Full box score for both teams |
| Buttons | Rematch (same opponent, new deal) · New opponent | Play by play drawer: the whole log as text |

"Shooting luck" is `score - sum over quarters of (ppp x 25)`. It tells a player who lost on a cold night that the
build and the calls were fine, which is the honest answer to "this feels random".

Not on this screen: prices, hints, anything about the next match.

---

## What is deliberately not in the UI at all

- The court. v1's court was the cluttered screen. v2 has no positions on a floor to read: the lineup screen is two rows of cards and the game is a scoreboard and a ticker.
- Numbers on bars. Segments only.
- The 0.08 chemistry factor, the make-chance formulas, the usage weights. A curious player can find them in "How it works" in settings, copied from `rules.md`.
- A substitution or bench control. There is no bench in v2.
