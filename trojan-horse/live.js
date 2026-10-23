
const D = __DATA__;
const { P, V } = D;
const KS = G.scaleOf(P);
const deg = Math.PI / 180;
const stage = document.querySelector(".th-stage");
const svg = stage.querySelector(".th-layers");
const layerOf = (name) => svg.querySelector(`[data-layer="${name}"]`);
const Z = { back: 10, "door-far": 11, arch: 30, "tower-near": 50, "door-near": 51 };
for (const [name, z] of Object.entries(Z)) layerOf(name).style.zIndex = String(z);
const moving = ["horse-low", "wheels", "hatch", "horse-up", "lead"].map(layerOf);
svg.style.setProperty("--th-aspect", `${D.W} / ${D.H}`);
const plate = stage.closest(".iso-plate");
const readout = document.querySelector("[data-readout]");
const status = stage.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel) => svg.querySelector(sel);
const doorNear = $('[data-part="door-near"]');
const doorFar = $('[data-part="door-far"]');
const hatchG = $('[data-part="hatch"]');
const ladderG = $('[data-part="ladder"]');
const leadG = $('[data-part="lead"]');
const soldiersG = $('[data-part="soldiers"]');
const wheelFaces = [...svg.querySelectorAll('[data-part="wheel-face"]')];
const nightBtn = document.querySelector("[data-night]");
const at = (p) => iso(p, P);
const path3 = (points, closed = false) => pathOf(points.map(at), closed);
const S = (paths, style) => solidSvg(paths, style);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const ease = (t, a, b) => smoothstep((t - a) / (b - a));
const f1 = (v) => Math.round(v * 10) / 10;

// ------------------------------------------------------------ body geometry, as in the build
const BF = D.BF;
const bodyR = (s) => {
  const u = Math.min(1, Math.abs((s - D.BODY.len / 2) / (D.BODY.len / 2)));
  return D.BODY.R * Math.pow(Math.max(0, 1 - Math.pow(u, D.BODY.p)), 1 / D.BODY.p);
};
const bodySlope = (s) => {
  const h = 0.01;
  const a = Math.max(0.2, Math.min(D.BODY.len - 0.2, s));
  return (bodyR(a + h) - bodyR(a - h)) / (2 * h);
};
const surface = (s, a, lift = 0) => G.pointOf(BF, s, bodyR(s) + lift, a);
const normalAt = (s, a) => G.unit3(G.sub3(G.radialOf(BF, a), G.mul3(BF.a, bodySlope(s))));

// ------------------------------------------------------------ wheels: seams, nails and square hubs turn with the cart
function wheelFace(x, angle) {
  const yF = D.WHEEL_Y[1];
  const c = [x, yF, D.WHEEL_R];
  const R = D.WHEEL_R;
  const rot = (u, v) => [c[0] + u * Math.cos(angle) + v * Math.sin(angle), yF, c[2] - u * Math.sin(angle) + v * Math.cos(angle)];
  const out = [];
  // two plank seams across the face, carried on over the tread where it faces us
  const seams = [];
  const tread = [];
  for (const off of [-4.4, 4.4]) {
    const t = Math.sqrt(R * R - off * off) - 0.15;
    seams.push(path3([rot(-t, off), rot(t, off)]));
    for (const sgn of [-1, 1]) {
      const p = rot(sgn * (t + 0.15), off);
      const n = G.unit3([p[0] - c[0], 0, p[2] - c[2]]);
      if (G.dot3(n, V) > 0.04) tread.push(path3([[p[0], D.WHEEL_Y[0], p[2]], p]));
    }
  }
  out.push(lineSvg(seams.join(""), { tone: "lo" }));
  if (tread.length) out.push(lineSvg(tread.join(""), { tone: "faint" }));
  // two cleats nailed across the planks
  const nails = [];
  for (const u of [-8.2, 8.2]) for (const v of [-9, -4.4, 0, 4.4, 9]) if (u * u + v * v < (R - 1.6) ** 2) nails.push(at(rot(u, v)));
  out.push(dotsSvg(nails, { size: 0.42, tone: "hi" }));
  // square hub on the axle end, nailed at its corners, and the linchpin cap
  const u = [Math.cos(angle), 0, -Math.sin(angle)];
  const v = [Math.sin(angle), 0, Math.cos(angle)];
  const HF = G.frameOf(c, [0, 1, 0], u, v);
  const q = 4.6;
  out.push(`<g class="th-wood">${S(G.prismOf(HF, [[-q, -q], [q, -q], [q, q], [-q, q]], 0, 2.8, P), { tone: "mid" })}</g>`);
  const hub = [[-q + 1.2, -q + 1.2], [q - 1.2, -q + 1.2], [q - 1.2, q - 1.2], [-q + 1.2, q - 1.2]].map(([a, b]) => at([c[0] + a * u[0] + b * v[0], yF + 2.8, c[2] + a * u[2] + b * v[2]]));
  out.push(dotsSvg(hub, { size: 0.5, tone: "hi" }));
  const capF = G.frameOf([c[0], yF + 2.8, c[2]], [0, 1, 0], u, v);
  out.push(`<g class="th-iron">${S(G.disc(0, 1.3, 1.9, capF, P, { steps: 20, bevel: 0.2 }), { tone: "mid" })}</g>`);
  // the linchpin through the cap turns with it
  out.push(lineSvg(path3([[c[0] - 1.5 * u[0], yF + 4.15, c[2] - 1.5 * u[2]], [c[0] + 1.5 * u[0], yF + 4.15, c[2] + 1.5 * u[2]]]), { tone: "hi" }));
  return out.join("");
}

