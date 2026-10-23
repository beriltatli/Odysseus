// Fig. 1 — The Trojan Horse. node build.mjs [--light] [--audit]
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL = join(homedir(), ".claude", "skills", "anatomy");
const use = (file) => import(pathToFileURL(join(SKILL, file)).href);
const k = await use("kit/iso-kit.mjs");
const G = await use("kit/lathe.mjs");
const { tubePieces, tubeSvg } = await use("kit/tube.mjs");
const A = await use("kit/audit.mjs");
const { kitScript } = await use("scripts/inline-kit.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

// ---------------------------------------------------------------- model
// World units: 20 per metre. x is the road (into the city), y across it (+y toward the viewer), z up.
const M = 20;
const W = 640;
const H = 430;
const AZIMUTH = 58;

const WHEEL_R = 13; // 0.65 m solid plank wheel
const X0 = -222; // horse at rest, outside the wall
const X1 = 164; // fully inside, platform clear of the door swing
const GATE = { x0: 0, x1: 30, half: 50, spring: 196, inner: 40, outer: 50 }; // passage, arch springing, voussoir radii
const TOWER = { x0: -8, x1: 38, y0: 50, y1: 92, h: 284 };
const DOOR = { t: 8, w: 50, impost: 186 };
const SWEEP = GATE.x1 + DOOR.w; // the open leaves reach x = 80
const CLEAR = 84; // the platform's rear must pass this before the leaves can close

const PLAT = { x: -76, y: -32, w: 152, d: 64, r: 1.2 };
const DECK = 28;
const BEAM = { z0: 15, z1: 25 };
const AXLE_X = [-50, 50];
const WHEEL_Y = [33, 39];
const LEG_X = [-40, 40];
const LEG_Y = 16;
const LEG_R = 7;
const HOOF_R = 8.6;
const LASH = { r: 1.1, shin: [44.2, 46.4, 52.8], knee: [62.4, 64.6, 71.2] };
const TIE = { shin: 49.6, knee: 67.8 }; // where the hanging ropes are tied on, between turns

const BODY = { x0: -62, len: 124, R: 34, p: 2.4, z: 117 };
const bodyR = (s) => {
  const u = Math.min(1, Math.abs((s - BODY.len / 2) / (BODY.len / 2)));
  return BODY.R * Math.pow(Math.max(0, 1 - Math.pow(u, BODY.p)), 1 / BODY.p);
};
const bodySlope = (s) => {
  const h = 0.01;
  const a = Math.max(0.2, Math.min(BODY.len - 0.2, s));
  return (bodyR(a + h) - bodyR(a - h)) / (2 * h);
};

const PLANK_DEG = 9; // 40 planks round the barrel, about 27 cm each
const PLANK_LEN = 30; // 1.5 m boards, butt joints staggered strip by strip
const HATCH_STRIPS = [-4, -3, -2, -1, 0]; // five boards from -36° to 9° on the near flank

// ---------------------------------------------------------------- camera
const P = k.fitProjection(
  [
    [-302, -40, 0], [-302, 40, 0], [-302, 0, 214], [318, 40, 0], [318, -40, 0],
    [TOWER.x0, -TOWER.y1, TOWER.h + 16], [TOWER.x1, -TOWER.y1, 0], [TOWER.x0, TOWER.y1, TOWER.h + 16], [TOWER.x1, TOWER.y1, 0],
    [-312, 104, -6], [322, 104, -6], [-312, -104, -6], [322, -104, -6],
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;
const XF = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const fade = (v, [lo, hi]) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- recorders
function recorderFor(piece) {
  const R = A.recorder(P);
  const put = (name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) => R.put({ name, at: ref, bias, svg, shapes, piece, ...rest });
  return { R, put, record: R.solid };
}
const HORSE = recorderFor("horse");
const GATEW = recorderFor("gate");

function makers({ put, record, R }, owner) {
  const box = (name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.6, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, meta = {} } = {}) => {
    const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
    const shape = record(A.slab(plan, z0, z1 - z0, { name, owner, ...meta }, steps));
    put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
    return shape;
  };
  const cyl = (name, cx, cy, r, z0, z1, style = {}, { extra = "", inner = "", bias = 0, steps = 36, bevel = 0, meta = {} } = {}) => {
    const shape = record(A.cylinder(cx, cy, r, z0, z1 - z0, { name, owner, ...meta }));
    put(name, [cx, cy, (z0 + z1) / 2], S(k.cylinder(cx, cy, r, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
    return shape;
  };
  const turned = (name, F, profile, style = {}, { extra = "", inner = "", bias = 0, smooth, steps, rims, bevel = 0, meta = {}, ref } = {}) => {
    const opts = { bevel, ...(smooth !== undefined ? { smooth } : {}), ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) };
    const paths = G.solidOf(profile, F, P, opts);
    const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    const shape = record(A.solid(F, profile, { name, owner, radius: smooth && smooth.radius ? smooth.radius : null, ...meta }));
    put(name, ref ?? G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias });
    return shape;
  };
  const prism = (name, F, poly, s0, s1, style = {}, { extra = "", inner = "", bias = 0, meta = {}, ref } = {}) => {
    const shape = record(A.prism(F, poly, s0, s1, { name, owner, ...meta }));
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const centre = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.mul3(F.u, cx)), G.mul3(F.v, cy));
    put(name, ref ?? centre, S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
    return shape;
  };
  const ball = (name, c, r, style = {}, { bias = 0, extra = "", meta = {} } = {}) => {
    const shape = record(A.ball(c, r, { name, owner, ...meta }));
    put(name, c, S(G.sphereOf(c, r, P, { steps: 32 }), { tone: "mid", ...style }) + extra, [shape], { bias });
    return shape;
  };
  // A rope: a filleted route drawn as twisted tube chunks, each its own depth-sorted item.
  const rope = (name, points, r, { bend = 4, maxLength = 14, bias = 0.05, touch, closed = false, rings = true, tone = "mid", ends = [false, false], meta = {}, cls = "th-rope" } = {}) => {
    const route = closed ? points : G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
    R.route(name, route, r, { limp: true, touch, closed, piece: owner, ...meta });
    const pieces = tubePieces(route, r, P, { maxLength, spacing: Math.max(0.5, Math.min(1.4, r)), closed, ...(rings ? { rings: { pitch: r * 1.5, twist: r * 1.6, fade: [0.1, 0.55], tone: "lo" } } : {}) });
    pieces.forEach((piece, index) =>
      put(`${name}:${index}`, piece.mid, `<g class="${cls}">${tubeSvg(piece, { tone })}</g>`, [A.tube(piece.points, piece.radii)], { bias, route: name, chunk: index }),
    );
    // a knot at an end: a ball whose surface the rope's end rim lands on
    [0, 1].forEach((index) => {
      if (!ends[index]) return;
      const end = index ? route[route.length - 1] : route[0];
      const prev = index ? route[route.length - 2] : route[1];
      const out = G.unit3(G.sub3(end, prev));
      const R = r * 1.55;
      ball(`${name}.knot${index}`, G.add3(end, G.mul3(out, Math.sqrt(R * R - r * r))), R, { tone: "mid" }, { bias: bias + 0.1 });
    });
    return route;
  };
  return { box, cyl, turned, prism, ball, rope };
}
const HM = makers(HORSE, "horse");
// the sand the wheels and towers stand on
for (const { record } of [HORSE, GATEW]) record(A.slab({ x: -400, y: -200, w: 800, d: 400, r: 0 }, -6, 6, { name: "stand.ground", ground: true }, 2));
const GM = makers(GATEW, "gate");

// soft shadows on the sand, drawn under everything in their layer
const HALOS = { horse: [], gate: [] };
// ---------------------------------------------------------------- ground (static, drawn first)
const GROUND = { x: -314, y: -104, w: 636, d: 208, r: 14 };
const ground = [];
ground.push(`<path class="iso-halo" d="${k.haloOf(GROUND, -6, 6, P)}" style="opacity:calc(var(--anatomy-halo-opacity)*.6)"/>`);
ground.push(`<g class="th-sand">${S(k.slabOf(GROUND, -6, 6, P, 8, 1.2), { tone: "lo", crease: "faint", inner: Ln(k.sideSeam(GROUND, -2.4, P, 8), { tone: "faint" }) })}</g>`);
{
  // sand speckle: a fixed scatter, denser near the road
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dots = [];
  for (let i = 0; i < 520; i++) {
    const x = GROUND.x + 10 + rnd() * (GROUND.w - 20);
    const y = GROUND.y + 10 + rnd() * (GROUND.d - 20);
    if (x > 44 && Math.abs(y) < 66) continue; // paving inside the gate
    if (x > -14 && x < 44 && Math.abs(y) < 98) continue;
    dots.push(at([x, y, 0]));
  }
  ground.push(`<g class="th-sand">${Dots(dots, { size: 0.45, tone: "lo" })}</g>`);
  // the road outside: two wheel ruts that fade out where the track runs off into the sand
  for (const y of [-36, 36]) {
    const pts = [at([-306, y, 0]), at([-160, y, 0]), at([-30, y, 0]), at([-8, y, 0])];
    ground.push(`<g class="th-sand">${k.fadeLineSvg(pts, { fade: [40, 0], tone: "mid" })}</g>`);
  }
  // paving inside the city: staggered flagstones as closed outlines (no line ends)
  const stones = [];
  for (let row = 0; row < 8; row++) {
    const y0 = -64 + row * 16;
    const offset = (row % 2) * 13;
    for (let x = 44 - offset; x < 318; x += 26) {
      const xa = Math.max(46, x + 1);
      const xb = Math.min(316, x + 25);
      if (xb - xa < 6) continue;
      stones.push(k.planOutline({ x: xa, y: y0 + 1, w: xb - xa, d: 14, r: 1.6 }, 0, P, 3));
    }
  }
  ground.push(`<g class="th-sand">${Ln(stones.join(""), { tone: "lo" })}</g>`);
  // the threshold in the passage
  ground.push(`<g class="th-stone">${Ln(k.planOutline({ x: 1, y: -49, w: 28, d: 98, r: 1 }, 0, P, 3) + k.lineOnTop([15, -49], [15, 49], 0, P), { tone: "lo" })}</g>`);
}

// ---------------------------------------------------------------- the platform
const wood = (s) => `<g class="th-wood">${s}</g>`;
{
  const { box, cyl } = HM;
  // halo under the cart
  HALOS.horse.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PLAT, -6), 0, 0.1, P)}" style="filter:blur(6px)"/>`);
  // axle blocks under the side beams, axles through them
  for (const x of AXLE_X) {
    for (const sy of [-1, 1]) {
      const y0 = sy > 0 ? 24 : -32;
      box(`axle.block.${x}.${sy}`, [x - 7, y0, 8], [x + 7, y0 + 8, BEAM.z0], { tone: "mid" }, { extra: Dots([at([x - 4.5, sy > 0 ? 32 : -24, 11.5]), at([x + 4.5, sy > 0 ? 32 : -24, 11.5])], { size: 0.45, tone: "mid" }) });
    }
    // the axle runs block to block under the deck; its stubs come out of the blocks into the wheels
    const AF = G.frameOf([x, 0, WHEEL_R], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    HM.turned(`axle.${x}`, AF, [[-24, 2.6], [24, 2.6]], { tone: "lo" });
    for (const sy of [-1, 1]) HM.turned(`axle.stub.${x}.${sy}`, G.frameOf([x, sy * 32, WHEEL_R], [0, sy, 0], [1, 0, 0], [0, 0, 1]), [[0, 2.6], [1, 2.6]], { tone: "lo" });
  }
  // side beams and end headers
  const nailsBeam = (y, z) => Dots([-70, -46, -22, 0, 22, 46, 70].map((x) => at([x, y, z])), { size: 0.45, tone: "mid" });
  box("beam.far", [PLAT.x, -32, BEAM.z0], [PLAT.x + PLAT.w, -24, BEAM.z1], { tone: "mid" }, { r: 0.8, bevel: 0.5 });
  box("beam.near", [PLAT.x, 24, BEAM.z0], [PLAT.x + PLAT.w, 32, BEAM.z1], { tone: "mid" }, { r: 0.8, bevel: 0.5, extra: nailsBeam(32.05, 20), inner: Ln(k.segment([-38, 32, BEAM.z0], [-38, 32, BEAM.z1], P) + k.segment([38, 32, BEAM.z0], [38, 32, BEAM.z1], P), { tone: "lo" }) });
  box("header.rear", [PLAT.x, -24, BEAM.z0], [PLAT.x + 8, 24, BEAM.z1], { tone: "mid" }, { r: 0.8 });
  box("header.front", [PLAT.x + PLAT.w - 8, -24, BEAM.z0], [PLAT.x + PLAT.w, 24, BEAM.z1], { tone: "mid" }, { r: 0.8, bevel: 0.5, extra: Dots([-14, 0, 14].map((y) => at([PLAT.x + PLAT.w + 0.05, y, 20])), { size: 0.45, tone: "mid" }) });
  // deck: 16 cross planks, each nailed twice at both beams
  const n = 16;
  const pw = PLAT.w / n;
  for (let i = 0; i < n; i++) {
    const x0 = PLAT.x + i * pw + 0.25;
    const x1 = PLAT.x + (i + 1) * pw - 0.25;
    const nails = [-30, -26, 26, 30].map((y) => at([(x0 + x1) / 2 + (y > 0 ? 0 : 0), y, DECK]));
    const grain = Ln(k.lineOnTop([x0, (i % 3) * 6 - 6], [x1, (i % 3) * 6 - 6], DECK, P), { tone: "faint" });
    box(`deck.${i}`, [x0, PLAT.y - 1, BEAM.z1], [x1, PLAT.y + PLAT.d + 1, DECK], { tone: "mid" }, { r: 0.5, bevel: 0.35, extra: Dots(nails, { size: 0.42, tone: "mid" }) + grain });
  }
  // wheels: discs on the axle stubs. Their plank seams, nails and square hubs turn, so the page draws them.
  for (const x of AXLE_X) {
    for (const sy of [-1, 1]) {
      const F = G.frameOf([x, sy * WHEEL_Y[0], WHEEL_R], [0, sy, 0], [1, 0, 0], [0, 0, 1]);
      HM.turned(`wheel.${x}.${sy}`, F, [[0, WHEEL_R], [WHEEL_Y[1] - WHEEL_Y[0], WHEEL_R]], { tone: "mid" }, { bevel: 0.6, ref: [x, sy * 36, WHEEL_R] });
      HM.turned(`washer.${x}.${sy}`, G.frameOf([x, sy * 32, WHEEL_R], [0, sy, 0], [1, 0, 0], [0, 0, 1]), [[0, 4.2], [1, 4.2]], { tone: "lo" }, { meta: { seated: true } });
    }
  }
}

