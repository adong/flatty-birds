# FlaTTy Birds

A Flappy Bird-style game starring Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js.
The kid wears a jetpack and hops through towers of stacked subway trains under an elevated metro line.
There are no image, model, or audio files: textures are painted on canvases, the people are built from boxes by the shared kit,
and every sound is synthesised.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`.
- **Send one file:** `dist/flappy-teddy.html` is the whole game in one page (about 720 KB). AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name flappy-teddy`
- The two fonts load from Google Fonts when online. Offline, the game falls back to Arial Black and the system font.

| Keys | Touch / mouse | |
|---|---|---|
| Space, ↑, W or Enter | tap or click anywhere | hop (on the title: play; after a run: run again) |
| ← → or A D | tap a card | pick a flyer on the title screen |
| E | 🐣 button | easy mode on or off (title screen) |
| P or Esc | ❚❚ button | pause; Space or a tap resumes after a short countdown |
| M | 🔊 button | sound on or off |

## How it works

- **Pick a flyer** on the title screen: TEDDY and TOMMY first (modelled on their photos, from the kit roster), then ZOOM, LUNA, BOLT the robot,
  BRUNO the bear and the ZOMBIE. Behind the title the picked kid flies the course on autopilot.
- **3, 2, 1, GO!** The kid hovers while the countdown runs, gets a free hop on GO, and the first gate is still a couple of seconds away.
- **Hop through the gaps.** Each gap is +1. Coins float in about half of the gaps, and sometimes in a little trail between gates.
  The viaduct above is a soft ceiling: you bump along it, you don't crash.
- **Bonk.** Touching a train stack, a pillar or the platform plays a soft bump, cartoon stars pop, and the kid tumbles down and stands up dizzy.
  The card shows score, coins and best. Taps are ignored for a moment so frantic tapping doesn't skip it, then RUN AGAIN (or tap, or Space).
- **New best:** "YAY!", confetti, and the kid celebrates standing on the spot: Tommy does his Y peace pose (比耶),
  Teddy waves, then shadow-boxes and does his jump shot (his kit signature), and everyone else waves.
  Bests are saved per flyer (and separately for easy mode) in the browser, so `index.html` and the dist page each keep their own.
- **Gentle by design:** soft gravity, a hop rises about 1.7 m, wide gaps that narrow slowly over the first 50 gates, and a slow start that speeds up a little.
- **Easy mode (🐣):** wider gaps (8.4 m narrowing to 7.2 m instead of 7.0 to 5.4), slower, smaller jumps between gaps, and a bouncy floor
  (touching the platform bounces you back up). It is on by default for Tommy and remembered per flyer.

To change the feel, edit `GRAVITY`, `FLAP_V` and `MODES` at the top of `js/game.js`.

## Fairness check

Every course comes from one generator, and the same physics step drives the game, the title-screen autopilot and a headless check.
From the browser console:

```js
flappy.check()                       // 6 courses of 150 gates: checks every gate, then the autopilot flies them
flappy.check({ mode: 'easy' })
flappy.check({ runs: 20, gates: 300 })
flappy.check({ bot: false })         // nobody hops: must report crashes (proves the check can fail)
flappy.check({ broken: true })       // a deliberately unfair generator: must report failures
```

For each gate it checks the gap size, that the gap stays inside the band, and that the step from the previous gap is within the design limit
and physically reachable at top speed. Then the autopilot flies every course. Last run: normal 20 × 300 gates and easy 20 × 300 gates,
0 static failures and 0 crashes. `{ bot: false }` crashed into the platform in every run, and `{ broken: true }` reported gaps that were too small,
too-big steps and crashes.

Other test hooks: `flappy.step(seconds, { auto })` advances the game and draws synchronously (the Browser pane throttles animation when hidden),
`flappy.crash()`, `flappy.pick(id)`, `flappy.easy(on)` and `flappy.peek(distance)` for a close-up camera.

## Files

```
index.html       page, HUD and screens (CSS inline)
js/scene.js      canvas textures; sky, city layers, platform and viaduct; train-stack gates, coins, jetpack, particles
js/hero.js       the flying kid: Kit person + jetpack, flying / tumble / stand / celebration poses
js/game.js       physics, course generator, autopilot, fairness check, states, input, HUD, test hooks
kit/             copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .); don't edit it here
dist/flappy-teddy.html   the single-page build
PLAN.md          the plan this was built from
```

## Kit candidates

Written here first; worth moving into `~/claude-games/kit` if another game wants them:

- **Standing celebrations** (`standPose` in `js/hero.js`): `wave` and `peace` stride while they pose because they were made for running buddies.
  This settles the legs so a kid can wave or do the Y pose on the spot. A `still` option for `Kit.people.pose` would do the same.
- **Celebration sequence** (`celebration` in `js/hero.js`): wave, then the roster signature poses in turn.
- **Jetpack model** (`buildJetpack` in `js/scene.js`) with flames that grow on each hop; Metro Surfer has its own jetpack too.
- **Particle pool** (`makeParticles` in `js/scene.js`): point sprites with per-particle colour, fade, gravity and drag.
- **Sounds** made with `Kit.sound.tone` / `hiss`: a jetpack puff for each hop, a two-note chime per gate and a soft cartoon bonk (`OWN_SOUNDS` in `js/game.js`).
- **Dizzy stars** that circle the head after a bump (`js/hero.js`).

## Not verified

- **Sound:** the effects and music are wired to the kit, but nobody listened in this build (the test browser has no audio check).
- **Real touch devices:** touch was tested with emulated pointer and touch events at phone and iPad sizes in the Browser pane, not on a real iPhone or iPad.