// ------------------------------------------------------------ gate leaves
const ARCH_R = D.GATE.inner;
const LEAF = (() => {
  const lowPoly = [[0, 0], [D.DOOR.w, 0], [D.DOOR.w, D.DOOR.impost], [0, D.DOOR.impost]];
  const capPoly = [[10, D.DOOR.impost], [D.DOOR.w, D.DOOR.impost]];
  for (let j = 0; j <= 14; j++) {
    const w = D.DOOR.w - (j / 14) * (D.DOOR.w - 10);
    capPoly.push([w, D.GATE.spring + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - (D.DOOR.w - w) ** 2))]);
  }
  const topOf = (w) => (w < 10 ? D.DOOR.impost : D.GATE.spring + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - (D.DOOR.w - w) ** 2)));
  return { lowPoly, capPoly, topOf };
})();
function leafSvg(sy, phi) {
  // hinge on the city face of the passage; the leaf swings in toward the viewer
  const hinge = [D.GATE.x1, sy * D.GATE.half, 0];
  const wdir = [Math.sin(phi), -sy * Math.cos(phi), 0];
  const tdir = [-Math.cos(phi), -sy * Math.sin(phi), 0];
  const F = G.frameOf(hinge, tdir, wdir, [0, 0, 1]);
  const W3 = (s, w, z) => [hinge[0] + tdir[0] * s + wdir[0] * w, hinge[1] + tdir[1] * s + wdir[1] * w, z];
  const out = [S(G.prismOf(F, LEAF.lowPoly, 0, D.DOOR.t, P), { tone: "mid" }), S(G.prismOf(F, LEAF.capPoly, 0, D.DOOR.t, P), { tone: "mid" })];
  const innerSeen = G.dot3(G.mul3(tdir, -1), V) > 0;
  const outerSeen = G.dot3(tdir, V) > 0;
  const faceS = innerSeen ? 0 : outerSeen ? D.DOOR.t : null;
  if (faceS !== null) {
    const boards = [];
    for (let w = 8.33; w < D.DOOR.w - 1; w += 8.33) {
      boards.push(path3([W3(faceS, w, 0.2), W3(faceS, w, D.DOOR.impost)]));
      if (w > 10) boards.push(path3([W3(faceS, w, D.DOOR.impost), W3(faceS, w, LEAF.topOf(w) - 0.2)]));
    }
    out.push(lineSvg(boards.join(""), { tone: "lo" }));
  }
  if (innerSeen) {
    // iron straps across the boards, studded, and a ring pull near the meeting edge
    const iron = [];
    for (const z of [34, 104, 168]) {
      iron.push(S(G.prismOf(F, [[1.5, z], [D.DOOR.w - 1.5, z], [D.DOOR.w - 1.5, z + 6], [1.5, z + 6]], -1.2, 0, P), { tone: "mid" }));
      const studs = [];
      for (let w = 5; w < D.DOOR.w - 2; w += 6) studs.push(at(W3(-1.2, w, z + 3)));
      iron.push(dotsSvg(studs, { size: 0.5, tone: "hi" }));
    }
    for (const z of [30, 100, 164]) {
      const KF = G.frameOf(W3(-1.6, 0, z), [0, 0, 1], wdir, tdir);
      iron.push(S(G.disc(0, 14, 1.8, KF, P, { steps: 16 }), { tone: "mid" }));
    }
    const ring = [];
    const rc = W3(-0.6, D.DOOR.w - 7, 120);
    for (let j = 0; j <= 24; j++) {
      const a = (j / 24) * Math.PI * 2;
      ring.push([rc[0] + wdir[0] * 2.6 * Math.sin(a), rc[1] + wdir[1] * 2.6 * Math.sin(a), rc[2] - 2.6 - 2.6 * Math.cos(a)]);
    }
    iron.push(`<g class="th-iron">${S(G.disc(0, 1.6, 1.8, G.frameOf(rc, G.mul3(tdir, -1), wdir, [0, 0, 1]), P, { steps: 16 }), { tone: "mid" })}</g>`);
    iron.push(lineSvg(path3(ring, true), { tone: "hi" }));
    out.push(`<g class="th-iron">${iron.join("")}</g>`);
  }
  return out.join("");
}