const BF = XF([BODY.x0, 0, BODY.z]);
const BODY_PROFILE = Array.from({ length: 41 }, (_, i) => {
  const s = (i / 40) * BODY.len;
  return [s, bodyR(s), 1];
});
const BODY_CUT = A.solid(BF, BODY_PROFILE, { name: "body.cut", piece: "horse" });

// ---------------------------------------------------------------- legs, hooves, lashings
const LEGS = [];
for (const x of LEG_X) for (const y of [-LEG_Y, LEG_Y]) LEGS.push([x, y]);
const legTop = 110;
{
  const { box, cyl, rope } = HM;
  const { put, record } = HORSE;
  for (const [x, y] of LEGS) {
    const tag = `${x}.${y}`;
    box(`hoof.plate.${tag}`, [x - 10, y - 10, DECK], [x + 10, y + 10, DECK + 2], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.4, extra: Dots(k.corners({ x: x - 10, y: y - 10, w: 20, d: 20 }, 2.4).map(([a, b]) => at([a, b, DECK + 2])), { size: 0.5, tone: "hi" }) });
    cyl(`hoof.${tag}`, x, y, HOOF_R, DECK + 2, DECK + 10, { tone: "mid" }, { bevel: 0.5, inner: Ln(k.sideArc(x, y, HOOF_R, DECK + 6, P, 24), { tone: "lo" }) });
    // the leg: vertical staves running up into the belly. It is drawn clipped along its true
    // intersection with the barrel, so it can sit in front of the belly without showing its top.
    const zJoin = (a, r = LEG_R) => {
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      const rr = bodyR(px - BODY.x0);
      return BODY.z - Math.sqrt(Math.max(0, rr * rr - py * py));
    };
    const facingA = (a) => Math.cos(a) * V[0] + Math.sin(a) * V[1];
    const visA = [];
    for (let j = 0; j <= 96; j++) {
      const a = Math.atan2(V[1], V[0]) - Math.PI / 2 + (j / 96) * Math.PI;
      visA.push(a);
    }
    const seam = path3(visA.map((a) => [x + LEG_R * Math.cos(a), y + LEG_R * Math.sin(a), zJoin(a)]));
    const clipR = LEG_R + 1.2;
    const clipPts = [
      ...visA.map((a) => [x + clipR * Math.cos(a), y + clipR * Math.sin(a), zJoin(a, LEG_R) + 0.3]),
      [x + clipR * Math.cos(visA[96]), y + clipR * Math.sin(visA[96]), DECK],
      [x + clipR * Math.cos(visA[0]), y + clipR * Math.sin(visA[0]), DECK],
    ];
    const staves = [];
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * Math.PI * 2 + 0.11;
      if (facingA(a) < 0.08) continue;
      staves.push(path3([[x + LEG_R * Math.cos(a), y + LEG_R * Math.sin(a), DECK + 10], [x + LEG_R * Math.cos(a), y + LEG_R * Math.sin(a), zJoin(a)]]));
    }
    const legShape = record(A.cylinder(x, y, LEG_R, DECK + 10, legTop - DECK - 10, { name: `leg.${tag}`, owner: "horse", seated: true, cut: [BODY_CUT] }));
    const clipId = `th-leg-${x}-${y}`.replace(/[^\w-]/g, "m");
    put(
      `leg.${tag}`,
      [x, y, 60],
      `<clipPath id="${clipId}"><path d="${path3(clipPts, true)}"/></clipPath><g clip-path="url(#${clipId})">${S(k.cylinder(x, y, LEG_R, DECK + 10, legTop - DECK - 10, P, 36), { tone: "hi", crease: "none", inner: Ln(staves.join(""), { tone: "lo" }) })}</g>${Ln(seam, { tone: "mid" })}`,
      [legShape],
    );
    // rope lashings: two turns at the shin, three at the knee
    for (const z of [...LASH.shin, ...LASH.knee]) {
      const ringPts = Array.from({ length: 48 }, (_, i) => [x + (LEG_R + LASH.r) * Math.cos((i / 48) * Math.PI * 2), y + (LEG_R + LASH.r) * Math.sin((i / 48) * Math.PI * 2), z]);
      tubePieces(ringPts, LASH.r, P, { maxLength: 7, spacing: 0.8, closed: true, rings: { pitch: LASH.r * 1.5, twist: LASH.r * 1.6, fade: [0.1, 0.55], tone: "lo" } }).forEach((piece, i) =>
        put(`lash.${tag}.${z}:${i}`, piece.mid, `<g class="th-rope">${tubeSvg(piece, { tone: "mid" })}</g>`, [A.tube(piece.points, piece.radii, { owner: `leg.${tag}` })], { bias: 0.05 }),
      );
    }
  }
}

