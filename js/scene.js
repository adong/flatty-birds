/* FlaTTy Birds — scenery.
   Canvas textures and simple models: the sky, three layers of city, the elevated station (platform below, viaduct above),
   the gates (a stack of subway-train fronts from below, a tiled station pillar from above), coins, the jetpack and particles.
   There are no image files: everything is painted here. */
(function () {
  'use strict';
  const T = THREE;

  const DIMS = {
    PLAY_TOP: 16, // underside of the viaduct; the platform is y = 0
    COL_W: 3.0, // train-stack width
    CAP_W: 3.5, // pillar cap width
    CAP_H: 0.9,
    PIL_W: 2.5, // pillar width above the cap
    CAR_H: 3.0,
    CAR_D: 4.6,
    PLAT_FRONT: 3.2, // z of the platform's front face
    PLAT_BACK: -9,
    SEG: 40, // platform / viaduct segment length
  };
  const SKY = { top: '#3b93e6', mid: '#8ccbf6', horizon: '#e2f1fb', fog: '#cfe5f6' };
  const TRAIN_COLORS = ['#ffcc1f', '#ff5a4e', '#2f9bff', '#2fc47c', '#b46cff', '#ff8a2a'];
  const SIGN_WORDS = ['METRO', 'TEDDY', 'TOMMY', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO'];

  // ---------------------------------------------------------------- helpers
  // Canvas, texture and material helpers come from the kit (Kit.gfx). These two differ: this mesh also receives
  // shadows and may have no parent, and this boxUV tiles a texture by a different size across and up.
  const { makeCanvas, toTexture, shade, roundRect, std, rand, randi, pick } = window.Kit.gfx;

  function mesh(geo, mat, x, y, z, parent, shadow = true) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  // Scale a BoxGeometry's UVs so a texture tiles once per `uw` x `uh` metres on every face.
  function boxUV(geo, w, h, d, uw, uh) {
    const uv = geo.attributes.uv;
    const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, (uv.getX(i) * size[f][0]) / uw, (uv.getY(i) * size[f][1]) / uh);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  // ---------------------------------------------------------------- textures

  function skyTexture() {
    const [c, g] = makeCanvas(4, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, SKY.top);
    gr.addColorStop(0.55, SKY.mid);
    gr.addColorStop(1, SKY.horizon);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    return toTexture(c);
  }

  function cloudTexture() {
    const [c, g] = makeCanvas(256, 128);
    g.fillStyle = '#fff';
    const puffs = [[60, 86, 38], [104, 64, 50], [156, 72, 44], [196, 90, 32], [128, 96, 40]];
    for (const [x, y, r] of puffs) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, 40, 0, 128);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(160,190,220,0.45)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 256, 128);
    return toTexture(c);
  }

  // A 4-window x 4-floor tile of building facade (12 m x 12.8 m).
  function facadeTexture(base, trim) {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    // faint brick rows
    g.fillStyle = shade(base, -0.06);
    for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 256, 2);
    for (let fy = 0; fy < 4; fy++) {
      g.fillStyle = trim;
      g.fillRect(0, fy * 64 + 58, 256, 6); // floor ledge
      for (let fx = 0; fx < 4; fx++) {
        const x = fx * 64 + 14, y = fy * 64 + 14;
        g.fillStyle = trim;
        g.fillRect(x - 3, y - 3, 42, 42);
        const lit = Math.random() < 0.18;
        const gr = g.createLinearGradient(x, y, x + 36, y + 36);
        gr.addColorStop(0, lit ? '#fff3b8' : '#bfe4ff');
        gr.addColorStop(1, lit ? '#ffc76a' : '#5d8fc4');
        g.fillStyle = gr;
        g.fillRect(x, y, 36, 36);
        g.fillStyle = trim;
        g.fillRect(x + 16, y, 4, 36);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x + 3, y + 3, 9, 14);
      }
    }
    const t = toTexture(c, true);
    return t;
  }

  function farTexture(base) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = shade(base, 0.25);
    for (let y = 8; y < 128; y += 16) {
      for (let x = 6; x < 128; x += 14) if (Math.random() < 0.55) g.fillRect(x, y, 7, 8);
    }
    return toTexture(c, true);
  }

  // Platform top: grey tiles with the yellow tactile strip near the front edge (texture spans the platform depth).
  function platformTopTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#c9c4bb';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    // front of the platform is the bottom of the texture (v = 0 at the back, see boxUV on the top face)
    g.fillStyle = '#ffd21f';
    g.fillRect(0, 214, 256, 22);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 4; x < 256; x += 10) for (let y = 217; y < 234; y += 8) g.fillRect(x, y, 4, 4);
    g.fillStyle = '#efeae0';
    g.fillRect(0, 238, 256, 18);
    return toTexture(c, true);
  }

  // Front of the station: a stone coping and red-brick arches (one arch per 10 m tile, 9 m tall).
  function platformFrontTexture() {
    const [c, g] = makeCanvas(256, 230);
    g.fillStyle = '#b8563b';
    g.fillRect(0, 0, 256, 230);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 22; y < 230; y += 7) {
      g.fillRect(0, y, 256, 1.5);
      for (let x = (y / 7) % 2 ? 0 : 9; x < 256; x += 18) g.fillRect(x, y, 1.5, 7);
    }
    // arch opening
    g.fillStyle = '#3b2a35';
    g.beginPath();
    g.moveTo(48, 230);
    g.lineTo(48, 120);
    g.arc(128, 120, 80, Math.PI, 0);
    g.lineTo(208, 230);
    g.fill();
    g.strokeStyle = '#d9b48a';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(128, 120, 84, Math.PI, 0);
    g.stroke();
    // a warm shop window glowing inside the arch
    g.fillStyle = '#ffcf6b';
    g.fillRect(80, 150, 96, 50);
    g.fillStyle = '#3b2a35';
    g.fillRect(126, 150, 4, 50);
    // coping stone
    g.fillStyle = '#e8e2d6';
    g.fillRect(0, 0, 256, 20);
    g.fillStyle = '#ffd21f';
    g.fillRect(0, 0, 256, 6);
    return toTexture(c, true);
  }

  // Front of the viaduct: a riveted teal girder with a coloured line stripe (10 m tile, 2.6 m tall).
  function viaductTexture() {
    const [c, g] = makeCanvas(256, 72);
    g.fillStyle = '#2f7f86';
    g.fillRect(0, 0, 256, 72);
    g.fillStyle = '#24666c';
    g.fillRect(0, 0, 256, 8);
    g.fillRect(0, 64, 256, 8);
    g.strokeStyle = '#24666c';
    g.lineWidth = 5;
    for (let x = 0; x < 256; x += 64) {
      g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 32, 64); g.lineTo(x + 64, 8); g.stroke();
    }
    g.fillStyle = '#ffcc1f';
    g.fillRect(0, 30, 256, 6);
    g.fillStyle = '#ff5a4e';
    g.fillRect(0, 37, 256, 6);
    g.fillStyle = '#9fd3d6';
    for (let x = 6; x < 256; x += 16) {
      g.beginPath(); g.arc(x, 4, 2, 0, 7); g.fill();
      g.beginPath(); g.arc(x, 68, 2, 0, 7); g.fill();
    }
    return toTexture(c, true);
  }

  function trainFrontTexture(color, num) {
    const [c, g] = makeCanvas(160, 160);
    g.fillStyle = color;
    g.fillRect(0, 0, 160, 160);
    g.fillStyle = shade(color, -0.25);
    g.fillRect(0, 0, 160, 10);
    g.fillRect(0, 150, 160, 10);
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 104, 160, 12);
    // windshield
    roundRect(g, 18, 28, 124, 60, 14);
    g.fillStyle = '#1d2b44';
    g.fill();
    const gl = g.createLinearGradient(18, 28, 142, 88);
    gl.addColorStop(0, 'rgba(160,215,255,0.65)');
    gl.addColorStop(0.5, 'rgba(160,215,255,0.1)');
    g.fillStyle = gl;
    g.fill();
    g.fillStyle = shade(color, -0.25);
    g.fillRect(78, 28, 4, 60);
    // route badge
    roundRect(g, 60, 12, 40, 14, 5);
    g.fillStyle = '#14121f';
    g.fill();
    g.fillStyle = '#ffd21f';
    g.font = 'bold 12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(num, 80, 19.5);
    // headlights
    for (const x of [30, 130]) {
      g.fillStyle = '#fff6c2';
      g.beginPath(); g.arc(x, 130, 10, 0, 7); g.fill();
      g.strokeStyle = shade(color, -0.4);
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = '#2a2a33';
    roundRect(g, 60, 124, 40, 14, 4);
    g.fill();
    return toTexture(c);
  }

  function trainSideTexture(color) {
    const [c, g] = makeCanvas(160, 96);
    g.fillStyle = shade(color, -0.08);
    g.fillRect(0, 0, 160, 96);
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 66, 160, 8);
    for (let x = 10; x < 160; x += 50) {
      roundRect(g, x, 18, 38, 36, 6);
      g.fillStyle = '#22314d';
      g.fill();
      g.fillStyle = 'rgba(170,220,255,0.35)';
      g.fillRect(x + 4, 22, 10, 28);
    }
    return toTexture(c);
  }

  function roofTexture() {
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = '#8c939c';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#7a8189';
    for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 3);
    return toTexture(c);
  }

  // White subway tiles with a coloured band (tiles once per 2.5 m x 2.5 m).
  function tileTexture(band) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#f3f1ea';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = band;
    g.fillRect(0, 52, 128, 24);
    g.strokeStyle = 'rgba(0,0,0,0.13)';
    g.lineWidth = 2;
    for (let y = 0; y <= 128; y += 13) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
      const off = (y / 13) % 2 ? 0 : 16;
      for (let x = off; x <= 128; x += 32) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 13); g.stroke();
      }
    }
    return toTexture(c, true);
  }

  function hazardTexture() {
    const [c, g] = makeCanvas(128, 32);
    g.fillStyle = '#ffd21f';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#20202a';
    for (let x = -32; x < 160; x += 24) {
      g.beginPath();
      g.moveTo(x, 32); g.lineTo(x + 12, 32); g.lineTo(x + 44, 0); g.lineTo(x + 32, 0);
      g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 28, 128, 4);
    return toTexture(c, true);
  }

  // A station roundel. Names stay as they are; METRO reads 地铁 in 中文 (redrawn when the language changes).
  const signRedraws = [];
  function signTexture(word, color) {
    const [c, g] = makeCanvas(256, 256);
    const tex = toTexture(c);
    const draw = () => {
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = color;
      g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(128, 128, 78, 0, 7); g.fill();
      g.fillStyle = '#1b3f9c';
      g.fillRect(4, 100, 248, 56);
      g.fillStyle = '#fff';
      g.font = 'bold 40px "Bungee", "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(window.Kit.lang ? window.Kit.lang.t(word) : word, 128, 130, 232);
      tex.needsUpdate = true;
    };
    draw();
    signRedraws.push(draw);
    return tex;
  }

  function coinFaceTexture() {
    const [c, g] = makeCanvas(128, 128);
    const gr = g.createRadialGradient(48, 44, 6, 64, 64, 64);
    gr.addColorStop(0, '#fff6b8');
    gr.addColorStop(0.5, '#ffcf2e');
    gr.addColorStop(1, '#d48a00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#b06f00';
    g.lineWidth = 8;
    g.beginPath(); g.arc(64, 64, 46, 0, 7); g.stroke();
    // a star
    g.fillStyle = '#fff1a0';
    g.strokeStyle = '#b06f00';
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 14 : 32;
      g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
    return toTexture(c);
  }

  function starTexture() {
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 12 : 30;
      g.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    return toTexture(c);
  }

  // ---------------------------------------------------------------- shared materials, built once

  const M = {};
  const Scene = { DIMS, SKY, TRAIN_COLORS };

  Scene.init = function () {
    M.dot = window.Kit.gfx.dotTexture();
    M.star = starTexture();
    M.sky = skyTexture();
    M.cloud = new T.SpriteMaterial({ map: cloudTexture(), fog: false, transparent: true, depthWrite: false });
    const facades = [['#f2a65a', '#8a4d2a'], ['#ead9b7', '#7e6a4a'], ['#6fb7c9', '#2f5f73'], ['#e98a9a', '#7c3348'], ['#9dbc6a', '#466232'], ['#c6b3ec', '#594a86'], ['#f6d36b', '#8a6a1a']];
    M.facades = facades.map(([b, t]) => std('#ffffff', { map: facadeTexture(b, t), roughness: 0.9 }));
    M.roofTop = std('#7d7a86');
    M.far = ['#9fbfdf', '#a9c7e4', '#93b4d6'].map((col) => new T.MeshLambertMaterial({ color: '#ffffff', map: farTexture(col) }));
    M.platTop = std('#ffffff', { map: platformTopTexture() });
    M.platFront = std('#ffffff', { map: platformFrontTexture() });
    M.platDark = std('#5a4b52');
    M.viaFront = std('#ffffff', { map: viaductTexture(), metalness: 0.2, roughness: 0.6 });
    M.viaDark = std('#235a60', { metalness: 0.2, roughness: 0.7 });
    M.rail = std('#9aa3ad', { metalness: 0.6, roughness: 0.35 });
    M.roof = std('#ffffff', { map: roofTexture() });
    M.trains = TRAIN_COLORS.map((col, i) => {
      const side = std('#ffffff', { map: trainSideTexture(col), roughness: 0.5 });
      const front = std('#ffffff', { map: trainFrontTexture(col, String(i + 1)), roughness: 0.45 });
      return [side, side, M.roof, M.roof, front, front];
    });
    M.tileTex = ['#2f9bff', '#ff5a4e', '#2fc47c', '#ffcc1f'].map((b) => tileTexture(b));
    M.hazard = std('#ffffff', { map: hazardTexture(), roughness: 0.5 });
    M.capDark = std('#20202a');
    M.signs = SIGN_WORDS.map((w, i) => std('#ffffff', { map: signTexture(w, i % 2 ? '#2f9bff' : '#e8322e'), roughness: 0.5 }));
    M.signBack = std('#d9d9d9');
    if (window.Kit.lang) window.Kit.lang.onChange(() => signRedraws.forEach((draw) => draw()));
    const coinFace = std('#ffffff', { map: coinFaceTexture(), metalness: 0.35, roughness: 0.3, emissive: '#5a3c00', emissiveIntensity: 0.35 });
    M.coin = [std('#e0a400', { metalness: 0.5, roughness: 0.3, emissive: '#4a3000', emissiveIntensity: 0.4 }), coinFace, coinFace];
    M.lampPost = std('#3d4a5c', { metalness: 0.3, roughness: 0.5 });
    M.lampGlow = new T.MeshBasicMaterial({ color: '#fff3c4' });
    M.bench = std('#2f7f86');
    M.benchWood = std('#c98a4a');
    M.jetRed = std('#ff4b3a', { roughness: 0.4 });
    M.jetMetal = std('#cfd6de', { metalness: 0.7, roughness: 0.25 });
    M.jetDark = std('#3a3f48', { metalness: 0.4, roughness: 0.4 });
    M.flameOuter = new T.MeshBasicMaterial({ color: '#ff8a1a', transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
    M.flameInner = new T.MeshBasicMaterial({ color: '#fff2a0', transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
    Scene.dotTexture = M.dot;
    Scene.starTexture = M.star;
    Scene.skyTexture = M.sky;
  };

  // ---------------------------------------------------------------- background layers
  // A layer is a row of items at one depth. update(camX, halfW) moves items that scrolled off the left to the right end,
  // so the row never runs out. Perspective does the parallax: deeper layers sweep past more slowly.

  function makeLayer(z, makeItem, gapRange) {
    const group = new T.Group();
    const items = [];
    let endX = -60;
    const add = () => {
      const it = makeItem();
      it.obj.position.x = endX + it.w / 2;
      it.obj.position.z = z + (it.dz || 0);
      group.add(it.obj);
      items.push(it);
      endX += it.w + rand(gapRange[0], gapRange[1]);
    };
    return {
      group,
      update(camX, halfW) {
        while (endX < camX + halfW + 20) add();
        for (const it of items) {
          if (it.obj.position.x + it.w / 2 < camX - halfW - 10) {
            it.obj.position.x = endX + it.w / 2;
            endX += it.w + rand(gapRange[0], gapRange[1]);
            if (it.reskin) it.reskin();
          }
        }
      },
      reset(camX) {
        for (const it of items) group.remove(it.obj);
        items.length = 0;
        endX = camX - 300;
      },
    };
  }

  function midBuilding() {
    const w = pick([9, 10, 12, 14, 16]), h = rand(14, 42), d = 10;
    const g = new T.Group();
    const geo = boxUV(new T.BoxGeometry(w, h, d), w, h, d, 12, 12.8);
    const body = mesh(geo, pick(M.facades), 0, h / 2 - 10, 0, g, false);
    const cap = mesh(new T.BoxGeometry(w + 0.6, 0.8, d + 0.6), M.roofTop, 0, h - 10 + 0.4, 0, g, false);
    let tower = null;
    if (Math.random() < 0.35) tower = waterTower(g, rand(-w / 4, w / 4), h - 10 + 0.8);
    return {
      obj: g,
      w,
      reskin() {
        const nh = rand(14, 42);
        body.material = pick(M.facades);
        body.scale.y = nh / h;
        body.position.y = nh / 2 - 10;
        cap.position.y = nh - 10 + 0.4;
        if (tower) tower.position.y = nh - 10 + 0.8;
      },
    };
  }

  function waterTower(parent, x, y) {
    const g = new T.Group();
    g.position.set(x, y, 0);
    const wood = std('#9c6a42');
    mesh(new T.CylinderGeometry(1.6, 1.6, 3, 12), wood, 0, 3.8, 0, g, false);
    mesh(new T.ConeGeometry(1.9, 1.4, 12), std('#6b4a32'), 0, 6, 0, g, false);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new T.BoxGeometry(0.2, 2.4, 0.2), M.lampPost, lx, 1.2, lz, g, false);
    parent.add(g);
    return g;
  }

  function farBuilding() {
    const w = rand(14, 30), h = rand(30, 80);
    const geo = boxUV(new T.BoxGeometry(w, h, 12), w, h, 12, 16, 16);
    const m = mesh(geo, pick(M.far), 0, h / 2 - 20, 0, null, false);
    m.receiveShadow = false;
    return {
      obj: m,
      w,
      reskin() {
        const nh = rand(30, 80);
        m.scale.y = nh / h;
        m.position.y = nh / 2 - 20;
      },
    };
  }

  function cloud() {
    const s = new T.Sprite(M.cloud);
    const w = rand(40, 70);
    s.scale.set(w, w * 0.5, 1);
    s.position.y = rand(30, 75);
    return { obj: s, w, reskin() { s.position.y = rand(30, 75); } };
  }

  Scene.buildLayers = function () {
    return [
      makeLayer(-46, midBuilding, [1, 6]),
      makeLayer(-120, farBuilding, [-4, 4]),
      makeLayer(-230, cloud, [20, 70]),
    ];
  };

  // ---------------------------------------------------------------- station: platform below, viaduct above
  // One SEG-long piece; the game recycles a handful of them.

  Scene.buildSegment = function () {
    const { SEG, PLAY_TOP, PLAT_FRONT, PLAT_BACK } = DIMS;
    const g = new T.Group();
    const depth = PLAT_FRONT - PLAT_BACK, zc = (PLAT_FRONT + PLAT_BACK) / 2;
    // platform: the top face carries the tiles and safety strip, the front face the brick arches
    const platGeo = boxUV(new T.BoxGeometry(SEG, 9, depth), SEG, 9, depth, 10, 9);
    // the top face's v runs along the depth: one texture spans it, with the safety strip at the front (v = 0)
    const uv = platGeo.attributes.uv;
    for (let i = 8; i < 12; i++) uv.setY(i, i < 10 ? 1 : 0);
    uv.needsUpdate = true;
    mesh(platGeo, [M.platDark, M.platDark, M.platTop, M.platDark, M.platFront, M.platDark], 0, -4.5, zc, g, false);
    // viaduct: 2.6 m deep girder deck
    const viaGeo = boxUV(new T.BoxGeometry(SEG, 2.6, depth), SEG, 2.6, depth, 10, 2.6);
    mesh(viaGeo, [M.viaDark, M.viaDark, M.viaDark, M.viaDark, M.viaFront, M.viaDark], 0, PLAY_TOP + 1.3, zc, g, false);
    // rails on top of the viaduct
    for (const z of [-1.2, 1.2]) mesh(new T.BoxGeometry(SEG, 0.25, 0.2), M.rail, 0, PLAY_TOP + 2.72, z - 2, g, false);
    // platform furniture behind the flying lane
    const decor = new T.Group();
    g.add(decor);
    const fill = () => {
      decor.clear();
      for (let x = -SEG / 2 + rand(3, 8); x < SEG / 2 - 2; x += rand(9, 15)) {
        const r = Math.random();
        if (r < 0.45) lampPost(decor, x, -6);
        else if (r < 0.8) bench(decor, x, -6.5);
        else stationSign(decor, x, -6);
      }
    };
    fill();
    return { obj: g, w: SEG, reskin: fill };
  };

  function lampPost(parent, x, z) {
    mesh(new T.CylinderGeometry(0.12, 0.16, 5, 8), M.lampPost, x, 2.5, z, parent);
    mesh(new T.BoxGeometry(1.0, 0.18, 0.4), M.lampPost, x + 0.35, 5, z, parent);
    mesh(new T.BoxGeometry(0.5, 0.2, 0.36), M.lampGlow, x + 0.65, 4.86, z, parent, false);
  }

  function bench(parent, x, z) {
    mesh(new T.BoxGeometry(2.4, 0.16, 0.7), M.benchWood, x, 0.6, z, parent);
    mesh(new T.BoxGeometry(2.4, 0.6, 0.12), M.benchWood, x, 1.0, z - 0.32, parent);
    for (const dx of [-1, 1]) mesh(new T.BoxGeometry(0.12, 0.6, 0.6), M.bench, x + dx, 0.3, z, parent);
  }

  function stationSign(parent, x, z) {
    for (const dx of [-1.3, 1.3]) mesh(new T.CylinderGeometry(0.08, 0.08, 3.4, 6), M.lampPost, x + dx, 1.7, z, parent);
    // CylinderGeometry's top cap (material 1) faces +y; turned about x it faces the camera
    const sign = mesh(new T.CylinderGeometry(1.1, 1.1, 0.12, 28), [M.signBack, pick(M.signs), M.signBack], x, 3.3, z + 0.1, parent);
    sign.rotation.set(Math.PI / 2, Math.PI / 2, 0); // face the camera, text level
  }

  // ---------------------------------------------------------------- gates
  // bottom: a stack of train cars standing on their tails, noses to the camera; the lowest car sinks into the platform.
  // top: a tiled station pillar hanging from the viaduct, ending in a striped cap with a metro roundel.

  Scene.buildGate = function () {
    const { COL_W, CAP_W, CAP_H, PIL_W, CAR_H, CAR_D, PLAY_TOP } = DIMS;
    const g = new T.Group();
    const carGeo = new T.BoxGeometry(COL_W, CAR_H, CAR_D);
    const cars = [];
    for (let i = 0; i < 5; i++) cars.push(mesh(carGeo, M.trains[0], 0, 0, 0, g));
    const acGeo = new T.BoxGeometry(1.5, 0.18, 2.2);
    const ac = mesh(acGeo, M.jetMetal, 0, 0, 0, g);
    const tileTex = pick(M.tileTex).clone();
    tileTex.needsUpdate = true;
    const pillarMat = std('#ffffff', { map: tileTex });
    const pillar = mesh(new T.BoxGeometry(PIL_W, 1, 3.2), pillarMat, 0, 0, 0, g);
    const cap = mesh(new T.BoxGeometry(CAP_W, CAP_H, 3.8), [M.hazard, M.hazard, M.capDark, M.capDark, M.hazard, M.hazard], 0, 0, 0, g);
    const sign = mesh(new T.CylinderGeometry(0.85, 0.85, 0.12, 28), [M.signBack, M.signs[0], M.signBack], 0, 0, 1.66, g);
    sign.rotation.set(Math.PI / 2, Math.PI / 2, 0); // face the camera, text level
    return {
      obj: g,
      // lo = top of the train stack, hi = bottom of the pillar cap
      set(lo, hi) {
        const n = Math.ceil((lo + 0.6) / CAR_H);
        const c0 = randi(0, TRAIN_COLORS.length - 1);
        for (let i = 0; i < cars.length; i++) {
          const car = cars[i];
          car.visible = i < n;
          if (!car.visible) continue;
          car.position.y = lo - CAR_H * (i + 0.5);
          car.material = M.trains[(c0 + i) % TRAIN_COLORS.length];
          car.scale.x = i === 0 ? 1 : 0.98;
        }
        ac.position.y = lo + 0.09;
        const top = PLAY_TOP + 1.2; // ends inside the viaduct
        const len = Math.max(0.2, top - (hi + CAP_H));
        pillar.scale.y = len;
        pillar.position.y = hi + CAP_H + len / 2;
        tileTex.repeat.set(1, len / 2.5);
        cap.position.y = hi + CAP_H / 2;
        sign.position.y = hi + CAP_H + 1.1;
        sign.visible = len > 2.4;
        sign.material = [M.signBack, pick(M.signs), M.signBack];
      },
    };
  };

  // ---------------------------------------------------------------- coin, jetpack

  Scene.buildCoin = function () {
    const geo = new T.CylinderGeometry(0.5, 0.5, 0.12, 28);
    geo.rotateX(Math.PI / 2); // face the camera
    const m = new T.Mesh(geo, M.coin);
    m.castShadow = true;
    return m;
  };

  // A little red jetpack in the person's own frame (they face -z, so the back is +z). Origin = between the shoulder blades.
  Scene.buildJetpack = function () {
    const g = new T.Group();
    mesh(new T.BoxGeometry(0.62, 0.7, 0.26), M.jetRed, 0, 0, 0.13, g);
    const flames = [];
    for (const x of [-0.2, 0.2]) {
      mesh(new T.CylinderGeometry(0.15, 0.15, 0.78, 12), M.jetMetal, x, 0.02, 0.38, g);
      mesh(new T.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.jetMetal, x, 0.41, 0.38, g);
      mesh(new T.CylinderGeometry(0.1, 0.15, 0.16, 12), M.jetDark, x, -0.45, 0.38, g);
      const f = new T.Group();
      f.position.set(x, -0.53, 0.38);
      const outer = new T.Mesh(new T.ConeGeometry(0.13, 0.7, 10), M.flameOuter);
      outer.rotation.x = Math.PI;
      outer.position.y = -0.35;
      const inner = new T.Mesh(new T.ConeGeometry(0.07, 0.42, 8), M.flameInner);
      inner.rotation.x = Math.PI;
      inner.position.y = -0.21;
      f.add(outer, inner);
      g.add(f);
      flames.push(f);
    }
    g.userData.flames = flames;
    return g;
  };

  // ---------------------------------------------------------------- particles
  // A pool of point sprites with per-particle colour and fade. `size` is in world units.

  Scene.makeParticles = function (n, size, map, additive) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
    const vel = new Float32Array(n * 3), life = new Float32Array(n), maxLife = new Float32Array(n), grav = new Float32Array(n), drag = new Float32Array(n);
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('color', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    const mat = new T.PointsMaterial({ size, map: map || M.dot, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
    const points = new T.Points(geo, mat);
    points.frustumCulled = false;
    const color = new T.Color();
    let next = 0, alive = 0;
    return {
      obj: points,
      emit(x, y, z, count, o) {
        for (let k = 0; k < count; k++) {
          const i = next;
          next = (next + 1) % n;
          color.set(Array.isArray(o.color) ? pick(o.color) : o.color);
          const sp = o.spread || 0;
          pos[i * 3] = x + rand(-sp, sp);
          pos[i * 3 + 1] = y + rand(-sp, sp);
          pos[i * 3 + 2] = z + rand(-sp, sp) * 0.5;
          vel[i * 3] = (o.vx || 0) + rand(-o.speed, o.speed);
          vel[i * 3 + 1] = (o.vy || 0) + rand(-o.speed, o.speed);
          vel[i * 3 + 2] = rand(-o.speed, o.speed) * 0.5;
          life[i] = maxLife[i] = rand(o.life * 0.6, o.life);
          grav[i] = o.gravity !== undefined ? o.gravity : 8;
          drag[i] = o.drag || 0;
          col[i * 4] = color.r;
          col[i * 4 + 1] = color.g;
          col[i * 4 + 2] = color.b;
          col[i * 4 + 3] = 1;
        }
        alive = n;
      },
      update(dt) {
        if (!alive) return;
        let live = 0;
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          if (life[i] <= 0) {
            pos[i * 3 + 1] = -999;
            col[i * 4 + 3] = 0;
            continue;
          }
          live++;
          const k = Math.exp(-drag[i] * dt);
          vel[i * 3] *= k;
          vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt;
          vel[i * 3 + 2] *= k;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          col[i * 4 + 3] = Math.min(1, (life[i] / maxLife[i]) * 1.8);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        if (!live) alive = 0;
      },
      clear() {
        life.fill(0);
        for (let i = 0; i < n; i++) {
          pos[i * 3 + 1] = -999;
          col[i * 4 + 3] = 0;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        alive = 0;
      },
    };
  };

  Scene.util = { makeCanvas, toTexture, shade, roundRect, std, mesh, boxUV, rand, randi, pick };
  window.FlappyScene = Scene;
})();
