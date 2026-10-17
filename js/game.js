/* FlaTTy Birds — game logic.
   The kid flies along +x at z = 0. Gravity pulls down and a hop sets the upward speed (it doesn't add to it), so every hop
   feels the same. Gates are generated ahead and recycled behind. One physics step (stepFlyer) drives the real game,
   the title-screen autopilot and the headless fairness check (flappy.check). */
(function () {
  'use strict';
  const T = THREE, A = window.FlappyScene, H = window.FlappyHero, Kit = window.Kit;
  const { PLAY_TOP, COL_W, CAP_W, CAP_H, PIL_W, SEG } = A.DIMS;

  // ---------------------------------------------------------------- tuning
  const GRAVITY = 22;
  const FLAP_V = 8.6; // a hop rises about 1.7 m
  const MAX_FALL = 12;
  const HIT_R = 0.6; // the kid's hit circle; the drawn kid is a bit bigger, so near misses look close and still count
  const FORGIVE = 0.12; // gate hit boxes are this much smaller than the drawn gates
  const MARGIN = 2.2; // gaps keep at least this far from the platform and the viaduct
  const FIRST_X = 30; // the first gate, in metres after the start line
  const COUNT_T = 3;
  const DT = 1 / 120; // physics substep
  const HOVER_Y = PLAY_TOP * 0.5;
  // Each value eases from [start, end] as the score goes from 0 to `ramp`.
  const MODES = {
    normal: { speed: [5.6, 7.2], gap: [7.0, 5.4], spacing: [12.5, 11], shift: [2.6, 4.0], ramp: 50, bounce: false },
    easy: { speed: [4.8, 5.8], gap: [8.4, 7.2], spacing: [13, 12], shift: [2.0, 2.8], ramp: 60, bounce: true },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const smooth = (t) => t * t * (3 - 2 * t);
  const tune = (m, key, i) => lerp(m[key][0], m[key][1], smooth(clamp(i / m.ramp, 0, 1)));
  const $ = (id) => document.getElementById(id);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('flappyTeddy.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try { localStorage.setItem('flappyTeddy.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };

  // Kit.sound effects by name, plus this game's own: a jetpack puff for each hop and a two-note chime per gate.
  const OWN_SOUNDS = {
    flap() {
      Kit.sound.hiss({ filter: 'lowpass', f: 1800, to: 500, dur: 0.14, vol: 0.16 });
      Kit.sound.tone({ f: 330, to: 560, dur: 0.1, vol: 0.05 });
    },
    point() {
      Kit.sound.tone({ type: 'triangle', f: 784, dur: 0.1, vol: 0.08 });
      Kit.sound.tone({ type: 'triangle', f: 1175, at: 0.07, dur: 0.18, vol: 0.08 });
    },
    bonk() {
      Kit.sound.bump();
      Kit.sound.tone({ f: 420, to: 160, dur: 0.22, vol: 0.12 }); // a cartoon boing, never a crash
    },
  };
  function sfx(name, arg) {
    try {
      if (OWN_SOUNDS[name]) return OWN_SOUNDS[name]();
      if (typeof Kit.sound[name] === 'function') return Kit.sound[name](arg);
    } catch (e) { /* never let sound break the game */ }
  }

  // ---------------------------------------------------------------- course generator (pure: used by the game and the check)

  function makeCourse(mode, seed, broken) {
    return { mode, m: MODES[mode], rng: mulberry32(seed), gates: [], n: 0, last: null, broken: !!broken };
  }

  function addGate(course) {
    const { m, rng } = course;
    const i = course.n++;
    const prev = course.last;
    let gap = tune(m, 'gap', i);
    let shift = tune(m, 'shift', i);
    if (course.broken) {
      gap *= 0.45; // deliberately unfair, to prove the check notices
      shift *= 4;
    }
    const cMin = MARGIN + gap / 2, cMax = PLAY_TOP - MARGIN - gap / 2;
    let c;
    if (!prev) c = HOVER_Y + (rng() - 0.5) * 2;
    else {
      c = prev.c + (rng() * 2 - 1) * shift;
      if (c < cMin) c = cMin + (cMin - c) * 0.5; // bounce off the band edges so the course keeps moving
      if (c > cMax) c = cMax - (c - cMax) * 0.5;
      if (!course.broken) c = clamp(c, prev.c - shift, prev.c + shift);
    }
    if (!course.broken) c = clamp(c, cMin, cMax);
    const x = prev ? prev.x + tune(m, 'spacing', i) : FIRST_X;
    const g = { i, x, c, gap, lo: c - gap / 2, hi: c + gap / 2, passed: false, coins: [] };
    if (i > 0 && rng() < 0.5) g.coins.push({ x, y: c, taken: false });
    if (prev && i > 1 && rng() < 0.25) {
      // a little trail of three coins on the straight line between the two gap centres
      for (const f of [0.35, 0.5, 0.65]) g.coins.push({ x: lerp(prev.x, x, f), y: lerp(prev.c, c, f), taken: false });
    }
    course.gates.push(g);
    course.last = g;
    return g;
  }

  // ---------------------------------------------------------------- physics (pure)

  function circleBox(px, py, x0, x1, y0, y1) {
    const dx = px - clamp(px, x0, x1), dy = py - clamp(py, y0, y1);
    return dx * dx + dy * dy < HIT_R * HIT_R;
  }

  function gateHit(g, x, y) {
    if (Math.abs(x - g.x) > CAP_W / 2 + HIT_R) return false;
    const F = FORGIVE;
    return (
      circleBox(x, y, g.x - COL_W / 2 + F, g.x + COL_W / 2 - F, -50, g.lo - F) || // train stack
      circleBox(x, y, g.x - CAP_W / 2 + F, g.x + CAP_W / 2 - F, g.hi + F, g.hi + CAP_H) || // pillar cap
      circleBox(x, y, g.x - PIL_W / 2 + F, g.x + PIL_W / 2 - F, g.hi + CAP_H, 50) // pillar
    );
  }

  // Advance the flyer p = { x, y, vy } by dt. Returns null, or what happened: a gate object (crash), 'floor' (crash),
  // 'bounce' (easy mode's bouncy platform) or 'ceiling' (a harmless bump on the viaduct).
  function stepFlyer(p, dt, course, speed) {
    p.vy = Math.max(p.vy - GRAVITY * dt, -MAX_FALL);
    p.x += speed * dt;
    p.y += p.vy * dt;
    let ev = null;
    if (p.y > PLAY_TOP - HIT_R) {
      p.y = PLAY_TOP - HIT_R;
      if (p.vy > 0) p.vy = 0;
      ev = 'ceiling';
    }
    for (const g of course.gates) if (gateHit(g, p.x, p.y)) return g;
    if (p.y < HIT_R) {
      if (!course.m.bounce) return 'floor';
      p.y = HIT_R;
      p.vy = FLAP_V * 0.85;
      return 'bounce';
    }
    return ev;
  }

  // The autopilot: hop once you've dropped below the target height. A hop always peaks APEX above where it started,
  // so hovering this way keeps the kid within about a metre of the gap centre. Inside a gate it already drifts toward
  // the next gap, but only as far as the current gap safely allows.
  const APEX = (FLAP_V * FLAP_V) / (2 * GRAVITY);
  function botWantsFlap(p, course) {
    let cur = null, nxt = null;
    for (const g of course.gates) {
      if (g.x + CAP_W / 2 + HIT_R < p.x) continue;
      if (!cur) cur = g;
      else {
        nxt = g;
        break;
      }
    }
    let c = HOVER_Y;
    if (cur) {
      c = cur.c;
      if (nxt && p.x + HIT_R > cur.x - CAP_W / 2) {
        const safe = Math.max(0, cur.gap / 2 - HIT_R - 1.1);
        c = clamp(nxt.c, cur.c - safe, cur.c + safe);
      }
    }
    const target = c - APEX / 2;
    if (p.y < target - 1 && p.vy < FLAP_V * 0.35) return true; // far below: keep hopping to climb fast
    return p.y < target && p.vy <= 0;
  }

  // ---------------------------------------------------------------- fairness check (headless)
  // Generates courses with the real generator, checks every gate against its neighbour, then flies the autopilot
  // through them with the real physics step. { bot: false } (nobody hops) and { broken: true } (an unfair generator)
  // must both fail, which shows the check can fail.
  function check(opts = {}) {
    const mode = opts.mode || 'normal', runs = opts.runs || 6, want = opts.gates || 150;
    const useBot = opts.bot !== false;
    const m = MODES[mode];
    const rep = { mode, runs, gatesPerRun: want, bot: useBot, broken: !!opts.broken, gatesChecked: 0, staticFails: [], crashes: [], passed: [], coins: 0, minGap: Infinity, maxShift: 0 };
    const climbRate = FLAP_V * 0.5; // average climb when hopping each time the kid starts to fall
    for (let r = 0; r < runs; r++) {
      const course = makeCourse(mode, (opts.seed || 1000) + r, opts.broken);
      const p = { x: 0, y: HOVER_Y, vy: FLAP_V * 0.75 };
      let passed = 0, t = 0, crash = null;
      const verify = (g) => {
        rep.gatesChecked++;
        rep.minGap = Math.min(rep.minGap, g.gap);
        const why = [];
        if (g.gap < m.gap[1] - 1e-6) why.push('gap ' + g.gap.toFixed(2) + ' < ' + m.gap[1]);
        if (g.lo < MARGIN - 1e-6 || g.hi > PLAY_TOP - MARGIN + 1e-6) why.push('gap outside the band');
        const prev = course.gates[course.gates.length - 2];
        if (prev && prev.i === g.i - 1) {
          const shift = Math.abs(g.c - prev.c);
          rep.maxShift = Math.max(rep.maxShift, shift);
          if (shift > tune(m, 'shift', g.i) + 1e-6) why.push('shift ' + shift.toFixed(2) + ' > design limit');
          // physically reachable? the kid may sit anywhere in either gap's safe band
          const travel = Math.max(0, shift - (prev.gap / 2 - HIT_R) - (g.gap / 2 - HIT_R));
          const time = (g.x - prev.x - CAP_W - 2 * HIT_R) / m.speed[1];
          const reach = g.c > prev.c ? climbRate * time : 0.5 * GRAVITY * time * time;
          if (time <= 0 || travel > reach) why.push('not reachable: needs ' + travel.toFixed(2) + ' m in ' + time.toFixed(2) + ' s');
        }
        if (why.length) rep.staticFails.push({ run: r, gate: g.i, why: why.join('; ') });
      };
      while (passed < want && t < want * 3 + 60) {
        while (!course.last || course.last.x < p.x + 40) verify(addGate(course));
        while (course.gates.length && course.gates[0].x < p.x - 10) course.gates.shift();
        if (useBot && botWantsFlap(p, course)) p.vy = FLAP_V;
        const ev = stepFlyer(p, DT, course, tune(m, 'speed', passed));
        t += DT;
        for (const g of course.gates) {
          if (!g.passed && g.x + COL_W / 2 < p.x - HIT_R) {
            g.passed = true;
            passed++;
          }
          for (const c of g.coins) {
            if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < HIT_R + 0.5) {
              c.taken = true;
              rep.coins++;
            }
          }
        }
        if (ev === 'floor' || (ev && typeof ev === 'object')) {
          const g = ev === 'floor' ? null : ev, prev = g && course.gates.find((q) => q.i === g.i - 1);
          crash = { run: r, gate: passed, x: +(p.x - (g ? g.x : 0)).toFixed(2), y: +p.y.toFixed(2), vy: +p.vy.toFixed(2), what: g ? 'gate ' + g.i : 'floor' };
          if (g) Object.assign(crash, { lo: +g.lo.toFixed(2), hi: +g.hi.toFixed(2), prevC: prev ? +prev.c.toFixed(2) : null });
          break;
        }
      }
      if (crash) rep.crashes.push(crash);
      rep.passed.push(passed);
    }
    rep.ok = rep.staticFails.length === 0 && rep.crashes.length === 0;
    rep.minGap = +rep.minGap.toFixed(2);
    rep.maxShift = +rep.maxShift.toFixed(2);
    rep.staticFails = rep.staticFails.slice(0, 10).concat(rep.staticFails.length > 10 ? [{ more: rep.staticFails.length - 10 }] : []);
    return rep;
  }

  // ---------------------------------------------------------------- state

  const G = {
    state: 'loading', t: 0, score: 0, coins: 0, best: 0, newBest: false, bestToast: false,
    mode: 'normal', countT: 0, countMove: true, lastCount: 0, overT: 0, lockT: 0, shakeT: 0, closeK: 0,
    camX: 0, auto: false, paused: null, bounced: false, sparkT: 0, streak: 0, coinT: -9,
  };
  const P = { x: 0, y: HOVER_Y, vy: 0, vx: 0, atTop: false };
  let course = makeCourse('normal', 1);
  let renderer, scene, camera, sun, hero = null, entry = null;
  let layers = [], segs = [], puffs, sparks, starBurst;
  const gatePool = [], coinPool = [];
  const view = { dist: 30, cy: 8, w: 30, lead: 6, aspect: 1, tan: Math.tan((40 / 2) * Math.PI / 180) };
  const ui = {};
  let ROSTER = [];
  let last = 0;
  const nozzle = [new T.Vector3(), new T.Vector3()];

  const bestKey = (id, easy) => 'best.' + id + (easy ? '.easy' : '');
  const isEasy = () => G.mode === 'easy';

  // ---------------------------------------------------------------- course visuals

  function dress(g) {
    g.vis = gatePool.pop() || A.buildGate();
    g.vis.set(g.lo, g.hi);
    g.vis.obj.position.x = g.x;
    g.vis.obj.visible = true;
    scene.add(g.vis.obj);
    for (const c of g.coins) {
      c.mesh = coinPool.pop() || A.buildCoin();
      c.mesh.position.set(c.x, c.y, 0);
      c.mesh.visible = true;
      scene.add(c.mesh);
    }
  }

  function undress(g) {
    if (g.vis) {
      scene.remove(g.vis.obj);
      gatePool.push(g.vis);
      g.vis = null;
    }
    for (const c of g.coins) {
      if (!c.mesh) continue;
      scene.remove(c.mesh);
      coinPool.push(c.mesh);
      c.mesh = null;
    }
  }

  function ensureCourse() {
    while (!course.last || course.last.x < G.camX + view.w + 30) dress(addGate(course));
    while (course.gates.length && course.gates[0].x + CAP_W < G.camX - view.w / 2 - 6) undress(course.gates.shift());
  }

  function newRun(attract) {
    for (const g of course.gates) undress(g);
    course = makeCourse(G.mode, (Math.random() * 1e9) | 0);
    Object.assign(P, { x: 0, y: HOVER_Y, vy: 0, vx: 0, atTop: false });
    Object.assign(G, { score: 0, coins: 0, newBest: false, bestToast: false, overT: 0, shakeT: 0, closeK: 0, bounced: false, streak: 0, auto: attract || G.auto });
    G.best = store.get(bestKey(entry.id, isEasy()), 0);
    G.camX = P.x + view.lead;
    for (const l of layers) l.reset(G.camX);
    placeSegments();
    puffs.clear();
    sparks.clear();
    starBurst.clear();
    hero.setMode('hover');
    hero.dizzy(0);
    ensureCourse();
    updateHud(true);
  }

  // ---------------------------------------------------------------- game flow

  function startAttract() {
    G.state = 'title';
    G.auto = false;
    newRun(true);
    show('title');
    ui.hud.classList.remove('counting');
    sfx('music', 'title');
  }

  function startGame() {
    sfx('init');
    sfx('click');
    G.auto = false;
    newRun(false);
    G.state = 'count';
    G.countT = COUNT_T;
    G.countMove = true;
    G.lastCount = 0;
    show('hud');
    ui.hud.classList.add('counting');
    sfx('music', 'play');
  }

  function doFlap() {
    P.vy = FLAP_V;
    hero.flap();
    hero.nozzles(nozzle);
    for (const n of nozzle) puffs.emit(n.x, n.y, n.z, 5, { color: ['#ffffff', '#eef3f8', '#dde6ef'], spread: 0.12, speed: 0.9, vx: -1.2, vy: -2.6, gravity: -2, drag: 2.5, life: 0.75 });
    if (G.state === 'play' && !G.auto) sfx('flap');
  }

  function primary() {
    sfx('init');
    switch (G.state) {
      case 'play': return doFlap();
      case 'count': return hero.flap(); // a practice flap of the arms; the run hasn't started yet
      case 'title': return startGame();
      case 'over': if (G.lockT <= 0) startGame(); return;
      case 'paused': return togglePause();
    }
  }

  function onPass() {
    G.score++;
    sfx('point');
    updateHud();
    bump(ui.score);
    if (!G.bestToast && G.best > 0 && G.score > G.best && !G.auto) {
      G.bestToast = true;
      toast('NEW BEST!');
      sfx('powerup');
    }
  }

  function takeCoin(c) {
    c.taken = true;
    if (c.mesh) c.mesh.visible = false;
    sparks.emit(c.x, c.y, 0.3, 14, { color: ['#ffe14d', '#fff6b8', '#ffb31a'], spread: 0.25, speed: 3.2, gravity: 4, drag: 2, life: 0.55 });
    if (G.state === 'play' && !G.auto) {
      G.coins++;
      G.streak = G.t - G.coinT < 3 ? G.streak + 1 : 0;
      G.coinT = G.t;
      sfx('coin', G.streak);
      updateHud();
      bump(ui.coinPill);
    }
  }

  function crash(ev) {
    if (G.state === 'title') return newRun(true); // the autopilot shouldn't crash; if it does, quietly start over
    G.state = 'fall';
    G.bounced = false;
    const fromGate = ev && typeof ev === 'object';
    P.vx = fromGate ? -3.2 : 0;
    P.vy = fromGate ? 4.5 : 3;
    hero.setMode('tumble');
    G.shakeT = 0.22;
    starBurst.emit(P.x + 0.3, P.y + 0.2, 0.6, 12, { color: ['#ffe14d', '#ffffff', '#ffd0f0'], spread: 0.2, speed: 4.5, gravity: 3, drag: 2.2, life: 0.8 });
    sfx('bonk');
    sfx('music', 'over');
    finishRun();
  }

  function finishRun() {
    if (G.auto) return;
    if (G.score > G.best) {
      G.newBest = G.score > 0;
      G.best = G.score;
      store.set(bestKey(entry.id, isEasy()), G.best);
    }
    const total = store.get('coins', 0) + G.coins;
    store.set('coins', total);
  }

  // Where a tumbling kid comes to rest: the platform, or the roof of a train stack they're above.
  function floorAt(x) {
    let f = 0;
    for (const g of course.gates) if (Math.abs(x - g.x) < COL_W / 2 && g.lo > f) f = g.lo;
    return f;
  }

  function fallTick(dt) {
    P.vy = Math.max(P.vy - GRAVITY * dt, -MAX_FALL);
    P.x += P.vx * dt;
    P.vx *= Math.exp(-1.5 * dt);
    P.y += P.vy * dt;
    // don't tumble into a train stack's side
    for (const g of course.gates) {
      if (P.y < g.lo && Math.abs(P.x - g.x) < COL_W / 2 + HIT_R) P.x = Math.min(P.x, g.x - COL_W / 2 - HIT_R);
    }
    const stand = floorAt(P.x) + H.CENTER * H.SCALE;
    if (P.y <= stand && P.vy < 0) {
      P.y = stand;
      if (!G.bounced && P.vy < -4) {
        G.bounced = true;
        P.vy = -P.vy * 0.3;
        P.vx *= 0.5;
        sfx('land');
        puffs.emit(P.x, stand - 0.8, 0.2, 10, { color: ['#e8e2d6', '#d6cfc2'], spread: 0.3, speed: 1.6, vy: 0.6, gravity: 1, drag: 3, life: 0.6 });
      } else {
        P.vy = 0;
        P.vx = 0;
        G.state = 'over';
        G.overT = 0;
        G.lockT = 0.9;
        hero.setMode(G.newBest ? 'celebrate' : 'stand');
        hero.dizzy(G.newBest ? 0 : 2.4);
        if (G.newBest) {
          sfx('powerup');
          confetti();
        }
        showOver();
      }
    }
  }

  function confetti() {
    sparks.emit(P.x, P.y + 2.6, 0.4, 70, { color: ['#ff3d7f', '#ffd400', '#18d4ff', '#7cff6b', '#b46cff', '#ffffff'], spread: 0.6, speed: 3.6, vy: 3, gravity: 3.5, drag: 1.2, life: 2.2 });
  }

  function playTick(dt, auto) {
    const speed = tune(course.m, 'speed', G.score);
    if (auto && botWantsFlap(P, course)) doFlap();
    const ev = stepFlyer(P, dt, course, speed);
    G.camX = P.x + view.lead;
    ensureCourse();
    for (const g of course.gates) {
      if (!g.passed && g.x + COL_W / 2 < P.x - HIT_R) {
        g.passed = true;
        if (G.state === 'play') onPass();
        else G.score++;
      }
      for (const c of g.coins) if (!c.taken && Math.abs(c.x - P.x) < 1.2 && Math.hypot(c.x - P.x, c.y - P.y) < HIT_R + 0.5) takeCoin(c);
    }
    if (ev === 'ceiling') {
      if (!P.atTop && G.state === 'play') sfx('click');
      P.atTop = true;
    } else P.atTop = false;
    if (ev === 'bounce') {
      sfx('land');
      hero.flap();
      puffs.emit(P.x, 0.1, 0.2, 8, { color: ['#e8e2d6', '#ffffff'], spread: 0.3, speed: 1.5, vy: 0.8, gravity: 1, drag: 3, life: 0.5 });
    }
    if (ev === 'floor' || (ev && typeof ev === 'object')) crash(ev);
  }

  function tick(dt) {
    G.t += dt;
    G.shakeT = Math.max(0, G.shakeT - dt);
    switch (G.state) {
      case 'title':
        playTick(dt, true);
        break;
      case 'count': {
        G.countT -= dt;
        if (G.countMove) {
          P.x += tune(course.m, 'speed', 0) * dt;
          G.camX = P.x + view.lead;
          ensureCourse();
        }
        const base = G.countMove ? HOVER_Y : G.hoverY;
        P.y = base + Math.sin(G.t * 2.6) * 0.22;
        P.vy = Math.cos(G.t * 2.6) * 0.5;
        const n = Math.ceil(G.countT);
        if (n !== G.lastCount && n > 0) {
          G.lastCount = n;
          showCount(String(n));
          sfx('click');
        }
        if (G.countT <= 0) {
          G.state = 'play';
          ui.hud.classList.remove('counting');
          hero.setMode('fly');
          showCount('GO!');
          sfx('swipe');
          doFlap();
          P.vy = FLAP_V * 0.75;
        }
        break;
      }
      case 'play':
        playTick(dt, G.auto);
        break;
      case 'fall':
        fallTick(dt);
        break;
      case 'over':
        G.overT += dt;
        G.lockT -= dt;
        break;
    }
  }

  // ---------------------------------------------------------------- pause, mute, picking

  function togglePause() {
    if (G.state === 'play' || G.state === 'count') {
      G.paused = G.state;
      G.state = 'paused';
      show('pause');
      sfx('music', 'pause');
    } else if (G.state === 'paused') {
      // resume with a short countdown, hovering where the kid was
      G.state = 'count';
      G.countT = 2;
      G.countMove = false;
      G.lastCount = 0;
      G.hoverY = clamp(P.y, HIT_R + 0.5, PLAY_TOP - HIT_R - 0.5);
      hero.setMode('hover');
      show('hud');
      ui.hud.classList.add('counting');
      sfx('music', 'play');
    }
  }

  function toggleMute() {
    sfx('init');
    sfx('toggleMute');
    const muted = !!sfx('isMuted');
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
    ui.muteTitle.textContent = muted ? '🔇' : '🔊';
  }

  function setEasy(on) {
    G.mode = on ? 'easy' : 'normal';
    store.set('easy.' + entry.id, !!on);
    ui.easyBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    ui.easyBtn.querySelector('b').textContent = on ? 'EASY ON' : 'EASY OFF';
    refreshBests();
    if (G.state === 'title') newRun(true);
  }

  function pickCharacter(id, user) {
    const e = ROSTER.find((r) => r.id === id) || ROSTER[0];
    if (hero && entry && e.id === entry.id) return;
    entry = e;
    store.set('kid', e.id);
    if (hero) scene.remove(hero.root);
    hero = H.build(e);
    scene.add(hero.root);
    hero.root.position.set(P.x, P.y, 0);
    G.mode = store.get('easy.' + e.id, e.id === 'tommy') ? 'easy' : 'normal';
    ui.easyBtn.setAttribute('aria-pressed', isEasy() ? 'true' : 'false');
    ui.easyBtn.querySelector('b').textContent = isEasy() ? 'EASY ON' : 'EASY OFF';
    document.querySelectorAll('.avatar').forEach((b) => b.setAttribute('aria-checked', b.dataset.id === e.id ? 'true' : 'false'));
    refreshBests();
    if (user) sfx('click');
    if (G.state === 'title') newRun(true);
  }

  function refreshBests() {
    document.querySelectorAll('.avatar').forEach((b) => {
      b.querySelector('.bs').textContent = 'BEST ' + store.get(bestKey(b.dataset.id, store.get('easy.' + b.dataset.id, b.dataset.id === 'tommy')), 0);
    });
    if (entry) {
      ui.bestName.textContent = entry.name;
      ui.bestTitle.textContent = store.get(bestKey(entry.id, isEasy()), 0);
      ui.bestMode.textContent = isEasy() ? ' (EASY)' : '';
    }
  }

  // ---------------------------------------------------------------- UI

  function show(which) {
    for (const id of ['title', 'hud', 'over', 'pause']) ui[id].classList.toggle('hidden', id !== which && !(id === 'hud' && which === 'pause'));
    if (which === 'title') refreshBests();
  }

  function showOver() {
    ui.ovScore.textContent = G.score;
    ui.ovCoins.textContent = G.coins;
    ui.ovBest.textContent = G.best;
    ui.ovBestLabel.textContent = entry.name + "'S BEST" + (isEasy() ? ' (EASY)' : '');
    ui.newBest.classList.toggle('on', G.newBest);
    ui.ovTitle.textContent = G.newBest ? 'YAY!' : 'BONK!';
    ui.ovTitle.classList.toggle('yay', G.newBest);
    setTimeout(() => {
      if (G.state === 'over') show('over');
    }, 350);
  }

  function showCount(text) {
    const el = ui.count;
    el.textContent = text;
    el.classList.remove('go', 'tick');
    void el.offsetWidth; // restart the animation
    el.classList.add(text === 'GO!' ? 'go' : 'tick');
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    ui.toasts.appendChild(t);
    setTimeout(() => t.remove(), 1300);
  }

  let hudScore = -1, hudCoins = -1;
  function updateHud(force) {
    if (force || hudScore !== G.score) ui.score.textContent = hudScore = G.score;
    if (force || hudCoins !== G.coins) ui.coins.textContent = hudCoins = G.coins;
  }

  function buildPicker() {
    let faces = {};
    try {
      faces = Kit.portraits(ROSTER, { size: 176 });
    } catch (e) { /* no portraits: the cards still show names */ }
    const box = ui.picker;
    box.innerHTML = '';
    for (const e of ROSTER) {
      const b = document.createElement('button');
      b.className = 'avatar';
      b.dataset.id = e.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.innerHTML = '<img alt=""><span class="nm"></span><span class="bs"></span>';
      if (faces[e.id]) b.querySelector('img').src = faces[e.id];
      b.querySelector('.nm').textContent = e.name;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        sfx('init');
        pickCharacter(e.id, true);
      });
      box.appendChild(b);
    }
  }

  // ---------------------------------------------------------------- rendering

  function placeSegments() {
    const start = Math.floor((G.camX - view.w) / SEG) * SEG;
    segs.forEach((s, i) => {
      s.obj.position.x = start + i * SEG + SEG / 2;
      s.reskin();
    });
  }

  function halfW(z) {
    return (camera.position.z - z) * view.tan * view.aspect;
  }

  function render(dt) {
    const s = G.state;
    // hero
    if (s === 'title' || s === 'play') hero.setMode('fly');
    hero.update(dt, P.vy);
    hero.root.position.set(P.x, P.y + hero.hop, 0);
    // jet sparks while flying
    if (s === 'title' || s === 'play' || s === 'count') {
      G.sparkT -= dt;
      if (G.sparkT <= 0) {
        G.sparkT = 0.045;
        hero.nozzles(nozzle);
        for (const n of nozzle) sparks.emit(n.x, n.y - 0.15, n.z, 1, { color: ['#ffb31a', '#ffe14d', '#ff7a1a'], spread: 0.05, speed: 0.4, vx: -0.8, vy: -2.2, gravity: 0, drag: 1, life: 0.28 });
      }
    }
    puffs.update(dt);
    sparks.update(dt);
    starBurst.update(dt);
    // coins spin
    for (const g of course.gates) for (const c of g.coins) if (c.mesh) c.mesh.rotation.y += dt * 3;

    // camera: side-on, following the kid; after a run it eases in close to see them
    G.closeK = clamp(G.closeK + (s === 'over' ? dt * 1.4 : -dt * 3), 0, 1);
    const k = smooth(G.closeK);
    const farX = G.camX, farY = view.cy, farZ = view.dist;
    const cd = 9.5, ch = 2 * cd * view.tan;
    const nearX = P.x, nearY = P.y + ch * 0.22, nearZ = cd;
    camera.position.set(lerp(farX, nearX, k), lerp(farY, nearY, k), lerp(farZ, nearZ, k));
    if (G.peek) camera.position.set(P.x + G.peek.dx, P.y + G.peek.dy, G.peek.d); // test hook: flappy.peek()
    if (G.shakeT > 0) {
      const a = G.shakeT * 0.6;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    const cx = camera.position.x;
    for (const l of [layers[0], layers[1], layers[2]]) l.update(cx, halfW(l === layers[0] ? -46 : l === layers[1] ? -120 : -230));
    const hw = halfW(A.DIMS.PLAT_BACK) + 4;
    for (const sg of segs) {
      if (sg.obj.position.x + SEG / 2 < cx - hw) {
        sg.obj.position.x += SEG * segs.length;
        sg.reskin();
      }
    }
    sun.position.set(cx + 10, 34, 26);
    sun.target.position.set(cx, 4, 0);
    renderer.render(scene, camera);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (G.state !== 'paused') {
      const n = Math.max(1, Math.ceil(dt / DT - 0.01));
      for (let i = 0; i < n; i++) tick(dt / n);
    }
    render(G.state === 'paused' ? 0 : dt);
  }

  // ---------------------------------------------------------------- input

  function bindInput() {
    const onUi = (e) => e.target && e.target.closest && e.target.closest('button, .picker, a');
    window.addEventListener('pointerdown', (e) => {
      if (onUi(e)) return;
      if (e.button !== undefined && e.button > 0) return;
      if (G.state === 'play' || G.state === 'count') e.preventDefault();
      primary();
    }, { passive: false });
    // stop iOS double-tap zoom and long-press menus from interrupting play (menus still scroll)
    document.addEventListener('touchstart', (e) => {
      if (!onUi(e) && (G.state === 'play' || G.state === 'count')) e.preventDefault();
    }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const c = e.code;
      if (c === 'KeyM') return toggleMute();
      if (c === 'KeyP' || c === 'Escape') return togglePause();
      if (G.state === 'title') {
        if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD') {
          e.preventDefault();
          const i = ROSTER.indexOf(entry) + (c === 'ArrowLeft' || c === 'KeyA' ? -1 : 1);
          sfx('init');
          pickCharacter(ROSTER[(i + ROSTER.length) % ROSTER.length].id, true);
          const sel = document.querySelector('.avatar[aria-checked="true"]');
          if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
          return;
        }
        if (c === 'KeyE') return setEasy(!isEasy());
      }
      if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW' || c === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        primary();
      }
    });

    const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      sfx('init');
      fn();
      e.currentTarget.blur();
    });
    tapBtn('playBtn', startGame);
    tapBtn('againBtn', () => { if (G.lockT <= 0.4) startGame(); });
    tapBtn('changeBtn', () => { sfx('click'); startAttract(); });
    tapBtn('resumeBtn', togglePause);
    tapBtn('pauseBtn', togglePause);
    tapBtn('muteBtn', toggleMute);
    tapBtn('muteTitle', toggleMute);
    tapBtn('easyBtn', () => { sfx('click'); setEasy(!isEasy()); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.state === 'play' || G.state === 'count') togglePause();
        sfx('suspend');
      } else sfx('resume');
    });
    window.addEventListener('resize', resize);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const lo = -1.8, hi = PLAY_TOP + 3, band = hi - lo;
    const visH = Math.max(band, 12 / aspect); // phones in portrait still see at least 12 m of course
    const extra = visH - band;
    view.aspect = aspect;
    view.dist = visH / 2 / view.tan;
    view.cy = lo - extra * 0.3 + visH / 2;
    view.w = visH * aspect;
    view.lead = clamp(view.w * 0.25, 2.5, 9); // the kid flies a quarter of the way in from the left
    camera.aspect = aspect;
    camera.far = view.dist + 400;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    try {
      await Promise.race([document.fonts.load('64px Bungee'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { /* fall back to system fonts */ }
    const canvas = $('game');
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('loading').textContent = 'This browser can’t run WebGL, so FlaTTy Birds can’t start.';
      return;
    }
    A.init();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.background = A.skyTexture;
    scene.fog = new T.Fog(A.SKY.fog, 70, 330);
    camera = new T.PerspectiveCamera(40, 1, 0.5, 600);
    scene.add(new T.HemisphereLight('#e2f2ff', '#8a7464', 0.8));
    sun = new T.DirectionalLight('#fff1d6', 1.25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    layers = A.buildLayers();
    for (const l of layers) scene.add(l.group);
    for (let i = 0; i < 5; i++) {
      const s = A.buildSegment();
      segs.push(s);
      scene.add(s.obj);
    }
    puffs = A.makeParticles(300, 0.55);
    sparks = A.makeParticles(500, 0.22, null, true);
    starBurst = A.makeParticles(60, 0.55, A.starTexture);
    scene.add(puffs.obj, sparks.obj, starBurst.obj);

    for (const id of ['title', 'hud', 'over', 'pause', 'score', 'coins', 'coinPill', 'count', 'toasts', 'picker', 'easyBtn', 'muteBtn', 'muteTitle', 'bestName', 'bestTitle', 'bestMode', 'ovScore', 'ovCoins', 'ovBest', 'ovBestLabel', 'newBest', 'ovTitle']) ui[id] = $(id);

    ROSTER = Kit.roster.list.slice(); // Teddy and Tommy come first
    buildPicker();
    const muted = !!sfx('isMuted');
    ui.muteBtn.textContent = ui.muteTitle.textContent = muted ? '🔇' : '🔊';

    resize();
    pickCharacter(store.get('kid', 'teddy'));
    bindInput();
    startAttract();
    $('loading').remove();
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- console hooks for testing

  window.flappy = {
    get state() { return G.state; },
    G, P,
    get course() { return course; },
    start: startGame,
    flap: primary,
    pick(id) { pickCharacter(id, true); return entry.id; },
    easy(on) { setEasy(on); return G.mode; },
    pause: togglePause,
    // Advance `seconds` of game time right now and draw (the Browser pane throttles animation frames when hidden).
    // { auto: true } lets the autopilot fly a real run while stepping (it doesn't count toward BEST).
    step(seconds = 1, opts = {}) {
      if (opts.auto !== undefined) G.auto = !!opts.auto;
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) tick(1 / 120);
        render(1 / 60);
      }
      return { state: G.state, score: G.score, coins: G.coins, x: +P.x.toFixed(1), y: +P.y.toFixed(2), vy: +P.vy.toFixed(2) };
    },
    // Fly into the next gate's train stack (for testing the crash and game-over flow).
    crash() {
      const g = course.gates.find((q) => q.x > P.x + 1);
      if (g) crash(g);
      return G.state;
    },
    check,
    MODES,
    // Park the camera close to the kid (d metres away), for looking at poses. flappy.peek() puts it back.
    peek(d, dx = 0, dy = 0) {
      G.peek = d ? { d, dx, dy } : null;
      render(0);
      return !!G.peek;
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