// ---------------------------------------------------------------- body: the barrel of planks
const deg = Math.PI / 180;
const strips = [];
for (let i = -20; i < 20; i++) strips.push(i);
const jointsOf = (i) => {
  const off = (((i * 7) % PLANK_LEN) + PLANK_LEN) % PLANK_LEN;
  const out = [];
  for (let s = off; s < BODY.len; s += PLANK_LEN) if (s > 8 && s < BODY.len - 8) out.push(s);
  return out;
};
// the hatch: four strips, each cut at its own butt joints so its edge steps like every other joint
const HATCH = HATCH_STRIPS.map((i) => {
  const joints = jointsOf(i);
  const s0 = joints.find((s) => s >= 31);
  return { i, a0: i * PLANK_DEG * deg, a1: (i + 1) * PLANK_DEG * deg, s0, s1: s0 + PLANK_LEN };
});
function surfacePoint(s, a, lift = 0) {
  return G.pointOf(BF, s, bodyR(s) + lift, a);
}
function normalAt(s, a) {
  const rad = G.radialOf(BF, a);
  return G.unit3(G.sub3(rad, G.mul3(BF.a, bodySlope(s))));
}
// plank seams along the body and staggered butt joints, faded toward the limb
function bodyLines() {
  const list = [];
  const facing = (s, a) => G.dot3(normalAt(s, a), V);
  const alphaOf = (f) => Math.max(0.06, fade(f, [0, 0.38]));
  for (const i of strips) {
    const a = i * PLANK_DEG * deg;
    // sample along s; keep the visible runs, ending exactly on the limb
    const step = 2;
    let prev = null;
    for (let s = 0.6; s <= BODY.len - 0.6 + 1e-6; s += step) {
      const sc = Math.min(s, BODY.len - 0.6);
      const f = facing(sc, a);
      const cur = { s: sc, f };
      if (prev) {
        let p0 = prev;
        let p1 = cur;
        if (p0.f > 0 || p1.f > 0) {
          if (p0.f <= 0) p0 = { s: p0.s + (p1.s - p0.s) * (p0.f / (p0.f - p1.f)), f: 0 };
          if (p1.f <= 0) p1 = { s: p0.s + (p1.s - p0.s) * (p0.f / (p0.f - p1.f)), f: 0 };
          list.push({ d: path3([surfacePoint(p0.s, a), surfacePoint(p1.s, a)]), alpha: alphaOf((p0.f + p1.f) / 2) });
        }
      }
      prev = cur;
    }
    // butt joints across this strip
    for (const s of jointsOf(i)) {
      const a1 = (i + 1) * PLANK_DEG * deg;
      const f0 = facing(s, a);
      const f1 = facing(s, a1);
      if (f0 <= 0 && f1 <= 0) continue;
      let b0 = a;
      let b1 = a1;
      if (f0 <= 0) b0 = a + (a1 - a) * (f0 / (f0 - f1));
      if (f1 <= 0) b1 = a + (a1 - a) * (f0 / (f0 - f1));
      const pts = Array.from({ length: 5 }, (_, j) => surfacePoint(s, b0 + ((b1 - b0) * j) / 4));
      list.push({ d: path3(pts), alpha: alphaOf(Math.min(Math.max(f0, 0), Math.max(f1, 0)) + 0.02) });
    }
  }
  return list;
}
// planks overlap: a thin shadow strip under each seam on the lit flank reads as lapped boards
function lapShadows() {
  const out = [];
  for (const i of strips) {
    const a = i * PLANK_DEG * deg;
    const b = a - 1.1 * deg;
    const pts = [];
    for (let s = 6; s <= BODY.len - 6; s += 3) if (G.dot3(normalAt(s, a), V) > 0.22) pts.push(s);
    if (pts.length < 3) continue;
    const top = pts.map((s) => surfacePoint(s, a));
    const bot = [...pts].reverse().map((s) => surfacePoint(s, b));
    out.push(path3([...top, ...bot], true));
  }
  return out.join("");
}
{
  const { turned } = HM;
  const lines = bodyLines();
  const inner = `<g class="th-grain">${k.fadedSvg(lines, { tone: "lo" })}</g>`;
  // breast boss: a turned block where the chest boards meet, nailed round its rim
  const bossS = 122.4;
  const BOSS = [[bossS, 0], [bossS, 10.2], [bossS + 1.6, 10, 1], [bossS + 3.2, 7.4, 1], [bossS + 3.9, 3.6, 1], [bossS + 4.1, 0]];
  const bossDots = G.dotsOf(BF, bossS + 1.7, 8.6, 10, P, { fade: [0.04, 0.42] });
  HM.turned("boss", BF, BOSS, { tone: "mid" }, { extra: Dots(bossDots, { size: 0.45, tone: "hi" }), meta: { seated: true }, ref: G.pointOf(BF, bossS + 2, 0, 0) });
  turned("body", BF, BODY_PROFILE, { tone: "hi" }, { smooth: { slope: bodySlope }, steps: 120, inner: `<path class="th-lap" d="${lapShadows()}"/>` + inner, ref: [0, 0, BODY.z] });
}

