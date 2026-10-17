# FlaTTy Birds

A Flappy Bird-style game starring Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js.
The kid wears a jetpack and hops through towers of stacked subway trains under an elevated metro line.
There are no image, model, or audio files: textures are painted on canvases, the people are built from boxes by the shared kit,
and every sound is synthesised.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`.
- **Send one file:** `dist/flatty-birds.html` is the whole game in one page (about 720 KB). AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name flatty-birds`
- The two fonts load from Google Fonts when online. Offline, the game falls back to Arial Black and the system font.

| Keys | Touch / mouse | |
|---|---|---|
| Space, ↑, W or Enter | tap or click anywhere | hop (on the title: play; after a run: run again) |
| ← → or A D | tap a card | pick a flyer on the title screen |
| T | buddy button (bottom right) or his card on the title | call your buddy, the other brother: any time, as often as you like |
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
- **New best:** "YAY!", confetti, and the kid does their signature moves from the kit roster, over and over: Tommy his Y peace pose (比耶)
  with little happy hops; Teddy Mike Tyson-style boxing (jab, guard, straight), then a basketball jump shot that sends a 🏀 flying;
  everyone else waves.
  Bests are saved per flyer (and separately for easy mode) in the browser, so `index.html` and the dist page each keep their own.
- **Gentle by design:** soft gravity, a hop rises about 1.7 m, wide gaps that narrow slowly over the first 50 gates, and a slow start that speeds up a little.
- **Your buddy is the other brother** (like Metro Surfer's): Tommy flies along with every flyer, and Teddy comes when Tommy is the one playing.
  Tap the big button with his face (bottom right), his dashed card on the title screen (he shows up behind the menu right away), or press T.
  For about 10 s he flies a little behind you with his own jetpack and name tag, copying your hops a beat later along the same path.
  He says hi with his signature move (Tommy's Y peace pose, Teddy's boxing), flies up close to hand over a treat
  (🍦 💧 🧃 🍪 🍉 🍌, "🍦 ICE CREAM FROM TOMMY!") that arcs into your hand, then says bye (Tommy's Y again, or Teddy's jump shot
  with a 🏀 that flies ahead: SWISH!) and drops back out of view. Tap again after his treat and he comes back for another hello and another treat.
  There's no cooldown, and before his treat an extra tap just keeps him coming.
  **He has your back:** while he's with you (until he starts dropping back, about 9.6 s; the bar with his face shows the time left, and his button glows),
  bumping into a gate doesn't end the run. The train stack and pillar pop instead, or the platform bounces you back up,
  "TOMMY SAVED YOU!" (or "TEDDY SAVED YOU!") pops up and he does his hello move. The rest is just for fun: the score works the same with or without him.
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
`flappy.crash()`, `flappy.pick(id)`, `flappy.easy(on)`, `flappy.buddy()` (calls him like his button and reports where he is;
`flappy.buddy(false)` only reports), `flappy.peek(distance)` for a close-up camera, `flappy.hero.move` (which celebration move is playing),
and, for screenshots from a hidden Browser pane, `flappy.keepAwake()` (don't auto-pause when hidden) and `flappy.freeze()` (stop real-time ticking).

## Files

```
index.html       page, HUD and screens (CSS inline)
js/scene.js      canvas textures; sky, city layers, platform and viaduct; train-stack gates, coins, jetpack, particles
js/hero.js       the flying kid: Kit person + jetpack, flying / tumble / stand / celebration poses
js/game.js       physics, course generator, autopilot, fairness check, the buddy, states, input, HUD, test hooks
kit/             copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .); don't edit it here
dist/flatty-birds.html   the single-page build
PLAN.md          the plan this was built from
```

## Kit candidates

Written here first; worth moving into `~/claude-games/kit` if another game wants them:

- **Standing celebrations** (`standPose` in `js/hero.js`): `wave` and `peace` stride while they pose because they were made for running buddies.
  This settles the legs so a kid can wave or do the Y pose on the spot. A `still` option for `Kit.people.pose` would do the same.
- **Celebration loop** (`celebration` and `segment` in `js/hero.js`): the roster signature moves in turn, each turned to read best
  (boxing three-quarters on, the jump shot side-on), with the jump and the 🏀 for the jump shot (`handWorld` places the ball between the hands).
- **Jetpack model** (`buildJetpack` in `js/scene.js`) with flames that grow on each hop; Metro Surfer has its own jetpack too.
- **Particle pool** (`makeParticles` in `js/scene.js`): point sprites with per-particle colour, fade, gravity and drag.
- **Sounds** made with `Kit.sound.tone` / `hiss`: a jetpack puff for each hop, a two-note chime per gate and a soft cartoon bonk (`OWN_SOUNDS` in `js/game.js`).
- **Dizzy stars** that circle the head after a bump (`js/hero.js`).
- **Mid-air signature moves** (`airPose` in `js/hero.js`): a pose done with the arms while the legs dangle, turned to read best.
- **The buddy's path-following** (`trail`, `trailY`, `flapXs` in `js/game.js`): he replays your path and your hops a beat later.
  Metro Surfer does the same for jumps and rolls; both could share one helper.

## Not verified

- **Sound:** the effects and music are wired to the kit, but nobody listened in this build (the test browser has no audio check).
- **Real touch devices:** touch was tested with emulated pointer and touch events at phone and iPad sizes in the Browser pane, not on a real iPhone or iPad.
