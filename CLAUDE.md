# ISO

Two-player basketball card and dice game (private beta). Concept owner: Patrick. Built with Michael.

## Run it
- `npm install`, then `npm run dev` (http://localhost:5181)
- `npm test` runs the rules tests. `npm run build` type-checks and builds.
- Handy URLs in dev: `?demo=draft|lineup|court|reveal|break|final|gameover` jumps to a screen against the bot; `?seed=abc` fixes the dice; `?transport=bc` plays two tabs locally.

## Where things are
- `docs/v3/rules.md`: the rules in tabletop language (the source of truth) and the engine API the screens use. `docs/v3/numbers.md`: measured balance.
- `src/game/`: pure, deterministic rules engine (roster, dice, abilities, deck, subs, stats, bot). No UI code here. Change rules here and keep `rules.md` in sync.
- `src/net/`, `src/session/`: online play (both players run the same engine from the same seed; secret picks use commit-reveal).
- `src/ui/screens/`, `src/ui/components/`, `src/styles/`: the app. `diceScene.ts` is the 3D dice, `ballScene.ts` the logo ball.
- `public/players/`: player photo cut-outs with licences in `credits.json`.
- `docs/v2/` is an older, abandoned simulation design. Ignore it.

## Rules of the game design
- It must be playable on a table with real cards and d4/d6/d8/d10/d12. Outcomes come only from dice and card text. No simulations, percentages or decimals.
- Player ratings, PASS/REB dice, OVR and abilities are placeholders that need tuning.

## Look
- Black UI, violet (#a47bff) for offence, cyan (#27d7ff) for defence, dark iridescent edge on elite cards only. No lime, no gold theme.
- Phone first, should feel like a native iOS app. Keep the court uncluttered: faces and names, details on tap.
- No team or league logos. No money or stakes features. The site stays `noindex`.

## Deploying
The live site (https://iso-beta-zeta.vercel.app) is deployed by Michael from his machine with `vercel deploy --prod`. Pushing to GitHub does not update it.