// ---------------------------------------------------------------- neck, head, ears, mane
const NECK_DIR = G.unit3([Math.cos(60 * deg), 0, Math.sin(60 * deg)]);
const NF = G.frameOf([36, 0, 132], NECK_DIR, [0, 1, 0], G.cross3(NECK_DIR, [0, 1, 0]));
const NECK_LEN = 104;
const NECK_TOP = 94;
const NECK_S0 = -12;
const neckAt = (s) => 19 - 8 * Math.pow(Math.max(0, s) / NECK_TOP, 0.9);
const neckR = (s) => (s < 0 ? neckAt(0) * Math.sqrt(Math.max(0, 1 - (s / NECK_S0) ** 2)) : s <= NECK_TOP ? neckAt(s) : neckAt(NECK_TOP) * Math.sqrt(Math.max(0, 1 - ((s - NECK_TOP) / (NECK_LEN - NECK_TOP)) ** 2)));
const NECK_PROFILE = Array.from({ length: 49 }, (_, i) => [NECK_S0 + (i / 48) * (NECK_LEN - NECK_S0), neckR(NECK_S0 + (i / 48) * (NECK_LEN - NECK_S0)), 1]);
const HEAD_DIR = G.unit3([Math.cos(-40 * deg), 0, Math.sin(-40 * deg)]);
const HO = G.pointOf(NF, 92, 0, 0);
const HF = G.frameOf(HO, HEAD_DIR, [0, 1, 0], G.cross3(HEAD_DIR, [0, 1, 0]));
// head: a rounded poll behind s = 0, the cheek, a slight dish, and a blunt muzzle
const HEAD_S0 = -9;
const HEAD_LEN = 60;
const headR = (s) => {
  if (s < 0) return 14 * Math.sqrt(Math.max(0, 1 - (s / HEAD_S0) ** 2));
  if (s <= 50) return 14 - 5 * Math.pow(s / 50, 0.95) - 1.1 * Math.sin((s / 50) * Math.PI);
  return 9 * Math.sqrt(Math.max(0, 1 - ((s - 50) / 10) ** 2));
};
const HEAD_PROFILE = Array.from({ length: 49 }, (_, i) => [HEAD_S0 + (i / 48) * (HEAD_LEN - HEAD_S0), headR(HEAD_S0 + (i / 48) * (HEAD_LEN - HEAD_S0)), 1]);
const HEAD_SHAPE = A.solid(HF, HEAD_PROFILE, { name: "head.cut", piece: "horse" });
const NECK_SHAPE = A.solid(NF, NECK_PROFILE, { name: "neck.cut", piece: "horse" });
// "up" on the neck and head: v points up from the axis
const NECK_UP = Math.PI / 2;
const sideLines = (F, radius, from, s1, count, phase = 0) => {
  const list = [];
  for (let j = 0; j < count; j++) {
    const a = phase + (j / count) * Math.PI * 2;
    const s0 = typeof from === "function" ? from(a) : from;
    let run = [];
    const flush = () => {
      if (run.length > 1) list.push({ d: path3(run.map((p) => p.p)), alpha: Math.max(0.06, fade(Math.min(...run.map((p) => p.f)) + 0.05, [0, 0.38])) });
      run = [];
    };
    for (let s = s0; s <= s1 + 1e-6; s = s + 2 > s1 && s < s1 ? s1 : s + 2) {
      const sl = (radius(Math.min(s1, s + 0.05)) - radius(Math.max(s0, s - 0.05))) / 0.1;
      const f = G.facingOf(F, a, P, sl);
      if (f > 0.02) run.push({ p: G.pointOf(F, s, radius(s), a), f });
      else flush();
    }
    flush();
  }
  return list;
};
// A turned part that grows out of a host (the neck from the chest, the head from the neck, an ear
// from the poll): it is drawn after the host but clipped along their true intersection, with a
// seam where they meet, and recorded as the part minus its host.
function emerging(name, F, profile, rFn, sIn, sOut, host, { tone = "hi", steps, grain = 0, phase = 0 } = {}) {
  const dir = Math.sign(sOut - sIn);
  const sJ = (a) => {
    let lo = sIn;
    let hi = sOut;
    if (A.sdf(host, G.pointOf(F, lo, rFn(lo), a)) >= 0) return lo;
    for (let i = 0; i < 36; i++) {
      const m = (lo + hi) / 2;
      if (A.sdf(host, G.pointOf(F, m, rFn(m), a)) < 0) lo = m;
      else hi = m;
    }
    return hi;
  };
  const c = G.angleToward(F, V);
  const span = (m, n) => Array.from({ length: n + 1 }, (_, i) => c - Math.PI / 2 - m + ((Math.PI + 2 * m) * i) / n);
  const seamA = span(0, 72);
  const seam = path3(seamA.map((a) => G.pointOf(F, sJ(a), rFn(sJ(a)), a)));
  const clipA = span(0.14, 72);
  const rMax = Math.max(...profile.map((p) => p[1]));
  const clip = [...clipA.map((a) => G.pointOf(F, sJ(a), rFn(sJ(a)) + 1.4, a)), ...[...clipA].reverse().map((a) => G.pointOf(F, sOut + dir * 120, rMax + 60, a))];
  const slope = (s) => (rFn(Math.min(Math.max(sIn, sOut) - 0.01, s + 0.05)) - rFn(Math.max(Math.min(sIn, sOut) + 0.01, s - 0.05))) / 0.1;
  const paths = G.solidOf(profile, F, P, { smooth: { slope }, ...(steps ? { steps } : {}) });
  const lines = grain ? `<g class="th-grain">${k.fadedSvg(sideLines(F, rFn, sJ, Math.max(sIn, sOut) - (dir > 0 ? 6 : 0), grain, phase), { tone: "lo" })}</g>` : "";
  const id = `th-${name.replace(/[^\w]/g, "-")}`;
  const shape = HORSE.record(A.solid(F, profile, { name, owner: "horse", seated: true, cut: [host] }));
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  HORSE.put(name, G.add3(F.o, G.mul3(F.a, mid)), `<clipPath id="${id}"><path d="${path3(clip, true)}"/></clipPath><g clip-path="url(#${id})">${S(paths, { tone, inner: lines })}</g>${Ln(seam, { tone: "mid" })}`, [shape]);
  return shape;
}
{
  const { turned, prism } = HM;
  emerging("neck", NF, NECK_PROFILE, neckR, NECK_S0, NECK_LEN, BODY_CUT, { steps: 96, grain: 22, phase: 0.12 });
  emerging("head", HF, HEAD_PROFILE, headR, HEAD_S0, HEAD_LEN, NECK_SHAPE, { steps: 80, grain: 20, phase: 0.2 });
  // mane: a ridge of short upright boards down the neck's crest
  for (let j = 0; j < 12; j++) {
    const s = 88 - j * 6.2;
    const base = G.pointOf(NF, s, neckR(s) - 0.35, NECK_UP);
    const out = G.radialOf(NF, NECK_UP);
    const F = G.frameOf(base, out, NF.a, [0, 1, 0]);
    const h = 9 + ((j * 7) % 5) + (j < 3 ? 2 : 0);
    prism(`mane.${j}`, F, [[-2.7, -1.1], [2.7, -1.1], [2.7, 1.1], [-2.7, 1.1]], 0, h, { tone: "hi" }, { meta: { seated: true } });
  }
  // ears: pointed turned cones standing up from the poll
  for (const sy of [-1, 1]) {
    const base = G.pointOf(HF, 2, headR(2) - 3, Math.PI / 2 + sy * 0.5);
    const dir = G.unit3([-0.12, sy * 0.24, 1]);
    const earR = (s) => (s <= 4 ? 4.4 + 0.05 * s : s <= 16 ? 4.6 * Math.pow(1 - (s - 4) / 14, 0.8) : 4.6 * Math.pow(2 / 14, 0.8) * Math.sqrt(Math.max(0, 1 - (s - 16) / 2)));
    const EP = Array.from({ length: 19 }, (_, i) => [i, earR(i), 1]);
    emerging(`ear.${sy}`, G.frameAlong(base, dir), EP, earR, 0, 18, HEAD_SHAPE, { tone: "hi" });
  }
  // eye: a turned boss on the near cheek
  const eyeAt = G.pointOf(HF, 12, headR(12) - 0.6, 0.35);
  turned("eye", G.frameAlong(eyeAt, G.radialOf(HF, 0.35)), [[0, 2.8], [1.4, 2.8, 1], [2, 1.6, 1], [2.3, 0]], { tone: "mid" }, { meta: { seated: true } });
}