// ------------------------------------------------------------ the hatch
const H = D.HATCH;
const A0 = H[0].a0;
const SMIN = H[0].s0;
const SMAX = H[0].s1;
const HINGE0 = surface(H[0].s0, A0);
const HINGE1 = surface(H[0].s1, A0);
const HINGE_E = G.unit3(G.sub3(HINGE1, HINGE0));
const THICK = 1.6;
function rotateAbout(p, angle) {
  const d = G.sub3(p, HINGE0);
  const e = HINGE_E;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cr = G.cross3(e, d);
  const ed = G.dot3(e, d);
  return G.add3(HINGE0, G.add3(G.add3(G.mul3(d, c), G.mul3(cr, s)), G.mul3(e, ed * (1 - c))));
}
const rotV = (v, angle) => G.sub3(rotateAbout(G.add3(HINGE0, v), angle), HINGE0);
function stripGrid(h) {
  const ns = Math.max(2, Math.round((h.s1 - h.s0) / 3));
  const rows = [];
  for (let j = 0; j <= ns; j++) {
    const s = h.s0 + ((h.s1 - h.s0) * j) / ns;
    rows.push([0, 1, 2].map((m) => {
      const a = h.a0 + ((h.a1 - h.a0) * m) / 2;
      return { o: surface(s, a), i: surface(s, a, -THICK), n: normalAt(s, a) };
    }));
  }
  return rows;
}
const GRIDS = H.map(stripGrid);
// the hinge runs along the bottom board only
const HS0 = H[0].s0;
const HS1 = H[0].s1;
// the stepped outline of the opening, following each board's own butt joints
const OPENING = (() => {
  const pts = [];
  const edge = (s0, s1, a, n = 8) => {
    for (let j = 0; j <= n; j++) pts.push(surface(s0 + ((s1 - s0) * j) / n, a));
  };
  const arc = (s, a0, a1, n = 3) => {
    for (let j = 1; j < n; j++) pts.push(surface(s, a0 + ((a1 - a0) * j) / n));
  };
  edge(H[0].s0, H[0].s1, H[0].a0);
  H.forEach((h, i) => {
    arc(h.s1, h.a0, h.a1);
    pts.push(surface(h.s1, h.a1));
    if (i < H.length - 1) pts.push(surface(H[i + 1].s1, h.a1));
  });
  const top = H[H.length - 1];
  edge(top.s1, top.s0, top.a1);
  [...H].reverse().forEach((h, i, list) => {
    arc(h.s0, h.a1, h.a0);
    pts.push(surface(h.s0, h.a0));
    if (i < list.length - 1) pts.push(surface(list[i + 1].s0, h.a0));
  });
  return pts;
})();
const quadSvg = (pts, normal) => {
  const tone = G.toneOf(normal, P);
  const d = pathOf(pts.map(at), true);
  return tone >= 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${tone}" d="${d}"/>`;
};
function hatchSvg(phi) {
  if (phi < 0.002) return "";
  const rot = (p) => rotateAbout(p, -phi);
  const out = [];
  // the dark hold behind the opening, its cut board ends, and two frames inside
  out.push(`<path class="th-cavity" d="${path3(OPENING, true)}"/>`);
  const ribs = [];
  for (const s of [HS0 + 6, (HS0 + H[H.length - 1].s1) / 2, H[H.length - 1].s1 - 6]) ribs.push(path3([0, 1, 2, 3, 4, 5, 6, 7, 8].map((m) => surface(s, H[0].a0 - 0.2 + ((H[H.length - 1].a1 - H[0].a0 + 0.4) * m) / 8, -6))));
  out.push(`<clipPath id="th-hold"><path d="${path3(OPENING, true)}"/></clipPath><g clip-path="url(#th-hold)"><path class="th-cavity-rib" d="${ribs.join("")}"/></g>`);
  // the leaf: one curved shell of five boards, its edges first, then the face we see
  const nMid = rotV(normalAt((HS0 + H[2].s1) / 2, (H[0].a0 + H[H.length - 1].a1) / 2), -phi);
  const outward = G.dot3(nMid, V) > 0;
  const faces = [];
  const rim = [];
  GRIDS.forEach((rows, b) => {
    for (let j = 0; j < rows.length - 1; j++)
      for (let m = 0; m < 2; m++) {
        const c = [rows[j][m], rows[j + 1][m], rows[j + 1][m + 1], rows[j][m + 1]];
        const n = rotV(c[0].n, -phi);
        const pts = c.map((p) => rot(outward ? p.o : p.i));
        faces.push(quadSvg(pts, outward ? n : G.mul3(n, -1)));
      }
    // thickness: the end grain at both butt joints and the long edges, where they face us
    const ends = [rows[0], rows[rows.length - 1]];
    ends.forEach((r, e) => {
      for (let m = 0; m < 2; m++) {
        const q = [rot(r[m].o), rot(r[m + 1].o), rot(r[m + 1].i), rot(r[m].i)];
        const n = G.mul3(rotV(BF.a, -phi), e ? 1 : -1);
        if (G.dot3(n, V) > 0) rim.push(quadSvg(q, n));
      }
    });
    for (const m of [0, 2]) {
      for (let j = 0; j < rows.length - 1; j++) {
        const q = [rot(rows[j][m].o), rot(rows[j + 1][m].o), rot(rows[j + 1][m].i), rot(rows[j][m].i)];
        const t = G.unit3(G.sub3(rows[j][2].o, rows[j][0].o));
        const n = G.mul3(rotV(t, -phi), m ? 1 : -1);
        if (G.dot3(n, V) > 0) rim.push(quadSvg(q, n));
      }
    }
  });
  // seams between the boards on the face, and the leaf's outline
  const face = (p) => rot(outward ? p.o : p.i);
  const seams = [];
  GRIDS.forEach((rows, b) => {
    if (b === 0) return;
    const lo = Math.max(H[b].s0, H[b - 1].s0);
    const hi = Math.min(H[b].s1, H[b - 1].s1);
    const run = rows.filter((r, j) => {
      const s = H[b].s0 + ((H[b].s1 - H[b].s0) * j) / (rows.length - 1);
      return s >= lo - 1e-6 && s <= hi + 1e-6;
    });
    if (run.length > 1) seams.push(path3(run.map((r) => face(r[0]))));
  });
  const ring = [];
  OPENING.forEach((p) => ring.push(rot(p)));
  const outline = path3(outward ? ring : ring.map((p) => p), true);
  // inside face: two ledges across the boards and two hinge straps
  const inside = [];
  if (!outward) {
    for (const s of [HS0 + 7, H[2].s1 - 7]) {
      const top = [];
      const bot = [];
      for (let m = 0; m <= 10; m++) {
        const a = H[0].a0 + ((H[H.length - 1].a1 - H[0].a0) * m) / 10;
        top.push(rot(surface(s - 2.2, a, -THICK - 1.6)));
        bot.push(rot(surface(s + 2.2, a, -THICK - 1.6)));
      }
      const nIn = rotV(G.mul3(normalAt(s, (H[0].a0 + H[4].a1) / 2), -1), -phi);
      inside.push(`<path class="iso-shade" data-shade="${Math.min(3, G.toneOf(nIn, P))}" d="${path3([...top, ...[...bot].reverse()], true)}"/>`);
      inside.push(lineSvg(path3([...top, ...[...bot].reverse()], true), { tone: "mid" }));
    }
    const straps = [];
    for (const s of [HS0 + 4, HS1 - 4]) straps.push(path3([0, 1, 2, 3, 4].map((m) => rot(surface(s, A0 + (m / 4) * 20 * deg, -THICK - 0.3)))));
    inside.push(`<g class="th-iron">${lineSvg(straps.join(""), { tone: "hi" })}${dotsSvg([HS0 + 4, HS1 - 4].flatMap((s) => [6, 14].map((d) => at(rot(surface(s, A0 + d * deg, -THICK - 0.3))))), { size: 0.5, tone: "hi" })}</g>`);
  }
  out.push(`<g class="iso-solid">${rim.join("")}${faces.join("")}${lineSvg(seams.join(""), { tone: "lo" })}${inside.join("")}<path class="iso-line iso-edge" data-tone="hi" d="${outline}"/></g>`);
  // hinge knuckles on the sill, on the fixed boards
  const knuck = [];
  for (const s of [HS0 + 4, HS1 - 4]) {
    const c = G.lerp3(HINGE0, HINGE1, (s - SMIN) / (SMAX - SMIN));
    const KF = G.frameOf(G.add3(c, G.mul3(normalAt(s, A0), 0.4)), HINGE_E, [0, 1, 0], [0, 0, 1]);
    knuck.push(S(G.disc(-2.6, 2.6, 1.5, KF, P, { steps: 16 }), { tone: "mid" }));
  }
  out.push(`<g class="th-iron">${knuck.join("")}</g>`);
  return out.join("");
}

