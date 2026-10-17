# FlaTTy Birds (flappy-teddy): plan

A Flappy Bird-style game for Teddy (8) and Tommy (5), in the same family as Metro Surfer:
Three.js r149 classic scripts, everything drawn procedurally, Web Audio sound, one HTML page.

## The game

- **Title:** portrait cards for every roster character (Teddy and Tommy first). ← → or a tap picks; PLAY (or Space/Enter/tap) starts.
  Behind the title the picked kid flies through the course on autopilot.
- **Countdown:** 3, 2, 1, GO! The kid hovers mid-air while the first gate is still off-screen.
- **Flying:** tap, click, Space, ↑ or W makes the kid hop up (velocity is set, not added, so it's predictable). Gravity pulls down.
  The kid flies side-on with a jetpack that puffs smoke on every hop and tilts nose-up when rising, nose-down when falling.
- **Gates:** a stack of subway-train fronts rising from the platform and a tiled station pillar hanging from the elevated viaduct above.
  Fly through the gap: +1 score. A coin floats in about half the gaps.
- **Crash:** a soft bump, cartoon stars, the kid tumbles to the platform. No gore, no shaking text.
- **Game over:** score, coins, best (per character, in localStorage) and a big RUN AGAIN button. Input is ignored for a moment so frantic tapping
  doesn't skip the card. On a new best the kid does their signature pose (Tommy's Y peace pose, Teddy waves) with confetti.
- **Gentle by design:** wide gaps that narrow slowly, a slow start that speeds up a little, a ceiling you bump against instead of dying,
  and an EASY switch (wider gaps, slower, a bouncy floor) for Tommy.

## World (metres, side view)

- Camera: perspective, looking along -z. The kid flies along +x at z = 0, so the camera only tracks x.
  Background layers sit at real depths (z = -40, -100, -180), so perspective does the parallax for free.
- Play band: platform at y = 0, viaduct ceiling at y = 16.
- The view is fitted so the whole band is visible and at least 14 m of width shows in phone portrait; spare height goes mostly to sky.
- Physics runs in fixed 1/120 s substeps so it behaves the same at any frame rate and in the headless checks.

## Fairness check

`flappy.check()` generates long courses with the real generator and:
1. checks every gate statically (gap size, gap inside the band, vertical shift between neighbours within the reachable limit);
2. flies a simple bot through them headless with the real physics step, and reports crashes.
`flappy.check({ bot: false })` and `flappy.check({ broken: true })` must report failures, which proves the check can fail.

## Files

```
index.html     page, HUD, screens (CSS inline)
js/scene.js    canvas textures, background layers, gates, coins, jetpack, particles
js/hero.js     the flying kid: Kit person + jetpack, flying / tumble / signature poses
js/game.js     physics, course generator, states, input, HUD, test hooks
kit/           synced copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .)
dist/flappy-teddy.html   single-page build (python3 ../kit/tools/bundle.py .)
```

## Phases

1. Before the kit is ready: core loop with placeholder shapes, Three.js from ../metro-surfer/vendor/three.min.js.
2. When kit/README.md exists: sync the kit, load kit scripts, characters from Kit.roster / Kit.people, portraits from Kit.portraits,
   sound from Kit.sound. Anything new (poses, helpers) lives in this repo and is listed in the README as a kit candidate.