// ---------------------------------------------------------------- halter, bridle, lead rope, tail, hanging ropes
const ringAround = (F, s, r, n = 40) => Array.from({ length: n }, (_, i) => G.pointOf(F, s, r, (i / n) * Math.PI * 2));
const NOSE_S = 44;
const HEADSTALL_S = 20;
const BAND_W = 2.4;
const CHIN = G.pointOf(HF, NOSE_S, headR(NOSE_S) + 1.1, -Math.PI / 2 + 0.25);
const RING_R = 2.1;
const LEAD_R = 1.25;
const LEAD_START = G.add3(CHIN, [0, 0, -Math.sqrt(RING_R * RING_R - LEAD_R * LEAD_R)]);
{
  const { ball, rope } = HM;
  // rope bands round the muzzle and behind the cheek: turned rings lying on the head, twisted strands on them
  for (const [name, s] of [["halter.nose", NOSE_S], ["halter.poll", HEADSTALL_S]]) {
    const s0 = s - BAND_W / 2;
    const s1 = s + BAND_W / 2;
    const rIn = Math.max(headR(s0), headR(s1)) + 0.02;
    const rOut = Math.max(headR(s0), headR(s1)) + 2.0;
    const strands = k.fadedSvg(G.ribsOf(HF, s0, s1, rOut, 34, P, { twist: 0.42, fade: [0.1, 0.55] }), { tone: "lo" });
    const shape = HORSE.record(A.ring(HF, s0, s1, rIn, rOut, { name, owner: "horse" }));
    HORSE.put(name, G.pointOf(HF, s, rOut, 0), `<g class="th-rope">${S(G.ringBand(s0, s1, rIn, rOut, HF, P), { tone: "mid", inner: strands })}</g>`, [shape]);
  }
  // cheek ropes, each end flush on a band's face
  for (const a of [0.2, Math.PI - 0.2]) {
    const sa = HEADSTALL_S + BAND_W / 2;
    const sb = NOSE_S - BAND_W / 2;
    const pts = Array.from({ length: 9 }, (_, i) => {
      const s = sa + ((sb - sa) * i) / 8;
      return G.pointOf(HF, s, headR(s) + 1.2, a);
    });
    rope(`halter.cheek.${a > 1 ? "far" : "near"}`, pts, 0.85, { touch: ["head", "halter*", "eye"], maxLength: 10, bend: 30 });
  }
  ball("halter.ring", CHIN, RING_R, { tone: "lo" }, { meta: { seated: true } });
}
// the lead rope at rest: hangs from the chin ring to the sand ahead and runs on along the ground
const LEAD = { slackEnd: [CHIN[0] + 30, 34, 1.2], tautEnd: [CHIN[0] + 64, 10, 14] };
function leadRoute(t) {
  const a = LEAD_START;
  const n = 26;
  const pts = [];
  const slack = [];
  // slack: drop almost vertically, curve onto the sand, then lie along it with a gentle wave
  const drop = [a[0] + 8, a[1] + 1, LEAD_R + 0.05];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const c = [a[0] + 2, a[1] + 1, 18];
    const q = (p0, p1, p2) => p0 * (1 - u) * (1 - u) + 2 * p1 * u * (1 - u) + p2 * u * u;
    slack.push([q(a[0], c[0], drop[0]), q(a[1], c[1], drop[1]), Math.max(LEAD_R + 0.05, q(a[2], c[2], drop[2]))]);
  }
  for (let i = 1; i <= n - 14; i++) {
    const u = i / (n - 14);
    slack.push([drop[0] + (LEAD.slackEnd[0] - drop[0]) * u + 5 * Math.sin(u * Math.PI), drop[1] + (LEAD.slackEnd[1] - drop[1]) * u, LEAD_R + 0.05 + (LEAD_R * 0.55) * Math.max(0, (u - 0.8) / 0.2)]);
  }
  const taut = slack.map((_, i) => {
    const u = i / (slack.length - 1);
    const sag = 7 * u * (1 - u);
    return [a[0] + (LEAD.tautEnd[0] - a[0]) * u, a[1] + (LEAD.tautEnd[1] - a[1]) * u, a[2] + (LEAD.tautEnd[2] - a[2]) * u - sag];
  });
  for (let i = 0; i < slack.length; i++) pts.push(G.lerp3(slack[i], taut[i], t));
  return pts;
}
// tail: three frayed ropes from a turned block on the rump, each ending in a whipped knot
{
  const { rope, turned } = HM;
  const sT = 9;
  const aT = 72 * deg;
  const n = normalAt(sT, aT);
  const base = surfacePoint(sT, aT);
  const TF = G.frameAlong(base, n);
  turned("tail.block", TF, [[-3, 6], [2.4, 6], [3.1, 5.3, 1], [3.4, 4.3], [3.4, 0]], { tone: "mid" }, { meta: { seated: true, cut: [BODY_CUT] }, extra: Dots(G.dotsOf(TF, 1.2, 6, 8, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "hi" }) });
  const face = G.add3(base, G.mul3(n, 3.4));
  const side = G.unit3(G.cross3(n, [1, 0, 0]));
  [-1.9, 0, 1.9].forEach((o, j) => {
    const r0 = G.add3(face, G.mul3(side, o));
    const r1 = G.add3(r0, G.mul3(n, 7));
    const drop = [r1[0] - 9 - j, r1[1] + o * 1.5, r1[2] - 12];
    rope(`tail.${j}`, [r0, r1, drop, [drop[0] - 3 + j * 2, drop[1] + o * 1.2, drop[2] - 26], [drop[0] - 1 + j * 3, drop[1] + o * 1.8, drop[2] - 50 + j * 5]], 1.4, { bend: 9, ends: [false, true], touch: ["tail*", "body"], meta: { limp: false } });
  });
}
// hanging ropes: lashed knee to knee along each side, and shin to shin across under the belly
{
  const { rope } = HM;
  const sag = (a, b, depth, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const ch = Math.cosh((u - 0.5) * 2.2);
    const c0 = Math.cosh(1.1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u - depth * (c0 - ch) / (c0 - 1)];
  });
  // each end leaves its leg radially between two turns of the lashing, and is tied there
  const tie = (a, dir, len = 5) => [a, G.add3(a, G.mul3(dir, len))];
  for (const y of [-LEG_Y, LEG_Y]) {
    const a = [LEG_X[1] - LEG_R, y, TIE.knee];
    const z = [LEG_X[0] + LEG_R, y, TIE.knee];
    const [a0, a1] = tie(a, [-1, 0, 0]);
    const [z0, z1] = tie(z, [1, 0, 0]);
    rope(`swag.side.${y}`, [a0, ...sag(a1, z1, 30).slice(0, -1), z1, z0].filter((p, i, arr) => i === 0 || G.len3(G.sub3(p, arr[i - 1])) > 0.01), 1.1, { touch: ["lash*", `leg.${LEG_X[1]}.${y}`, `leg.${LEG_X[0]}.${y}`], maxLength: 10, bend: 5 });
  }
  for (const x of LEG_X) {
    const a = [x, LEG_Y - LEG_R, TIE.shin];
    const z = [x, -LEG_Y + LEG_R, TIE.shin];
    rope(`swag.cross.${x}`, [a, ...sag(G.add3(a, [0, -3, 0]), G.add3(z, [0, 3, 0]), 7, 8), z], 1.1, { touch: ["lash*", `leg.${x}.${LEG_Y}`, `leg.${x}.${-LEG_Y}`], maxLength: 6, bend: 3 });
  }
}
// lead rope (rest pose): recorded for the audit; the page redraws it as it goes taut
HM.rope("lead", leadRoute(0), LEAD_R, { bend: 6, maxLength: 12, touch: ["halter*", "head", "stand.ground"], ends: [false, true], meta: { free: [false, true], limp: false } });