// ------------------------------------------------------------ the rope ladder
const XL = D.BODY.x0 + (SMIN + SMAX) / 2;
const HZ = HINGE0[2];
const HY = HINGE0[1];
const LADDER_PATH = G.resample(G.fillet([[0, HY + 2.4, HZ + 0.5], [0, HY + 4, HZ - 27], [0, 33.6, 27], [0, 35.4, 0.9]], 6, 8), 1);
const LADDER_LEN = G.pathLength(LADDER_PATH);
const RAIL = 0.8;
function ladderSvg(u) {
  if (u < 0.002) return "";
  const len = Math.max(1.2, LADDER_LEN * u);
  const span = G.cut(LADDER_PATH, 0, len);
  const out = [];
  for (const dx of [-6, 6]) {
    const route = span.map((p) => [XL + dx, p[1], p[2]]);
    if (G.pathLength(route) < 1) continue;
    T.tubePieces(route, RAIL, P, { maxLength: 400, spacing: 0.6, caps: [true, false], rings: { pitch: 1.2, twist: 1.3, fade: [0.1, 0.55], tone: "lo" } }).forEach((piece) => out.push(tubeOf(piece)));
  }
  const rungs = [];
  for (let l = 5; l < len - 3; l += 7.5) {
    const p = G.pointAlong(LADDER_PATH, l);
    const F = G.frameOf([XL - 6.6, p[1], p[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    rungs.push(S(G.disc(0, 13.2, 0.95, F, P, { steps: 14 }), { tone: "mid" }));
  }
  out.push(`<g class="th-wood">${rungs.join("")}</g>`);
  // what is still rolled up hangs at the bottom as a bundle
  const end = G.pointAlong(LADDER_PATH, len);
  const rr = 1.4 + 3.4 * Math.sqrt(1 - u);
  if (u < 0.999) out.push(`<g class="th-rope">${S(G.disc(-1, 15.2, rr, G.frameOf([XL - 7.6, end[1] + rr * 0.4, end[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P, { steps: 24 }), { tone: "mid" })}</g>`);
  return out.join("");
}
const tubeOf = (piece) => `<g class="th-rope">${T.tubeSvg(piece, { tone: "mid" })}${piece.rings ? "" : ""}</g>`;

// ------------------------------------------------------------ the lead rope, slack to taut
const LEAD = D.LEAD;
const CHIN = D.CHIN;
const LEAD_START = D.LEAD_START;
const LEAD_R = D.LEAD_R;
__LEADROUTE__
function leadSvg(t) {
  const route = G.fillet(leadRoute(t), Math.max(6, D.LEAD_R * 2.6), 10, { P, tube: D.LEAD_R });
  const pieces = T.tubePieces(route, D.LEAD_R, P, { maxLength: 12, spacing: 1.25, rings: { pitch: D.LEAD_R * 1.5, twist: D.LEAD_R * 1.6, fade: [0.1, 0.55], tone: "lo" } });
  pieces.sort((a, b) => G.dot3(a.mid, V) - G.dot3(b.mid, V));
  const end = route[route.length - 1];
  const out = G.unit3(G.sub3(end, route[route.length - 2]));
  const KR = D.LEAD_R * 1.55;
  const knot = G.add3(end, G.mul3(out, Math.sqrt(KR * KR - D.LEAD_R * D.LEAD_R)));
  return pieces.map(tubeOf).join("") + `<g class="th-rope">${S(G.sphereOf(knot, KR, P, { steps: 24 }), { tone: "mid" })}</g>`;
}

// ------------------------------------------------------------ soldiers
const COUNT = 6;
function soldierSvg() {
  const out = [];
  // greaves, a tunic belted at the waist, a crested helmet and a round shield carried on the near arm
  out.push(`<g class="th-soldier-dark">${S(slabOf({ x: -1.2, y: -2.8, w: 2.4, d: 2.1, r: 0.8 }, 0, 13.5, P, 3), { tone: "mid" })}${S(slabOf({ x: -1.2, y: 0.7, w: 2.4, d: 2.1, r: 0.8 }, 0, 13.5, P, 3), { tone: "mid" })}</g>`);
  out.push(S(cylinder(0, 0, 3.5, 12.5, 12.5, P, 24, 0.3), { tone: "mid", inner: lineSvg(sideArc(0, 0, 3.5, 17.5, P, 16), { tone: "lo" }) }));
  out.push(S(G.sphereOf([0, 0, 28.6], 3.3, P, { steps: 28 }), { tone: "hi", lit: true }));
  // the crest: a horsehair ridge front to back over the helmet, drawn in the helmet's own plane
  const crest = [];
  for (let j = 0; j <= 12; j++) {
    const a = Math.PI * (0.12 + 0.76 * (j / 12));
    crest.push([3.9 * Math.cos(a) * 1.15, 0, 28.6 + 3.9 * Math.sin(a) + 0.4]);
  }
  for (let j = 12; j >= 0; j--) {
    const a = Math.PI * (0.12 + 0.76 * (j / 12));
    crest.push([6.4 * Math.cos(a) * 1.05, 0, 28.6 + 6.4 * Math.sin(a) - 0.6]);
  }
  const cd = path3(crest, true);
  out.push(`<g class="iso-solid" data-lit=""><path class="iso-shade" data-shade="${Math.min(3, G.toneOf([0, 1, 0], P))}" d="${cd}"/><path class="iso-line iso-edge" data-tone="hi" d="${cd}"/></g>`);
  const SF = G.frameOf([0.6, 3.9, 17.5], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  out.push(S(G.disc(0, 1, 5.4, SF, P, { steps: 40, bevel: 0.4 }), { tone: "hi" }));
  out.push(lineSvg(pathOf(Array.from({ length: 41 }, (_, j) => at(G.pointOf(SF, 1, 4.1, (j / 40) * Math.PI * 2))), true), { tone: "mid" }));
  out.push(S(G.sphereOf([0.6, 4.9, 17.5], 1.1, P, { steps: 16 }), { tone: "hi", lit: true }));
  return `<g class="th-soldier">${out.join("")}</g>`;
}
const SOLDIER = soldierSvg();
const soldierEls = Array.from({ length: COUNT }, (_, i) => {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-soldier", String(i));
  g.innerHTML = SOLDIER;
  g.style.opacity = "0";
  soldiersG.appendChild(g);
  return g;
});
// where each one waits: two at the leaves, the rest along the near side of the yard
const POSTS = [[86, 30], [88, -12], [98, 58], [110, 66], [96, -40], [124, 56]];
const CLIMB = 38; // units a second down the ladder
const RUN = 64;
const T_HATCH = [0.2, 2.6];
const T_LADDER = [2.1, 4.4];
const START = (i) => 4.8 + i * 1.7;
function plan(i, X) {
  const top = [X + XL, HY + 5.4, HZ + 1];
  const foot = [X + XL, 39, 0];
  const post = [POSTS[i][0], POSTS[i][1], 0];
  const turn = [Math.max(post[0] + 14, Math.min(foot[0] - 10, X + D.rear - 8)), 42 + (i % 3) * 5, 0];
  const legs = [foot, turn, post];
  const runLen = G.pathLength(legs);
  const t0 = START(i);
  const climb = LADDER_LEN / CLIMB;
  return { top, foot, legs, runLen, t0, climb, arrive: t0 + 0.6 + climb + runLen / RUN };
}
function soldierAt(i, tau, X) {
  const p = plan(i, X);
  const q = tau - p.t0;
  if (q <= 0) return { show: 0, out: false, pos: p.top };
  if (q < 0.6) {
    const e = smoothstep(q / 0.6);
    return { show: e, out: q > 0.3, pos: [p.top[0], p.top[1] - 4 + 4 * e, p.top[2] - 14 * (1 - e)] };
  }
  if (q < 0.6 + p.climb) {
    const l = ((q - 0.6) / p.climb) * LADDER_LEN;
    const lp = G.pointAlong(LADDER_PATH, l);
    return { show: 1, out: true, pos: [X + XL, lp[1] + 3.6, Math.max(0, lp[2] - 26)] };
  }
  const l = Math.min(p.runLen, (q - 0.6 - p.climb) * RUN);
  const pos = G.pointAlong(p.legs, l);
  const bob = l < p.runLen ? Math.abs(Math.sin(l * 0.38)) * 1.4 : 0;
  return { show: 1, out: true, pos: [pos[0], pos[1], pos[2] + bob] };
}

// ------------------------------------------------------------ state
let X = D.X0;
let target = D.X0;
let vel = 0;
let tension = 0;
let leadAt = -1;
let night = false;
let dim = 0;
let tau = 0;
let doorP = 1; // 0 shut, 1 open; the angle is an ease of it
let door = Math.PI / 2;
let breached = false;
let frame = 0;
let last = 0;
let visible = false;
let lastWheel = null;
let lastDoor = null;
let lastHatch = null;
let lastLadder = null;
let phaseLow = "";
let phaseUp = "";
const TAU_OPEN = plan(1, D.X1).arrive;
const TAU_END = plan(COUNT - 1, D.X1).arrive + 1.2;
const insideNow = () => X + D.rear >= D.CLEAR - 0.01;
const front = 128;

const SLOT_Z = { A: 20, B: 40, C: 60 };
function place(names, slot) {
  names.forEach((name, i) => (layerOf(name).style.zIndex = String(SLOT_Z[slot] + i)));
}
const cam = cameraOf(P);
const behindLift = (cam.cosA * cam.sinE) / cam.cosE;
function upperPhase() {
  if (insideNow()) return "C";
  for (const s of D.upSamples) {
    const x = s[0] + X;
    if (x < D.GATE.x1 && s[2] + (D.GATE.x1 - x) * behindLift > D.DOOR.impost - 6) return "A";
  }
  return "B";
}
function draw(force = false) {
  // move the horse layers by the screen offset of X, in CSS px
  const k = svg.clientWidth / D.W;
  const [ox, oy] = axisVector(P, [X, 0, 0]);
  const tr = `translate3d(${(ox * k).toFixed(2)}px, ${(oy * k).toFixed(2)}px, 0)`;
  moving.forEach((el) => (el.style.transform = tr));
  const inside = insideNow();
  const pl = inside ? "C" : "A";
  const pu = upperPhase();
  if (pl !== phaseLow || pu !== phaseUp || force) {
    place(["horse-low", "wheels", "hatch"], pl);
    place(["horse-up", "lead"], pu);
    if (pl === pu) place(["horse-low", "wheels", "hatch", "horse-up", "lead"], pl);
    phaseLow = pl;
    phaseUp = pu;
  }
  // wheels: angle from distance rolled, no slip
  const angle = (X - D.X0) / D.WHEEL_R;
  if (force || lastWheel === null || Math.abs(angle - lastWheel) > 0.002) {
    wheelFaces.forEach((g) => (g.innerHTML = wheelFace(Number(g.dataset.x), angle)));
    lastWheel = angle;
  }
  if (force || lastDoor === null || Math.abs(door - lastDoor) > 0.0015) {
    doorNear.innerHTML = leafSvg(1, door);
    doorFar.innerHTML = leafSvg(-1, door);
    lastDoor = door;
  }
  const hPhi = ease(tau, T_HATCH[0], T_HATCH[1]) * 158 * deg;
  if (force || lastHatch === null || Math.abs(hPhi - lastHatch) > 0.002) {
    hatchG.innerHTML = hatchSvg(hPhi);
    lastHatch = hPhi;
  }
  const lu = ease(tau, T_LADDER[0], T_LADDER[1]);
  if (force || lastLadder === null || Math.abs(lu - lastLadder) > 0.002) {
    ladderG.innerHTML = ladderSvg(lu);
    lastLadder = lu;
  }
  if (force || Math.abs(tension - leadAt) > 0.004) {
    leadG.innerHTML = leadSvg(tension);
    leadAt = tension;
  }
  // soldiers, sorted far to near each frame
  let out = 0;
  const states = soldierEls.map((el, i) => {
    const st = soldierAt(i, tau, X);
    if (st.out) out++;
    el.style.opacity = st.show.toFixed(3);
    el.setAttribute("transform", translateAlong(P, st.pos));
    return { el, depth: G.dot3(st.pos, V) };
  });
  states.sort((a, b) => a.depth - b.depth);
  states.forEach((s, i) => {
    if (soldiersG.children[i] !== s.el) soldiersG.insertBefore(s.el, soldiersG.children[i] ?? null);
  });
  plate.style.setProperty("--th-night", smoothstep(dim).toFixed(3));
  const gate = doorP === 1 ? "open" : doorP === 0 ? "closed" : doorTarget() > 0.5 ? "opening" : "closing";
  const dist = (X - D.X0) / D.M;
  const turns = (X - D.X0) / (2 * Math.PI * D.WHEEL_R);
  const text = `${dist.toFixed(1)} m · ${turns.toFixed(2)} turns · gate ${gate} · ${COUNT - out} inside / ${out} out`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", dist.toFixed(1));
  stage.setAttribute("aria-valuetext", text);
}
function doorTarget() {
  return !insideNow() || breached || tau >= TAU_OPEN ? 1 : 0;
}
function limits() {
  let lo = D.X0;
  let hi = D.X1;
  if (tau > 0) return [X, X];
  if (insideNow() && door < Math.PI / 2 - 0.02) lo = D.CLEAR - D.rear;
  if (!insideNow() && door < Math.PI / 2 - 0.05) hi = Math.min(hi, D.GATE.x0 - front - 2);
  return [lo, hi];
}

// ------------------------------------------------------------ idle tour
let touring = !still.matches;
let tourStep = 0;
let tourWait = 2.2;
let idleTimer = 0;
function tour(dt) {
  if (tourWait > 0) {
    tourWait -= dt;
    return;
  }
  const atRest = Math.abs(X - target) < 0.3;
  switch (tourStep) {
    case 0: target = D.X1; tourStep = 1; break;
    case 1: if (atRest && doorP === 0) { tourStep = 2; tourWait = 1.4; } break;
    case 2: setNight(true, false); tourStep = 3; break;
    case 3: if (tau >= TAU_END) { tourStep = 4; tourWait = 3.2; } break;
    case 4: setNight(false, false); tourStep = 5; break;
    case 5: if (tau <= 0 && dim < 0.02) { tourStep = 6; tourWait = 1.2; } break;
    case 6: target = D.X0; tourStep = 7; break;
    case 7: if (atRest && Math.abs(X - D.X0) < 0.5) { tourStep = 0; tourWait = 2.4; } break;
  }
}
function hold() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches) return;
    touring = true;
    tourStep = X > D.X0 + 1 ? (night ? 3 : insideNow() ? 1 : 0) : 0;
    tourWait = 0.6;
    run();
  }, 7000);
}
function setNight(on, user = true) {
  night = on;
  if (nightBtn) nightBtn.setAttribute("aria-pressed", String(on));
  if (status) status.textContent = on ? "Night." + (insideNow() ? "" : " The hatch waits until the gate has closed behind the horse.") : "Day.";
  if (user) hold();
  run();
}

