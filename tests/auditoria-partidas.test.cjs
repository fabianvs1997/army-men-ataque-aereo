// Auditoría de calidad (2026-11-07): partidas completas de las 3
// misiones con un piloto automático que juega de verdad —vuela por
// la carretera (el helicóptero no cruza terreno de más de 2 u),
// dispara con el cañón y los misiles, embarca heridos, escolta al
// pelotón, levanta la carga con el winch y sale por el portal—.
// Fija que las 3 misiones se pueden completar, sin errores de
// consola, sin congelamientos (ningún frame de upd() por encima de
// 500 ms) y sin atascos que no se resuelvan solos. En Node la
// mediana es ~0,5 ms/frame; los picos raros (~50 ms) son pausas del
// GC de V8, no del juego: se miden y se acotan, no se persiguen.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { game } = require('../support/fake-host.cjs');

const DT = 0.05,
  MAX_FRAMES = 30000;
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// Grafo de carreteras del mundo: nodos = puntos de `world.roads`
// (cada ~6 u), aristas entre nodos a menos de 9 u. Dijkstra del
// punto de carretera más cercano al jugador al más cercano al
// objetivo; el último tramo (<= 20 u) es en línea recta.
function roadGraph(world) {
  const nodes = world.roads.map((p) => ({ x: p.x, z: p.z }));
  const adj = nodes.map(() => []);
  const cell = 9,
    buckets = new Map();
  nodes.forEach((n, i) => {
    const k = Math.floor(n.x / cell) + ',' + Math.floor(n.z / cell);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(i);
  });
  nodes.forEach((n, i) => {
    const cx = Math.floor(n.x / cell),
      cz = Math.floor(n.z / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const j of buckets.get(cx + dx + ',' + (cz + dz)) || []) {
          if (j <= i) continue;
          const d = dist(n.x, n.z, nodes[j].x, nodes[j].z);
          if (d < 9) {
            adj[i].push([j, d]);
            adj[j].push([i, d]);
          }
        }
  });
  return { nodes, adj };
}
function nearestNode(graph, x, z) {
  let best = -1,
    bd = Infinity;
  graph.nodes.forEach((n, i) => {
    const d = dist(x, z, n.x, n.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return { i: best, d: bd };
}
function roadPath(graph, fx, fz, tx, tz) {
  const from = nearestNode(graph, fx, fz),
    to = nearestNode(graph, tx, tz);
  if (from.i < 0 || to.i < 0 || from.d > 60 || to.d > 60) return null;
  if (from.i === to.i) return [];
  const n = graph.nodes.length;
  const d = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  d[from.i] = 0;
  for (;;) {
    let u = -1,
      best = Infinity;
    for (let i = 0; i < n; i++)
      if (!done[i] && d[i] < best) {
        best = d[i];
        u = i;
      }
    if (u < 0 || u === to.i) break;
    done[u] = true;
    for (const [v, w] of graph.adj[u])
      if (d[u] + w < d[v]) {
        d[v] = d[u] + w;
        prev[v] = u;
      }
  }
  if (!Number.isFinite(d[to.i])) return null;
  const path = [];
  for (let u = to.i; u >= 0; u = prev[u]) path.unshift(graph.nodes[u]);
  return path;
}

function playMission(n) {
  const g = game(123);
  const { app, state: s } = g;
  const errors = [];
  const origError = console.error,
    origWarn = console.warn;
  console.error = (...a) => errors.push('error: ' + a.map(String).join(' '));
  console.warn = (...a) => errors.push('warn: ' + a.map(String).join(' '));
  const timeline = [],
    frameTimes = [];
  let outcome = 'sin-terminar',
    failReason = '';
  const pressed = new Set();
  const setKey = (k, on) => {
    if (on && !pressed.has(k)) {
      pressed.add(k);
      g.host.emit('keydown', { key: k, repeat: false, preventDefault() {} });
    } else if (!on && pressed.has(k)) {
      pressed.delete(k);
      g.host.emit('keyup', { key: k, preventDefault() {} });
    }
  };
  const releaseAll = () => {
    for (const k of [...pressed]) setKey(k, false);
    app.view.fire = false;
  };
  try {
    app.start(n, true);
    const graph = roadGraph(s.world);
    let lastStage = s.mission.stage;
    timeline.push(lastStage);
    let missileCooldown = 0,
      navPath = null,
      navTargetKey = '',
      escapeUntil = 0,
      stuckStreak = 0,
      lastMoveCheck = { frame: 0, x: s.P.x, z: s.P.z };
    for (let frame = 0; frame < MAX_FRAMES; frame++) {
      const P = s.P,
        M = s.mission;
      if (M.stage !== lastStage) {
        lastStage = M.stage;
        navPath = null;
        navTargetKey = '';
        timeline.push(lastStage);
      }
      const live = s.E.filter((e) => !e.dead && e.hp > 0);
      const nearestEnemy = (maxD, kinds) => {
        let best = null,
          bd = maxD;
        for (const e of live) {
          if (kinds && !kinds.includes(e.k)) continue;
          const d = dist(P.x, P.z, e.x, e.z);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        return best;
      };
      let hover = false,
        tx = null,
        tz = null;
      const pkNear = s.PK.map((q) => ({ q, d: dist(P.x, P.z, q.x, q.z) }))
        .filter((o) => o.d < 45)
        .sort((a, b) => a.d - b.d)[0];
      const pk =
        pkNear ||
        (P.arm <= 5
          ? s.PK.map((q) => ({ q, d: dist(P.x, P.z, q.x, q.z) }))
              .filter((o) => o.d < 150)
              .sort((a, b) => a.d - b.d)[0]
          : null);
      if (pk) {
        tx = pk.q.x;
        tz = pk.q.z;
      } else if (M.stage === 'EMBARCAR_HERIDOS') {
        const waiting = M.allies.filter(
          (a) =>
            a.wounded &&
            ['HERIDO_ESPERANDO', 'ABORDANDO'].includes(a.state),
        );
        if (waiting.length) {
          waiting.sort(
            (a, b) =>
              dist(P.x, P.z, a.x, a.z) - dist(P.x, P.z, b.x, b.z),
          );
          const w = waiting[0];
          if (dist(P.x, P.z, w.x, w.z) <= 5) hover = true;
          else {
            tx = w.x;
            tz = w.z;
          }
        }
      } else if (
        M.cargo &&
        M.cargo.state === 'waiting' &&
        (M.cargo.winchFrom === 'any' ||
          ['ESCOLTAR_BC', 'ENTREGA_C', 'CARGA_PORTAL'].includes(M.stage)) &&
        !nearestEnemy(70)
      ) {
        if (dist(P.x, P.z, M.cargo.x, M.cargo.z) <= 6) hover = true;
        else {
          tx = M.cargo.x;
          tz = M.cargo.z;
        }
      } else if (
        M.stage === 'ENTREGA_C' &&
        dist(P.x, P.z, M.finish.x, M.finish.z) <= 8
      ) {
        hover = true;
      } else if (M.cargo && M.cargo.state === 'carried' && M.cargo.deliverAt) {
        tx = M.cargo.deliverAt.x;
        tz = M.cargo.deliverAt.z;
      } else if (M.stage === 'ESCOLTAR_BC') {
        const marching = M.allies.filter(
          (a) => !a.wounded && !['CAIDO', 'SEGURO_EN_C'].includes(a.state),
        );
        if (marching.length) {
          marching.sort(
            (a, b) =>
              dist(P.x, P.z, a.x, a.z) - dist(P.x, P.z, b.x, b.z),
          );
          const last = marching[marching.length - 1];
          if (dist(P.x, P.z, last.x, last.z) <= 12) {
            tx = P.x + Math.sin(P.yaw) * 5;
            tz = P.z + Math.cos(P.yaw) * 5;
          } else {
            tx = last.x;
            tz = last.z;
          }
        } else {
          tx = M.finish.x;
          tz = M.finish.z;
        }
      } else {
        const t = M.target(P);
        if (t) {
          tx = t.x;
          tz = t.z;
        }
      }
      let combatTarget = null;
      // Con salud baja (≤3) y un botiquín cerca, el botiquín manda
      // sobre el combate: si no, el piloto se queda peleando junto a
      // la caja con salud 1 mientras hay un botiquín a 25 u y muere
      // por el último soldado (Misión 1 del vídeo).
      const needPack = pk && pk.q.ty === 'a' && P.arm <= 3;
      if (!hover && tx !== null && frame >= escapeUntil && !needPack) {
        combatTarget =
          nearestEnemy(55, ['tank', 'tur', 'heli', 'garage', 'base', 'jeep']) ||
          nearestEnemy(45, ['inf']) ||
          nearestEnemy(40, ['car']);
        // En las fases de combate (despejar B y la caja) el piloto
        // persigue al enemigo aunque ya esté a 12 u del objetivo:
        // si no, se queda parado junto a la caja o a B mientras le
        // disparan 5 enemigos a la vez sin rematarlos (Misión 1 del
        // vídeo: 3 tanques guardando la caja + infantería alrededor).
        // En embarque y entrega se mantiene el margen de 12 u para
        // poder llegar al herido o al helipuerto.
        if (
          combatTarget &&
          (dist(P.x, P.z, tx, tz) > 12 ||
            ['DESPEJAR_B', 'CARGA_PORTAL'].includes(M.stage))
        ) {
          tx = combatTarget.x;
          tz = combatTarget.z;
        }
      }
      let wx = tx,
        wz = tz;
      if (!hover && tx !== null && dist(P.x, P.z, tx, tz) > 20) {
        const key = Math.round(tx) + ',' + Math.round(tz);
        if (key !== navTargetKey) {
          navTargetKey = key;
          navPath = roadPath(graph, P.x, P.z, tx, tz);
        }
        if (navPath && navPath.length) {
          while (
            navPath.length > 1 &&
            dist(P.x, P.z, navPath[0].x, navPath[0].z) < 7
          )
            navPath.shift();
          if (dist(P.x, P.z, navPath[0].x, navPath[0].z) < 7) navPath.shift();
          if (navPath.length) {
            wx = navPath[0].x;
            wz = navPath[0].z;
          }
        }
      } else if (!hover) {
        navPath = null;
        navTargetKey = '';
      }
      releaseAll();
      missileCooldown -= DT;
      if (hover) {
        // Quieto: embarque, winch y entrega exigen estabilidad.
      } else if (combatTarget) {
        // Bombeo a distancia: encarar al enemigo y no quedarse parado
        // (parado, las balas enemigas no fallan). El cañón llega a
        // 130 u con ayuda de puntería, así que no hace falta pegarse
        // a 14 u: a esa distancia TODOS disparan a la vez (Misión 1
        // del vídeo, sin aliados que repartan el fuego: 6 tanques +
        // infantería alrededor de B). Se pelea fuera del alcance de
        // la infantería (45 u) y del jeep (55 u): la distancia de
        // bombeo es 48 u contra infantería, 58 u contra el jeep y
        // 50 u contra el resto (tanques y torretas, 65-75 u, siguen
        // disparando pero son menos bocas). Acercarse hasta esa
        // distancia y retroceder, siempre de cara y disparando.
        const cd = dist(P.x, P.z, combatTarget.x, combatTarget.z);
        const want =
          combatTarget.k === 'inf'
            ? 48
            : combatTarget.k === 'jeep'
              ? 58
              : 50;
        const err = norm(
          Math.atan2(combatTarget.x - P.x, combatTarget.z - P.z) - P.yaw,
        );
        if (err > 0.12) setKey('a', true);
        else if (err < -0.12) setKey('d', true);
        if (Math.abs(err) < 0.7) setKey(cd > want ? 'w' : 's', true);
        // Disparar con el cañón con ayuda de puntería (cono de 60°):
        // a 0,45 rad el tiro sigue yendo al objetivo, y el piloto no
        // se pasa los frames girando sin disparar mientras 5
        // soldados le disparan a la vez (Misión 1 del vídeo).
        if (Math.abs(err) < 0.45) app.view.fire = true;
        if (
          ['tank', 'tur', 'heli', 'garage'].includes(combatTarget.k) &&
          P.mi > 0 &&
          missileCooldown <= 0 &&
          Math.abs(err) < 0.3 &&
          cd < 120
        ) {
          app.view.mAsk = true;
          missileCooldown = 2;
        }
      } else if (wx !== null) {
        const err = norm(Math.atan2(wx - P.x, wz - P.z) - P.yaw);
        const d = dist(P.x, P.z, wx, wz);
        if (err > 0.12) setKey('a', true);
        else if (err < -0.12) setKey('d', true);
        if (Math.abs(err) < 0.7 && d > 4) setKey('w', true);
        const foe = nearestEnemy(130);
        if (foe) {
          const eerr = norm(Math.atan2(foe.x - P.x, foe.z - P.z) - P.yaw);
          if (Math.abs(eerr) < 0.25) app.view.fire = true;
          if (
            ['tank', 'tur', 'heli', 'garage'].includes(foe.k) &&
            P.mi > 0 &&
            missileCooldown <= 0 &&
            Math.abs(eerr) < 0.3 &&
            dist(P.x, P.z, foe.x, foe.z) < 120
          ) {
            app.view.mAsk = true;
            missileCooldown = 2;
          }
        }
      }
      const t0 = process.hrtime.bigint();
      app.upd(DT);
      frameTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
      assert.ok(Number.isFinite(P.x) && Number.isFinite(P.z), 'posición NaN');
      if (frame - lastMoveCheck.frame >= 40) {
        const moved = dist(P.x, P.z, lastMoveCheck.x, lastMoveCheck.z);
        if (!hover && moved < 2 && wx !== null) {
          stuckStreak++;
          if (stuckStreak >= 2) {
            escapeUntil = frame + 120;
            navPath = null;
            navTargetKey = '';
            stuckStreak = 0;
          }
        } else stuckStreak = 0;
        lastMoveCheck = { frame, x: P.x, z: P.z };
      }
      if (s.st === 'win' || s.st === 'campaign') {
        outcome = 'completada';
        break;
      }
      if (s.st === 'over' || M.failed) {
        outcome = 'fracasada';
        failReason = M.reason || 'over';
        break;
      }
    }
    if (outcome === 'sin-terminar') {
      const M = s.mission;
      failReason =
        'límite de frames en fase ' +
        M.stage +
        ' · rescatados ' +
        M.rescued +
        ' · entregados ' +
        M.delivered +
        '/' +
        M.allies.length +
        ' · P=(' +
        Math.round(s.P.x) +
        ',' +
        Math.round(s.P.z) +
        ')';
    }
  } finally {
    console.error = origError;
    console.warn = origWarn;
    releaseAll();
  }
  frameTimes.sort((a, b) => a - b);
  return {
    outcome,
    failReason,
    frames: frameTimes.length,
    gameTime: +(frameTimes.length * DT).toFixed(1),
    maxFrameMs: frameTimes[frameTimes.length - 1] || 0,
    p95Ms: frameTimes[Math.floor(frameTimes.length * 0.95)] || 0,
    over16: frameTimes.filter((t) => t > 16).length,
    over500: frameTimes.filter((t) => t > 500).length,
    errors,
    timeline,
    final: s,
  };
}

for (const n of [1, 2, 3]) {
  test('partida completa de la misión ' + n + ' (piloto automático)', () => {
    const r = playMission(n);
    assert.equal(r.outcome, 'completada', r.failReason);
    assert.deepEqual(r.errors, [], 'errores de consola durante la partida');
    assert.equal(r.over500, 0, 'frames de más de 500 ms (congelamiento)');
    assert.ok(r.p95Ms < 16, 'p95 de upd() por debajo de 16 ms');
    assert.ok(r.maxFrameMs < 500, 'ningún frame de upd() llega a 500 ms');
    const M = r.final.mission;
    assert.ok(M.stars >= 1, 'al menos 1 estrella');
    assert.ok(
      M.delivered >= M.allies.length - 2,
      'pelotón casi intacto al final',
    );
    if (n === 1) {
      assert.equal(M.cargo.state, 'delivered', 'caja por el portal');
      // Misión 1 del vídeo: sin escolta ni heridos, directo de
      // despejar B a la caja y el portal.
      assert.deepEqual(r.timeline, [
        'INICIO_A',
        'COMBATE_RUTA_AB',
        'DESPEJAR_B',
        'CARGA_PORTAL',
      ]);
      assert.equal(M.allies.length, 0, 'sin pelotón en M1');
      assert.equal(M.stars, 3, 'sin pelotón que perder: 3 estrellas');
    }
    if (n === 2) {
      assert.ok(
        M.carsEscaped < M.carsLimit,
        'coches por el portal por debajo del límite',
      );
      assert.ok(
        M.garages.every((g) => g.destroyed),
        'los 3 garajes destruidos',
      );
    }
    if (n === 3) {
      assert.equal(M.cargo.state, 'delivered', 'batería en el tren');
      assert.equal(M.train.state, 'arrived', 'tren en C');
      assert.deepEqual(r.timeline, [
        'INICIO_A',
        'COMBATE_RUTA_AB',
        'DESPEJAR_B',
        'EMBARCAR_HERIDOS',
        'ESCOLTAR_BC',
        'ENTREGA_C',
        'PORTAL',
      ]);
    }
  });
}