// ---------------------------------------------------------------- the gate: towers, imposts, arch, spandrel
const stone = (s) => `<g class="th-stone">${s}</g>`;
const COURSE = 16;
function towerLines(plan, z0, z1) {
  const out = [];
  for (let z = z0 + COURSE; z < z1 - 1; z += COURSE) out.push(k.sideSeam(plan, z, P, 2));
  // head joints on each visible face, staggered course by course, ending on the course lines
  let row = 0;
  for (let z = z0; z < z1 - 1; z += COURSE, row++) {
    const za = z;
    const zb = Math.min(z + COURSE, z1);
    const off = (row % 2) * 12;
    for (let x = plan.x + 12 + off; x < plan.x + plan.w - 4; x += 24) out.push(k.segment([x, plan.y + plan.d, za], [x, plan.y + plan.d, zb], P));
    for (let y = plan.y + 10 + off; y < plan.y + plan.d - 4; y += 24) out.push(k.segment([plan.x + plan.w, y, za], [plan.x + plan.w, y, zb], P));
  }
  return out.join("");
}
function tower(name, y0, y1) {
  const plan = { x: TOWER.x0, y: y0, w: TOWER.x1 - TOWER.x0, d: y1 - y0, r: 0.6 };
  const { box } = GM;
  HALOS.gate.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, -4), 0, 0.1, P)}"/>`);
  // plinth course, shaft, cornice, merlons
  box(`${name}.plinth`, [plan.x - 3, y0 - 3, 0], [plan.x + plan.w + 3, y1 + 3, 10], { tone: "mid" }, { r: 0.6, bevel: 0.5 });
  const shaft = { x: plan.x, y: y0, w: plan.w, d: y1 - y0, r: 0.6 };
  const slit = (x, y, face) =>
    face === "x"
      ? path3([[TOWER.x1 + 0.05, y - 1.6, 200], [TOWER.x1 + 0.05, y + 1.6, 200], [TOWER.x1 + 0.05, y + 1.6, 224], [TOWER.x1 + 0.05, y - 1.6, 224]], true)
      : path3([[x - 1.6, y1 + 0.05, 150], [x + 1.6, y1 + 0.05, 150], [x + 1.6, y1 + 0.05, 174], [x - 1.6, y1 + 0.05, 174]], true);
  box(`${name}.shaft`, [plan.x, y0, 10], [plan.x + plan.w, y1, TOWER.h - 14], { tone: "mid" }, {
    r: 0.6,
    inner: Ln(towerLines(shaft, 10, TOWER.h - 14), { tone: "lo" }),
    extra: `<path class="th-slit" d="${slit(0, (y0 + y1) / 2, "x")}"/>` + (name.endsWith("near") ? `<path class="th-slit" d="${slit(15, 0, "y")}"/>` : ""),
  });
  box(`${name}.cornice`, [plan.x - 3, y0 - 3, TOWER.h - 14], [plan.x + plan.w + 3, y1 + 3, TOWER.h], { tone: "mid" }, { r: 0.6, bevel: 0.5 });
  // merlons evenly round the parapet, one on each corner
  const MW = 7;
  const x0 = plan.x - 3;
  const x1 = plan.x + plan.w + 3 - MW;
  const y0m = y0 - 3;
  const y1m = y1 + 3 - MW;
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const mer = new Map();
  for (const px of lin(x0, x1, 4)) for (const py of [y0m, y1m]) mer.set(`${px.toFixed(1)},${py.toFixed(1)}`, [px, py]);
  for (const py of lin(y0m, y1m, 4)) for (const px of [x0, x1]) mer.set(`${px.toFixed(1)},${py.toFixed(1)}`, [px, py]);
  [...mer.values()].forEach(([px, py], j) => box(`${name}.merlon.${j}`, [px, py, TOWER.h], [px + MW, py + MW, TOWER.h + 13], { tone: "mid" }, { r: 0.4, bevel: 0.4 }));
}
tower("tower.far", -TOWER.y1, -TOWER.y0);
tower("tower.near", TOWER.y0, TOWER.y1);
{
  const { box, prism } = GM;
  // imposts the arch springs from
  for (const sy of [-1, 1]) {
    const ya = sy > 0 ? GATE.inner : -GATE.half;
    const yb = sy > 0 ? GATE.half : -GATE.inner;
    box(`impost.${sy}`, [GATE.x0 - 1, ya, DOOR.impost], [GATE.x1 + 1, yb, GATE.spring], { tone: "mid" }, { r: 0.4, bevel: 0.4 });
  }
  // voussoirs: eleven wedges and a proud keystone (drawn with the spandrel as one arch, below)
}
// the spandrel wall above the arch: one face with the arch cut from it, drawn by hand
const SPAN_TOP = TOWER.h - 30;
const spandrel = (() => {
  const xf = GATE.x1;
  const arc = [];
  for (let j = 0; j <= 11; j++) {
    const a = (j / 11) * Math.PI;
    const key = j === 5 || j === 6;
    const r = GATE.outer;
    arc.push([r * Math.cos(a), GATE.spring + r * Math.sin(a)]);
    if (key && j === 5) {
      const a5 = (5 / 11) * Math.PI;
      const a6 = (6 / 11) * Math.PI;
      arc.push([(r + 4) * Math.cos(a5), GATE.spring + (r + 4) * Math.sin(a5)], [(r + 4) * Math.cos(a6), GATE.spring + (r + 4) * Math.sin(a6)]);
    }
  }
  const face = [[GATE.half, GATE.spring], [GATE.half, SPAN_TOP], [-GATE.half, SPAN_TOP], [-GATE.half, GATE.spring], ...arc.slice().reverse()].map(([y, z]) => [xf, y, z]);
  const tone = G.toneOf([1, 0, 0], P);
  const top = [[GATE.x0, -GATE.half, SPAN_TOP], [GATE.x1, -GATE.half, SPAN_TOP], [GATE.x1, GATE.half, SPAN_TOP], [GATE.x0, GATE.half, SPAN_TOP]];
  // stone courses run from tower to arch
  const lines = [];
  for (let z = GATE.spring + COURSE; z < SPAN_TOP - 1; z += COURSE) {
    const yArc = Math.sqrt(Math.max(0, GATE.outer ** 2 - (z - GATE.spring) ** 2));
    if (z - GATE.spring < GATE.outer) {
      lines.push(path3([[xf, -GATE.half, z], [xf, -yArc, z]]), path3([[xf, yArc, z], [xf, GATE.half, z]]));
    } else lines.push(path3([[xf, -GATE.half, z], [xf, GATE.half, z]]));
  }
  // the parapet walk: a coping course on top
  const svg =
    `<path class="iso-fill" d="${path3(face, true)}"/><path class="iso-shade" data-shade="${Math.min(3, tone)}" d="${path3(face, true)}"/>` +
    `<path class="iso-top" d="${path3(top, true)}"/>` +
    Ln(lines.join(""), { tone: "lo" }) +
    `<path class="iso-line iso-edge" data-tone="hi" d="${path3([[xf, -GATE.half, GATE.spring], [xf, -GATE.half, SPAN_TOP], [GATE.x0, -GATE.half, SPAN_TOP], [GATE.x0, GATE.half, SPAN_TOP], [xf, GATE.half, SPAN_TOP], [xf, GATE.half, GATE.spring]])}"/>` +
    `<path class="iso-line" data-tone="faint" d="${path3([[xf, -GATE.half, SPAN_TOP], [xf, GATE.half, SPAN_TOP]])}"/>`;
  return svg;
})();
{
  // the arch: the spandrel wall, then the voussoirs far to near, the keystone last. One item, whose
  // true shape is the wedges plus one column of wall above each of them.
  const AF = G.frameOf([GATE.x0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const VF = G.frameOf([GATE.x0, 0, GATE.spring], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const cols = [];
  const wedges = [];
  for (let j = 10; j >= 0; j--) {
    if (j === 5) continue;
    wedges.push(j);
  }
  wedges.push(5);
  const wedgeSvg = wedges
    .map((j) => {
      const a0 = (j / 11) * Math.PI;
      const a1 = ((j + 1) / 11) * Math.PI;
      const key = j === 5;
      const ro = key ? GATE.outer + 4 : GATE.outer;
      const poly = [[GATE.inner * Math.cos(a0), GATE.inner * Math.sin(a0)], [ro * Math.cos(a0), ro * Math.sin(a0)], [ro * Math.cos(a1), ro * Math.sin(a1)], [GATE.inner * Math.cos(a1), GATE.inner * Math.sin(a1)]];
      cols.push(GATEW.record(A.prism(VF, poly, key ? -1.5 : 0, key ? GATE.x1 + 1.5 : GATE.x1, { name: `voussoir.${j}`, owner: "gate" })));
      return S(G.prismOf(VF, poly, key ? -1.5 : 0, key ? GATE.x1 + 1.5 : GATE.x1, P), { tone: "mid" });
    })
    .join("");
  for (let j = 0; j < 11; j++) {
    const a0 = (j / 11) * Math.PI;
    const a1 = ((j + 1) / 11) * Math.PI;
    const ro = j === 5 ? GATE.outer + 4 : GATE.outer;
    const p0 = [ro * Math.cos(a0), GATE.spring + ro * Math.sin(a0)];
    const p1 = [ro * Math.cos(a1), GATE.spring + ro * Math.sin(a1)];
    cols.push(GATEW.record(A.prism(AF, [p0, [p0[0], SPAN_TOP], [p1[0], SPAN_TOP], p1], GATE.x0, GATE.x1, { name: `spandrel.${j}`, owner: "gate" })));
  }
  GATEW.put("arch", [GATE.x1, 0, 240], `<g class="iso-solid">${spandrel}</g>${wedgeSvg}`, cols);
}

// ---------------------------------------------------------------- settle both assemblies
A.settle(HORSE.R, P);
HORSE.R.items.sort((a, b) => a.key - b.key);
if (process.env.PAIR) {
  const [na, nb] = process.env.PAIR.split(",");
  const items = HORSE.R.items.filter((it) => it.name === na || it.name === nb);
  const o = A.overlapsOf(items, P, {});
  o.pairs.forEach((p) => console.log(items[p.a].name, items[p.b].name, JSON.stringify(p.front)));
}
if (process.env.ORDER) HORSE.R.items.forEach((it, i) => new RegExp(process.env.ORDER).test(it.name) && console.log(i, it.name, it.key.toFixed(2)));
A.settle(GATEW.R, P);
GATEW.R.items.sort((a, b) => a.key - b.key);

const UPPER = /^(neck|head(?!er)|ear|eye|mane|halter|lead)/;
const hItems = HORSE.R.items;
const lowSvg = [];
const upSvg = [];
hItems.forEach((item) => {
  if (/^lead/.test(item.name)) return; // the page draws the lead rope in its own layer
  (UPPER.test(item.name) ? upSvg : lowSvg).push(`<g data-n="${item.name}">${item.svg}</g>`);
});

// upper sample points, for the page to decide whether the head is still under the arch
const UP_SAMPLES = [];
for (let s = 0; s <= NECK_LEN; s += 6) for (const a of [Math.PI / 2, 0, Math.PI]) UP_SAMPLES.push(G.pointOf(NF, s, neckR(s) + (a === Math.PI / 2 ? 14 : 0), a));
for (let s = HEAD_S0; s <= HEAD_LEN; s += 6) for (const a of [Math.PI / 2, 0, Math.PI]) UP_SAMPLES.push(G.pointOf(HF, s, headR(s), a));
for (const sy of [-1, 1]) UP_SAMPLES.push(G.add3(G.pointOf(HF, 2, headR(2) - 3, Math.PI / 2 + sy * 0.5), G.mul3(G.unit3([-0.12, sy * 0.24, 1]), 18)));

const gItems = GATEW.R.items;
const gateSvg = (re) => gItems.filter((it) => re.test(it.name)).map((it) => `<g data-n="${it.name}">${it.svg}</g>`).join("");

// The figure is a stack of SVG layers with one viewBox. Static layers never repaint; the horse
// layers move by a compositor transform, and the page changes their z-index to put the horse
// behind or in front of the arch and the near tower.
const LABEL =
  "A wooden horse of weathered grey planks stands on a wheeled platform outside a city gate of two stone towers and an arch. Pulled by its lead rope it rolls in through the open timber doors, which close behind it. At night a hatch in its flank swings down, a rope ladder unrolls and six soldiers climb out and run back to open the gate from inside.";
const layer = (name, body, { cls = "", first = false } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg th-layer ${cls}" data-layer="${name}" viewBox="0 0 ${W} ${H}"${first ? ` role="img" aria-label="${LABEL}"` : ` aria-hidden="true"`}>${body}</svg>`;
const layers = [
  layer("back", ground.join("") + HALOS.gate.join("") + `<g class="th-stone">${gateSvg(/^tower\.far/)}</g>`, { first: true }),
  layer("door-far", `<g data-part="door-far" class="th-door"></g>`),
  layer("arch", `<g class="th-stone">${gateSvg(/^(impost|arch)/)}</g>`),
  layer("tower-near", `<g class="th-stone">${gateSvg(/^tower\.near/)}</g>`),
  layer("door-near", `<g data-part="door-near" class="th-door"></g>`),
  layer("horse-low", HALOS.horse.join("") + `<g class="th-wood">${lowSvg.join("")}</g>`, { cls: "th-move" }),
  layer("wheels", `<g class="th-wood">${AXLE_X.map((x) => `<g data-part="wheel-face" data-x="${x}"></g>`).join("")}</g>`, { cls: "th-move" }),
  layer("hatch", `<g class="th-wood"><g data-part="hatch"></g><g data-part="ladder"></g></g>`, { cls: "th-move" }),
  layer("horse-up", `<g class="th-wood">${upSvg.join("")}</g>`, { cls: "th-move" }),
  layer("lead", `<g class="th-wood"><g data-part="lead"></g></g>`, { cls: "th-move" }),
];
const svg = `<div class="th-layers" style="aspect-ratio:${W} / ${H}"><div class="th-scene">${layers.join("")}</div>${layer("soldiers", `<g data-part="soldiers"></g>`, { cls: "th-top" })}</div>`;

// ---------------------------------------------------------------- data for the page
const DATA = {
  P,
  V,
  M,
  X0,
  X1,
  CLEAR,
  SWEEP,
  WHEEL_R,
  WHEEL_Y,
  AXLE_X,
  GATE,
  DOOR,
  TOWER,
  BODY,
  PLANK_DEG,
  HATCH,
  BF,
  CHIN,
  LEAD_START,
  LEAD,
  LEAD_R,
  rear: PLAT.x,
  W,
  upSamples: UP_SAMPLES.map((p) => p.map(f2)),
};

const CSS = readFileSync(join(HERE, "trojan.css"), "utf8");
const latheSource = readFileSync(join(SKILL, "kit", "lathe.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const tubeSource = readFileSync(join(SKILL, "kit", "tube.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const exportsOf = (file) => [...readFileSync(join(SKILL, "kit", file), "utf8").matchAll(/^export (?:function|const|let) (\w+)/gm)].map((m) => m[1]);
const libScript = `const G = (() => {${latheSource}\nreturn { ${exportsOf("lathe.mjs").join(", ")} };})();\nconst T = (() => {${tubeSource}\nreturn { ${exportsOf("tube.mjs").join(", ")} };})();\n`;
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__LEADROUTE__", leadRoute.toString());

const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig. 1 — The Trojan Horse",
    title: "A gift on wheels",
    hint: "Drag the rope to pull · press N for night",
    readout: "0.0 m · 0.00 turns · gate open · 6 inside / 0 out",
    keys: [
      { mark: "raised", label: "The gift: grey plank horse on a four-wheeled cart, legs lashed with rope" },
      { mark: "lit", label: "What it hides: six soldiers behind a hatch whose seams are plank joints" },
      { mark: "edge", label: "The gate: two timber leaves in a stone arch, closed once the cart is clear" },
    ],
    caption:
      "The trick needs the city to do the work. The horse is a sealed gift on wheels, so the defenders pull it in themselves and shut the gate behind it, which puts the danger inside their own wall. The hatch is cut along the boards' own butt joints, so nothing shows until it opens. At night it swings down on its hinges, a rope ladder unrolls, and the soldiers climb out and unbar the gate from the inside. The cart's wheels are 1.3 m across and roll without slipping: one turn for every 4.08 m pulled.",
    body: `<div class="iso-stage th-stage" tabindex="0" role="slider" aria-label="Trojan horse. Drag or press the arrow keys to pull the lead rope; press N to switch night on or off." aria-valuemin="0" aria-valuemax="${((X1 - X0) / M).toFixed(1)}" aria-valuenow="0">${svg}<span class="th-sr" role="status" aria-live="polite" data-status></span></div><div class="th-controls"><button class="th-btn" type="button" data-night aria-pressed="false">Night · N</button></div>`,
  });

let page = k.pageHtml({ title: "The Trojan Horse", theme: THEME, body, script: kitScript() + libScript + LIVE, width: 700 });
// the default page follows the reader's system theme, set before first paint
if (THEME === "dark")
  page = page.replace(
    '<body class="iso" data-theme="dark">',
    `<body class="iso" data-theme="dark"><script>(()=>{const q=matchMedia("(prefers-color-scheme: light)");const set=()=>{document.body.dataset.theme=q.matches?"light":"dark"};set();q.addEventListener("change",set)})()</script>`,
  );
const out = THEME === "light" ? "trojan-horse-light.html" : "trojan-horse.html";
writeFileSync(join(HERE, out), page);
console.log("wrote", out, `${(page.length / 1024).toFixed(0)} KB`, `${hItems.length} horse items`, `${gItems.length} gate items`, `scale ${KS.toFixed(3)}`);

// the poll band and the head touch along the band's inner rim; 0.4 px² of the far half reads as in front
A.auditOrExit(HORSE.R, P, { allow: [["head", "halter.poll"]] });
A.auditOrExit(GATEW.R, P, {});
