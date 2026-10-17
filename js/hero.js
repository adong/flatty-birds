/* FlaTTy Birds — the flying kid.
   Wraps a Kit person (Kit.people.build) with a jetpack and the poses this game needs: flying side-on with flapping arms,
   tumbling after a bump, standing, and a celebration on a new best: the roster signature moves (Tommy's Y peace pose;
   Teddy's Mike Tyson-style boxing, then a basketball jump shot with a 🏀), and a wave for everyone else.

   Hierarchy: root (the body's centre, = the hit circle) > tilt (pitch, rotation.z) > turn (yaw) > lean (rotation.x)
              > fit (scale, feet moved down so the body centre sits on root) > person.root */
(function () {
  'use strict';
  const T = THREE, A = window.FlappyScene, Kit = window.Kit, people = Kit.people;

  const SCALE = 0.9; // a 2 m kit person flies at 1.8 m (the hit circle is smaller: near misses count)
  const CENTER = 1.05; // body centre height in the person's own units
  const FLY_YAW = -Math.PI / 2 - 0.62; // facing +x, turned three-quarters toward the camera so faces show
  const FACE_YAW = -Math.PI; // facing the camera (same turn direction as FLY_YAW, so the turn is short)
  // Celebrations turn a little sideways where a move reads better from the side.
  const POSE_YAW = { boxing: -Math.PI + 0.75, jumpshot: -Math.PI / 2 - 0.5 };
  const SEG_T = { boxing: 2.1, jumpshot: 1.9 }; // seconds per move in the celebration loop (others 1.8)
  const RELEASE = 0.62; // the jump shot lets go of the ball this far into its move
  // Mid-air signature moves (the buddy's hello, goodbye and hand-over) face where they read best.
  const AIR_YAW = { peace: -Math.PI + 0.45, wave: -Math.PI + 0.5, boxing: -Math.PI + 0.75 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);

  // The celebration loop for a new best: the roster's signature moves in order (Teddy: boxing, then the jump shot;
  // Tommy: peace), or a wave for characters without one.
  function celebration(entry) {
    return entry.signature && entry.signature.length ? entry.signature.slice() : ['wave'];
  }

  // Which move of the loop is playing at `time`, and how far into it.
  function segment(seq, time) {
    const total = seq.reduce((a, m) => a + (SEG_T[m] || 1.8), 0);
    let t = time % total;
    for (const m of seq) {
      const d = SEG_T[m] || 1.8;
      if (t < d) return { mode: m, t };
      t -= d;
    }
    return { mode: seq[0], t: 0 };
  }

  // Kit poses like 'wave' and 'peace' stride while they pose (they were made for running buddies).
  // Standing still, the legs settle and the kid bounces instead. Kit candidate: a `still` option for pose().
  const STRIDING = { wave: 1, peace: 1, give: 1, run: 1, walk: 1 };
  function standPose(p, ph, mode, k) {
    people.pose(p, ph, mode, k);
    if (STRIDING[mode]) {
      p.legL.rotation.x += (0 - p.legL.rotation.x) * Math.min(1, k * 2);
      p.legR.rotation.x += (0 - p.legR.rotation.x) * Math.min(1, k * 2);
      p.hips.position.y = p.hipY;
    }
  }

  // opts.scale: size relative to a 2 m kit person (default SCALE; the buddy uses his roster buddyScale).
  function build(entry, opts = {}) {
    const scale = opts.scale || SCALE;
    const root = new T.Group();
    const tilt = new T.Group();
    const turn = new T.Group();
    const lean = new T.Group();
    const fit = new T.Group();
    root.add(tilt);
    tilt.add(turn);
    turn.add(lean);
    lean.add(fit);
    fit.scale.setScalar(scale);
    fit.position.y = -CENTER * scale;
    const p = people.build(entry.look);
    fit.add(p.root);
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    // the jetpack rides on the hips group (the torso), on the back: the person faces -z, so the back is +z
    const jet = A.buildJetpack();
    jet.position.set(0, 0.36, 0.18 + (entry.look.pack ? 0.23 : 0));
    p.hips.add(jet);
    const flames = jet.userData.flames;

    // dizzy stars that circle over the head after a bump
    const stars = new T.Group();
    const starMat = new T.SpriteMaterial({ map: A.starTexture, color: '#ffe14d', depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const s = new T.Sprite(starMat);
      s.scale.setScalar(0.42);
      stars.add(s);
    }
    stars.visible = false;
    root.add(stars);

    const seq = celebration(entry);
    // the basketball for the jump shot: held overhead, then shot up and away
    let ball = null;
    const ballV = new T.Vector3(), handA = new T.Vector3(), handB = new T.Vector3();
    if (seq.includes('jumpshot')) {
      ball = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('🏀'), depthWrite: false }));
      ball.scale.setScalar(0.42);
      ball.visible = false;
      root.add(ball);
    }
    const st = { phase: 0, yaw: FLY_YAW, pitch: 0, lean: 0, thrust: 0, mode: 'hover', modeT: 0, flapT: 9, spin: 0, dizzy: 0, hop: 0, shot: false, air: null, airT: 0 };
    turn.rotation.y = st.yaw;

    // t = time into the jump shot (or -1 when another move is playing); ball positions are in root space
    function updateBall(t, dt, hopStep) {
      if (t < 0 || t > RELEASE + 1.1) {
        ball.visible = false;
        st.shot = false;
        return;
      }
      ball.visible = true;
      if (t < RELEASE) {
        // between the hands, just above them
        root.updateMatrixWorld(true);
        people.handWorld(p, -1, handA);
        people.handWorld(p, 1, handB);
        ball.position.copy(handA).add(handB).multiplyScalar(0.5);
        root.worldToLocal(ball.position);
        ball.position.y += 0.18;
        st.shot = false;
        return;
      }
      if (!st.shot) {
        st.shot = true;
        ballV.set(2.8, 5.2, 0); // up and toward the way he's facing (+x)
        try { Kit.sound.swish(); } catch (e) { /* sound is optional */ }
      }
      ballV.y -= 9.8 * dt;
      ball.position.addScaledVector(ballV, dt);
      ball.position.y -= hopStep; // root moves with the hop; the ball shouldn't
    }

    return {
      entry, root, person: p, jet,
      get hop() { return st.hop; },
      headTop: (2.2 - CENTER) * scale, // top of the head above root
      // A signature move done mid-air while flying (null: back to flapping). Returns seconds into the move.
      airPose(mode) {
        if (mode !== st.air) {
          st.air = mode;
          st.airT = 0;
        }
        return st.airT;
      },
      get ball() { return ball; },
      // which celebration move is playing and how far into it (for tests)
      get move() { return st.mode === 'celebrate' ? segment(seq, st.modeT) : null; },
      // hover, fly, tumble, stand, celebrate
      setMode(mode) {
        if (mode !== st.mode) {
          st.mode = mode;
          st.modeT = 0;
        }
      },
      flap() {
        st.flapT = 0;
        st.thrust = 1;
      },
      dizzy(sec) { st.dizzy = sec; },
      // World positions of the two jet nozzles (for smoke puffs).
      nozzles(out) {
        jet.updateWorldMatrix(true, true);
        for (let i = 0; i < flames.length; i++) flames[i].getWorldPosition(out[i]);
        return out;
      },
      update(dt, vy) {
        st.modeT += dt;
        st.flapT += dt;
        st.thrust = Math.max(0, st.thrust - dt * 2.4);
        const m = st.mode;
        const flying = m === 'hover' || m === 'fly';
        const cele = m === 'celebrate' ? segment(seq, st.modeT) : null;
        // facing
        const air = flying ? st.air : null;
        st.airT += dt;
        const wantYaw = air ? AIR_YAW[air] || FLY_YAW : flying || m === 'tumble' ? FLY_YAW : cele ? POSE_YAW[cele.mode] || FACE_YAW : FACE_YAW;
        st.yaw += (wantYaw - st.yaw) * damp(m === 'tumble' ? 4 : 6, dt);
        turn.rotation.y = st.yaw;
        // pitch: nose up while rising, down while falling; a tumble spins head over heels
        if (m === 'tumble') {
          st.spin -= dt * 9;
          tilt.rotation.z = st.spin;
        } else {
          let want = 0;
          if (m === 'fly' && !air) want = clamp(vy * 0.045, -0.42, 0.3);
          else if (m === 'hover') want = Math.sin(st.modeT * 2.2) * 0.05;
          st.spin = 0;
          st.pitch += (want - st.pitch) * damp(10, dt);
          tilt.rotation.z = st.pitch;
        }
        st.lean += ((flying ? -0.12 : 0) - st.lean) * damp(8, dt);
        lean.rotation.x = st.lean;

        // limbs
        st.phase += dt * (flying ? 9 : 6);
        const lastHop = st.hop;
        st.hop = 0;
        if (air) {
          // the move with the arms, legs dangling under the jetpack
          standPose(p, air === 'boxing' ? st.airT * 6 : st.phase, air, damp(14, dt));
          p.legL.rotation.x = 0.3 + Math.sin(st.phase) * 0.15;
          p.legR.rotation.x = 0.1 - Math.sin(st.phase) * 0.15;
        } else if (flying) {
          people.pose(p, st.phase, 'jet', damp(14, dt));
          flapArms(p, st.flapT, st.modeT);
        } else if (m === 'tumble') people.pose(p, st.phase, 'fall', damp(14, dt));
        else if (m === 'celebrate') {
          const { mode, t } = cele;
          standPose(p, st.modeT * 6, mode, damp(12, dt));
          if (mode === 'jumpshot') st.hop = t > 0.15 && t < 0.95 ? Math.sin((Math.PI * (t - 0.15)) / 0.8) * 0.75 : 0;
          else if (mode === 'boxing') st.hop = Math.abs(Math.sin(st.modeT * 7)) * 0.05; // light on his feet
          else st.hop = Math.abs(Math.sin(st.modeT * 5.5)) * 0.28; // little happy hops
          if (ball) updateBall(mode === 'jumpshot' ? t : -1, dt, st.hop - lastHop);
        } else standPose(p, st.modeT * 3, 'stand', damp(10, dt));
        if (ball && m !== 'celebrate') ball.visible = false;

        // jet flames: big right after a hop, a small idle flicker otherwise, off once landed
        const on = flying || m === 'tumble';
        const f = on ? 0.45 + st.thrust * 0.9 + Math.random() * 0.12 : 0;
        for (const fl of flames) {
          fl.visible = f > 0.01;
          fl.scale.set(0.8 + f * 0.4, f * 1.2, 0.8 + f * 0.4);
        }

        // dizzy stars
        st.dizzy = Math.max(0, st.dizzy - dt);
        stars.visible = st.dizzy > 0;
        if (stars.visible) {
          stars.position.y = (2.15 - CENTER) * scale + 0.3;
          const a = st.modeT * 5;
          stars.children.forEach((s, i) => {
            const b = a + (i * Math.PI * 2) / 3;
            s.position.set(Math.cos(b) * 0.5, Math.sin(b * 2) * 0.06, Math.sin(b) * 0.5);
          });
        }
      },
    };
  }

  // Bird-style arm flap: arms out to the sides, a quick downstroke on every hop, then a slow lift back up.
  function flapArms(p, flapT, t) {
    const stroke = flapT < 0.1 ? flapT / 0.1 : Math.max(0, 1 - (flapT - 0.1) / 0.35);
    const up = 1.75 - stroke * 1.25 + Math.sin(t * 6) * 0.06;
    p.armL.rotation.x = 0.25;
    p.armR.rotation.x = 0.25;
    p.armL.rotation.z = -up;
    p.armR.rotation.z = up;
  }

  window.FlappyHero = { build, SCALE, CENTER, celebration };
})();