// ------------------------------------------------------------ loop
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) tour(dt);
  const [lo, hi] = limits();
  target = clamp(target, D.X0, D.X1);
  const goal = clamp(target, lo, hi);
  const prev = X;
  if (calm) {
    X = goal;
    vel = 0;
  } else {
    const wantV = clamp((goal - X) / 0.45, -70, 70);
    vel += (wantV - vel) * (1 - Math.exp(-dt / 0.35));
    X += vel * dt;
    if ((goal - prev) * (goal - X) <= 0 || (Math.abs(goal - X) < 0.03 && Math.abs(vel) < 0.5)) {
      X = goal;
      vel = 0;
    }
  }
  tension += ((calm ? 0 : clamp(vel / 30, 0, 1)) - tension) * (1 - Math.exp(-dt / 0.3));
  if (tension < 0.002) tension = 0;
  // night: the hold opens only inside the walls, once the gate is shut
  dim = calm ? (night ? 1 : 0) : night ? Math.min(1, dim + dt / 1.8) : Math.max(0, dim - dt / 1.8);
  const ready = insideNow() && (doorP === 0 || tau > 0);
  if (night && (ready || tau > 0)) tau = calm ? TAU_END : Math.min(TAU_END, tau + dt);
  else if (!night && tau > 0) tau = calm ? 0 : Math.max(0, tau - dt * 1.8);
  // the gate: the leaves close once the cart has cleared their swing, and open for the soldiers
  const want = doorTarget();
  doorP = calm ? want : want > doorP ? Math.min(want, doorP + dt / 2.6) : Math.max(want, doorP - dt / 2.6);
  door = smoothstep(doorP) * (Math.PI / 2);
  const dt0 = want * (Math.PI / 2);
  if (tau >= TAU_OPEN) breached = true;
  if (breached && X + front < D.GATE.x0) breached = false;
  draw();
  const settled = !touring && X === goal && tension === 0 && doorP === want && (dim === 0 || dim === 1) && (tau === 0 || tau === TAU_END) && !(night && ready && tau < TAU_END);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

// pointer: drag sideways to pull (or push back); screen motion maps onto the road's direction
const along = axisVector(P, [1, 0, 0]);
const alongLen = Math.hypot(along[0], along[1]);
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, from: target };
  stage.setPointerCapture?.(e.pointerId);
  hold();
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const box = svg.getBoundingClientRect();
  const k = D.W / box.width;
  const dx = (e.clientX - drag.x) * k;
  const dy = (e.clientY - drag.y) * k;
  const w = (dx * along[0] + dy * along[1]) / (alongLen * alongLen);
  target = clamp(drag.from + w, D.X0, D.X1);
  hold();
  run();
});
const endDrag = () => (drag = null);
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("keydown", (e) => {
  let handled = true;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") target = clamp(Math.max(target, X) + 20, D.X0, D.X1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = clamp(Math.min(target, X) - 20, D.X0, D.X1);
  else if (e.key === "Home") target = D.X0;
  else if (e.key === "End") target = D.X1;
  else if (e.key === "n" || e.key === "N") setNight(!night);
  else handled = false;
  if (!handled) return;
  e.preventDefault();
  hold();
  run();
});
document.addEventListener("keydown", (e) => {
  if (e.target === stage || e.target.closest?.("input,textarea")) return;
  if (e.key === "n" || e.key === "N") setNight(!night);
});
nightBtn?.addEventListener("click", () => setNight(!night));
const moon = document.createElement("div");
moon.className = "th-moon";
plate.appendChild(moon);
draw(true);
